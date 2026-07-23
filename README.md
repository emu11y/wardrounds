# WardRounds — README & Operating Document

> **This README is the single source of truth for the project.** There are **no separate
> dated handoff files** — the running handoff lives here. (Old per‑session files are in
> `docs/archive/`.)
>
> ### 📖 READ‑FIRST & UPDATE‑LAST RULE (non‑negotiable)
> **Start of every session:** read this whole file, and recall the previous session from
> the top entry of the Work Log (§3).
> **End of every session:** update it in place — prepend a dated Work Log entry (§3),
> update phase/step status (§4), append new Lessons (§7), and refresh Next Steps (§5).
>
> _Last updated: 23 Jul 2026 — WhatsApp app published + RSVP verified end‑to‑end on TEST._

---

## 1. SESSION CLOSE‑OUT GUIDE — what to do when Emu says *"let's close out the session"*

When Emu asks to close out (or wrap up / end the session), do all of the following:

1. **Produce a comprehensive, structured summary of the session**, covering:
   - **Current objectives** — what we're driving toward.
   - **Key decisions made** this session.
   - **Important project files** touched or relevant.
   - **Important lessons learnt** this session.
   - **Exact next steps** — specific, ordered, copy‑pasteable where possible.
2. **Include dev‑server / restart instructions** (see §9).
3. **Recall the last session** — read the previous Work Log entry so continuity is preserved.
4. **Compile all findings into a to‑fix / to‑do list for the next session** (Cowork or Claude chat) — fold these into Next Steps (§5) and the phase status (§4).
5. **Update this README in place**, don't spawn a new file: prepend a new dated block to the Work Log (§3), tick/adjust phases (§4), append lessons (§7), refresh next steps (§5). Keep secret **values** out — names/IDs only.
6. **Apply the Rules (§6)** to everything.
7. **Cowork sessions only:** ALSO save a dated markdown copy of the summary to the **Downloads** folder (so it can be dropped into a new thread). File name like `WARDROUNDS_CLOSEOUT_YYYY-MM-DD.md`.
8. **Do NOT create separate per‑session handoff files in the repo** — everything lives in this README.

> The old workflow generated a downloadable handoff .md each session. That's replaced by
> updating this README (plus, for Cowork, the Downloads copy).

---

## 2. PROJECT OVERVIEW

**WardRounds** — a clinical practice‑management PWA for hospital teams in Nairobi, Kenya. Built by Dr. Ebrahim Yusuf (Emu) for his practice (Comprehensive Diabetes Centre). Core value: an authoritative personal fee/billing record matching hospital records, preventing revenue leakage for fee‑for‑service / visiting consultants. Pricing: KES 500/month after a 14‑day free trial. **Not an EMR** — no clinical notes/diagnoses/results.

**Stack:** React + Vite + Tailwind CSS · Supabase (Postgres + Auth + RLS + Storage) · Supabase Edge Functions (Deno) · Recharts · SheetJS · Claude Vision API (tag scanning) · Resend (email) · Meta WhatsApp Cloud API. GitHub `emu11y/wardrounds`. Hosting: Vercel (team `ward-monitor`, project `wardrounds`).

**Environments**
- **PROD:** `https://wardrounds.site` (branch `main`). Supabase ref `bannxzyidkgmbejyrzea`, publishable `sb_publishable_CJ4N9ejAfmP5tlwHJ781uQ_ozZUUX3Y`.
- **Staging:** `https://wardrounds-git-dev-ward-monitor.vercel.app` (branch `dev`, auto‑deploys). Supabase **TEST** ref `ewkjhqhszbxnizqbosod`, publishable `sb_publishable_WWD1rzuDeozClgPybaDXMw_1Zg0GQFf`. TEST login: `test@wardrounds.com` (NOT the hotmail address — seed SQL must key off this).

**Meta / WhatsApp IDs** (IDs, not secrets)
- Business portfolio `thyroid_kenya`, business_id `1239450534066576`.
- App **Wardrounds**, app id `2202646650298242` — **Published** (23 Jul).
- **TEST WABA** `1512386093333740`; test number `+1 555 155‑9940`, phone_number_id `1199957979870204`. Subscribed to app via `subscribed_apps` ✅.
- **PROD WABA** "Dr Ebrahim Yusuf Clinic" id `434693039737057` — empty (awaiting a production number).
- System user `wardrounds_server` holds the permanent token.
- Secret **names** only (values live in Supabase secrets / Meta): `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`.

