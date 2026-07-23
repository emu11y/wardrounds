# WardRounds — Master Handoff & Operating Document

> **This is the single source of truth for the project.** It replaces the old
> per‑session handoff files (now in `docs/archive/`).
>
> ### 📖 READ‑FIRST RULE (non‑negotiable)
> **At the START of every session, read this entire file before doing anything else.**
> **At the END of every session, update it:** add a dated entry to the Work Log (§1),
> update the phase/step status (§3), and add any new lessons (§6), rule changes (§7),
> or architecture changes (§5). Keep it current — the next session inherits only what
> is written here.
>
> _Last updated: 23 Jul 2026 (Cowork session — WhatsApp published + RSVP verified E2E on TEST)._

---

## 1. DAILY WORK LOG (newest first)

Append one dated block per session. Keep entries terse: what shipped, what was decided, what's still open.

### 2026‑07‑23 — WhatsApp go‑live push: app PUBLISHED, RSVP verified end‑to‑end on TEST
- Audited state: found WhatsApp far more built than the 16 Jul handoff implied (Phases 1–6 all built on `dev`).
- Promoted `dev` → `main` (reconciled a divergence: `git merge origin/main` into dev, then `--ff-only`). Production deployed; `https://wardrounds.site/privacy` now live.
- Meta app **Wardrounds**: set Privacy policy URL = `https://wardrounds.site/privacy`, uploaded app icon, **Published** the app (was in Development).
- Verified outbound send end‑to‑end (real WhatsApp with Confirm / Need‑to‑reschedule buttons).
- **Diagnosed inbound failure:** real button taps weren't reaching the webhook. Root cause = the **TEST WABA was never subscribed to the app** (`subscribed_apps`). App‑level webhook config was correct; function logs proved the webhook was only ever hit by the signed simulation, never by real taps.
- **Fix:** `curl -X POST "https://graph.facebook.com/v23.0/1512386093333740/subscribed_apps" -H "Authorization: Bearer $WHATSAPP_TOKEN"` → `{"success":true}`. Re‑sent, tapped Confirm on phone → `rsvp_status='confirmed'` written. **RSVP round‑trip fully verified on TEST.**
- ⚠️ **Two secrets were exposed in chat** and MUST be rotated: `WHATSAPP_APP_SECRET` and `CRON_SECRET`. Deferred to next session (scheduled 9am nudge) because rotating live credentials mid‑air breaks the working webhook until propagated.
- Open: PROD WhatsApp go‑live (Phase 7), secret rotation, `privacy@wardrounds.site` receive test.

### 2026‑07‑22 — RSVP E2E prep + PROD schema
- Verified template bodies/buttons, `message_log` constraints, TEST schema. Reset the seed visit to today.
- Ran WhatsApp Phase 1 + Phase 2 schema on **PROD** (`bannxzyidkgmbejyrzea`) — additive, all gates default OFF, so PROD behaviour unchanged but schema‑ready.
- Built the public `/privacy` route (controller/processor roles, WhatsApp section, Kenya DPA 2019, opt‑out) and the RSVP badge in the Outpatient UI. Activated the `admin@wardrounds.site` mailbox + `privacy@` alias.
- Flagged: Meta app unpublished (blocks real taps); TEST pg_cron `CRON_SECRET` drift.

### 2026‑07‑19 — WhatsApp RSVP built + inbound webhook live on TEST
- Phase 5 (utility templates) E2E PASSED. Fixed Meta error 190 by creating permanent system user `wardrounds_server` with a never‑expire token.
- Built Phase 6: RSVP quick‑reply buttons + `whatsapp-webhook` (GET verify handshake, POST X‑Hub‑Signature‑256 check, decodes `CONFIRM:`/`RESCHED:<uuid>`, writes `rsvp_status`). Added `{{7}}` clinic contact to templates. Configured Meta webhook + subscribed `messages`. Also shipped the calendar redesign.

