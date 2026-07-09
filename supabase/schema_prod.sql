-- ============================================================================
-- WardRounds — PRODUCTION schema, reconstructed from the LIVE test project
-- (ref ewkjhqhszbxnizqbosod) on 2026-07-08 via dashboard introspection.
--
-- This SUPERSEDES supabase/schema.sql (which was stale: missing 7 tables and
-- using the old current_team_id() helper). Run this in the NEW prod project's
-- SQL Editor. Ends with NOTIFY pgrst per the DB standards.
--
-- SECURITY NOTE: see the GRANTS / RLS section at the bottom. The live project
-- leaves RLS OFF on most tables and grants `anon` full access. Do NOT ship that
-- to production unchanged — the hardening block is included and recommended.
-- ============================================================================

-- ─── EXTENSIONS ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── TABLES ─────────────────────────────────────────────────────────────────
-- FKs are added after all tables exist (avoids circular-dependency ordering).

CREATE TABLE public.teams (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             text NOT NULL,
  admin_id         uuid NOT NULL,
  logo_url         text,
  created_at       timestamp DEFAULT now(),
  updated_at       timestamp DEFAULT now(),
  practice_name    text,
  doctor_name      text DEFAULT 'Dr. Ebrahim Yusuf'::text,
  doctor_title     text DEFAULT 'Attending Physician'::text,
  practice_address text,
  practice_phone   text,
  practice_email   text,
  address          text,
  phone            text,
  email            text
);

CREATE TABLE public.users (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email                   text NOT NULL,
  full_name               text NOT NULL,
  team_id                 uuid,
  role                    text,
  created_at              timestamp DEFAULT now(),
  invited_at              timestamptz,
  avatar_url              text,
  status                  text NOT NULL DEFAULT 'active'::text,
  archived_at             timestamptz,
  phone                   text,
  date_of_birth           date,
  emergency_contact_name  text,
  emergency_contact_phone text,
  job_title               text,
  speciality              text,
  licence_number          text,
  position_id             uuid,
  CONSTRAINT users_email_key UNIQUE (email),
  CONSTRAINT users_role_check CHECK (role = ANY (ARRAY['admin'::text, 'member'::text])),
  CONSTRAINT users_status_check CHECK (status = ANY (ARRAY['active'::text, 'archived'::text]))
);

CREATE TABLE public.team_positions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL,
  name        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  is_clinical boolean NOT NULL DEFAULT false,
  CONSTRAINT team_positions_team_name_unique UNIQUE (team_id, name)
);

CREATE TABLE public.hospitals (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id            uuid NOT NULL,
  name               text NOT NULL,
  location           text,
  created_at         timestamp DEFAULT now(),
  address            text,
  phone              text,
  email              text,
  status             text DEFAULT 'active'::text,
  color              text DEFAULT '#3B82F6'::text,
  hospital_id_prefix text
);

CREATE TABLE public.hospital_services (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id   uuid NOT NULL,
  service_name  text NOT NULL,
  price_per_day numeric(10,2) NOT NULL,
  created_at    timestamp DEFAULT now(),
  service_type  text DEFAULT 'ward'::text
);

CREATE TABLE public.patients (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id        uuid NOT NULL,
  first_name     text NOT NULL,
  last_name      text NOT NULL,
  date_of_birth  date,
  insurance_name text,
  hospital_id    uuid,
  created_at     timestamp DEFAULT now(),
  email          text,
  phone          text
);

CREATE TABLE public.admissions (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id          uuid NOT NULL,
  team_id             uuid NOT NULL,
  hospital_id         uuid NOT NULL,
  ward                text NOT NULL,
  admission_date      timestamp DEFAULT now(),
  discharge_date      timestamp,
  status              text DEFAULT 'admitted'::text,
  created_at          timestamp DEFAULT now(),
  updated_at          timestamp DEFAULT now(),
  team_start_date     date DEFAULT CURRENT_DATE,
  patient_hospital_id text,
  CONSTRAINT admissions_status_check CHECK (status = ANY (ARRAY['admitted'::text, 'discharged'::text, 'transferred'::text, 'archived'::text]))
);

