# WardRounds — Phase 6 RSVP E2E — run sheet (22 Jul 2026)

> Supersedes the "Verify" section of `WARDROUNDS_PHASE6_RSVP_STEPS.md`, which was
> written on 19 Jul and is now stale in two places (seed date, publish state).
> TEST only (`ewkjhqhszbxnizqbosod`). PROD (`bannxzyidkgmbejyrzea`) untouched.

---

## A. What Claude verified (no changes made)

| Check | Result |
|---|---|
| `whatsapp.ts` ↔ `whatsapp.js` mirror | In sync. Same `toE164Kenya`, `waParam`, `buildApptWaParams` (7 params, {{7}} = clinic contact). `buildRsvpPayloads` server-side only, as documented. |
| Approved template bodies (all 5, read in WhatsApp Manager) | `appt_confirmation`, `appt_reminder_1w`, `appt_reminder_1d`, `appt_reminder_dayof` = **7 variables**. `appt_manual` = **8** ({{7}} note, {{8}} contact). Exactly what the code emits. |
| Button order on all 5 | **Confirm** (index 0) then **Need to reschedule** (index 1) — matches `buildRsvpPayloads` and the webhook's `CONFIRM`/`RESCHED` mapping. |
| Template status | All five **Active – Quality pending** (approved). |
| Meta webhook config | Callback URL `…/whatsapp-webhook` saved, verify token set, **`messages` field subscribed**. |
| `message_log` constraints | `channel` check allows `whatsapp`; `status` has **no** check constraint, so the webhook's `'received'` will insert cleanly. |
| TEST schema | `rsvp_status`, `rsvp_at` present and NULL on the seed visit. |
| pg_cron `wr-send-reminders` | Active, `0 4 * * *`. Its `x-cron-secret` header still starts `ec44757b…` — the rotated secret starts `b5c33b0f…`. **Drift confirmed.** |

---

## B. Three things that block the E2E as written

### B1. The seed visit was stale — **FIXED 22 Jul, already run**

Claude ran the reset below in the TEST SQL Editor. Result: 1 row updated —
`visit_date = 2026-07-22`, `visit_time = 15:00 Nairobi`, `status = scheduled`, both day-of
stamps and both RSVP fields back to null. **Nothing to do here unless the seed goes stale
again (i.e. you pick this up on a later date), in which case re-run it.**

The original problem: the visit was dated **2026-07-19**

`WARDROUNDS_PHASE6_RSVP_STEPS.md` says to null `reminder_dayof_wa_sent_at` and re-run.
That will **not** fire: the day-of window matches `visit_date = today`. The visit must be
moved to today as well. Corrected reset (TEST SQL Editor — Emu runs, it is an UPDATE):

```sql
update outpatient_visits v
set visit_date                = (now() at time zone 'Africa/Nairobi')::date,
    visit_time                = ((now() at time zone 'Africa/Nairobi')::date + time '15:00')
                                at time zone 'Africa/Nairobi',
    reminder_dayof_sent_at    = null,
    reminder_dayof_wa_sent_at = null,
    rsvp_status               = null,
    rsvp_at                   = null
from patients p
where p.id = v.patient_id and p.first_name = 'WR_SEED_TEST';

notify pgrst, 'reload schema';
```

Seed row still exists (Phase 5 cleanup was never run): patient `WR_SEED_TEST`,
phone `254713377374`, `whatsapp_opt_in = true`, team `whatsapp_enabled = true` and
`reminders_enabled = true`, visit id **`b16bc556-782d-4b63-810c-d850702f9c39`**.

### B2. pg_cron secret drift (does not block the manual curl)

The manual curl in §C uses the *current* `CRON_SECRET`, so it works regardless. Fix the
job only if you want TEST nightly runs alive again (SQL Editor, Emu runs, `****` = the
current CRON_SECRET):

```sql
select cron.alter_job(
  (select jobid from cron.job where jobname = 'wr-send-reminders'),
  command := replace(
    (select command from cron.job where jobname = 'wr-send-reminders'),
    'ec44757b7219c8',   -- old secret prefix as stored; replace with the FULL old value
    '****'              -- full current CRON_SECRET
  )
);
```

