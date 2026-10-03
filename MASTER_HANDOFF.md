# WardRounds — MASTER HANDOFF (Governing Document)

> **This is the single governing document for WardRounds.** It merges every session handoff
> (Sessions 6–29, all dated July/August handoffs, the Billing-Rebuild and Timeline-Editor
> handoffs, `WHATSAPP_GOLIVE_STATE.md`, and the former README operating doc) into one place.
> All superseded files live in `docs/archive/` (repo) and the claude.ai Project knowledge base.
>
> ### 📖 READ-FIRST & UPDATE-LAST RULE (non-negotiable)
> **Start of every session:** read this whole file; recall the previous session from the top
> entry of the Work Log (§12).
> **End of every session:** update THIS file in place — prepend a Work Log entry (§12), tick
> phases (§10), append Lessons (§8), refresh Open Items (§9). **Never create a new per-session
> handoff file.** Keep secret *values* out — names/IDs only.
>
> _Created: 3 Oct 2026 (build resumed after ~8 weeks dormant). Last code commit: 10 Aug 2026._

---

## 0. CONTENTS
1. Session close-out guide · 2. Project overview & environments · 3. Current state snapshot ·
4. Feature inventory · 5. Data model reference · 6. Architecture & subsystems · 7. Rules ·
8. Lessons learnt · 9. Open items (consolidated) · 10. Roadmap & phases · 11. Dev commands ·
12. Work log · 13. Document index

---

## 1. SESSION CLOSE-OUT GUIDE — when Emu says *"let's close out the session"*

1. Produce a structured summary: **objectives · decisions · files touched · lessons · exact next steps** (ordered, copy-pasteable).
2. Include dev-server / restart instructions (§11).
3. Recall the previous Work Log entry for continuity.
4. Fold all findings into Open Items (§9) and Roadmap status (§10).
5. **Update this file in place** (prepend §12, tick §10, append §8, refresh §9).
6. Apply the Rules (§7) to everything.
7. Cowork sessions: also save a dated copy `WARDROUNDS_CLOSEOUT_YYYY-MM-DD.md` to **Downloads**, and update `MASTER_HANDOFF.md` in the claude.ai Project knowledge base.
8. Commit: `git add MASTER_HANDOFF.md && git commit -m "docs: master handoff YYYY-MM-DD" && git push origin dev`.

---

## 2. PROJECT OVERVIEW & ENVIRONMENTS

**WardRounds** — a clinical practice-management and billing PWA for hospital-based clinicians in Nairobi, Kenya. Built by Dr. Ebrahim Yusuf (Emu) — founder, sole developer and primary user — for his practice (Comprehensive Diabetes Centre, Doctors Park, 3rd Parklands Ave). **Core value:** an authoritative *personal* fee record that matches hospital records and prevents revenue leakage for fee-for-service / visiting consultants. The doctor's practice issues the invoice; the hospital is the venue. **Not an EMR** — no clinical notes/diagnoses/results beyond operational notes. Pricing: **KES 500/month after a 14-day free trial** (subscription schema prepped, not built).

**Stack:** React + Vite + Tailwind · Supabase (Postgres, Auth, RLS, Storage, Edge Functions/Deno) · Recharts · SheetJS · Claude Vision (tag scanning, via `scan-tag` edge fn) · Resend (email) · Meta WhatsApp Cloud API. Repo `emu11y/wardrounds`. Hosting Vercel (team `ward-monitor`, project `wardrounds`). Local path on Emu's Mac: `~/Claude/Project FIles/wardrounds` (also referenced as `~/wardrounds`).

**Environments**
| | URL | Branch | Supabase ref | Publishable key |
|---|---|---|---|---|
| **PROD** | https://wardrounds.site | `main` | `bannxzyidkgmbejyrzea` | `sb_publishable_CJ4N9ejAfmP5tlwHJ781uQ_ozZUUX3Y` |
| **Staging/TEST** | https://wardrounds-git-dev-ward-monitor.vercel.app | `dev` (auto-deploys) | `ewkjhqhszbxnizqbosod` | `sb_publishable_WWD1rzuDeozClgPybaDXMw_1Zg0GQFf` |

TEST login: `test@wardrounds.com` (seed SQL must key off this, not the hotmail address). **Never purge TEST data**; PROD started empty.

