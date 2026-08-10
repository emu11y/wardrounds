-- WardRounds — Billing verification schema — run in Supabase SQL Editor
-- TEST project (ewkjhqhszbxnizqbosod) FIRST → verify → then PROD (bannxzyidkgmbejyrzea).
-- Follows Claude_Code_Database_Architecture_Standards.pdf: additive-only,
-- idempotent, RLS via current_user_team_id(), ends with NOTIFY pgrst.
--
-- Purpose: once a patient is discharged, the accounts person records whether the
-- patient has been billed, the invoice number, the amount, and whether they have
-- paid — so unpaid bills can be followed up. One row per admission (unique).
-- billing_records was dropped long ago; this is a separate, purpose-built table.

-- 1. invoice_records: per-admission billing verification (accounts follow-up)
create table if not exists invoice_records (
  id             uuid primary key default gen_random_uuid(),
  admission_id   uuid not null references admissions(id) on delete cascade,
  team_id        uuid not null references teams(id) on delete cascade,
  billed         boolean not null default false,
  billed_at      timestamptz,
  billing_mode   text,                   -- hospital | direct_patient | invoiced_hospital (app-enforced)
  invoice_number text,
  amount         numeric(12,2),          -- amount billed (KES); nullable until known
  paid           boolean not null default false,
  paid_at        timestamptz,
  notes          text,                   -- free-text follow-up note
  created_by     uuid references users(id),
  updated_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Idempotent: pick up billing_mode on an already-created invoice_records table.
alter table invoice_records
  add column if not exists billing_mode text;

-- One billing record per admission — lets the app check-then-update/insert safely.
create unique index if not exists uq_invoice_records_admission
  on invoice_records (admission_id);

-- Common access path: a team's records, newest first.
create index if not exists idx_invoice_records_team
  on invoice_records (team_id, created_at desc);

-- RLS: team-scoped via the SECURITY DEFINER helper (never inline subqueries on
-- users — infinite recursion). Reads + writes are team-scoped; the finer
-- can_edit_billing / can_mark_paid capability gating is enforced in the app layer
-- (consistent with dischargePatient and the rest of the write paths).
alter table invoice_records enable row level security;

drop policy if exists "team members can read invoice_records" on invoice_records;
create policy "team members can read invoice_records"
  on invoice_records for select
  using (team_id = current_user_team_id());

drop policy if exists "team members can insert invoice_records" on invoice_records;
create policy "team members can insert invoice_records"
  on invoice_records for insert
  with check (team_id = current_user_team_id());

drop policy if exists "team members can update invoice_records" on invoice_records;
create policy "team members can update invoice_records"
  on invoice_records for update
  using (team_id = current_user_team_id())
  with check (team_id = current_user_team_id());

notify pgrst, 'reload schema';