CREATE TABLE public.outpatient_visits (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id          uuid,
  team_id             uuid,
  visit_date          date DEFAULT CURRENT_DATE,
  visit_time          timestamptz DEFAULT now(),
  consultation_fee    numeric DEFAULT 0,
  status              text DEFAULT 'seen'::text,
  notes               text,
  patient_hospital_id text,
  created_at          timestamptz DEFAULT now(),
  hospital_id         uuid,
  created_by_user_id  uuid,
  is_adhoc            boolean DEFAULT false,
  doctor_id           uuid,
  CONSTRAINT outpatient_visits_status_check CHECK (status = ANY (ARRAY['seen'::text, 'scheduled'::text, 'pending'::text, 'closed'::text, 'blocked'::text, 'cancelled'::text]))
);

CREATE TABLE public.patient_notes (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_id       uuid,
  note_text          text NOT NULL,
  created_by_user_id uuid NOT NULL,
  created_at         timestamp DEFAULT now(),
  signature          text,
  visit_id           uuid,
  CONSTRAINT note_belongs_to_one_parent CHECK (
    ((admission_id IS NOT NULL) AND (visit_id IS NULL))
    OR ((admission_id IS NULL) AND (visit_id IS NOT NULL))
  )
);

CREATE TABLE public.services_rendered (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_id  uuid NOT NULL,
  service_id    uuid NOT NULL,
  rendered_date date DEFAULT now(),
  quantity      integer DEFAULT 1,
  price_applied numeric(10,2),
  created_at    timestamp DEFAULT now()
);

CREATE TABLE public.team_services (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid,
  service_name text NOT NULL,
  description  text,
  category     text DEFAULT 'Procedure'::text,
  price        numeric NOT NULL DEFAULT 0,
  billing_type text DEFAULT 'one-off'::text,
  status       text DEFAULT 'active'::text,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE public.admission_services (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id    uuid NOT NULL,
  team_service_id uuid NOT NULL,
  service_name    text NOT NULL,
  price           numeric NOT NULL,
  billing_type    text,
  added_at        timestamptz DEFAULT now(),
  service_at      timestamptz DEFAULT now()
);

CREATE TABLE public.visit_services (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id        uuid,
  team_service_id uuid,
  service_name    text NOT NULL,
  price           numeric NOT NULL,
  added_at        timestamptz DEFAULT now()
);

CREATE TABLE public.invoices (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_id uuid NOT NULL,
  total_amount numeric(10,2) NOT NULL,
  pdf_path     text,
  generated_at timestamp DEFAULT now(),
  paid_at      timestamp
);

CREATE TABLE public.timeline_events (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_id uuid NOT NULL,
  event_type   text,
  ward         text,
  timestamp    timestamp DEFAULT now(),
  notes        text,
  CONSTRAINT timeline_events_event_type_check CHECK (event_type = ANY (ARRAY['admitted'::text, 'transferred'::text, 'discharged'::text]))
);

CREATE TABLE public.user_permissions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL,
  team_id               uuid NOT NULL,
  can_manage_patients   boolean NOT NULL DEFAULT false,
  can_discharge         boolean NOT NULL DEFAULT false,
  can_transfer          boolean NOT NULL DEFAULT false,
  can_edit_billing      boolean NOT NULL DEFAULT false,
  can_mark_paid         boolean NOT NULL DEFAULT false,
  can_view_all_patients boolean NOT NULL DEFAULT false,
  can_manage_outpatient boolean NOT NULL DEFAULT false,
  can_view_reports      boolean NOT NULL DEFAULT false,
  can_access_admin      boolean NOT NULL DEFAULT false,
  can_manage_team       boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  view_inpatient        boolean DEFAULT true,
  view_outpatient       boolean DEFAULT true,
  view_patients         boolean DEFAULT true,
  view_analytics        boolean DEFAULT true,
  view_admin            boolean DEFAULT false,
  can_view_revenue      boolean,
  CONSTRAINT user_permissions_user_id_key UNIQUE (user_id)
);

CREATE TABLE public.activity_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid NOT NULL,
  user_id      uuid,
  user_email   text,
  user_name    text,
  action       text NOT NULL,
  entity_type  text,
  entity_id    uuid,
  patient_id   uuid,
  patient_name text,
  details      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── FOREIGN KEYS ───────────────────────────────────────────────────────────