**Email:** Resend, domain `wardrounds.site` verified, sender `WardRounds <reminders@wardrounds.site>`, html+text. DKIM/DMARC(`p=none`)/SPF all pass — Hotmail Junk is new‑domain reputation, NOT a DNS gap (do not re‑add SPF/DMARC). Namecheap mailbox `admin@wardrounds.site` (+ `privacy@` alias, receive‑only) active. Registrar: Namecheap.

---

## 3. DAILY WORK LOG (newest first — prepend one block per session)

### 2026‑07‑23 — WhatsApp go‑live: app PUBLISHED, RSVP verified end‑to‑end on TEST
- Audited state: WhatsApp far more built than earlier handoffs implied (Phases 1–6 all built on `dev`).
- Promoted `dev` → `main` (reconciled a divergence: merged `origin/main` into dev, then `--ff-only`). Production deployed; `https://wardrounds.site/privacy` live.
- Meta app: set Privacy policy URL, uploaded app icon, **Published** (was in Development).
- Verified outbound send end‑to‑end (real WhatsApp with Confirm / Need‑to‑reschedule buttons).
- **Diagnosed inbound failure** (real taps not reaching webhook) → root cause: **TEST WABA never subscribed to the app**. Function logs showed the webhook only ever hit by the signed simulation.
- **Fix:** `curl -X POST "https://graph.facebook.com/v23.0/1512386093333740/subscribed_apps" -H "Authorization: Bearer $WHATSAPP_TOKEN"` → `{"success":true}`. Re‑sent, tapped Confirm → `rsvp_status='confirmed'`. **RSVP round‑trip fully verified on TEST.**
- Consolidated all handoff docs into this README; archived old files to `docs/archive/`.
- ⚠️ `WHATSAPP_APP_SECRET` + `CRON_SECRET` were exposed in chat → **must be rotated** (scheduled 9am nudge). Open: PROD go‑live (Phase 7), rotation, `privacy@` receive test.

### 2026‑07‑22 — RSVP E2E prep + PROD schema
- Verified templates/buttons/`message_log`/schema; reset seed to today. Ran WhatsApp Phase 1+2 schema on **PROD** (gates OFF, behaviour unchanged). Built `/privacy` route + RSVP badge; activated `admin@`/`privacy@` mailbox. Flagged: app unpublished, TEST pg_cron secret drift.

### 2026‑07‑19 — WhatsApp RSVP built + inbound webhook live on TEST
- Phase 5 (utility templates) E2E PASSED; fixed Meta error 190 with a permanent system‑user token. Built Phase 6 (RSVP buttons + `whatsapp-webhook`), added `{{7}}` clinic contact, configured Meta webhook + subscribed `messages`. Shipped calendar redesign.

### (earlier — detail in `docs/archive/`)
- 16 Jul: mobile landing rebuilt (CSS‑only); plain‑text email; auto‑reminders live on PROD; WhatsApp planned.
- ≤15 Jul: core app, auth, RLS, permissions, invoicing, analytics, branded email, PROD launch.

---

## 4. PHASES & STEPS (status)

`[x]` done · `[~]` in progress · `[ ]` not started.

**Phase 1 — Core app** `[x]` (live) — auth, teams, per‑team RLS via `current_user_team_id()`, permissions layer, patients, visits, invoicing, analytics, tag scanning, export.

**Phase 2 — Landing pages** `[x]` (shipped) — desktop + CSS‑only mobile landing, promoted. `[ ]` full mobile+desktop DRY unification (backlog §8.1).

**Phase 3 — Email reminders** `[x]` (live) — `send-reminders` daily cron; 1w/1d/day‑of + confirmations + manual; html+text.

**Phase 4 — WhatsApp channel (schema + send)** `[x]` — schema TEST ✅ / PROD ✅ (gates OFF); sender pair, `send-whatsapp`, cron branch, Settings toggle, opt‑in, compose‑modal checkboxes.

**Phase 5 — Utility‑template E2E** `[x]` — 5 `appt_*` templates approved on TEST WABA; send verified.

