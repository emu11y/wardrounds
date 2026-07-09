-- ============================================================================
-- rls_smoke_test_prod.sql  —  full RLS smoke test (PROD)
-- Project: WardRounds Production (ref bannxzyidkgmbejyrzea)
--
-- WHY: the app was built with RLS OFF. schema_prod.sql now ENABLES RLS on every
-- table with team-scoped policies (current_user_team_id() / current_user_role()).
-- Before cutover we must drive each real flow in the live app and confirm rows
-- land with NO "permission denied", then confirm team isolation holds.
--
-- HOW TO USE
--   0. Ensure schema_prod.sql's hardening block has been applied (RLS enabled,
--      anon revoked, policies created). This file only VERIFIES; it does not
--      create policies.
--   1. Sign in to https://wardrounds.site as the test admin.
--   2. For each section, perform the UI action listed, then run the query.
--   3. Every schema/policy fix you make in the SQL Editor must END WITH:
--        NOTIFY pgrst, 'reload schema';
--   4. Edge Functions (invite-team-member, scan-tag) use service_role and BYPASS
--      RLS — so test them from the UI, not with these queries.
--
-- Set the team once:
--   Replace <TEAM_ID> below, or run:
--     SELECT team_id FROM public.users WHERE email = 'youraddress+test4@gmail.com';
-- ============================================================================

-- Convenience: confirm your team id first.
SELECT id, email, role, team_id
FROM public.users
WHERE email = 'youraddress+test4@gmail.com';

-- ───────────────────────────────────────────────────────────────────────────
-- 0. RLS IS ACTUALLY ON  (belt-and-braces before functional tests)
-- ───────────────────────────────────────────────────────────────────────────
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
-- Expect: rowsecurity = true for ALL 17 app tables.

