-- Auto-reminders — schedule the send-reminders Edge Function.
-- Run in the Supabase SQL Editor, per project. Prereqs: deploy send-reminders
-- first, and run 2026-07-15_auto_reminders.sql (tracking columns) on this project.
--
-- Fires once each morning. pg_cron schedules in UTC; 04:00 UTC = 07:00 Africa/Nairobi.
-- The day-of window is included, so the morning run covers same-day appointments.
--
-- Replace the two placeholders before running:
--   <PROJECT_REF>       PROD = bannxzyidkgmbejyrzea   ·   TEST = ewkjhqhszbxnizqbosod
--   <SERVICE_ROLE_KEY>  this project's service_role (secret) key
--                       (Project Settings → API → service_role). Keep it secret.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: drop any prior job of this name before (re)creating it.
select cron.unschedule('wr-send-reminders')
where exists (select 1 from cron.job where jobname = 'wr-send-reminders');

select cron.schedule('wr-send-reminders', '0 4 * * *', $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/send-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
      'apikey',        '<SERVICE_ROLE_KEY>',
      'Content-Type',  'application/json'
    ),
    body    := '{}'::jsonb
  );
$$);

-- Inspect: select jobid, jobname, schedule, active from cron.job where jobname = 'wr-send-reminders';
-- Recent runs: select * from cron.job_run_details order by start_time desc limit 10;