ALTER TABLE public.users              ADD CONSTRAINT users_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);
ALTER TABLE public.users              ADD CONSTRAINT users_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.team_positions(id) ON DELETE SET NULL;
ALTER TABLE public.team_positions     ADD CONSTRAINT team_positions_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
ALTER TABLE public.hospitals          ADD CONSTRAINT hospitals_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);
ALTER TABLE public.hospital_services  ADD CONSTRAINT hospital_services_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id);
ALTER TABLE public.patients           ADD CONSTRAINT patients_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);
ALTER TABLE public.patients           ADD CONSTRAINT patients_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id);
ALTER TABLE public.admissions         ADD CONSTRAINT admissions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);
ALTER TABLE public.admissions         ADD CONSTRAINT admissions_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id);
ALTER TABLE public.admissions         ADD CONSTRAINT admissions_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);
ALTER TABLE public.outpatient_visits  ADD CONSTRAINT outpatient_visits_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);
ALTER TABLE public.outpatient_visits  ADD CONSTRAINT outpatient_visits_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id);
ALTER TABLE public.outpatient_visits  ADD CONSTRAINT outpatient_visits_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);
ALTER TABLE public.outpatient_visits  ADD CONSTRAINT outpatient_visits_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.users(id);
ALTER TABLE public.outpatient_visits  ADD CONSTRAINT outpatient_visits_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);
ALTER TABLE public.patient_notes      ADD CONSTRAINT patient_notes_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);
ALTER TABLE public.patient_notes      ADD CONSTRAINT patient_notes_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.outpatient_visits(id) ON DELETE CASCADE;
ALTER TABLE public.patient_notes      ADD CONSTRAINT patient_notes_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);
ALTER TABLE public.services_rendered  ADD CONSTRAINT services_rendered_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.hospital_services(id);
ALTER TABLE public.services_rendered  ADD CONSTRAINT services_rendered_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);
ALTER TABLE public.team_services      ADD CONSTRAINT team_services_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);
ALTER TABLE public.admission_services ADD CONSTRAINT admission_services_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id) ON DELETE CASCADE;
ALTER TABLE public.admission_services ADD CONSTRAINT admission_services_team_service_id_fkey FOREIGN KEY (team_service_id) REFERENCES public.team_services(id);
ALTER TABLE public.visit_services     ADD CONSTRAINT visit_services_team_service_id_fkey FOREIGN KEY (team_service_id) REFERENCES public.team_services(id);
ALTER TABLE public.visit_services     ADD CONSTRAINT visit_services_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.outpatient_visits(id) ON DELETE CASCADE;
ALTER TABLE public.invoices           ADD CONSTRAINT invoices_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);
ALTER TABLE public.timeline_events    ADD CONSTRAINT timeline_events_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admissions(id);
ALTER TABLE public.user_permissions   ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_permissions   ADD CONSTRAINT user_permissions_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);
ALTER TABLE public.activity_logs      ADD CONSTRAINT activity_logs_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);
ALTER TABLE public.activity_logs      ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
-- NOTE: teams.admin_id has NO FK in the live DB (kept as a plain uuid column).

-- ─── INDEXES (non-PK/unique) ────────────────────────────────────────────────
CREATE INDEX idx_activity_logs_action     ON public.activity_logs USING btree (action);
CREATE INDEX idx_activity_logs_patient    ON public.activity_logs USING btree (patient_id);
CREATE INDEX idx_activity_logs_team       ON public.activity_logs USING btree (team_id, created_at DESC);
CREATE INDEX idx_activity_logs_user       ON public.activity_logs USING btree (user_id);
CREATE INDEX idx_outpatient_visits_doctor_id ON public.outpatient_visits USING btree (doctor_id);
CREATE INDEX team_positions_team_id_idx   ON public.team_positions USING btree (team_id, sort_order);
CREATE INDEX idx_user_permissions_team    ON public.user_permissions USING btree (team_id);
CREATE INDEX idx_user_permissions_user    ON public.user_permissions USING btree (user_id);

