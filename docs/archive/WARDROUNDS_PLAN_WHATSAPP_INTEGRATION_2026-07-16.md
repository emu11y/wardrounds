# WardRounds — WhatsApp Integration Plan — 16 Jul 2026

**Decisions (Emu, this session):** Provider = **Meta WhatsApp Cloud API (direct)** · Scope phase 1 = **auto reminders + booking confirmations + manual reminders** · Channel logic = **both channels** (email + WhatsApp when both exist) · Birthday/holiday/health-day wishes = **deferred to Phase B** (Meta classes these as *marketing* templates — ~KES 5.20/msg vs ~0.80 utility, stricter opt-in).

**Key API facts (verified Jul 2026):** On-Premise API retired (Oct 2025) — Cloud API is the only route. Per-message pricing: utility ≈ KES 0.80, marketing ≈ KES 5.20, replies within the 24h service window free. Business-initiated messages outside a 24h window **must use pre-approved templates** — including "manual" reminders (free text only allowed inside an open 24h window after the patient messages you).

---

## PHASE 0 — Meta setup (Emu, manual — no code)

1. **Meta Business Portfolio** at business.facebook.com; start **Business Verification** (docs: registration cert / utility bill). Unverified accounts are limited to 250 business-initiated conversations/day — fine for rollout; verification lifts limits.
2. **Meta developer app** (developers.facebook.com) → add **WhatsApp** product → creates a WhatsApp Business Account (WABA). Meta gives a free **test number** (up to 5 recipient numbers) — use this for ALL dev/TEST work before buying a number.
3. **Dedicated phone number** for production (must NOT be registered on the WhatsApp app; a fresh Safaricom SIM works — it only needs to receive one verification SMS/call). Display name e.g. "WardRounds".
4. **System User → permanent access token** (never the 24h temporary token): Business Settings → System Users → create `wardrounds-server`, assign the app + WABA, generate token with `whatsapp_business_messaging` scope.
5. **Record:** `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` (test number id for TEST, real number id for PROD later).
6. **Create + submit utility templates** (WhatsApp Manager → Message Templates, category *Utility*, language English). Approval usually minutes–hours. Proposed set — all share the same variable order `{{1}}=patient first name, {{2}}=practice name, {{3}}=date, {{4}}=time, {{5}}=doctor, {{6}}=location`:
   - `appt_reminder_1w` — "Hello {{1}}, a reminder from {{2}}: you have an appointment on {{3}} at {{4}} with {{5}} at {{6}}. Reply to this message if you need to reschedule."
   - `appt_reminder_1d` — same body, "tomorrow" phrasing.
   - `appt_reminder_dayof` — "today" phrasing.
   - `appt_confirmation` — "Hello {{1}}, your appointment with {{2}} is confirmed for {{3}} at {{4}} with {{5}} at {{6}}."
   - `appt_manual` — reminder body + one free-ish slot `{{7}}=staff note` (constrained: Meta rejects templates that are one giant variable; keep the note as an optional short trailing line).

**Multi-tenant note:** one number sends for all teams; per-team branding lives in `{{2}} practice name` (from `teams`), exactly like the email templates.

---

## PHASE 1 — Schema (SQL Editor only, TEST first → verify → PROD)

```sql
-- patients: consent + normalised number
alter table patients add column if not exists whatsapp_opt_in boolean not null default false;

-- outpatient_visits: per-channel idempotency (email columns stay untouched)
alter table outpatient_visits
  add column if not exists reminder_1w_wa_sent_at timestamptz,
  add column if not exists reminder_1d_wa_sent_at timestamptz,
  add column if not exists reminder_dayof_wa_sent_at timestamptz;

-- teams: channel toggle (mirrors reminders_enabled)
alter table teams add column if not exists whatsapp_enabled boolean not null default false;

-- audit log for every outbound message (both channels, append-only)
create table if not exists message_log (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id),
  patient_id uuid references patients(id),
  visit_id uuid references outpatient_visits(id),
  channel text not null check (channel in ('email','whatsapp')),
  template text,
  recipient text not null,
  status text not null default 'sent',   -- sent | delivered | read | failed (webhook updates later)
  provider_message_id text,               -- Resend id / WhatsApp wamid
  error text,
  created_at timestamptz not null default now()
);
-- RLS: team-scoped via current_user_team_id(); inserts from edge functions use service role.
notify pgrst, 'reload schema';
```

Separate `_wa_sent_at` columns keep the two channels independently idempotent — email success never suppresses a WhatsApp retry and vice versa. Keep default `whatsapp_enabled=false` so nothing sends until a team opts in via Settings.

---

## PHASE 2 — Shared send module (code, `dev` branch)

DRY mirror pair, same pattern as the email template system (§6 of prior handoff):