**Phase 6 — RSVP (buttons + webhook + UI)** `[x]` (verified E2E on TEST 23 Jul) — `{{7}}` contact, quick‑reply payloads, `whatsapp-webhook`, RSVP badge, `messages` subscribed, **WABA subscribed to app**, app **Published**, `/privacy` live.

**Phase 7 — WhatsApp PROD go‑live** `[~]`
- `[x]` PROD schema applied, gates OFF.
- `[ ]` Production number → PROD WABA `434693039737057`.
- `[ ]` Recreate + approve the 5 `appt_*` templates **under the PROD WABA** (per‑WABA).
- `[ ]` Deploy `send-whatsapp`, `whatsapp-webhook` (`--no-verify-jwt`), `send-reminders` to PROD.
- `[ ]` `subscribed_apps` for the **PROD** WABA (do NOT skip — this was the missing step on TEST).
- `[ ]` PROD secrets; PROD webhook (callback `https://bannxzyidkgmbejyrzea.functions.supabase.co/whatsapp-webhook`, verify token, subscribe `messages`).
- `[ ]` Enable `teams.whatsapp_enabled` + patient opt‑in; real send+tap verify on PROD.
- `[ ]` Business Verification — **DEFERRED** (250 conv/day is enough; verify only when the cap is hit).

---

## 5. NEXT STEPS / TO‑FIX (for the next session)

1. **Rotate exposed secrets** `WHATSAPP_APP_SECRET` + `CRON_SECRET` (reset in Meta → re‑set in Supabase secrets everywhere; `CRON_SECRET` also needs the pg_cron job header updated on both projects). A 9am scheduled nudge is set.
2. **PROD WhatsApp go‑live** — Phase 7 steps above (production number → templates → deploy fns → `subscribed_apps` → secrets → webhook → enable per team → verify).
3. **Fix TEST pg_cron `CRON_SECRET` drift** — nightly TEST runs 401 until the job header is updated (manual curl sidesteps).
4. **Send a test email to `privacy@wardrounds.site`** to confirm receipt.
5. Commit the docs consolidation: `cd ~/wardrounds && git add -A && git commit -m "docs: consolidate handoffs into README; archive old files" && git push origin dev`.

---

## 6. RULES (non‑negotiable — apply to every task)