### (earlier)
- 16 Jul: mobile landing rebuilt (CSS‑only, no framer/Lenis); plain‑text email shipped; auto‑reminders live on PROD; WhatsApp integration planned.
- ≤15 Jul: core app, auth, RLS, permissions, invoicing, analytics, branded email templates, PROD launch on `wardrounds.site`. (Detail in `docs/archive/`.)

---

## 2. PROJECT OVERVIEW

**WardRounds** — a clinical practice‑management PWA for hospital teams in Nairobi, Kenya. Built by Dr. Ebrahim Yusuf (Emu) for his practice (Comprehensive Diabetes Centre). Core value: an authoritative personal fee/billing record that matches hospital records, preventing revenue leakage for fee‑for‑service / visiting consultants. Pricing: KES 500/month after a 14‑day free trial. Not an EMR — no clinical notes/diagnoses/results.

**Stack:** React + Vite + Tailwind CSS · Supabase (Postgres + Auth + RLS + Storage) · Supabase Edge Functions (Deno) · Recharts · SheetJS · Claude Vision API (tag scanning) · Resend (email) · Meta WhatsApp Cloud API. GitHub `emu11y/wardrounds`. Hosting: Vercel (team `ward-monitor`, project `wardrounds`).

**Environments**
- **PROD:** `https://wardrounds.site` (branch `main`). Supabase ref `bannxzyidkgmbejyrzea`, publishable `sb_publishable_CJ4N9ejAfmP5tlwHJ781uQ_ozZUUX3Y`.
- **Staging:** `https://wardrounds-git-dev-ward-monitor.vercel.app` (branch `dev`, auto‑deploys). Supabase **TEST** ref `ewkjhqhszbxnizqbosod`, publishable `sb_publishable_WWD1rzuDeozClgPybaDXMw_1Zg0GQFf`. TEST login: `test@wardrounds.com` (NOT the hotmail address — seed SQL must key off this).

**Meta / WhatsApp IDs** (values that are IDs, not secrets)
- Business portfolio `thyroid_kenya`, business_id `1239450534066576`.
- App **Wardrounds**, app id `2202646650298242` — **Published** (as of 23 Jul).
- **TEST WABA** `1512386093333740`; test number `+1 555 155‑9940`, phone_number_id `1199957979870204`. Subscribed to app via `subscribed_apps` ✅.
- **PROD WABA** "Dr Ebrahim Yusuf Clinic" id `434693039737057` — currently empty (awaiting a production number).
- System user `wardrounds_server` holds the permanent token.
- Secret **names** (values live only in Supabase secrets / Meta, never in this file): `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`.

**Email:** Resend, domain `wardrounds.site` verified, sender `WardRounds <reminders@wardrounds.site>`, multipart html+text. DKIM/DMARC(`p=none`)/SPF all pass — Hotmail Junk is new‑domain reputation, NOT a DNS gap (do not re‑add SPF/DMARC). Namecheap mailbox `admin@wardrounds.site` (+ `privacy@` alias, receive‑only) active. Registrar: Namecheap.

---

## 3. PHASES & STEPS (status)

`[x]` done · `[~]` in progress · `[ ]` not started.

**Phase 1 — Core app** `[x]` (live on PROD)
- `[x]` Auth, team model, per‑team RLS via `current_user_team_id()`, permissions layer (`src/lib/permissions.js`), Settings admin toggles.
- `[x]` Patients, outpatient visits, invoicing, analytics, tag scanning, Excel export.

**Phase 2 — Landing pages** `[x]` (shipped; full standardisation is a backlog item — §7.1)
- `[x]` Desktop + mobile landing (mobile rebuilt CSS‑only, no framer/Lenis), promoted to PROD.
- `[ ]` Unify mobile+desktop into one DRY component set; delete the superseded split (backlog).

**Phase 3 — Email reminders/confirmations** `[x]` (live on PROD)
- `[x]` `send-reminders` daily cron (07:00 Nairobi, `0 4 * * *` UTC) both projects; 1w/1d/day‑of + confirmations + manual reminders; html+plain‑text.

