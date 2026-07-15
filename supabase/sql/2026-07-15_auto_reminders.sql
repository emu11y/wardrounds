-- Auto-reminders — tracking columns + team gate.
-- Run in the Supabase SQL Editor on BOTH TEST (ewkjhqhszbxnizqbosod) and PROD (bannxzyidkgmbejyrzea).
-- Idempotent (IF NOT EXISTS). Ends with the PostgREST schema reload.

ALTER TABLE public.outpatient_visits
  ADD COLUMN IF NOT EXISTS reminder_1w_sent_at    timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_1d_sent_at    timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_dayof_sent_at timestamptz;

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS reminders_enabled boolean NOT NULL DEFAULT true;

NOTIFY pgrst, 'reload schema';