- **`supabase/functions/_shared/whatsapp.ts`** — `toE164Kenya(phone)` (07…/7…/+254… → `254…`; return null if unparseable) + `sendWhatsAppTemplate({ to, template, params })` → `POST https://graph.facebook.com/v23.0/${WHATSAPP_PHONE_NUMBER_ID}/messages` with `Authorization: Bearer ${WHATSAPP_TOKEN}`, body `{ messaging_product:'whatsapp', to, type:'template', template:{ name, language:{code:'en'}, components:[{type:'body', parameters: params.map(p=>({type:'text',text:p}))}] } }`. Returns `{ ok, wamid, error }` — never throws (same "Safe" contract as email).
- **`src/lib/whatsapp.js`** — client mirror: `toE164Kenya` + `buildApptWaParams(visit, team, patient)` producing the ordered `{{1}}…{{6}}` params from the same data `buildAppointmentEmail` consumes. **No token in the browser** — client paths call the new edge function below.
- **New edge function `send-whatsapp`** — browser-facing generic sender mirroring `send-email/index.ts`: auth via user JWT, validates team membership, calls `sendWhatsAppTemplate`, writes `message_log`.

**Secrets (one line, `*` = values):** `supabase secrets set WHATSAPP_TOKEN=**** WHATSAPP_PHONE_NUMBER_ID=**** --project-ref ewkjhqhszbxnizqbosod && supabase secrets set WHATSAPP_TOKEN=**** WHATSAPP_PHONE_NUMBER_ID=**** --project-ref bannxzyidkgmbejyrzea`

---

## PHASE 3 — Wire the three send paths

1. **`send-reminders/index.ts` (cron):** after the existing email branch, if `team.whatsapp_enabled && patient.whatsapp_opt_in && toE164Kenya(patient.phone)` and the matching `_wa_sent_at` is null → send the tier's template, stamp `_wa_sent_at`, log to `message_log`. Email logic untouched. Extend the summary JSON with `whatsapp: {sent, skipped, failed}` counts.
2. **Booking confirmation (`sendAppointmentEmailSafe` call sites):** add `sendAppointmentWhatsAppSafe` alongside (calls `send-whatsapp` with `appt_confirmation`). Fire both; failures independent.
3. **`ReminderComposeModal.jsx`:** add channel checkboxes (Email / WhatsApp — WhatsApp enabled only when patient has valid phone + opt-in + team toggle). WhatsApp path sends `appt_manual` with the staff note as `{{7}}`; show plainly that WhatsApp text is template-bound.

---

## PHASE 4 — UI + permissions (standing rules apply)

- **Settings → Practice Details:** second glass toggle "**WhatsApp reminders**" under the existing email one (`teams.whatsapp_enabled` via `saveTeamProfile`). Admin-gated.
- **Patient forms / check-in:** "WhatsApp reminders OK" opt-in checkbox next to the phone field (consent is a Meta policy requirement, and good practice for health comms).
- **`src/lib/permissions.js`:** register the new action(s) (e.g. `send_whatsapp`), enforce on the modal + edge function, expose admin toggle. **No feature ships ungated.**
- Glassmorphic + pill buttons + `#007AFF`; no `window.alert/confirm`.

---

## PHASE 5 — Verify → promote (workflow rules)

1. All work on `dev`; TEST project + **Meta test number** with Emu's phone as an allowed recipient.
2. Seed a today-dated `WR_SEED_TEST` visit (patient with Emu's email + phone, `whatsapp_opt_in=true`), curl the TEST `send-reminders` → expect email **and** WhatsApp received; check `message_log`; then run the standard seed cleanup.
3. `npx esbuild` syntax checks in sandbox; real `npm run build` on Emu's machine.
4. Deploy edge functions to TEST, verify, then: `cd ~/wardrounds && git checkout main && git merge --ff-only dev && git push origin main && git checkout dev` and `supabase functions deploy send-reminders --project-ref bannxzyidkgmbejyrzea && supabase functions deploy send-whatsapp --project-ref bannxzyidkgmbejyrzea`.
5. Switch PROD secrets to the real number's `WHATSAPP_PHONE_NUMBER_ID` once the production number is registered.

---

## PHASE A+ (optional, later)

- **Delivery webhook:** new edge function `whatsapp-webhook` (Meta verify-token handshake + status events) updating `message_log.status` to delivered/read/failed. Also receives inbound patient replies → opens the free 24h service window. Recommended soon after launch; not required to send.
- **PHASE B — Wishes/campaigns (birthday, public holidays, world/Kenya health days):** *marketing* category templates (~KES 5.20/msg), separate explicit marketing opt-in field, a `campaigns` table + second pg_cron job, `patients.date_of_birth` for birthdays, static calendar table for health days. Plan as its own session once utility comms are stable.

---

## Cost & limits snapshot

Utility ≈ KES 0.80/msg delivered · "both channels" means each reminder tier costs ~0.80 on top of the (free-tier) email · unverified WABA capped at 250 business-initiated conversations/day, lifted after Business Verification · template approval typically fast but budget a day.

## Risks / watch-items

- **Template rejection:** keep bodies transactional, no promotional wording.
- **Number quality rating:** Meta throttles numbers with user blocks/reports — opt-in checkbox protects this.
- **Manual reminders are template-bound** — staff cannot send arbitrary text outside a 24h window; the modal must make this visible.
- **Phone hygiene:** `toE164Kenya` must reject junk rather than send to a wrong number.