- **Read this README first every session; update it at close‑out** (§1).
- **Three‑player workflow (non‑Cowork chats):** Claude.ai (chat) = architect, prompt author, diagnostic lead; Claude Code (terminal) = sole file editor (all code executes there); Emu = human relay pasting prompts/output between the two. **Fast path:** Emu pastes/uploads the whole file into chat; Claude.ai designs surgical changes + writes exact anchored `str_replace` prompts; Emu relays to Claude Code (or downloads a produced file and drops it into the repo).
- **Cowork execution split:** Claude edits files, drives the browser + Supabase SQL Editor (runs read‑only SELECTs itself) + Meta config; Emu runs the terminal (`git`/`supabase`/`npm`/`curl`), the SQL Editor Run button for writes, real builds, and phone taps.
- **Diagnose before building.** Read raw file contents (`grep -n`/`sed -n`/full upload) before designing any edit. Never guess schema, data shapes, or component structure. Claude Code must paste **raw** output, not summaries (it tends to summarize — push back; workaround: write to `/tmp/*.txt` and `cat`).
- **Strictly DRY.** Grep for existing implementations before writing anything new. One function, one location, many consumers. Extend with append‑only params, not forks. Keep documented mirror pairs (`whatsapp.ts`↔`whatsapp.js`, `email.js`↔`apptEmail.ts`) in sync.
- **Surgical edits only.** No full‑file rewrites. Content‑anchored `str_replace` (line numbers drift; anchors don't).
- **Strictly glassmorphic design:** light `bg-white/90 backdrop-blur-xl border border-white/60 rounded-2xl`; canonical `.glass-rim` in `src/styles/globals.css`; **pill (`rounded-full`) buttons**; iOS blue **#007AFF** accent. **No `window.alert`/`confirm` — glass modals only.**
- **Database:** follow **`Claude_Code_Database_Architecture_Standards.pdf`** (project‑knowledge upload) for ALL Supabase work. **All SQL runs only in the Supabase SQL Editor** (never via Claude Code / CLI). Every schema change ends with `NOTIFY pgrst, 'reload schema';`. RLS uses the `current_user_team_id()` SECURITY DEFINER helper (never inline subqueries on `users` — infinite recursion). `.maybeSingle()` for nullable queries. Timestamps pin `timeZone: 'Africa/Nairobi'`.
- **Permissions standing rule:** every new page/action/function registered in `src/lib/permissions.js`, enforced (`PageGuard` / `RevenueValue` / action gate), and exposed as an admin toggle in Settings. **No feature ships ungated.**
- **Done signal:** `npm run build` with **zero errors** + browser verification (screenshots). Unrun checks flagged plainly. The chunk‑size (>500 kB) warning is pre‑existing, not a failure.
- **Deploy discipline:** edge functions deploy per project (`--project-ref`); promote via `git checkout main && git merge --ff-only dev && git push origin main && git checkout dev` (if `--ff-only` refuses, STOP and reconcile). Never commit secret values (incl. into this file). One‑line terminal commands; `*` marks a secret.

---

## 7. LESSONS LEARNT (accumulated — append, don't overwrite)

- **Two webhook layers.** App‑level `messages` subscription is NOT enough — the WABA must also be subscribed to the app (`POST /<WABA_ID>/subscribed_apps`). Symptom: Meta shows the events, but your endpoint is never invoked. (23 Jul)
- **Verify delivery via the edge‑function invocation log**, not the Meta dashboard event feed. (23 Jul)
- **Publishing the Meta app** lifts "unpublished ⇒ only test webhooks", but does NOT set the WABA subscription.
- **Divergent branches:** if `git merge --ff-only dev` refuses, reconcile first (merge `origin/main` into dev), then ff‑merge. Don't force.
- **Temporary vs permanent WhatsApp tokens:** Graph console tokens die ~24h (error 190). Use a system‑user never‑expire token.
- **Template approvals are per‑WABA**, not per‑app, not in code.
- **WhatsApp template trailing text required:** a lone punctuation char after the last `{{n}}` fails; end with real words ("Thank you.").
- **Rotating a secret breaks its consumers until propagated:** `CRON_SECRET` → pg_cron header; `WHATSAPP_APP_SECRET` → webhook signature check. Reset + re‑set everywhere in one pass.
- **Seed SQL must key off the real TEST login** `test@wardrounds.com`; a wrong email silently inserts 0 rows (function returns all‑zeros = looks like success). Run the row‑count check after seeding.
- **The Cowork sandbox can't reach Supabase's network** and can't type into the Mac Terminal (terminals are click‑only); Claude runs SQL/browser itself, Emu runs `curl`/`git`/`supabase`.
- **CSS‑only motion** (one IntersectionObserver) replaces framer for landing reveals; framer‑free mock primitives are shareable, framer‑dependent ones must be statically replicated.
- **Hotmail Junk = new‑domain reputation** (SCL:5), not a DNS/auth gap — don't re‑add SPF/DMARC.

---

## 8. POST‑PRODUCTION BACKLOG (major future initiatives — each needs Emu direction/credentials)

1. **Landing pages — full overhaul.** One DRY component set for mobile+desktop; simplify animations; delete the superseded split. Success = fast first paint on mid‑range phones, no jank.
2. **Super‑user (platform admin) account.** Oversee all teams (counts, users, subscriptions). Crosses RLS → dedicated server‑side `platform_admin` role, never a client bypass; gated in `permissions.js`.
3. **Safaricom Daraja (M‑Pesa) payments.** STK Push / C2B for invoice settlement; credentials in Edge Function config only.
4. **SMS booking/notification updates.** Africa's Talking (or equivalent); server‑side, gated.
5. **Accounting page (per‑team).** Invoices, payments (incl. M‑Pesa), balances, revenue, mark‑as‑paid, statements/export; team‑RLS + permissions; Settings admin‑toggle page.
6. **Holiday / WHO health‑day broadcasts** — *Marketing* category (stricter approval, per‑message cost, shared‑number risk). Separate marketing opt‑in + curated date list + per‑team enablement. Deliberate separate project, not an auto‑blast.
7. **Per‑team phone numbers/WABAs** in Meta (vs the shared number) — affects template approval, routing, verification, per‑team `WHATSAPP_PHONE_NUMBER_ID` resolution.

---

## 9. ARCHITECTURE, KEY FILES & DEV COMMANDS

### Frontend
React + Vite + Tailwind. Routes lazy‑loaded in `src/App.jsx`; `/privacy` is public (readable signed‑out). **Glassmorphic** design system (see Rules). Landing animation is **CSS‑only** (no framer/Lenis) via one IntersectionObserver; framer‑free mock primitives (`MacBookFrame`, `PhoneFrame`, `MockSectionPanel`, `StatCard`, `BarChart`) are shared, framer‑dependent ones (`PatientCard`, `MockCardHeader`, `DashboardMock`) replicated statically. Everything gated in `src/lib/permissions.js`. `.maybeSingle()` for nullable reads; timestamps pin `Africa/Nairobi`.

### Backend / data (Supabase)
All SQL in the SQL Editor only; every schema change ends `NOTIFY pgrst, 'reload schema';`. RLS via `current_user_team_id()` SECURITY DEFINER. Edge fns (Deno): `invite-team-member`, `scan-tag`, `send-email`, `send-reminders`, `send-whatsapp`, `whatsapp-webhook`. Deploy per project (`--project-ref`); `whatsapp-webhook` uses `--no-verify-jwt`. pg_cron `wr-send-reminders` `0 4 * * *` UTC (07:00 Nairobi) both projects, auth via `x-cron-secret`=`CRON_SECRET`.

### WhatsApp subsystem
DRY pair `supabase/functions/_shared/whatsapp.ts` ↔ `src/lib/whatsapp.js` (`toE164Kenya`, `waParam`, `buildApptWaParams` — 7 params, `{{7}}`=clinic contact; `appt_manual` `{{7}}`=note/`{{8}}`=contact; `buildRsvpPayloads` server‑only). Graph call lives only in the `.ts`. **Outbound:** `send-whatsapp` (JWT+team check+`message_log`) and the `send-reminders` cron branch POST `graph.facebook.com/v23.0/<PHONE_ID>/messages` with quick‑reply payloads `CONFIRM:<visitId>`/`RESCHED:<visitId>`. **Inbound:** `whatsapp-webhook` — GET verify handshake vs `WHATSAPP_WEBHOOK_VERIFY_TOKEN`; POST verifies `X-Hub-Signature-256` (HMAC‑SHA256 raw body keyed by `WHATSAPP_APP_SECRET`) → sets `rsvp_status` + `rsvp_at` → inserts `message_log`; always returns 200; uses service‑role key. **Two webhook layers both required:** app‑level `messages` subscription AND `POST /<WABA_ID>/subscribed_apps`. Gating: sends only when `teams.whatsapp_enabled` AND patient `whatsapp_opt_in` AND a valid Kenyan mobile. Limits: utility ≈ KES 0.80, marketing ≈ 5.20; unverified = 250 conv/day.

### Email subsystem
DRY pair `src/lib/email.js` ↔ `supabase/functions/_shared/apptEmail.ts` (html + text — change both); `buildAppointmentEmail` → `{subject, html, text}`; sent via Resend.

### Key files
Sender pair (above) · edge fns `supabase/functions/{send-reminders,send-whatsapp,whatsapp-webhook,send-email,invite-team-member,scan-tag}/index.ts` · email pair (above) · client surfaces `src/components/{ReminderComposeModal,RsvpBadge,NewVisitModal}.jsx`, `src/pages/{Settings,Outpatient}.jsx` · `src/lib/permissions.js` · `src/pages/legal/Privacy.jsx` · schema SQL `WARDROUNDS_SQL_WHATSAPP_PHASE{1,2}*.sql` · webhook test `WARDROUNDS_WEBHOOK_RSVP_SIMULATE.sh` · archived handoffs `docs/archive/`.

### Dev commands (Emu's terminal)
```
cd ~/wardrounds && npm install && npm run dev      # Vite → http://localhost:5173 (append ?mobile=1 for mobile landing)
cd ~/wardrounds && npm run build                    # done signal: zero errors (>500 kB chunk warning is fine)
supabase functions deploy <name> --project-ref ewkjhqhszbxnizqbosod   # TEST  (bannxzyidkgmbejyrzea = PROD; add --no-verify-jwt for whatsapp-webhook)
git checkout main && git merge --ff-only dev && git push origin main && git checkout dev   # promote (STOP if ff-only refuses)
```