**Phase 4 — WhatsApp channel (Phase 1 schema + send)** `[x]` on TEST/`dev`
- `[x]` Schema: `patients.whatsapp_opt_in`, `outpatient_visits.reminder_{1w,1d,dayof}_wa_sent_at`, `teams.whatsapp_enabled`, `message_log` + RLS. TEST ✅, PROD ✅ (gates OFF).
- `[x]` DRY sender pair `_shared/whatsapp.ts` ↔ `src/lib/whatsapp.js`; `send-whatsapp` fn; `send-reminders` WhatsApp branch; Settings toggle; patient opt‑in; `ReminderComposeModal` channel checkboxes.

**Phase 5 — Utility‑template E2E** `[x]` (verified on TEST)
- `[x]` 5 `appt_*` utility templates approved on TEST WABA; seed→send→delivered→`message_log` audit verified.

**Phase 6 — RSVP (buttons + inbound webhook + UI)** `[x]` (verified E2E on TEST 23 Jul)
- `[x]` `{{7}}` clinic contact on templates; `buildRsvpPayloads` (`CONFIRM:<id>`/`RESCHED:<id>`); quick‑reply button components.
- `[x]` `whatsapp-webhook` fn (verify handshake + signature check + `rsvp_status` write + `message_log`); `verify_jwt=false`.
- `[x]` RSVP badge in Outpatient UI (`RsvpBadge.jsx`, `theme.js` status keys).
- `[x]` Meta webhook subscribed to `messages`; **WABA subscribed to app** (the fix that made real taps work); app **Published**.
- `[x]` `/privacy` public route live on PROD.

**Phase 7 — WhatsApp PROD go‑live** `[~]` (schema done; rest pending)
- `[x]` PROD schema (Phase 1+2) applied, gates OFF.
- `[ ]` Production number added to PROD WABA (`434693039737057`).
- `[ ]` Recreate + get approval for the 5 `appt_*` templates **under the PROD WABA** (approvals are per‑WABA).
- `[ ]` Deploy `send-whatsapp`, `whatsapp-webhook` (`--no-verify-jwt`), `send-reminders` to PROD.
- `[ ]` `subscribed_apps` for the **PROD** WABA (the step that was missing on TEST — do NOT skip).
- `[ ]` Set PROD secrets; configure PROD webhook (callback `https://bannxzyidkgmbejyrzea.functions.supabase.co/whatsapp-webhook`, verify token, subscribe `messages`).
- `[ ]` Enable `teams.whatsapp_enabled` per team + patient `whatsapp_opt_in`; real send+tap verification on PROD.
- `[ ]` Business Verification — **DEFERRED by Emu**: the unverified 250 conversations/day cap is enough for now; verify only when the cap is hit.

**Housekeeping / carry‑over**
- `[ ]` **Rotate exposed secrets** `WHATSAPP_APP_SECRET` + `CRON_SECRET` (see §6 lesson on rotation breakage).
- `[ ]` Fix TEST pg_cron `CRON_SECRET` drift (nightly TEST runs 401 until the job header is updated).
- `[ ]` Send a test email to `privacy@wardrounds.site` to confirm receipt.

---

## 4. (reserved)

---

## 5. ARCHITECTURE TO ADHERE TO