-- ─── FUNCTIONS ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_user_team_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT team_id FROM public.users WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_my_team_id()
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT team_id FROM users WHERE id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION public.create_team_for_user(p_user_email text, p_practice_name text, p_doctor_name text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_team_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM public.users WHERE email = p_user_email;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User % not found in public.users', p_user_email;
  END IF;

  INSERT INTO public.teams (practice_name, doctor_name)
  VALUES (p_practice_name, p_doctor_name)
  RETURNING id INTO v_team_id;

  UPDATE public.users
  SET team_id = v_team_id, role = 'admin'
  WHERE id = v_user_id;

  RETURN v_team_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'member');
  IF v_role NOT IN ('admin','member') THEN
    v_role := 'member';
  END IF;

  UPDATE public.users
  SET id = NEW.id,
      full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', full_name),
      role = v_role
  WHERE email = NEW.email AND id IS NULL;

  IF NOT FOUND THEN
    INSERT INTO public.users (id, email, full_name, role)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      v_role
    );
  END IF;

  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.seed_default_positions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.team_positions (team_id, name, sort_order) VALUES
    (NEW.id, 'Primary Doctor', 1),
    (NEW.id, 'Associate Doctor', 2),
    (NEW.id, 'Intern Doctor', 3),
    (NEW.id, 'Accountant', 4),
    (NEW.id, 'Accounts Team', 5);
  RETURN NEW;
END;
$function$;

-- ─── TRIGGERS ───────────────────────────────────────────────────────────────
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

CREATE TRIGGER on_team_created_seed_positions
  AFTER INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_positions();

-- ============================================================================
-- SECURITY HARDENING (FULL RLS) — chosen posture for production.
--
-- Goal: (1) the public/anon key can NEVER reach data; (2) strict team isolation
-- for every authenticated user. Edge Functions use service_role, which bypasses
-- RLS, so the invite / scan flows are unaffected.
--
-- ⚠️  The app was previously run with RLS OFF on most tables. This block enables
--     RLS everywhere, so EVERY flow must be smoke-tested on the fresh prod
--     project (which holds no real data yet) before cutover. Fix any policy gap
--     found during testing here.
-- ============================================================================

-- Block the public key entirely.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- Helper: caller's access role. SECURITY DEFINER so it reads users WITHOUT
-- retriggering RLS (prevents recursion inside users / permissions policies).
CREATE OR REPLACE FUNCTION public.current_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM public.users WHERE id = auth.uid();
$function$;

-- Enable RLS on every table (default-deny; policies below grant team-scoped access).
ALTER TABLE public.teams              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_positions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_services  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admissions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outpatient_visits  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_notes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services_rendered  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_services      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admission_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_services     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs      ENABLE ROW LEVEL SECURITY;

-- ─── POLICIES (team-scoped, canonical current_user_team_id()) ───────────────

-- teams: onboarding create; read/update own team only.
CREATE POLICY teams_insert ON public.teams FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY teams_select ON public.teams FOR SELECT TO authenticated USING (id = current_user_team_id());
CREATE POLICY teams_update ON public.teams FOR UPDATE TO authenticated
  USING (id = current_user_team_id()) WITH CHECK (id = current_user_team_id());

-- users: self always (needed at onboarding before a team exists); teammates
-- readable; admin edits of teammates allowed. Member CRUD by admins also goes
-- through the invite-team-member Edge Function (service_role, bypasses RLS).
CREATE POLICY users_select ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid() OR team_id = current_user_team_id());
CREATE POLICY users_insert_self ON public.users FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY users_update_self ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY users_update_admin ON public.users FOR UPDATE TO authenticated
  USING (team_id = current_user_team_id() AND current_user_role() = 'admin')
  WITH CHECK (team_id = current_user_team_id());

-- team_positions: read by team; write by team admins.
CREATE POLICY team_positions_select ON public.team_positions FOR SELECT TO authenticated
  USING (team_id = current_user_team_id());
CREATE POLICY team_positions_write ON public.team_positions FOR ALL TO authenticated
  USING (team_id = current_user_team_id() AND current_user_role() = 'admin')
  WITH CHECK (team_id = current_user_team_id() AND current_user_role() = 'admin');

-- user_permissions: read by team; write by team admins.
CREATE POLICY user_permissions_select ON public.user_permissions FOR SELECT TO authenticated
  USING (team_id = current_user_team_id());