Simpler and safer: re-issue the original `cron.schedule(...)` statement with the new
header value rather than a string replace. Your call.

### B3. The Meta app is **Unpublished** — real button taps will NOT reach the webhook

Confirmed on screen, in the Configure Webhooks panel:

> "Apps will only be able to receive test webhooks sent from the app dashboard while
> the app is unpublished. No production data, including from app admins, developers
> or testers, will be delivered unless the app has been published."

So step 2 of the old plan ("tap Confirm on the phone") cannot pass yet. The **Publish**
button is disabled because App settings → Basic is missing:

- **Privacy policy URL** — empty. *(There is no `/privacy` route in the app; one has to be built.)*
- **Category** — empty.
- **App icon** — not uploaded.

(Terms of Service URL and User data deletion are set to `https://www.facebook.com/`
placeholders — acceptable to Meta but worth replacing with real URLs eventually.)

**Interim:** §D verifies the whole inbound path without Meta, by POSTing a correctly
signed synthetic button payload straight at the deployed webhook. That exercises
signature verification → payload decode → `rsvp_status` write → `message_log` insert.
The only thing it does not prove is Meta's delivery hop.

---

## B4. PROD schema gap — **RESOLVED 22 Jul, already run**

Claude ran WhatsApp Phase 1 + Phase 2 on the **PROD** SQL Editor (`bannxzyidkgmbejyrzea`).
Pre-flight confirmed PROD had none of it and that `current_user_team_id()` exists.
Post-run verification on PROD:

| Check | Result |
|---|---|
| `outpatient_visits` WhatsApp columns (`rsvp_status`, `rsvp_at`, 3 × `_wa_sent_at`) | **5 / 5** |
| `patients.whatsapp_opt_in` · `teams.whatsapp_enabled` | present |
| `message_log` table + RLS policy | created, **1** policy (`team members can read message_log`) |
| Every PROD team `whatsapp_enabled = false` | **true** |
| Every PROD patient `whatsapp_opt_in = false` | **true** |

So PROD is schema-ready and behaviourally unchanged — nothing can send, because both gates
default off. `dev` → `main` can now be promoted safely. Supabase raised its usual two warnings
(create-table-without-RLS, and "destructive" for the `drop policy if exists`); RLS was enabled
via the dialog, and the dropped policy did not exist on PROD.

The original problem, for the record:

`src/lib/api.js` → `fetchUpcomingPatientVisits` now names `rsvp_status` in an **explicit
select list**. That column exists on TEST but **not on PROD** (PROD has no WhatsApp schema at
all). PostgREST errors on an unknown column, so merging `dev` → `main` as-is would break the
patient booking-search on wardrounds.site.

Every other visit query selects `*`, so this one query is the whole exposure. Two ways out:

1. **Run `WARDROUNDS_SQL_WHATSAPP_PHASE1_TEST.sql` then `WARDROUNDS_SQL_WHATSAPP_PHASE2_RSVP_TEST.sql`
   on the PROD SQL Editor first** (both additive and idempotent; `whatsapp_enabled` and
   `whatsapp_opt_in` default to **false**, so adding them sends nothing and changes no
   behaviour). Then promote. — *recommended, and it was already the plan in §F.*
2. Drop `rsvp_status` from that one select and promote without the schema. The booking-search
   dots then stay amber even for RSVP'd visits until PROD catches up.

`/privacy` has to be on `main` for `https://wardrounds.site/privacy` to resolve, so this has
to be settled before Meta gets the URL.

---

## C. Outbound leg (works today) — Emu runs

1. ~~Run the B1 reset SQL~~ — already done, see B1.
2. Trigger the reminder (one line, `****` = current CRON_SECRET):

```
curl -s -X POST 'https://ewkjhqhszbxnizqbosod.functions.supabase.co/send-reminders' -H 'apikey: sb_publishable_WWD1rzuDeozClgPybaDXMw_1Zg0GQFf' -H 'x-cron-secret: ****' -H 'Content-Type: application/json' -d '{}'
```

Expect `summary.reminder_dayof` = `due:1, sent:1` and `whatsapp:{due:1, sent:1, failed:0}`, `errors: []`.