### 5a. Frontend
- **React + Vite + Tailwind.** Routes lazy‑loaded in `src/App.jsx`. `/privacy` is a public route (readable signed‑out — Meta reviewers/patients).
- **Design system — strictly glassmorphic.** Light glass: `bg-white/90 backdrop-blur-xl border border-white/60 rounded-2xl`; canonical `.glass-rim` in `src/styles/globals.css`. **Pill buttons** (`rounded-full`). iOS blue `#007AFF` accent. **No `window.alert`/`confirm` — glass modals only.** (Deliberate exception: the mobile landing avoids heavy blur for performance.)
- **Landing animation mandate:** CSS‑only (opacity/transform, once‑per‑view via one IntersectionObserver). No framer‑motion / Lenis on the landing. Framer‑free mock primitives (`MacBookFrame`, `PhoneFrame`, `MockSectionPanel`, `StatCard`, `BarChart`, `colors.js`) are shared; framer‑dependent ones (`PatientCard`, `MockCardHeader`, `DashboardMock`) must be replicated statically, never imported into `MobileLanding.jsx`.
- **Permissions everywhere:** every page/action gated (`PageGuard`, action gates, `RevenueValue`) and registered in `src/lib/permissions.js`, exposed as a Settings admin toggle.
- Nullable reads use `.maybeSingle()`. Timestamps pin `timeZone: 'Africa/Nairobi'`.

### 5b. Backend / data (Supabase)
- **All SQL runs ONLY in the Supabase SQL Editor** — never via CLI/terminal. Every schema change ends with `NOTIFY pgrst, 'reload schema';`.
- **RLS** uses the `current_user_team_id()` SECURITY DEFINER helper — never inline subqueries on `users` (infinite recursion). Every record scoped to its owning team.
- Governed by `Claude_Code_Database_Architecture_Standards.pdf` (project knowledge) for ALL Supabase work.
- **Edge Functions (Deno):** `invite-team-member`, `scan-tag`, `send-email`, `send-reminders`, `send-whatsapp`, `whatsapp-webhook`. Deploy per project: `supabase functions deploy <name> --project-ref <ref>` (Vercel push does NOT deploy edge functions). `whatsapp-webhook` deploys with `--no-verify-jwt`.
- **Cron:** pg_cron `wr-send-reminders` `0 4 * * *` UTC (07:00 Nairobi) both projects. Authenticated by `x-cron-secret` = `CRON_SECRET`. Rotating `CRON_SECRET` requires updating the pg_cron job header too, or nightly runs 401.

### 5c. WhatsApp subsystem (Meta Cloud API direct)
- **DRY mirror pair:** `supabase/functions/_shared/whatsapp.ts` ↔ `src/lib/whatsapp.js` — same `toE164Kenya`, `waParam`, `buildApptWaParams` (7 params, `{{7}}`=clinic contact; `appt_manual` has `{{7}}`=note, `{{8}}`=contact). `buildRsvpPayloads(visitId)` is server‑side only. **Change both files together.** The Graph API call lives ONLY in the `.ts` (the browser never holds the token).
- **Outbound:** `send-whatsapp` (browser‑facing, JWT + team check + `message_log`) and the `send-reminders` cron branch both POST `graph.facebook.com/v23.0/<PHONE_ID>/messages` with the approved template + quick‑reply button components carrying `CONFIRM:<visitId>` / `RESCHED:<visitId>` payloads.
- **Inbound:** `whatsapp-webhook` — GET = Meta verify handshake vs `WHATSAPP_WEBHOOK_VERIFY_TOKEN`; POST = verify `X-Hub-Signature-256` (HMAC‑SHA256 of raw body keyed with `WHATSAPP_APP_SECRET`) → decode button payload → set `rsvp_status` (`confirmed`/`reschedule_requested`, last tap wins) + `rsvp_at` → insert `message_log` (`received`). **Always returns 200** so Meta never disables the subscription. Uses the service‑role key (public endpoint, no JWT).
- **Two webhook layers (critical):** (1) app‑level Webhooks config — callback URL + verify token + subscribe the `messages` field; (2) **the WABA must be subscribed to the app** via `POST /<WABA_ID>/subscribed_apps` with the access token. **Both are required** — missing (2) means Meta captures taps but never delivers them. Do this on every WABA (TEST and PROD).
- **Gating:** a message sends only when `teams.whatsapp_enabled` AND patient `whatsapp_opt_in` AND a valid Kenyan mobile — otherwise nothing sends. Templates are template‑bound (no free text outside a 24h reply window).
- **Costs/limits:** utility ≈ KES 0.80/msg, marketing ≈ 5.20, 24h replies free. Unverified business = 250 business‑initiated conversations/day.

