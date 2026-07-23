# WardRounds — Phase 5: TEST end-to-end verification (WhatsApp + email)

> Written by the scheduled template-check task on **2026-07-19**. All five WhatsApp
> templates on the Test WABA (`1512386093333740`) are **APPROVED** — WhatsApp Manager
> shows `appt_reminder_1w`, `appt_reminder_1d`, `appt_reminder_dayof`,
> `appt_confirmation`, `appt_manual` as **"Active – Quality pending"** (approved;
> quality rating simply not established until real sends accumulate). The Phase 4
> blocker is cleared. Everything below runs against **TEST only**
> (`ewkjhqhszbxnizqbosod`) — never PROD (`bannxzyidkgmbejyrzea`).

The plan: seed one `WR_SEED_TEST` patient + a today-dated scheduled visit, hit
`send-reminders` once, expect the **day-of** reminder on **both channels**
(email to ebrahim_yusuf@hotmail.co.uk, WhatsApp to +254 713 377374), verify the
stamps + `message_log`, then clean up.

---

## Step 1 — Seed (TEST Supabase SQL Editor)

Idempotent: re-running won't duplicate the patient or visit. The visit is
day-of (today, Nairobi) at 15:00 with you as the doctor, so the **dayof**
window fires for both channels on the next function run.

```sql
-- Phase 5 E2E seed — TEST ONLY. Emu = doctor & team owner.
with me as (
  select id as user_id, team_id
  from users
  where email = 'ebrahim_yusuf@hotmail.co.uk'
  limit 1
),
-- make sure both channel toggles are on for the team
tgl as (
  update teams
  set whatsapp_enabled = true, reminders_enabled = true
  where id = (select team_id from me)
  returning id
),
hosp as (
  select id as hospital_id
  from hospitals
  where team_id = (select team_id from me)
  order by created_at
  limit 1
),
pat as (
  insert into patients (team_id, first_name, last_name, email, phone, whatsapp_opt_in, hospital_id)
  select team_id, 'WR_SEED_TEST', 'Patient',
         'ebrahim_yusuf@hotmail.co.uk', '254713377374', true,
         (select hospital_id from hosp)
  from me
  where not exists (select 1 from patients where first_name = 'WR_SEED_TEST')
  returning id, team_id
),
pat_any as ( -- works on re-run too
  select id, team_id from pat
  union all
  select id, team_id from patients where first_name = 'WR_SEED_TEST'
  limit 1
)
insert into outpatient_visits
  (patient_id, team_id, hospital_id, doctor_id, created_by_user_id,
   visit_date, visit_time, status, notes)
select p.id, p.team_id,
       (select hospital_id from hosp),
       (select user_id from me), (select user_id from me),
       (now() at time zone 'Africa/Nairobi')::date,
       ((now() at time zone 'Africa/Nairobi')::date + time '15:00') at time zone 'Africa/Nairobi',
       'scheduled', 'WR_SEED_TEST e2e visit'
from pat_any p
where not exists (
  select 1 from outpatient_visits v
  join patients pp on pp.id = v.patient_id
  where pp.first_name = 'WR_SEED_TEST'
    and v.visit_date = (now() at time zone 'Africa/Nairobi')::date
);

notify pgrst, 'reload schema';
```

Sanity check after seeding:

```sql
select v.id, v.visit_date, v.visit_time, v.status,
       v.reminder_dayof_sent_at, v.reminder_dayof_wa_sent_at,
       p.email, p.phone, p.whatsapp_opt_in,
       t.reminders_enabled, t.whatsapp_enabled
from outpatient_visits v
join patients p on p.id = v.patient_id
join teams t on t.id = v.team_id
where p.first_name = 'WR_SEED_TEST';
```

Expect: one row, `status = scheduled`, both `_dayof_` stamps null, opt-in true, both toggles true.

## Step 2 — Trigger send-reminders (terminal, one line)