CREATE POLICY user_permissions_write ON public.user_permissions FOR ALL TO authenticated
  USING (team_id = current_user_team_id() AND current_user_role() = 'admin')
  WITH CHECK (team_id = current_user_team_id() AND current_user_role() = 'admin');

-- Team-owned tables — full access within the caller's team.
CREATE POLICY hospitals_team ON public.hospitals FOR ALL TO authenticated
  USING (team_id = current_user_team_id()) WITH CHECK (team_id = current_user_team_id());
CREATE POLICY patients_team ON public.patients FOR ALL TO authenticated
  USING (team_id = current_user_team_id()) WITH CHECK (team_id = current_user_team_id());
CREATE POLICY admissions_team ON public.admissions FOR ALL TO authenticated
  USING (team_id = current_user_team_id()) WITH CHECK (team_id = current_user_team_id());
CREATE POLICY outpatient_visits_team ON public.outpatient_visits FOR ALL TO authenticated
  USING (team_id = current_user_team_id()) WITH CHECK (team_id = current_user_team_id());
CREATE POLICY team_services_team ON public.team_services FOR ALL TO authenticated
  USING (team_id = current_user_team_id()) WITH CHECK (team_id = current_user_team_id());
CREATE POLICY activity_logs_team ON public.activity_logs FOR ALL TO authenticated
  USING (team_id = current_user_team_id()) WITH CHECK (team_id = current_user_team_id());

-- Child tables — scoped through their parent's team.
CREATE POLICY hospital_services_team ON public.hospital_services FOR ALL TO authenticated
  USING (hospital_id IN (SELECT id FROM public.hospitals WHERE team_id = current_user_team_id()))
  WITH CHECK (hospital_id IN (SELECT id FROM public.hospitals WHERE team_id = current_user_team_id()));
CREATE POLICY services_rendered_team ON public.services_rendered FOR ALL TO authenticated
  USING (admission_id IN (SELECT id FROM public.admissions WHERE team_id = current_user_team_id()))
  WITH CHECK (admission_id IN (SELECT id FROM public.admissions WHERE team_id = current_user_team_id()));
CREATE POLICY admission_services_team ON public.admission_services FOR ALL TO authenticated
  USING (admission_id IN (SELECT id FROM public.admissions WHERE team_id = current_user_team_id()))
  WITH CHECK (admission_id IN (SELECT id FROM public.admissions WHERE team_id = current_user_team_id()));
CREATE POLICY visit_services_team ON public.visit_services FOR ALL TO authenticated
  USING (visit_id IN (SELECT id FROM public.outpatient_visits WHERE team_id = current_user_team_id()))
  WITH CHECK (visit_id IN (SELECT id FROM public.outpatient_visits WHERE team_id = current_user_team_id()));
CREATE POLICY invoices_team ON public.invoices FOR ALL TO authenticated
  USING (admission_id IN (SELECT id FROM public.admissions WHERE team_id = current_user_team_id()))
  WITH CHECK (admission_id IN (SELECT id FROM public.admissions WHERE team_id = current_user_team_id()));
CREATE POLICY timeline_events_team ON public.timeline_events FOR ALL TO authenticated
  USING (admission_id IN (SELECT id FROM public.admissions WHERE team_id = current_user_team_id()))
  WITH CHECK (admission_id IN (SELECT id FROM public.admissions WHERE team_id = current_user_team_id()));
CREATE POLICY patient_notes_team ON public.patient_notes FOR ALL TO authenticated
  USING (
    (admission_id IS NOT NULL AND admission_id IN (SELECT id FROM public.admissions WHERE team_id = current_user_team_id()))
    OR (visit_id IS NOT NULL AND visit_id IN (SELECT id FROM public.outpatient_visits WHERE team_id = current_user_team_id()))
  )
  WITH CHECK (
    (admission_id IS NOT NULL AND admission_id IN (SELECT id FROM public.admissions WHERE team_id = current_user_team_id()))
    OR (visit_id IS NOT NULL AND visit_id IN (SELECT id FROM public.outpatient_visits WHERE team_id = current_user_team_id()))
  );

-- Reload PostgREST schema cache (required after schema changes).
NOTIFY pgrst, 'reload schema';