### 5d. Email subsystem
- DRY‑mirrored templates `src/lib/email.js` ↔ `supabase/functions/_shared/apptEmail.ts` (html + plain‑text — change both). `buildAppointmentEmail` → `{subject, html, text}`, threaded through all send paths. Sent via Resend.

---

## 6. LESSONS LEARNT (accumulated — append, don't overwrite)

- **Two webhook layers.** App‑level `messages` subscription is NOT enough — the WABA must also be subscribed to the app (`subscribed_apps`). Symptom: Meta shows the events, but your endpoint is never invoked. (23 Jul)
- **Verify delivery via the function logs.** The decisive test for "is Meta delivering?" is the edge‑function invocation log, not the Meta dashboard event feed. (23 Jul)
- **Publishing the Meta app** lifts the "unpublished ⇒ only test webhooks delivered" limit — needed for real taps, but it does NOT set the WABA subscription.
- **Divergent branches:** if `git merge --ff-only dev` refuses, reconcile first (`git merge origin/main` into dev), then ff‑merge. Don't force.
- **Temporary vs permanent WhatsApp tokens:** Graph console tokens die ~24h (Meta error 190). Use a system‑user never‑expire token.
- **Template approvals are per‑WABA**, not per‑app, not in code. A new number under a different WABA = fresh review.
- **WhatsApp template trailing text required:** a lone punctuation char after the last `{{n}}` fails ("Variables can't be at the start or end"); end with real words ("Thank you.").
- **Rotating a secret breaks its consumers until propagated:** `CRON_SECRET` → pg_cron header; `WHATSAPP_APP_SECRET` → the inbound webhook signature check. Reset and re‑set everywhere in one deliberate pass.
- **Seed SQL must key off the real TEST login** `test@wardrounds.com`; a wrong email silently inserts 0 rows and the function returns all‑zeros (looks like success). Always run the row‑count check after seeding.
- **Sandbox can't reach Supabase's network** and can't type into the user's Mac Terminal (terminals are click‑only); Claude runs SQL/browser itself, Emu runs `curl`/`git`/`supabase` in his terminal.
- **CSS‑only motion** with one IntersectionObserver replaces framer for landing reveals at ~zero runtime cost; framer‑free mock primitives can be shared, framer‑dependent ones must be statically replicated.
- **Hotmail Junk = new‑domain reputation** (SCL:5), not a DNS/auth gap — do not resurrect "add SPF/DMARC".

---

## 7. PROJECT RULES (non‑negotiable)

- **Read this document first every session; update it at the end of every session** (see top).
- **Diagnose before building.** Read raw file contents (`grep -n`/`sed -n`/full read) before designing any edit. Never guess schema, data shapes, or component structure.
- **Strictly DRY.** Grep for existing implementations before writing anything new. One function, one location, many consumers. Extend with append‑only params rather than forking. Keep documented mirror pairs (`whatsapp.ts`↔`whatsapp.js`, `email.js`↔`apptEmail.ts`) in sync.
- **Surgical edits only.** No full‑file rewrites (except when the whole file is the target). Content‑anchored `str_replace` — line numbers drift, anchors don't.
- **Strictly glassmorphic design** + pill buttons + iOS‑blue `#007AFF`. No `window.alert`/`confirm` — glass modals only.
- **Database:** all SQL in the Supabase SQL Editor only; every schema change ends `NOTIFY pgrst, 'reload schema';`; RLS via `current_user_team_id()`; `.maybeSingle()` for nullable; timestamps pin `Africa/Nairobi`; follow `Claude_Code_Database_Architecture_Standards.pdf`.
- **Permissions standing rule:** every new page/action/function registered in `src/lib/permissions.js`, enforced, and exposed as a Settings admin toggle. **No feature ships ungated.**
- **Done signal:** `npm run build` with zero errors + browser verification (screenshots). The >500 kB chunk warning is pre‑existing, not a failure. Flag unrun checks plainly.
- **Deploy discipline:** edge functions deploy per project (`--project-ref`); promote via `git checkout main && git merge --ff-only dev && git push origin main && git checkout dev` (if `--ff-only` refuses, STOP and reconcile).
- **Secrets:** never commit secret values (including into this file). One‑line terminal commands; `*` marks where a secret goes.
- **Cowork execution split:** Claude edits files, drives the browser + Supabase SQL Editor (read‑only SELECTs itself), and Meta config; Emu runs the terminal (`git`/`supabase`/`npm`/`curl`), the SQL Editor Run button for writes, real builds, and phone taps.