3. On +254 713 377374 the message should now arrive **with two buttons** (Confirm /
   Need to reschedule), bold practice name and date/time, and the contact line in its
   own paragraph. Tapping does nothing yet — that is B3, not a bug.

---

## D. Inbound leg (interim verification) — Emu runs

`WARDROUNDS_WEBHOOK_RSVP_SIMULATE.sh` (repo root) signs a synthetic Meta payload with
`WHATSAPP_APP_SECRET` and POSTs it to the deployed TEST webhook.

```
cd ~/wardrounds && chmod +x WARDROUNDS_WEBHOOK_RSVP_SIMULATE.sh && WHATSAPP_APP_SECRET='****' ./WARDROUNDS_WEBHOOK_RSVP_SIMULATE.sh CONFIRM
```

Expect `HTTP/2 200` and body `OK`. Then in the TEST SQL Editor:

```sql
select v.rsvp_status, v.rsvp_at
from outpatient_visits v join patients p on p.id = v.patient_id
where p.first_name = 'WR_SEED_TEST';

select channel, template, recipient, status, provider_message_id, created_at
from message_log order by created_at desc limit 5;
```

Expect `rsvp_status = confirmed`, `rsvp_at` set, and a `whatsapp / rsvp_confirmed /
received` row. Then re-run with `RESCHED` → flips to `reschedule_requested` (last tap wins).

**Negative test (proves the signature gate):** re-run with a wrong secret —
`WHATSAPP_APP_SECRET='nope' ./WARDROUNDS_WEBHOOK_RSVP_SIMULATE.sh CONFIRM` — expect
**401 Invalid signature** and no DB change.

---

## E. Built this session (Claude, unverified in a browser)

### E1. Public `/privacy` route — unblocks publishing the Meta app

