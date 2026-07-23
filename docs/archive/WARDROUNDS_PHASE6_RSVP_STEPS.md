# WardRounds — Phase 6: WhatsApp RSVP buttons + inbound webhook

> Built 19 Jul 2026 (Cowork session #9). Adds **Confirm / Need to reschedule**
> quick-reply buttons to all five `appt_*` templates and an inbound
> `whatsapp-webhook` edge function that records the patient's tap on the visit.
> Everything is TEST-only (`ewkjhqhszbxnizqbosod`) until verified — never touch
> PROD (`bannxzyidkgmbejyrzea`) here.

## What changed (already committed to the repo — Emu just deploys)

| File | What |
|---|---|
| `WARDROUNDS_SQL_WHATSAPP_PHASE2_RSVP_TEST.sql` | Adds `outpatient_visits.rsvp_status` + `rsvp_at`. Additive/idempotent. |
| `supabase/functions/_shared/whatsapp.ts` ↔ `src/lib/whatsapp.js` | `buildApptWaParams` now emits **{{7}} = clinic contact** (practice_phone → phone → practice_email). `appt_manual`: staff note stays {{7}}, contact shifts to {{8}}. New `buildRsvpPayloads(visitId)` → `["CONFIRM:<id>","RESCHED:<id>"]`. `sendWhatsAppTemplate` accepts `buttonPayloads`. **DRY mirror pair — keep in sync.** |
| `supabase/functions/send-reminders/index.ts` · `send-whatsapp/index.ts` | Both pass `buttonPayloads: buildRsvpPayloads(visitId)` at send time. |
| `supabase/functions/whatsapp-webhook/index.ts` (new + `deno.json`) | Public endpoint. GET = Meta verify handshake (`WHATSAPP_WEBHOOK_VERIFY_TOKEN`). POST = verifies `X-Hub-Signature-256` against `WHATSAPP_APP_SECRET`, then on a `button` message decodes `CONFIRM:`/`RESCHED:<uuid>`, sets `rsvp_status` = `confirmed` / `reschedule_requested` + `rsvp_at`, logs a `message_log` row (status `received`). Always returns 200 so Meta never disables the subscription. |
| `supabase/config.toml` | Registers `whatsapp-webhook` with `verify_jwt = false`. |
| `src/components/ReminderComposeModal.jsx` | Note updated: patients now RSVP via buttons (no longer "can't reply"). |

**Templates:** all five edited in WhatsApp Manager with the new bodies (bold
practice name + date/time, contact line in its own paragraph, "Please RSVP using
the buttons below") and two quick-reply buttons **Confirm** / **Need to
reschedule**. All five are **In review** as of submission. Buttons must stay in
this order — the webhook maps button 0 → confirm, 1 → reschedule via payload.

## Emu's steps (in order)

### 1. Schema — TEST SQL Editor
Run `WARDROUNDS_SQL_WHATSAPP_PHASE2_RSVP_TEST.sql` (ends with `notify pgrst`).

### 2. Secrets — terminal (`*` = secret value)
Two NEW secrets for the webhook. Pick any random string for the verify token;
the app secret is in Meta App Dashboard → App settings → Basic → App secret.

```
supabase secrets set WHATSAPP_APP_SECRET=**** WHATSAPP_WEBHOOK_VERIFY_TOKEN=**** --project-ref ewkjhqhszbxnizqbosod
```

Save the verify-token value — the Meta webhook config (step 4) needs the exact same string.

### 3. Deploy — terminal (one line each)
```
supabase functions deploy whatsapp-webhook --project-ref ewkjhqhszbxnizqbosod --no-verify-jwt
supabase functions deploy send-reminders --project-ref ewkjhqhszbxnizqbosod
supabase functions deploy send-whatsapp --project-ref ewkjhqhszbxnizqbosod
```

Callback URL will be: `https://ewkjhqhszbxnizqbosod.functions.supabase.co/whatsapp-webhook`

### 4. Meta webhook config — Claude drives the browser
Once the function is deployed and the verify token is set, tell Claude and it will:
open App Dashboard → WhatsApp → Configuration → Callback URL = the URL above,
Verify token = the string from step 2, subscribe to the **messages** field. (Meta
sends a GET handshake; the function echoes the challenge if the token matches.)
Emu completes any OAuth/confirm popups.

## Verify (after templates are APPROVED + steps 1–4 done)

RSVP needs an approved template with buttons, so wait for the five to clear review.
Then reuse the Phase 5 seed (`WR_SEED_TEST`, see `WARDROUNDS_PHASE5_E2E_STEPS.md`)
— but first reset the day-of WhatsApp stamp so it re-sends:

```sql
update outpatient_visits v set reminder_dayof_wa_sent_at = null
from patients p where p.id = v.patient_id and p.first_name = 'WR_SEED_TEST';
```

1. Re-run the send-reminders curl (Phase 5 step 2) → WhatsApp arrives with two buttons.
2. On the phone, tap **Confirm**.
3. TEST SQL Editor:
```sql
select v.rsvp_status, v.rsvp_at
from outpatient_visits v join patients p on p.id = v.patient_id
where p.first_name = 'WR_SEED_TEST';

select channel, template, status, provider_message_id, created_at
from message_log order by created_at desc limit 5;
```
Expect `rsvp_status = confirmed`, `rsvp_at` set, and a `message_log` row
`whatsapp / rsvp_confirmed / received`. Tap **Need to reschedule** → status flips
to `reschedule_requested` (last tap wins).

## After E2E passes → promote to PROD (unchanged caveats)
- Run both `WARDROUNDS_SQL_WHATSAPP_PHASE1_TEST.sql` and `..._PHASE2_RSVP_TEST.sql` on PROD SQL Editor.
- `supabase secrets set WHATSAPP_APP_SECRET=**** WHATSAPP_WEBHOOK_VERIFY_TOKEN=**** --project-ref bannxzyidkgmbejyrzea`
- Deploy `whatsapp-webhook` (`--no-verify-jwt`), `send-reminders`, `send-whatsapp` to PROD.
- Configure the PROD webhook in Meta (same steps, PROD callback URL).
- `git checkout main && git merge --ff-only dev && git push origin main && git checkout dev`
- PROD stays on the TEST number id until the real number exists; keep every team's `whatsapp_enabled` off until then.

## Follow-ups (not built)
- Surface `rsvp_status` in the Outpatient list / visit view (badge: Confirmed / Reschedule requested).
- Optional: notify the team when a patient requests a reschedule.
