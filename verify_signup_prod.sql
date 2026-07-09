-- ============================================================================
-- verify_signup_prod.sql  —  fresh end-to-end signup verification (PROD)
-- Project: WardRounds Production (ref bannxzyidkgmbejyrzea)
-- Run in the Supabase SQL Editor AFTER completing a fresh signup on
-- https://wardrounds.site (use a Gmail +alias, e.g. youraddress+test4@gmail.com,
-- confirm the email, and land as admin with no re-login).
--
-- Set the alias once here, then run each section.
-- Expected: teams=1, users.role='admin' with team_id, team_positions=5,
-- user_permissions=0.
-- ============================================================================

-- >>> EDIT THIS: the exact email you signed up with <<<
--   (Section 1–5 reference it via the literal below — replace all occurrences.)

-- ─── 1. The auth + public user rows exist and are linked ─────────────────────
SELECT id, email, full_name, role, team_id, status, created_at
FROM public.users
WHERE email = 'youraddress+test4@gmail.com';
-- Expect: exactly 1 row · role = 'admin' · team_id NOT NULL · status='active'.

-- ─── 2. Exactly one team was created, admin points back to the user ──────────
SELECT t.id AS team_id, t.practice_name, t.doctor_name, t.admin_id, t.created_at
FROM public.teams t
JOIN public.users u ON u.team_id = t.id
WHERE u.email = 'youraddress+test4@gmail.com';
-- Expect: exactly 1 team row for this user's team_id.

-- ─── 3. Five default positions were seeded for the new team ──────────────────
SELECT name, sort_order, is_clinical
FROM public.team_positions
WHERE team_id = (SELECT team_id FROM public.users WHERE email = 'youraddress+test4@gmail.com')
ORDER BY sort_order;
-- Expect: 5 rows — Primary Doctor(1), Associate Doctor(2), Intern Doctor(3),
--         Accountant(4), Accounts Team(5).
-- NOTE (follow-up #6): the doctor positions currently seed is_clinical=false.
--   For multi-doctor practices they should be TRUE. Flag if still false.

-- ─── 4. No permission rows exist yet (admin is ungated by default) ───────────
SELECT count(*) AS permission_rows
FROM public.user_permissions
WHERE team_id = (SELECT team_id FROM public.users WHERE email = 'youraddress+test4@gmail.com');
-- Expect: 0.

-- ─── 5. Consolidated pass/fail summary ───────────────────────────────────────
WITH u AS (
  SELECT id, team_id, role FROM public.users
  WHERE email = 'youraddress+test4@gmail.com'
)
SELECT
  (SELECT count(*) FROM u)                                                  AS user_rows,        -- expect 1
  (SELECT role FROM u)                                                      AS role,             -- expect admin
  (SELECT team_id IS NOT NULL FROM u)                                       AS has_team,         -- expect true
  (SELECT count(*) FROM public.teams t WHERE t.id = (SELECT team_id FROM u))         AS team_rows,        -- expect 1
  (SELECT count(*) FROM public.team_positions p WHERE p.team_id = (SELECT team_id FROM u)) AS position_rows,    -- expect 5
  (SELECT count(*) FROM public.user_permissions up WHERE up.team_id = (SELECT team_id FROM u)) AS permission_rows; -- expect 0

-- ============================================================================
-- CLEANUP  —  run ONLY after verification passes. Deletes the test signup and
-- its team so PROD stays empty. Order respects FKs (children first).
-- Deleting the auth user must be done from Dashboard → Authentication → Users
-- (or via the admin API); the public rows are cleared here.
-- ============================================================================
-- DO $$
-- DECLARE v_team uuid; v_user uuid;
-- BEGIN
--   SELECT id, team_id INTO v_user, v_team FROM public.users
--   WHERE email = 'youraddress+test4@gmail.com';
--   IF v_user IS NULL THEN RAISE NOTICE 'No such test user — nothing to clean.'; RETURN; END IF;
--
--   DELETE FROM public.user_permissions WHERE team_id = v_team;
--   DELETE FROM public.team_positions   WHERE team_id = v_team;
--   DELETE FROM public.activity_logs    WHERE team_id = v_team;
--   DELETE FROM public.users            WHERE id = v_user;
--   DELETE FROM public.teams            WHERE id = v_team;
--   RAISE NOTICE 'Cleaned test user % and team %', v_user, v_team;
-- END $$;
-- -- Then delete the auth user in Dashboard → Authentication → Users.