| File | Change |
|---|---|
| `src/pages/legal/Privacy.jsx` (new) | Full privacy policy, dark landing-style surface. Covers roles (clinic = controller, WardRounds = processor), what is collected, the WhatsApp section (opt-in gate, utility templates, quick-reply RSVP, Meta as processor, opt-out), subprocessors, retention, security, Kenya DPA 2019 rights, deletion requests. |
| `src/App.jsx` | `const Privacy = lazy(...)` + `<Route path="/privacy" element={<Privacy />} />`. Deliberately **not** wrapped in `PublicRoute` — it must be readable both signed-out (Meta's reviewer, patients) and signed-in. |
| `src/pages/landing/Footer.jsx`, `src/pages/landing/MobileLanding.jsx` | "Privacy Policy" link in the fine-print column/block. Both now import `Link` from react-router-dom. |

**Email — DONE (22 Jul).** You already had a paid Namecheap **Private Email (Launch)** mailbox,
`admin@wardrounds.site`, bought 16 Jul and valid to 16 Jul 2027 — but it had never been
activated, so nothing could be delivered to it. Activated by adding the three missing records
in Namecheap Advanced DNS, and `privacy@wardrounds.site` added as an alias of that mailbox
(1 of 10 used). `CONTACT_EMAIL` in `Privacy.jsx` needs no change.

Verified live in public DNS afterwards:

- apex `MX` → `10 mx1.privateemail.com`, `10 mx2.privateemail.com`
- apex `TXT` → `v=spf1 include:spf.privateemail.com ~all`
- `send.wardrounds.site` **unchanged** → `v=spf1 include:amazonses.com ~all` and
  `10 feedback-smtp.eu-west-1.amazonses.com` (Resend untouched — different name, different scope)
- `privateemail._domainkey` and `resend._domainkey` both still present

Two caveats: Namecheap aliases are **receive-only**, so replies to a patient will go out as
`admin@`, not `privacy@`; and send one test message to `privacy@wardrounds.site` to confirm
delivery before pointing Meta at the policy.

**One thing still to decide before publishing:**

1. Meta also wants **Category** set and an **App icon** uploaded in App settings → Basic;
   Terms of Service and User data deletion currently point at `https://www.facebook.com/`
   placeholders, which pass but are worth replacing.

Then: App settings → Basic → Privacy policy URL = `https://wardrounds.site/privacy` → save →
Publish. After publishing, real button taps reach the webhook and §D becomes a live test.

### E2. RSVP surfaced in the UI

| File | Change |
|---|---|
| `src/lib/theme.js` | **Bug fix.** `visitStatusKey()` tested `rsvp_status === 'declined'` — a value nothing writes. The webhook writes `'reschedule_requested'`. Key renamed `declined` → `reschedule`, label "Reschedule". Without this the RSVP state was unreachable and every replied-to visit would have stayed amber. Added `RSVP_BADGES` (raw column value → badge label). |
| `src/components/calendar/WeekGrid.jsx`, `DayTimeline.jsx` | Follow the rename in `LEGEND_ORDER` and `STATUS_ICONS`. |
| `src/components/RsvpBadge.jsx` (new) | Pill badge: green dot "Confirmed" / amber dot "Reschedule requested". Colours read from `VISIT_STATUS_STYLES` so badge, calendar dot and legend cannot drift. Renders `null` for null/unknown status. |
| `src/pages/Outpatient.jsx` | Badge on the visit card header row, next to the date. |
| `src/lib/api.js` | `fetchUpcomingPatientVisits` now also selects `rsvp_status` (the booking-search dots call `visitStatusKey`, so without it they always read amber). Every other visit query already selects `*`. |

**On gating** — no new permission key was added, and the standing rule is still met:
the page is gated by `view_outpatient` / `PageGuard`, actions by `can_manage_outpatient`,
and the feature itself by the existing **admin Settings toggle `teams.whatsapp_enabled`**.
With WhatsApp off, no template is ever sent, so `rsvp_status` is null on every visit and
the badge never renders — the data is the gate. Adding a `can_view_rsvp` column would mean
a schema change on both projects and a new Settings row for a read-only badge. Say the word
if you'd rather have the explicit key.

### E3. Verification done / not done

- **Done:** esbuild parse of all 10 touched files (clean); `react-dom/server` render probe of
  `Privacy` (7 content probes pass, 13 kB of HTML) and `RsvpBadge` (correct markup for
  `confirmed` and `reschedule_requested`, empty string for `null` and for an unknown value).
- **Not done — yours:** `npm run build` (the sandbox can't run the macOS rolldown binary) and
  browser verification of `/privacy` on desktop + phone and the badge on an Outpatient card.

---

## F0. YOUR TERMINAL — the whole list, in order

Everything that could be done in a browser has been. These five need a shell.

```
cd ~/wardrounds && npm run build
```
```
cd ~/wardrounds && git add -A && git commit -m "whatsapp: RSVP buttons + inbound webhook (Phase 6); public /privacy page; RSVP badge" && git push origin dev
```
```
cd ~/wardrounds && git checkout main && git merge --ff-only dev && git push origin main && git checkout dev
```
```
curl -s -X POST 'https://ewkjhqhszbxnizqbosod.functions.supabase.co/send-reminders' -H 'apikey: sb_publishable_WWD1rzuDeozClgPybaDXMw_1Zg0GQFf' -H 'x-cron-secret: ****' -H 'Content-Type: application/json' -d '{}'
```
```
cd ~/wardrounds && chmod +x WARDROUNDS_WEBHOOK_RSVP_SIMULATE.sh && WHATSAPP_APP_SECRET='****' ./WARDROUNDS_WEBHOOK_RSVP_SIMULATE.sh CONFIRM
```

Between 3 and 4, do the two browser bits that need a human: drag
`public/wardrounds-logo-transparent.png` onto the App icon box in Meta App settings → Basic,
and send a test email to `privacy@wardrounds.site` to confirm the new mailbox receives.
Then tell me and I'll set the Privacy policy URL and walk the publish.

---

## F. Still outstanding (unchanged)

- **Phase 6 code is uncommitted.** Emu runs:
  `cd ~/wardrounds && git add -A && git commit -m "whatsapp: RSVP buttons + inbound webhook (Phase 6)" && git push origin dev`
- Surface `rsvp_status` in the Outpatient UI (badge), permission-gated — not built.
- Promote to PROD only after the real-tap path passes (i.e. after publish).
- Production number + Business Verification.
