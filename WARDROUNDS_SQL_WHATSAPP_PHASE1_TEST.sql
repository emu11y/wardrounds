-- WardRounds — WhatsApp Phase 1 schema — run in Supabase SQL Editor
-- TEST project (ewkjhqhszbxnizqbosod) FIRST → verify → then PROD (bannxzyidkgmbejyrzea).
-- Follows Claude_Code_Database_Architecture_Standards.pdf: additive-only,
-- idempotent, RLS via current_user_team_id(), ends with NOTIFY pgrst.

-- 1. patients: WhatsApp consent (Meta policy requirement; default OFF)
alter table patients
  add column if not exists whatsapp_opt_in boolean not null default false;

-- 2. outpatient_visits: per-channel idempotency — separate from the email
--    reminder_*_sent_at columns so each channel retries independently.
alter table outpatient_visits
  add column if not exists reminder_1w_wa_sent_at    timestamptz,
  add column if not exists reminder_1d_wa_sent_at    timestamptz,
  add column if not exists reminder_dayof_wa_sent_at timestamptz;

-- 3. teams: channel toggle (mirrors reminders_enabled; default OFF so nothing
--    sends until an admin opts in via Settings)
alter table teams
  add column if not exists whatsapp_enabled boolean not null default false;

-- 4. message_log: append-only audit of every outbound message (both channels)
create table if not exists message_log (
  id                  uuid primary key default gen_random_uuid(),
  team_id             uuid not null references teams(id),
  patient_id          uuid references patients(id),
  visit_id            uuid references outpatient_visits(id),
  channel             text not null check (channel in ('email','whatsapp')),
  template            text,
  recipient           text not null,
  status              text not null default 'sent', -- sent | delivered | read | failed
  provider_message_id text,                          -- Resend id / WhatsApp wamid
  error               text,
  created_at          timestamptz not null default now()
);

create index if not exists idx_message_log_team_created
  on message_log (team_id, created_at desc);

-- RLS: team-scoped reads via the SECURITY DEFINER helper (never inline
-- subqueries on users — infinite recursion). No client insert/update/delete
-- policies: edge functions write with the service role, which bypasses RLS.
alter table message_log enable row level security;

drop policy if exists "team members can read message_log" on message_log;
create policy "team members can read message_log"
  on message_log for select
  using (team_id = current_user_team_id());

notify pgrst, 'reload schema';
