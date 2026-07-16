-- Auto-reminders — schedule the send-reminders Edge Function.
-- Run in the Supabase SQL Editor, per project. Prereqs: deploy send-reminders
-- first, and run 2026-07-15_auto_reminders.sql (tracking columns) on this project.
--
-- Fires once each morning. pg_cron schedules in UTC; 04:00 UTC = 07:00 Africa/Nairobi.
-- The day-of window is included, so the morning run covers same-day appointments.
--
-- Replace the three placeholders before running (use THIS project's values):
--   <PROJECT_REF>       PROD = bannxzyidkgmbejyrzea   ·   TEST = ewkjhqhszbxnizqbosod
--   <PUBLISHABLE_KEY>   this project's publishable key (Settings → API Keys).
--                       PROD = sb_publishable_CJ4N9…  ·  TEST = sb_publishable_WWD1rzu…
--                       This is the transport apikey (public — matches the app); it
--                       only gets the request through the gateway.
--   <CRON_SECRET>       the shared secret set via `supabase secrets set CRON_SECRET`
--                       on THIS project. This is the real authorization gate.
--                       Keep it secret.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: drop any prior job of this name before (re)creating it.
select cron.unschedule('wr-send-reminders')
where exists (select 1 from cron.job where jobname = 'wr-send-reminders');

select cron.schedule('wr-send-reminders', '0 4 * * *', $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/send-reminders',
    headers := jsonb_build_object(
      'apikey',        '<PUBLISHABLE_KEY>',
      'x-cron-secret', '<CRON_SECRET>',
      'Content-Type',  'application/json'
    ),
    body    := '{}'::jsonb
  );
$$);

-- Inspect: select jobid, jobname, schedule, active from cron.job where jobname = 'wr-send-reminders';
-- Recent runs: select * from cron.job_run_details order by start_time desc limit 10;