---

## 8. POST‑PRODUCTION BACKLOG (major future initiatives — each needs Emu direction/credentials)

1. **Landing pages — full overhaul.** One DRY component set for mobile+desktop; simplify animations; **delete the superseded split** (`Landing.jsx`/`MobileLanding.jsx`). Success = fast first paint on mid‑range phones, no jank, single source of truth.
2. **Super‑user (platform admin) account.** Oversee all teams (counts, users, subscriptions). Crosses the per‑team RLS boundary → dedicated server‑side `platform_admin` role (SECURITY DEFINER / Edge Function checks), never a client bypass; gated in `permissions.js`.
3. **Safaricom Daraja (M‑Pesa) payments.** STK Push / C2B for invoice settlement; credentials in Edge Function config only; ties into the accounting page + invoice flow.
4. **SMS booking/notification updates.** Africa's Talking (or equivalent); booked/rescheduled/cancelled + reminders; server‑side, gated.
5. **Accounting page (per‑team).** Invoices, payments (incl. M‑Pesa), balances, revenue, mark‑as‑paid, statements/export; team‑RLS + permissions; Settings admin‑toggle page.
6. **Holiday / WHO health‑day broadcasts** — *Marketing* category (stricter approval, per‑message cost, daily‑limit impact, shared‑number risk). Needs a separate marketing opt‑in + curated date list + per‑team enablement. Deliberate separate project, not an auto‑blast.
7. **Per‑team phone numbers/WABAs** in Meta (vs the single shared number) — affects template approval, routing, verification, per‑team `WHATSAPP_PHONE_NUMBER_ID` resolution.

---

## 9. KEY FILES & DEV COMMANDS

- Sender pair: `supabase/functions/_shared/whatsapp.ts` ↔ `src/lib/whatsapp.js`.
- Edge fns: `supabase/functions/{send-reminders,send-whatsapp,whatsapp-webhook,send-email,invite-team-member,scan-tag}/index.ts`.
- Email pair: `src/lib/email.js` ↔ `supabase/functions/_shared/apptEmail.ts`.
- Client WhatsApp surfaces: `src/components/ReminderComposeModal.jsx`, `src/components/RsvpBadge.jsx`, `src/pages/Settings.jsx`, `src/pages/Outpatient.jsx`, `src/components/NewVisitModal.jsx`.
- Permissions: `src/lib/permissions.js`. Legal: `src/pages/legal/Privacy.jsx`.
- SQL (schema, kept for reference): `WARDROUNDS_SQL_WHATSAPP_PHASE1_TEST.sql`, `WARDROUNDS_SQL_WHATSAPP_PHASE2_RSVP_TEST.sql`. Webhook test: `WARDROUNDS_WEBHOOK_RSVP_SIMULATE.sh`.
- Archived per‑session handoffs & plans: `docs/archive/`.

**Dev commands** (Emu's terminal):
```
cd ~/wardrounds && npm install && npm run dev      # Vite → http://localhost:5173 (append ?mobile=1 for mobile landing)
cd ~/wardrounds && npm run build                    # done signal: zero errors
supabase functions deploy <name> --project-ref ewkjhqhszbxnizqbosod   # TEST  (bannxzyidkgmbejyrzea = PROD)
```
