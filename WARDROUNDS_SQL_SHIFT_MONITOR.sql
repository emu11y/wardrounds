-- WardRounds — Shift Monitor + shared earnings schema — run in Supabase SQL Editor
-- TEST project (ewkjhqhszbxnizqbosod) FIRST → verify → then PROD (bannxzyidkgmbejyrzea).
-- Follows Claude_Code_Database_Architecture_Standards.pdf: additive-only, idempotent,
-- FKs + CHECK constraints (no magic strings), audit fields, soft deletes,
-- RLS via current_user_team_id() / current_user_role(), ends with NOTIFY pgrst.
--
-- RUN AS SEPARATE EXECUTIONS (the SQL Editor wraps a script in one transaction —
-- a failure at the end rolls back everything). Run blocks 1 → 6 one at a time,
-- then the verification block.
--
-- What this adds
--   payers                 master data: who pays (a hospital, an agency, the patient, insurer, other)
--   shifts                 transactional: one row per shift worked, with flexible pay
--                          (base rate per shift/hour + optional overtime + optional per-patient)
--   invoice_records        EXTENDED (not duplicated): a billing-status row now belongs to
--                          EITHER an admission OR a shift (CHECK exactly one) — one
--                          billed/paid/invoice workflow for every kind of earning
--   user_permissions       + can_log_shifts (nullable = inherit role default)
--
-- Shift totals are DERIVED on read (src/lib/earnings.js) — never stored.

-- ═══ BLOCK 1 — payers ═════════════════════════════════════════════════════════
create table if not exists payers (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references teams(id) on delete cascade,
  payer_type  text not null check (payer_type in ('hospital','agency','patient','insurer','other')),
  hospital_id uuid references hospitals(id) on delete restrict,  -- set when payer_type = 'hospital'
  name        text,                                              -- required unless it's a hospital (name comes from hospitals)
  phone       text,
  email       text,
  notes       text,
  status      text not null default 'active' check (status in ('active','archived')),
  created_by  uuid references users(id),
  updated_by  uuid references users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint payers_identity_chk check (
    (payer_type = 'hospital' and hospital_id is not null) or
    (payer_type <> 'hospital' and nullif(btrim(name), '') is not null)
  )
);

-- A hospital appears at most once as a payer per team.
create unique index if not exists uq_payers_team_hospital
  on payers (team_id, hospital_id) where hospital_id is not null and deleted_at is null;
create index if not exists idx_payers_team on payers (team_id) where deleted_at is null;

alter table payers enable row level security;

drop policy if exists "payers_select" on payers;
create policy "payers_select" on payers for select
  using (team_id = current_user_team_id());
drop policy if exists "payers_insert" on payers;
create policy "payers_insert" on payers for insert
  with check (team_id = current_user_team_id());
drop policy if exists "payers_update" on payers;
create policy "payers_update" on payers for update
  using (team_id = current_user_team_id())
  with check (team_id = current_user_team_id());

notify pgrst, 'reload schema';

-- ═══ BLOCK 2 — shifts ═════════════════════════════════════════════════════════
create table if not exists shifts (
  id                  uuid primary key default gen_random_uuid(),
  team_id             uuid not null references teams(id) on delete cascade,
  user_id             uuid not null references users(id),            -- the clinician who worked it
  hospital_id         uuid references hospitals(id) on delete set null, -- where (optional)
  payer_id            uuid references payers(id) on delete set null,    -- who pays (optional)
  shift_type          text not null default 'day'
                        check (shift_type in ('day','night','weekend','on_call','other')),
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  -- Base pay
  rate_unit           text not null default 'shift' check (rate_unit in ('shift','hour')),
  base_rate           numeric(12,2) not null default 0 check (base_rate >= 0),
  -- Overtime (optional, per shift)
  overtime_enabled    boolean not null default false,
  overtime_hours      numeric(6,2) not null default 0 check (overtime_hours >= 0),
  overtime_rate       numeric(12,2) not null default 0 check (overtime_rate >= 0),   -- KES per overtime hour
  -- Per-patient pay (optional, per shift)
  per_patient_enabled boolean not null default false,
  per_patient_mode    text not null default 'fixed' check (per_patient_mode in ('fixed','percent')),
  per_patient_amount  numeric(12,2) not null default 0 check (per_patient_amount >= 0), -- fixed: KES per patient · percent: fee per patient
  per_patient_percent numeric(5,2)  not null default 0 check (per_patient_percent between 0 and 100),
  patient_count       integer       not null default 0 check (patient_count >= 0),
  notes               text,
  created_by          uuid references users(id),
  updated_by          uuid references users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  constraint shifts_time_chk check (ends_at > starts_at)
);