**Meta / WhatsApp IDs** (IDs, not secrets): business `thyroid_kenya` `1239450534066576` · app **Wardrounds** `2202646650298242` (**Published**) · TEST WABA `1512386093333740`, test number +1 555 155-9940, phone_number_id `1199957979870204` (subscribed_apps ✅) · PROD WABA "Dr Ebrahim Yusuf Clinic" `434693039737057` (empty — awaiting production number) · system user `wardrounds_server` holds the permanent token.

**Secret names** (values only in Supabase secrets / Meta / Vercel): `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `CLAUDE_API_KEY`, `SITE_URL`.

**Email:** Resend, domain `wardrounds.site` verified, sender `WardRounds <reminders@wardrounds.site>`, html+text. SPF/DKIM/DMARC (`p=none`) all pass — Hotmail Junk is new-domain reputation, not DNS. Mailbox `admin@wardrounds.site` (+ `privacy@` alias). Registrar Namecheap.

---

## 3. CURRENT STATE SNAPSHOT (3 Oct 2026)

- **Branches:** `dev` == `main` == `645d8c3` ("Billing cards: Patient Details sub-card…"). Everything is live on wardrounds.site.
- **Working tree:** clean except untracked `WHATSAPP_GOLIVE_STATE.md` (now merged here → archived).
- **Last shipped (10 Aug):** Billing verification page + Analytics Billing tab + `invoice_records` table (TEST + PROD), mobile Filters popover, "Today" pill, Patient Details sub-card, UHID column in exports.
- **WhatsApp:** Phases 1–6 built and verified E2E on TEST; Phase 7 (PROD go-live) not started beyond schema.
- **Dormant:** no commits 10 Aug → 3 Oct. A daily 8pm Cowork nudge (`wardrounds-whatsapp-golive-nudge`) may still exist — turn it off if not wanted.
- **Not yet verified on a real phone:** Billing Filters popover; invoice control bar.

---

## 4. FEATURE INVENTORY (what exists)

| Module | Route / file | Notes |
|---|---|---|
| Landing (desktop) | `/` → `pages/landing/Landing.jsx` | Dark glass, Framer/Lenis, 4 feature blocks, comparison table, FAQ (JSON-LD) |
| Landing (mobile) | `MobileLanding.jsx` (touch or `?mobile=1`) | CSS-only motion, one IntersectionObserver |
| Auth | `AuthForm.jsx` shared by landing `AuthModal` + `/login`; `/auth/callback`; `/reset-password` | Sign-up creates a new practice; joining is invite-only |
| Inpatient (Dashboard) | `pages/Dashboard.jsx` + `PatientCard.jsx` | Ward cards, services, notes, transfer, discharge, invoice, timeline editor |
| Admit | `pages/AdmitPatient.jsx` | Tag scan (Claude Vision) or manual; dup-admission guard (scanner + manual) |
| Outpatient | `pages/Outpatient.jsx`, `LogVisitModal`, `NewVisitModal` | Team-wide visits; `doctor_id` required via `DoctorPicker` |
| Appointments | `pages/MyAppointments.jsx` + `components/calendar/*` | Per-doctor "control tower" tabs; slots 06:00–21:00/30 min; RSVP badge |
| Patients | `pages/Patients.jsx` | Directory, admit-from-card, Excel export |
| Billing | `pages/Billing.jsx` | Post-discharge billed/paid/mode/invoice #/amount; PDF + Excel export |
| Analytics | `pages/Analytics.jsx` | Revenue, outpatient, Billing tab; Excel export; `allSettled` loads |
| Invoice | `pages/modals/InvoiceModal.jsx` | A4 print via isolated iframe; auto-named PDF |
| Settings | `pages/Settings.jsx` (~2.4k lines) | Profile, practice/logo, hospitals (+ tag prefix, colour), wards/rates, team services, members (active/archived), positions, permissions, reminders/WhatsApp toggles |
| Reminders | `send-reminders` cron, `ReminderComposeModal` | Email live on PROD; WhatsApp on TEST |
| PWA | `public/sw.js`, `PwaInstallContext`, `InstallModal`, `InstallBanner` | Network-first app-shell SW; iOS guided install |
| Legal | `/privacy` (public) | |
| Activity log | `lib/activityLog.js`, `NotificationCenter` | Partial coverage |

---

## 5. DATA MODEL REFERENCE

**Identity & teams**
- `teams` (`id`, `name`, `admin_id` NOT NULL no FK, `reminders_enabled`, `whatsapp_enabled`, logo…). Team id generated client-side at signup (`crypto.randomUUID()`), inserted without `.select()`.
- `users` (`role` CHECK `admin|member` — access only; `position_id → team_positions`; `status active|archived` + `archived_at`; `team_id` nullable). Archived users are signed out at login. Members are **archived, never deleted**.
- `team_positions(name, sort_order, is_clinical)` — descriptive job titles; 5 defaults seeded by `on_team_created_seed_positions → seed_default_positions()`. `is_clinical` decides who appears in DoctorPicker/Appointments tabs. Doctor positions clinical by default. Admin-only "Other…" creator must declare clinical/non-clinical.
- `user_permissions` — **override layer** over `ROLE_DEFAULTS` (null = inherit). `can_*` columns: manage_patients, discharge, transfer, edit_billing, mark_paid, view_all_patients, view_reports, access_admin, manage_team, view_revenue (+ others per §permissions.js). Admins = ALL_TRUE. Page keys are **derived**: `view_inpatient=can_manage_patients`, `view_patients=can_view_all_patients`, `view_analytics=can_view_reports && can_view_revenue`, `view_admin=can_access_admin`, `view_billing=can_edit_billing`.
- Triggers/functions: `handle_new_auth_user()` (SECURITY DEFINER, reads `{role, full_name}` metadata, fail-closed `member`); `current_user_team_id()`, `current_user_role()` (SECURITY DEFINER RLS helpers); `create_team_for_user(email, practice, doctor)` (operator onboarding).

**Hospitals, wards, services**
- `hospitals` — per team: name, location, address, phone, email, `color`, `hospital_id_prefix`, active/inactive. Known prefixes: Aga Khan `AK`, M.P. Shah `UHID`, Avenue `IP No.`, 3rd Park `3PH`.
- `hospital_services` — wards & per-day rates (`service_name`, `price_per_day`, `service_type`); only `service_type='ward'` in admit/transfer dropdowns; no status column (hard delete).
- `team_services` — team catalogue: `category` (Procedure/Test/Equipment/Consultation/Other), `price`, `billing_type` (one-off/daily), `status` (active/hidden).

**Clinical / billing**
- `patients` (names, DOB, optional `phone`, `email`, insurance, `whatsapp_opt_in`).
- `admissions` (`patient_hospital_id` = real tag ID e.g. `AK0113939366`, `hospital_id`, `ward`, `admission_date`, `discharge_date`, status active/discharged/archived).
- `timeline_events` — `admitted` then `transferred` events; **billing derives on read** from these (`lib/billing.js`). Invariant A: `admissions.ward` = last ward event. Invariant B: `admissions.admission_date` = date of `admitted` event. `timestamp` is tz-less → parse with `parseEventTimestamp`.
- `admission_services` (+ `service_at timestamptz`) · `visit_services` (outpatient).
- `outpatient_visits` (status `seen|scheduled|pending|closed|blocked|cancelled`; `is_adhoc`; `doctor_id` vs `created_by_user_id`; `patient_hospital_id`; `reminder_1w/1d/dayof_sent_at`; `rsvp_status`, `rsvp_at`). Embed doctor with `users!outpatient_visits_doctor_id_fkey`.
- `patient_notes` — nullable `admission_id`/`visit_id`, CHECK exactly one set.
- `invoice_records` — one per admission (unique `admission_id`): `billed/billed_at`, `billing_mode` (hospital/direct_patient/invoiced_hospital), `invoice_number`, `amount numeric(12,2)`, `paid/paid_at`, `notes`, `created_by/updated_by`.
- `message_log` (email/WhatsApp sends + inbound RSVP) · activity log table (via `lib/activityLog.js`).
- **Dropped — never reference:** `billing_records`, `services_rendered`, `ward_segments`.

**Billing rules (signed off)**
- Admission day billed; discharge day billed; on transfer, transfer date belongs to new ward.
- Same-day "transfer" = wrongful-admission correction → 0-day segment kept for audit, rendered as muted footnote, **not billed**.
- Discharged/archived stays cap the last segment at `discharge_date`.
- Services = flat one-off charges on top of the day's ward charge.
- System total is derived (`billing.js`); `invoice_records.amount` is the recorded/hospital figure (may differ; "Use system total" prefill).
- KES figures are never compacted (`formatKES` already prefixes "KES ").

**Storage:** `team-logos` (`{teamId}/logo-{ts}`), `profile-pictures` (`{userId}/avatar-{ts}`) — public, 2 MB, jpeg/png/webp.

---

## 6. ARCHITECTURE & SUBSYSTEMS

**Frontend:** routes lazy-loaded in `src/App.jsx`; every page under `PageGuard permKey=…`; DefaultRedirect order Inpatient → Outpatient → Patients → Billing → Analytics → Settings. Only stylesheet loaded is `src/styles/globals.css` (canonical `.glass-rim`, `.glass-panel`, `.glass-drawer`). `useAuth().permissions` is the single permissions source. Main scroller is `#main-scroll` (not window). `TopHeader` sticky `z-[61]`; mobile pill nav `z-50`.

**Key libs:** `api.js` (~1.7k lines, all Supabase calls; `ALL_TIME_SLOTS`, `findPatientByHospitalId`, `fetchInvoiceRecords`, `upsertInvoiceRecord`) · `billing.js` (`buildWardLines`, `wardBillingLines`, `wardTotal`, `admissionGrandTotal`, `computeTeamRevenueForRange`, `BILLING_MODES`) · `permissions.js` · `hospitalTagReader.js` · `print.js` (`printHtml`, `escapeHtml`) · `activityLog.js` · `statusBadges.js` · `theme.js` · `email.js` · `whatsapp.js`.

**Tag scanning:** `TagScanDropzone` (shared by Admit, NewVisit, Appointments ad-hoc; gallery-pick, drag-drop, no `capture`) → `fileToScaledBase64` (≤2000 px, JPEG q0.85; HEIC re-encoded via canvas) → `scan-tag` edge fn (JWT-checked; model/prompt/token limit server-side; `CLAUDE_API_KEY`; Emu funds all scans) → returns `firstName, lastName, dateOfBirth, patientHospitalId, idPrefix, hospital, ward` → `matchHospitalFromScan()` matches in order: (1) returned hospital name, (2) `idPrefix` vs `hospital_id_prefix`, (3) prefix substring inside `patientHospitalId`. Team hospital list (with prefixes) is passed into the prompt. Dedup via `findPatientByHospitalId` (admissions → outpatient_visits) **before** `createPatient`; patient only created on final submit. Never auto-invoke the scanner.

**Edge functions (Deno):** `invite-team-member`, `scan-tag`, `send-email`, `send-reminders`, `send-whatsapp`, `whatsapp-webhook` (`--no-verify-jwt`). Deploy per project (`--project-ref`). pg_cron `wr-send-reminders` `0 4 * * *` UTC (07:00 Nairobi) on both projects, header `x-cron-secret`.

**WhatsApp:** DRY pair `supabase/functions/_shared/whatsapp.ts` ↔ `src/lib/whatsapp.js` (`toE164Kenya`, `waParam`, `buildApptWaParams` 7 params, `{{7}}` clinic contact; `buildRsvpPayloads` server-only). Outbound → `graph.facebook.com/v23.0/<PHONE_ID>/messages` with quick replies `CONFIRM:<visitId>` / `RESCHED:<visitId>`. Inbound webhook verifies `X-Hub-Signature-256` → sets `rsvp_status/rsvp_at` → logs; always 200. **Two webhook layers both required:** app-level `messages` subscription AND `POST /<WABA_ID>/subscribed_apps`. Sends only if `teams.whatsapp_enabled` AND patient `whatsapp_opt_in` AND valid Kenyan mobile. Utility ≈ KES 0.80/conv; marketing ≈ 5.20; unverified cap 250 conv/day.

**Email:** DRY pair `src/lib/email.js` ↔ `supabase/functions/_shared/apptEmail.ts` (html + text — change both).

**Security posture:** PROD RLS-hardened (17 tables, `anon` revoked, 24 policies). Admin actions that need service role go through Edge Functions only.

---

## 7. RULES (non-negotiable)

- **Read this file first; update it at close-out** (§1).
- **Execution model.** Chat sessions: Claude.ai = architect/diagnostic lead, Claude Code = sole file editor, Emu = relay. Cowork sessions (Claude linked to Emu's Mac): Claude edits files in the connected repo folder directly and drives browser/SQL Editor read-only SELECTs; **Emu runs** `npm run build` (sandbox can't run macOS rolldown), `git push`, `supabase` deploys, SQL **writes** (Run button) and phone taps. Commits from the sandbox can leave `.git/HEAD.lock` → Emu runs `rm -f .git/HEAD.lock`.
- **Diagnose before building.** Read raw file contents before designing any edit. Never guess schema, data shapes or component structure. Raw output, not summaries.
- **Strictly DRY.** Grep first. One function, one location, many consumers. Keep mirror pairs in sync.
- **Surgical edits.** Content-anchored `str_replace`; no full-file rewrites; STOP conditions in every fix prompt.
- **Sequencing:** SQL → `api.js` → component. One task fully finished before the next.
- **Glassmorphic design:** light `bg-white/90 backdrop-blur-xl border border-white/60 rounded-2xl`; `.glass-rim`; **pill buttons** (`rounded-full`); iOS blue **#007AFF**; **no `window.alert/confirm`** — glass modals + Toast only.
- **Database:** follow `Claude_Code_Database_Architecture_Standards.pdf`. **All SQL in the Supabase SQL Editor only.** Every schema change ends `NOTIFY pgrst, 'reload schema';`. RLS via `current_user_team_id()` (never inline subqueries on `users`). `.maybeSingle()` for nullable reads. Timestamps pin `Africa/Nairobi`. Soft-delete wherever a status column exists. TEST first, then PROD.
- **Permissions standing rule:** every new page/action/function is registered in `src/lib/permissions.js`, enforced (`PageGuard` / `RevenueValue` / action gate, explicit `=== true`), and gets an admin toggle in Settings. **Nothing ships ungated.**
- **Done signal:** `npm run build` zero errors (>500 kB chunk warning is pre-existing) + browser/phone verification. Unrun checks flagged plainly.
- **Deploy discipline:** promote with `git checkout main && git merge --ff-only dev && git push origin main && git checkout dev` (STOP if ff-only refuses — reconcile, never force). Never commit secret values.

---

## 8. LESSONS LEARNT (append, don't overwrite)

**Supabase / Postgres**
- `insert().select()` under RLS can return nothing (SELECT policy can't see the new row yet) → generate ids client-side, skip read-back.
- `upsert` triggers the INSERT RLS check even when the row exists → use plain `update`.
- PostgREST nested embeds without an FK fail silently/400 → query separately, merge in JS. Two FKs to the same table → name the constraint in the embed.
- SQL Editor runs a script as one transaction → split cleanup / constraints / verification; normalise values before adding a CHECK.
- `with_check` must be an expression, not a boolean literal.
- "new row violates RLS" = running as `anon` or no matching policy (≠ `PGRST116`).
- Anon-key curl returns 0 rows on RLS tables → invalid verification; use a user JWT or `set_config('request.jwt.claims',…)` + `set local role authenticated`.
- Migrations must sweep **triggers**, not just constraints/app code (invite 500 for 3 sessions). GoTrue Auth logs carry the real error; supabase-js shows `{}`.
- Repo `schema.sql` drifted → PROD rebuilt from live DB into `schema_prod.sql`. New projects don't copy Storage buckets/policies.
- `sb_secret_` keys: use `withSupabase(["publishable","secret"])`. TEST/PROD keys differ.
- Backfill gap rows → re-run idempotent backfills after shipping the writer.

**Auth**
- `signUp` returns no session with email confirmation on; trigger is async → poll for the `users` row. Pass onboarding data via `emailRedirectTo` query params (sessionStorage doesn't survive cross-browser confirm). Deleting an auth user leaves `public.users` behind (blocks re-signup). `AuthContext` wipes `sb-*` keys except on `AUTH_URL_FLOW_PATHS`.

**Frontend**
- One rejected promise in `Promise.all` blanked Analytics → `allSettled` + on-screen errors.
- Early returns that skip `setLoading(false)` → infinite spinners.
- `overflow-x:hidden` silently makes `overflow-y:auto` → use `clip`. Lenis needs `lenis.resize()` via ResizeObserver for LazyMount growth.
- Modals: `Backdrop` must be `fixed`; place modals beside (not inside) clickable cards; `data-lenis-prevent` + `min-h-0` over landing.
- Gradient border + `overflow-hidden` on the same element → corner artefact; put overflow on an inner wrapper.
- Only `globals.css` is imported — use a magenta canary rule when styles "don't apply".
- `fetchPatients` returns thin admissions → exports must use `fetchAdmissionsForPatient`.
- Date maths in EAT crosses UTC midnight at 21:00 UTC; `admitted` event must sort first.
- PNG re-encoding inflated photos past Claude's 10 MB limit → JPEG.
- Pure extractions should leave bundle size unchanged — good refactor check.

**WhatsApp / email**
- Two webhook layers (app `messages` + WABA `subscribed_apps`). Verify via edge-function invocation logs, not Meta's event feed.
- Graph console tokens die ~24 h (error 190) → system-user never-expire token.
- Template approvals are per-WABA. Templates can't end with lone punctuation after the last `{{n}}`.
- Rotating a secret breaks consumers until propagated (`CRON_SECRET` → pg_cron header; `WHATSAPP_APP_SECRET` → signature check).
- Seed SQL with the wrong email inserts 0 rows silently — always row-count after seeding.
- Hotmail Junk = new-domain reputation; emails need an explicit text/plain part.

**Tooling**
- Two Vite servers can run (5173/5174) → `pkill -f vite`. New packages may need a Vite cache clear.
- Vercel's Status filter can hide failed builds. Emu's zsh mangles pastes → prefer `git add src`, hyphenated messages. Sandbox can't run `npm run build`.

---

## 9. OPEN ITEMS (consolidated & code-checked 3 Oct 2026)

### P0 — Security (do first)
1. **Rotate `WHATSAPP_APP_SECRET` + `CRON_SECRET`** (exposed in chat; `CRON_SECRET` literal appears in 16 Jul handoffs). Update Meta → Supabase secrets (both projects) → pg_cron job headers.
2. **Confirm Supabase service-role key rotated** (rotated 1 Jul per one doc; Session 23/26 exposures). Confirm the `sbp_` CLI token is revoked.
3. **Scrub secrets from archived docs** — `WARDROUNDS_SESSION23_HANDOFF.md` and `WARDROUNDS_PROJECT_HANDOFF.md` (Project KB) contain service-role key, a Claude API key and a test login in plain text. Rotate the Claude API key if still active; delete/redact those docs.
4. Fix TEST pg_cron `CRON_SECRET` drift (nightly 401) — do together with #1.
5. Run full RLS smoke test on PROD (`rls_smoke_test_prod.sql`).
6. Tighten storage policies to per-team folders (any authed user can currently write).

### P1 — Verify (built, never confirmed)
- Billing Filters popover on a real phone · invoice control bar (Print/Close in card) on mobile.
- Admit-from-Patients-card (fixed 1 Jul, later docs say broken) — one re-check.
- Archive → blocked login → restore cycle · change-password E2E · members-list auto-refresh.
- Settings reminders toggle on PROD · `privacy@` receive test · `createAdmission` writes `timeline_events`.

### P1 — Bugs / gaps
- `invite-team-member` 500 (S30) — re-test; invite modal stuck on "Creating…" (needs `finally`); pre-check misses Auth-only users.
- Same-day two-ward stays rejected by timeline-editor validation (strictly increasing dates).
- Permission gates still unenforced: Edit Billing on cards, reassign-doctor, create-position; revenue masking in Analytics/Outpatient/InvoiceModal/AddServicesModal/AddNotesModal; retire Settings' separate `myPermissions` path.
- Admin not given a clinical position at signup; onboarding fallback on first login independent of `/auth/callback`.
- Grey bar / lingering backdrop in standalone PWA (Settings) — needs on-device debug.
- `SITE_URL` secret → `https://wardrounds.site`.

### P2 — Tech debt / polish
- Commit `supabase/schema_prod.sql`; untrack `.claude/settings.local.json`.
- Remove `services_rendered` leftovers in `fetchAdmissionsForPatient`.
- Billing-breakdown editor modal (edit `admission_services`); show **who added** each service (`created_by`).
- Activity logging for every mutation + per-member/per-patient audit view.
- Migrate InvoiceModal print plumbing to `lib/print.js`.
- Remaining Settings modals → `glass-panel`; Settings.jsx (~2.4k lines) split.
- Bundle code-split; `www` CNAME; SEO meta; real testimonials; footer contacts; DMARC hardening.
- Admin uploads another member's avatar; phone prompt after scan.
- Analytics: revenue by hospital & doctor × hospital (avoid N+1).

### ✅ Resolved in code (were listed open in older handoffs)
Duplicate-admission guard on scanner path (`AdmitPatient.jsx` single source) · Settings Add-Member + change-password wrapped in `<form>` · collapsed-sidebar hover flyout (`getBoundingClientRect`) · Discharge/Transfer/Mark-Paid gates enforced · no `window.alert/confirm` left · timeline editor (edit/delete/correct wrongful ward/+Add ward) · Block 2 landing.

---

## 10. ROADMAP & PHASES

`[x]` done · `[~]` in progress · `[ ]` not started

**Phase 1 Core app** `[x]` · **Phase 2 Landing** `[x]` (full DRY overhaul in backlog) · **Phase 3 Email reminders** `[x]` · **Phase 4 WhatsApp schema+send** `[x]` · **Phase 5 Utility templates** `[x]` · **Phase 6 RSVP** `[x]` · **Billing verification page** `[x]` (10 Aug)

**Phase 7 — WhatsApp PROD go-live** `[~]` — `[x]` PROD schema (gates OFF) · `[ ]` production number → PROD WABA · `[ ]` recreate/approve 5 `appt_*` templates under PROD WABA · `[ ]` deploy `send-whatsapp`, `whatsapp-webhook` (`--no-verify-jwt`), `send-reminders` to PROD · `[ ]` PROD `subscribed_apps` (do not skip) · `[ ]` PROD secrets + webhook (`https://bannxzyidkgmbejyrzea.functions.supabase.co/whatsapp-webhook`) · `[ ]` enable per team + real tap verify · Business Verification deferred until the 250/day cap bites.

### New build plan (agreed 3 Oct 2026) — in this order

**Phase 8 — UI minor fixes** `[ ]` — list to be captured from Emu's walkthrough (screenshots), plus P1 verify items above.

**Phase 9 — Shift Monitor** `[ ]` — for clinicians paid per shift (locum/sessional). Log shifts (hospital, date, start/end, shift type day/night/weekend/on-call, rate), running totals, billed/paid tracking (reuse Billing-page patterns + `invoice_records`-style status), Analytics + export. New `shifts` table (team-scoped RLS), `api.js` functions, page + permission key + Settings toggle. *Design questions open — see §10.1.*

**Phase 10 — Onboarding wizard** `[ ]` — first-run flow capturing:
1. Profession — doctor / surgeon / nurse / physiotherapist / pharmacist / clinical officer / other.
2. Practice type — solo / team (changeable later).
3. If team: can the team see **financials** or only **patient details & services** (maps onto `can_view_revenue` defaults).
4. Number of users in practice.
5. Pay model(s) — per shift, per patient (fixed amount or % ), per procedure, ward rounds (daily ward billing); how billing is done (daily / per visit / per procedure).
Outputs: a team/user **practice profile** that switches modules on/off (e.g. hide Inpatient for pure-shift users; show Shift Monitor) and sets permission defaults. Replaces/extends the current `/auth/callback` team creation; must also run on first login as fallback.

**Phase 11 — Hospital learning on scan** `[ ]` — when a scanned tag's hospital can't be matched, ask "Which hospital is this?" (pick existing / add new), then **learn** the ID pattern (prefix such as `AK`, `UHID`, `IP No.`, `3PH`, plus format/length) and store it on the hospital so later scans auto-identify. Builds on the existing `matchHospitalFromScan()` + `hospital_id_prefix` (today set manually in Settings). Consider a `hospital_id_patterns` table (multiple patterns per hospital: UHID vs IP No.).

**Phase 12 — App stores** `[ ]` — wrap the PWA for Google Play (TWA via Bubblewrap, or Capacitor) and Apple App Store (Capacitor; Apple requires native value beyond a web wrapper — camera scanning, push notifications, offline). Needs: developer accounts (Google $25 one-off; Apple $99/yr), privacy policy (have `/privacy`), data-safety forms, account-deletion flow (required by both stores), app icons/screens, review of medical-data positioning, and handling subscriptions (store billing rules vs M-Pesa).

### 10.1 Open design questions (need Emu's answers)
- Shift Monitor: shift types and rates per hospital? overtime/extra hours? who pays — hospital or agency? does a shift ever include per-patient fees on top?
- Onboarding: does profession change UI vocabulary (e.g. "patients" vs "clients")? can one user have multiple pay models at once (e.g. ward rounds + shifts)?
- Per-patient %: percentage of what — hospital bill, consultation fee?
- Hospital learning: per-team or shared across all WardRounds teams (a global hospital registry would let a new user's first scan auto-match)?

### Post-production backlog (unchanged)
Landing full DRY overhaul · super-user platform admin (server-side `platform_admin`, never client bypass) · M-Pesa Daraja · SMS (Africa's Talking) · per-team Accounting page · subscriptions (KES 500/mo, 14-day trial; schema prepped S20) · holiday/WHO-day broadcasts (marketing category) · per-team WABAs/numbers.

---

## 11. DEV COMMANDS (Emu's terminal)
```
cd ~/wardrounds && npm install && npm run dev        # http://localhost:5173 (?mobile=1 for mobile landing)
pkill -f vite                                         # if two servers are running
cd ~/wardrounds && npm run build                      # done signal: zero errors
supabase functions deploy <name> --project-ref ewkjhqhszbxnizqbosod   # TEST (PROD = bannxzyidkgmbejyrzea; add --no-verify-jwt for whatsapp-webhook)
git checkout main && git merge --ff-only dev && git push origin main && git checkout dev   # promote
rm -f .git/HEAD.lock                                  # after sandbox commits, if git complains
```

---

## 12. WORK LOG (newest first)

### 2026-10-03 — Build resumed; Master Handoff created
- Reviewed codebase (`dev`==`main`==`645d8c3`). Found README was the operating doc since 23 Jul, plus an unmerged 10 Aug handoff and `WHATSAPP_GOLIVE_STATE.md`.
- Merged all 50+ handoffs (Project KB + repo) into this `MASTER_HANDOFF.md`; code-checked open items (6 previously "open" items found already resolved). README now points here; stray handoff files archived.
- Agreed new build order: UI fixes → Shift Monitor → Onboarding wizard → Hospital learning on scan → App stores.

### 2026-08-10 — Billing verification page shipped to PROD
- `Billing.jsx` (Outpatient-style accordion cards: Charges / Billing Details / Follow-up Note / Patient Details), `invoice_records` (TEST+PROD), Analytics Billing tab, PDF+Excel export sharing `exportRows()`, `lib/print.js`, `view_billing` derived from `can_edit_billing`, Paid toggle gated by `can_mark_paid`, mobile Filters popover, "Today" pill, UHID column in exports. Fixed PostgREST embed 400 by merging in JS.

### 2026-07-29 — WhatsApp go-live state check (nightly nudge) — no change.

### 2026-07-23 — WhatsApp app PUBLISHED; RSVP verified E2E on TEST
- Promoted dev→main; `/privacy` live; Meta app published; root-caused inbound failure (WABA not subscribed to app) and fixed. Docs consolidated into README.

### 2026-07-22 — RSVP E2E prep; WhatsApp Phase 1+2 schema on PROD (gates OFF); `/privacy` + RSVP badge.
### 2026-07-19 — Phase 5 templates E2E passed; Phase 6 RSVP + webhook built; calendar redesign shipped.
### 2026-07-16 — Mobile landing rebuilt (CSS-only); plain-text email; auto-reminders live on PROD; WhatsApp planned.
### 2026-07-13 — PWA install (SW, InstallModal/Banner); clinical-staff `is_clinical` fix; Resend email.
### 2026-07-09 — Scan dropzone shared, scroll fixes, Appointments, timeline "+ Add ward".
### 2026-07-08 — PROD launch (RLS-hardened), onboarding bug fixed, mobile rebuild, domain live.
### 2026-07-07 — Permissions layer (`can_view_revenue`, `RevenueValue`, `PageGuard`); doctor assignment (`doctor_id`) + Appointments control tower.
### 2026-07-01→05 — Billing rebuild (derive from `timeline_events`), timeline editor, Analytics, invite blocker, landing phases 2–4, invoice overhaul, comparison table.
### 2026-06-09→28 — Sessions 6–29: core app, hospitals/prefix tag scanning, outpatient, notes, team members/positions, archive model, services catalogue, settings, glass design system.

---

## 13. DOCUMENT INDEX
- **Governing:** `MASTER_HANDOFF.md` (repo root + Project KB).
- **Standards:** `Claude_Code_Database_Architecture_Standards.pdf`, `12 Glassmorphism UI Features Best Practices and Examples.pdf` (Project KB).
- **Archive (superseded, read only for deep history):** `docs/archive/*` in repo; Session 6–29 + dated July handoffs, `WARDROUNDS_BILLING_REBUILD_HANDOFF.md`, `WARDROUNDS_TIMELINE_EDITOR_HANDOFF.md` in Project KB.
- **SQL/scripts in repo root:** `WARDROUNDS_SQL_INVOICE_RECORDS.sql`, `WARDROUNDS_SQL_WHATSAPP_PHASE{1,2}*.sql`, `WARDROUNDS_WEBHOOK_RSVP_SIMULATE.sh`, `rls_smoke_test_prod.sql`, `verify_signup_prod.sql`, `fix_doctor_is_clinical.sql`.