SELECT tablename, count(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
-- Expect: every table has >= 1 policy (teams/users have several).

-- Confirm anon has been revoked.
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'anon';
-- Expect: ZERO rows.

-- ───────────────────────────────────────────────────────────────────────────
-- FLOW 1 — Add a hospital + services   (UI: Settings/Hospitals → add hospital,
--          then add a ward/room service)
-- ───────────────────────────────────────────────────────────────────────────
SELECT id, name, location, status
FROM public.hospitals
WHERE team_id = '<TEAM_ID>'
ORDER BY created_at DESC;
-- Expect: your new hospital present.

SELECT hs.id, hs.service_name, hs.price_per_day, hs.service_type, h.name AS hospital
FROM public.hospital_services hs
JOIN public.hospitals h ON h.id = hs.hospital_id
WHERE h.team_id = '<TEAM_ID>'
ORDER BY hs.created_at DESC;
-- Expect: your new hospital_services row (scoped via parent hospital policy).

-- ───────────────────────────────────────────────────────────────────────────
-- FLOW 2 — Admit a patient   (UI: Admit Patient — optionally via tag scan)
-- ───────────────────────────────────────────────────────────────────────────
SELECT id, first_name, last_name, hospital_id, created_at
FROM public.patients
WHERE team_id = '<TEAM_ID>'
ORDER BY created_at DESC;

SELECT a.id, a.ward, a.status, a.admission_date, p.first_name, p.last_name
FROM public.admissions a
JOIN public.patients p ON p.id = a.patient_id
WHERE a.team_id = '<TEAM_ID>'
ORDER BY a.created_at DESC;
-- Expect: admission (status='admitted') + its patient.

-- Timeline: the 'admitted' event must exist (Invariant B: its date = admission_date).
SELECT te.event_type, te.ward, te.timestamp
FROM public.timeline_events te
JOIN public.admissions a ON a.id = te.admission_id
WHERE a.team_id = '<TEAM_ID>'
ORDER BY te.timestamp DESC;
-- Expect: an 'admitted' event for the new admission (child policy via admissions).

-- ───────────────────────────────────────────────────────────────────────────
-- FLOW 3 — Book an outpatient visit   (UI: Log Outpatient / New Visit)
-- ───────────────────────────────────────────────────────────────────────────
SELECT id, visit_date, status, consultation_fee, doctor_id, is_adhoc
FROM public.outpatient_visits
WHERE team_id = '<TEAM_ID>'
ORDER BY created_at DESC;
-- Expect: the visit row (also exercises the Appointments loader fix).

-- ───────────────────────────────────────────────────────────────────────────
-- FLOW 4 — Add a service   (UI: add a team service, then attach to an admission
--          and/or a visit)
-- ───────────────────────────────────────────────────────────────────────────
SELECT id, service_name, price, billing_type, status
FROM public.team_services
WHERE team_id = '<TEAM_ID>'
ORDER BY created_at DESC;

SELECT asv.service_name, asv.price, asv.billing_type, asv.added_at
FROM public.admission_services asv
JOIN public.admissions a ON a.id = asv.admission_id
WHERE a.team_id = '<TEAM_ID>'
ORDER BY asv.added_at DESC;
-- Expect: attached admission_services (child policy via admissions).

SELECT vs.service_name, vs.price, vs.added_at
FROM public.visit_services vs
JOIN public.outpatient_visits ov ON ov.id = vs.visit_id
WHERE ov.team_id = '<TEAM_ID>'
ORDER BY vs.added_at DESC;
-- Expect: attached visit_services (child policy via outpatient_visits).

-- ───────────────────────────────────────────────────────────────────────────
-- FLOW 5 — Generate an invoice   (UI: generate invoice for the admission)
-- ───────────────────────────────────────────────────────────────────────────
SELECT i.id, i.total_amount, i.generated_at, i.paid_at, i.pdf_path
FROM public.invoices i
JOIN public.admissions a ON a.id = i.admission_id
WHERE a.team_id = '<TEAM_ID>'
ORDER BY i.generated_at DESC;
-- Expect: the invoice (child policy via admissions).

-- ───────────────────────────────────────────────────────────────────────────
-- FLOW 6 — Invite a team member   (UI: Team → invite. Uses invite-team-member
--          Edge Function = service_role, BYPASSES RLS. Verify the row lands.)
-- ───────────────────────────────────────────────────────────────────────────
SELECT id, email, full_name, role, status, invited_at
FROM public.users
WHERE team_id = '<TEAM_ID>'
ORDER BY created_at DESC;
-- Expect: invited member row (status likely 'active'/pending per app logic).

-- ───────────────────────────────────────────────────────────────────────────
-- FLOW 7 — Tag scanner end-to-end   (UI: Admit/New Visit → scan a hospital tag)
--          scan-tag Edge Function + CLAUDE_API_KEY. Confirm extracted fields
--          pre-fill and the resulting patient/admission persisted (Flow 2 rows).
-- ───────────────────────────────────────────────────────────────────────────
-- No dedicated table — verify via the patients/admissions rows created above.

-- ───────────────────────────────────────────────────────────────────────────
-- FLOW 8 — Activity logging   (writes happen on most actions above)
-- ───────────────────────────────────────────────────────────────────────────
SELECT action, entity_type, user_email, created_at
FROM public.activity_logs
WHERE team_id = '<TEAM_ID>'
ORDER BY created_at DESC
LIMIT 25;
-- Expect: log rows for the actions performed (admit, add_service, invoice, etc.).

-- ───────────────────────────────────────────────────────────────────────────
-- ISOLATION CHECK — nothing leaks across teams
-- (Run as the authenticated app user, NOT as service_role/SQL-editor-superuser.
--  The SQL Editor runs as a privileged role that bypasses RLS, so the truest
--  isolation test is in the app: a second team must never see team 1's data.
--  This query documents the invariant to verify manually.)
-- ───────────────────────────────────────────────────────────────────────────
-- Manual: sign in as a DIFFERENT team's user and confirm none of the rows above
-- are visible (patients, admissions, invoices, hospitals, services, logs).

-- ============================================================================
-- If any flow returns "permission denied for table ...":
--   1. Identify the table + operation (INSERT/SELECT/UPDATE/DELETE).
--   2. Check its policy in pg_policies; the team-scoped pattern is:
--        USING (team_id = current_user_team_id())
--        WITH CHECK (team_id = current_user_team_id())
--      or, for child tables, scoped through the parent (see schema_prod.sql).
--   3. Add/adjust the policy in the SQL Editor.
--   4. ALWAYS end with:  NOTIFY pgrst, 'reload schema';
--   5. Re-run the failing flow.
-- ============================================================================