create index if not exists idx_shifts_team_start on shifts (team_id, starts_at desc) where deleted_at is null;
create index if not exists idx_shifts_user_start on shifts (user_id, starts_at desc) where deleted_at is null;
create index if not exists idx_shifts_hospital   on shifts (hospital_id);
create index if not exists idx_shifts_payer      on shifts (payer_id);

-- RLS: a clinician sees and edits their own shifts; team admins see/edit all of the team's.
alter table shifts enable row level security;

drop policy if exists "shifts_select" on shifts;
create policy "shifts_select" on shifts for select
  using (team_id = current_user_team_id()
         and (user_id = auth.uid() or current_user_role()::text = 'admin'));
drop policy if exists "shifts_insert" on shifts;
create policy "shifts_insert" on shifts for insert
  with check (team_id = current_user_team_id()
              and (user_id = auth.uid() or current_user_role()::text = 'admin'));
drop policy if exists "shifts_update" on shifts;
create policy "shifts_update" on shifts for update
  using (team_id = current_user_team_id()
         and (user_id = auth.uid() or current_user_role()::text = 'admin'))
  with check (team_id = current_user_team_id()
              and (user_id = auth.uid() or current_user_role()::text = 'admin'));
-- No DELETE policy: shifts are soft-deleted (deleted_at).

notify pgrst, 'reload schema';

-- ═══ BLOCK 3 — invoice_records: allow a row to belong to a shift ══════════════
alter table invoice_records add column if not exists shift_id uuid references shifts(id) on delete cascade;
alter table invoice_records alter column admission_id drop not null;

create unique index if not exists uq_invoice_records_shift on invoice_records (shift_id);

notify pgrst, 'reload schema';

-- ═══ BLOCK 4 — exactly one owner per billing record ═══════════════════════════
-- (separate execution: if any legacy row violates it, only this block fails)
alter table invoice_records drop constraint if exists invoice_records_owner_chk;
alter table invoice_records add constraint invoice_records_owner_chk
  check (num_nonnulls(admission_id, shift_id) = 1);

notify pgrst, 'reload schema';

-- ═══ BLOCK 5 — permission: can_log_shifts ═════════════════════════════════════
-- Nullable on purpose: null = inherit the role default (admins: yes; members: no).
alter table user_permissions add column if not exists can_log_shifts boolean;

notify pgrst, 'reload schema';

-- ═══ BLOCK 6 — VERIFY (read-only) ═════════════════════════════════════════════
select 'payers' t, count(*) from payers
union all select 'shifts', count(*) from shifts
union all select 'invoice_records with shift_id', count(*) from invoice_records where shift_id is not null
union all select 'user_permissions.can_log_shifts column',
  count(*) from information_schema.columns where table_name = 'user_permissions' and column_name = 'can_log_shifts';
-- Expect: 0, 0, 0, 1

-- ═══ ROLLBACK (only if needed, run manually, in this order) ════════════════════
-- alter table user_permissions drop column if exists can_log_shifts;
-- alter table invoice_records drop constraint if exists invoice_records_owner_chk;
-- delete from invoice_records where shift_id is not null;
-- alter table invoice_records alter column admission_id set not null;
-- alter table invoice_records drop column if exists shift_id;
-- drop table if exists shifts;
-- drop table if exists payers;
-- notify pgrst, 'reload schema';
