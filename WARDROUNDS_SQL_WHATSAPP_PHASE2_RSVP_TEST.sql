-- WardRounds — WhatsApp Phase 2 (RSVP) schema — run in Supabase SQL Editor
-- TEST project (ewkjhqhszbxnizqbosod) FIRST → verify → then PROD (bannxzyidkgmbejyrzea).
-- Additive-only, idempotent, ends with NOTIFY pgrst.

-- outpatient_visits: patient RSVP captured by the whatsapp-webhook edge
-- function when the patient taps a quick-reply button on any appt_* template.
-- rsvp_status values (webhook-controlled): 'confirmed' | 'reschedule_requested'
alter table outpatient_visits
  add column if not exists rsvp_status text,
  add column if not exists rsvp_at     timestamptz;

-- No RLS change needed: outpatient_visits policies already team-scope reads,
-- and the webhook writes with the service role (bypasses RLS).

notify pgrst, 'reload schema';