The TEST publishable key is inlined below (it's public by design). Replace only
`****` with your **CRON_SECRET** (the value you set via
`supabase secrets set CRON_SECRET=…` on TEST).

```
curl -s -X POST 'https://ewkjhqhszbxnizqbosod.functions.supabase.co/send-reminders' -H 'apikey: sb_publishable_WWD1rzuDeozClgPybaDXMw_1Zg0GQFf' -H 'x-cron-secret: ****' -H 'Content-Type: application/json' -d '{}'
```

Expected JSON: `summary.reminder_dayof` with `due:1, sent:1` (email) and
`whatsapp:{due:1, sent:1, skipped:0, failed:0}`; `errors: []`. (`reminder_1w`
and `reminder_1d` will be all zeros unless other visits happen to match.)

## Step 3 — Verify

1. **Email** arrives at ebrahim_yusuf@hotmail.co.uk (day-of branded reminder).
2. **WhatsApp** arrives on +254 713 377374 from the test number +1 (555) 155-9940,
   body = `appt_reminder_dayof` with your name, practice branding in {{2}}, 15:00,
   your doctor line, hospital/location — and the "…please contact your clinic
   directly." ending (no reply prompt).
3. **Stamps + log** (SQL Editor):

```sql
select v.reminder_dayof_sent_at, v.reminder_dayof_wa_sent_at
from outpatient_visits v join patients p on p.id = v.patient_id
where p.first_name = 'WR_SEED_TEST';

select channel, template, recipient, status, provider_message_id, error, created_at
from message_log
order by created_at desc
limit 10;
```

Expect both stamps non-null and one `whatsapp / appt_reminder_dayof / 254713377374 / sent` row with a `wamid`.

4. **Idempotency**: re-run the Step 2 curl — summary should show zero due, no
   second message, no new `message_log` row.

## Step 4 — Browser checks (TEST app)

- Settings → team: **WhatsApp reminders** glass toggle renders and persists.
- New booking (NewVisitModal / Outpatient): opt-in checkbox at phone entry;
  confirmation fires **both** channels with separate toasts (`appt_confirmation`).
- ReminderComposeModal: "Send via" Email/WhatsApp checkboxes; WA auto-ticked when
  allowed, disabled-with-reason otherwise; manual send uses `appt_manual` with the
  message as {{7}}.

## Step 5 — Cleanup (TEST SQL Editor)

```sql
-- Remove the E2E seed. message_log first (FK), then visit, then patient.
delete from message_log
where patient_id in (select id from patients where first_name = 'WR_SEED_TEST');

delete from outpatient_visits
where patient_id in (select id from patients where first_name = 'WR_SEED_TEST');

delete from patients where first_name = 'WR_SEED_TEST';

-- Optional: turn the team toggle back off until you're ready to go live
-- update teams set whatsapp_enabled = false
-- where id = (select team_id from users where email = 'ebrahim_yusuf@hotmail.co.uk');

notify pgrst, 'reload schema';
```

## After E2E passes → Promote (handoff §1 item 3)

One-liners for Emu (`*` = contains secrets):

- Run `WARDROUNDS_SQL_WHATSAPP_PHASE1_TEST.sql` on **PROD** SQL Editor (it's additive/idempotent).
- `supabase secrets set WHATSAPP_TOKEN=**** WHATSAPP_PHONE_NUMBER_ID=1199957979870204 CRON_SECRET=**** --project-ref bannxzyidkgmbejyrzea` *
- `supabase functions deploy send-whatsapp --project-ref bannxzyidkgmbejyrzea`
- `supabase functions deploy send-reminders --project-ref bannxzyidkgmbejyrzea`
- `git checkout main && git merge --ff-only dev && git push origin main && git checkout dev`

Reminder: PROD would still use the TEST phone-number id until the real number
exists — keep every PROD team's `whatsapp_enabled` **off** until then, or
consciously decide otherwise. Then: dedicated SIM → register in Meta →
swap `WHATSAPP_PHONE_NUMBER_ID` → Business Verification (lifts 250 conv/day).
