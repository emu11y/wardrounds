-- WardRounds — Onboarding wizard schema — run in Supabase SQL Editor
-- TEST project (ewkjhqhszbxnizqbosod) FIRST → test locally → then PROD (bannxzyidkgmbejyrzea).
-- Follows Claude_Code_Database_Architecture_Standards.pdf: additive-only, idempotent,
-- lookup table instead of magic strings, FKs + CHECKs, audit fields, RLS via
-- current_user_team_id() / current_user_role(), ends with NOTIFY pgrst.
-- Run blocks 1 → 5 as SEPARATE executions, then the verify block.
--
-- What this adds
--   professions        lookup (doctor, surgeon, nurse, physiotherapist, pharmacist, …)
--   users              + profession_key (FK), + onboarded_at (NULL = wizard still to do)
--                        → existing users are BACKFILLED as onboarded so nobody already
--                          using the app is pushed into the wizard
--   teams              + practice_type (solo|team), + expected_team_size,
--                      + members_see_financials (team default for can_view_revenue)
--   user_pay_models    how each clinician gets paid (ward rounds / per patient /
--                      per procedure / per shift) + the defaults the app pre-fills

-- ═══ BLOCK 1 — professions lookup ═════════════════════════════════════════════
create table if not exists professions (
  key         text primary key check (key ~ '^[a-z_]+$'),
  label       text not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true
);

insert into professions (key, label, sort_order) values
  ('doctor',            'Doctor',            10),
  ('surgeon',           'Surgeon',           20),
  ('clinical_officer',  'Clinical officer',  30),
  ('nurse',             'Nurse',             40),
  ('physiotherapist',   'Physiotherapist',   50),
  ('pharmacist',        'Pharmacist',        60),
  ('dentist',           'Dentist',           70),
  ('nutritionist',      'Nutritionist',      80),
  ('other',             'Other',            999)
on conflict (key) do nothing;

alter table professions enable row level security;
drop policy if exists "professions_read" on professions;
create policy "professions_read" on professions for select to authenticated using (true);
grant select on professions to authenticated;

notify pgrst, 'reload schema';

-- ═══ BLOCK 2 — users: profession + onboarding state ═══════════════════════════
alter table users add column if not exists profession_key text references professions(key);
alter table users add column if not exists onboarded_at timestamptz;

-- Everyone who exists BEFORE this migration has already been using the app.
-- (Idempotent: only touches rows still NULL; safe to re-run — but run it once,
--  BEFORE deploying the wizard, so brand-new signups after deploy stay NULL.)
update users set onboarded_at = coalesce(created_at, now()) where onboarded_at is null;

notify pgrst, 'reload schema';

-- ═══ BLOCK 3 — teams: practice profile ════════════════════════════════════════
alter table teams add column if not exists practice_type text;
alter table teams drop constraint if exists teams_practice_type_chk;
alter table teams add constraint teams_practice_type_chk check (practice_type is null or practice_type in ('solo','team'));

alter table teams add column if not exists expected_team_size integer;
alter table teams drop constraint if exists teams_expected_team_size_chk;
alter table teams add constraint teams_expected_team_size_chk check (expected_team_size is null or expected_team_size between 1 and 500);

-- Team default for members' revenue visibility (per-person overrides still win).
alter table teams add column if not exists members_see_financials boolean not null default true;

notify pgrst, 'reload schema';

-- ═══ BLOCK 4 — user_pay_models ════════════════════════════════════════════════
create table if not exists user_pay_models (
  id                  uuid primary key default gen_random_uuid(),
  team_id             uuid not null references teams(id) on delete cascade,
  user_id             uuid not null references users(id) on delete cascade,
  pay_model           text not null check (pay_model in ('ward_rounds','per_patient','per_procedure','per_shift')),
  -- per_patient defaults
  per_patient_mode    text check (per_patient_mode is null or per_patient_mode in ('fixed','percent')),
  per_patient_amount  numeric(12,2) check (per_patient_amount is null or per_patient_amount >= 0),  -- fixed KES, or the fee the % applies to
  per_patient_percent numeric(5,2)  check (per_patient_percent is null or per_patient_percent between 0 and 100),
  -- per_shift defaults (pre-fill the Shift form)
  shift_rate          numeric(12,2) check (shift_rate is null or shift_rate >= 0),
  shift_rate_unit     text check (shift_rate_unit is null or shift_rate_unit in ('shift','hour')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint uq_user_pay_model unique (user_id, pay_model)
);

create index if not exists idx_user_pay_models_team on user_pay_models (team_id);

alter table user_pay_models enable row level security;

-- Team can read (admins plan the practice); a clinician manages their own rows; admins can manage any in their team.
drop policy if exists "upm_select" on user_pay_models;
create policy "upm_select" on user_pay_models for select
  using (team_id = current_user_team_id());
drop policy if exists "upm_insert" on user_pay_models;
create policy "upm_insert" on user_pay_models for insert
  with check (team_id = current_user_team_id() and (user_id = auth.uid() or current_user_role()::text = 'admin'));
drop policy if exists "upm_update" on user_pay_models;
create policy "upm_update" on user_pay_models for update
  using (team_id = current_user_team_id() and (user_id = auth.uid() or current_user_role()::text = 'admin'))
  with check (team_id = current_user_team_id() and (user_id = auth.uid() or current_user_role()::text = 'admin'));
-- Unticking a pay type removes its configuration row (settings, not clinical history).
drop policy if exists "upm_delete" on user_pay_models;
create policy "upm_delete" on user_pay_models for delete
  using (team_id = current_user_team_id() and (user_id = auth.uid() or current_user_role()::text = 'admin'));

notify pgrst, 'reload schema';

-- ═══ BLOCK 5 — VERIFY (read-only) ═════════════════════════════════════════════
select 'professions' t, count(*) from professions
union all select 'users not yet onboarded (expect 0 right after migration)', count(*) from users where onboarded_at is null
union all select 'teams.members_see_financials column', count(*) from information_schema.columns where table_name = 'teams' and column_name = 'members_see_financials'
union all select 'user_pay_models', count(*) from user_pay_models;
-- Expect: 9, 0, 1, 0

-- ═══ ROLLBACK (manual, in order) ══════════════════════════════════════════════
-- drop table if exists user_pay_models;
-- alter table teams drop constraint if exists teams_practice_type_chk, drop constraint if exists teams_expected_team_size_chk;
-- alter table teams drop column if exists practice_type, drop column if exists expected_team_size, drop column if exists members_see_financials;
-- alter table users drop column if exists onboarded_at, drop column if exists profession_key;
-- drop table if exists professions;
-- notify pgrst, 'reload schema';
