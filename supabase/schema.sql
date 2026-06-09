-- WardRounds Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── ENUMS ───────────────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('admin', 'doctor', 'assoc_doctor', 'nurse', 'accountant', 'cashier');
CREATE TYPE admission_status AS ENUM ('admitted', 'transferred', 'discharged');
CREATE TYPE timeline_event_type AS ENUM ('admitted', 'transferred', 'discharged', 'note_added', 'service_added');
CREATE TYPE billing_status AS ENUM ('pending', 'billed', 'paid');

-- ─── TEAMS ───────────────────────────────────────────────────────────────────
CREATE TABLE teams (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  admin_id    UUID,
  logo_url    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── USERS (extends Supabase auth.users) ─────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL,
  team_id       UUID REFERENCES teams(id) ON DELETE SET NULL,
  role          user_role NOT NULL DEFAULT 'nurse',
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Back-fill admin_id FK now that users table exists
ALTER TABLE teams ADD CONSTRAINT teams_admin_id_fkey
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL;

-- ─── HOSPITALS ───────────────────────────────────────────────────────────────
CREATE TABLE hospitals (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  location    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── HOSPITAL SERVICES ───────────────────────────────────────────────────────
CREATE TABLE hospital_services (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hospital_id     UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  service_name    TEXT NOT NULL,
  price_per_day   NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PATIENTS ────────────────────────────────────────────────────────────────
CREATE TABLE patients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  date_of_birth   DATE,
  insurance_name  TEXT,
  hospital_id     UUID REFERENCES hospitals(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ADMISSIONS ──────────────────────────────────────────────────────────────
CREATE TABLE admissions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  hospital_id     UUID REFERENCES hospitals(id) ON DELETE SET NULL,
  ward            TEXT,
  admission_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  discharge_date  TIMESTAMPTZ,
  status          admission_status NOT NULL DEFAULT 'admitted',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TIMELINE EVENTS ─────────────────────────────────────────────────────────
CREATE TABLE timeline_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_id  UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  event_type    timeline_event_type NOT NULL,
  ward          TEXT,
  notes         TEXT,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  timestamp     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PATIENT NOTES ───────────────────────────────────────────────────────────
CREATE TABLE patient_notes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_id        UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  note_text           TEXT NOT NULL,
  created_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  signature           TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SERVICES RENDERED ───────────────────────────────────────────────────────
CREATE TABLE services_rendered (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_id    UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  service_id      UUID NOT NULL REFERENCES hospital_services(id) ON DELETE RESTRICT,
  rendered_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity        INTEGER NOT NULL DEFAULT 1,
  price_applied   NUMERIC(10,2) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BILLING RECORDS ─────────────────────────────────────────────────────────
CREATE TABLE billing_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_id    UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  service_id      UUID REFERENCES hospital_services(id) ON DELETE SET NULL,
  accrual_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  amount          NUMERIC(10,2) NOT NULL,
  status          billing_status NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── INVOICES ────────────────────────────────────────────────────────────────
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admission_id    UUID NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  total_amount    NUMERIC(10,2) NOT NULL,
  pdf_path        TEXT,
  generated_at    TIMESTAMPTZ DEFAULT NOW(),
  paid_at         TIMESTAMPTZ
);

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admissions_updated_at
  BEFORE UPDATE ON admissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
ALTER TABLE teams              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospitals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE hospital_services  ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE admissions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_notes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE services_rendered  ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's team_id
CREATE OR REPLACE FUNCTION current_team_id()
RETURNS UUID AS $$
  SELECT team_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- TEAMS: see your own team
CREATE POLICY "team_select" ON teams FOR SELECT USING (id = current_team_id());
CREATE POLICY "team_update" ON teams FOR UPDATE USING (id = current_team_id() AND current_user_role() = 'admin');

-- USERS: see teammates, admin can insert/update
CREATE POLICY "users_select" ON users FOR SELECT USING (team_id = current_team_id());
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (team_id = current_team_id() AND current_user_role() = 'admin');
CREATE POLICY "users_update" ON users FOR UPDATE USING (team_id = current_team_id() AND (id = auth.uid() OR current_user_role() = 'admin'));

-- HOSPITALS: team-scoped
CREATE POLICY "hospitals_select" ON hospitals FOR SELECT USING (team_id = current_team_id());
CREATE POLICY "hospitals_insert" ON hospitals FOR INSERT WITH CHECK (team_id = current_team_id() AND current_user_role() = 'admin');
CREATE POLICY "hospitals_update" ON hospitals FOR UPDATE USING (team_id = current_team_id() AND current_user_role() = 'admin');
CREATE POLICY "hospitals_delete" ON hospitals FOR DELETE USING (team_id = current_team_id() AND current_user_role() = 'admin');

-- HOSPITAL_SERVICES: via hospital team
CREATE POLICY "services_select" ON hospital_services FOR SELECT
  USING (hospital_id IN (SELECT id FROM hospitals WHERE team_id = current_team_id()));
CREATE POLICY "services_insert" ON hospital_services FOR INSERT
  WITH CHECK (hospital_id IN (SELECT id FROM hospitals WHERE team_id = current_team_id()) AND current_user_role() = 'admin');
CREATE POLICY "services_update" ON hospital_services FOR UPDATE
  USING (hospital_id IN (SELECT id FROM hospitals WHERE team_id = current_team_id()) AND current_user_role() = 'admin');
CREATE POLICY "services_delete" ON hospital_services FOR DELETE
  USING (hospital_id IN (SELECT id FROM hospitals WHERE team_id = current_team_id()) AND current_user_role() = 'admin');

-- PATIENTS: team-scoped
CREATE POLICY "patients_select" ON patients FOR SELECT USING (team_id = current_team_id());
CREATE POLICY "patients_insert" ON patients FOR INSERT WITH CHECK (team_id = current_team_id());
CREATE POLICY "patients_update" ON patients FOR UPDATE USING (team_id = current_team_id());
CREATE POLICY "patients_delete" ON patients FOR DELETE USING (team_id = current_team_id() AND current_user_role() = 'admin');

-- ADMISSIONS: team-scoped
CREATE POLICY "admissions_select" ON admissions FOR SELECT USING (team_id = current_team_id());
CREATE POLICY "admissions_insert" ON admissions FOR INSERT WITH CHECK (team_id = current_team_id());
CREATE POLICY "admissions_update" ON admissions FOR UPDATE USING (team_id = current_team_id());
CREATE POLICY "admissions_delete" ON admissions FOR DELETE USING (team_id = current_team_id() AND current_user_role() = 'admin');

-- TIMELINE_EVENTS: via admission team
CREATE POLICY "timeline_select" ON timeline_events FOR SELECT
  USING (admission_id IN (SELECT id FROM admissions WHERE team_id = current_team_id()));
CREATE POLICY "timeline_insert" ON timeline_events FOR INSERT
  WITH CHECK (admission_id IN (SELECT id FROM admissions WHERE team_id = current_team_id()));

-- PATIENT_NOTES: via admission team
CREATE POLICY "notes_select" ON patient_notes FOR SELECT
  USING (admission_id IN (SELECT id FROM admissions WHERE team_id = current_team_id()));
CREATE POLICY "notes_insert" ON patient_notes FOR INSERT
  WITH CHECK (admission_id IN (SELECT id FROM admissions WHERE team_id = current_team_id()));
CREATE POLICY "notes_update" ON patient_notes FOR UPDATE
  USING (created_by_user_id = auth.uid());
CREATE POLICY "notes_delete" ON patient_notes FOR DELETE
  USING (created_by_user_id = auth.uid() OR current_user_role() = 'admin');

-- SERVICES_RENDERED: via admission team
CREATE POLICY "rendered_select" ON services_rendered FOR SELECT
  USING (admission_id IN (SELECT id FROM admissions WHERE team_id = current_team_id()));
CREATE POLICY "rendered_insert" ON services_rendered FOR INSERT
  WITH CHECK (admission_id IN (SELECT id FROM admissions WHERE team_id = current_team_id()));
CREATE POLICY "rendered_delete" ON services_rendered FOR DELETE
  USING (admission_id IN (SELECT id FROM admissions WHERE team_id = current_team_id()) AND current_user_role() IN ('admin','accountant'));

-- BILLING_RECORDS: via admission team
CREATE POLICY "billing_select" ON billing_records FOR SELECT
  USING (admission_id IN (SELECT id FROM admissions WHERE team_id = current_team_id()));
CREATE POLICY "billing_insert" ON billing_records FOR INSERT
  WITH CHECK (admission_id IN (SELECT id FROM admissions WHERE team_id = current_team_id()));
CREATE POLICY "billing_update" ON billing_records FOR UPDATE
  USING (admission_id IN (SELECT id FROM admissions WHERE team_id = current_team_id()) AND current_user_role() IN ('admin','accountant','cashier'));

-- INVOICES: via admission team
CREATE POLICY "invoices_select" ON invoices FOR SELECT
  USING (admission_id IN (SELECT id FROM admissions WHERE team_id = current_team_id()));
CREATE POLICY "invoices_insert" ON invoices FOR INSERT
  WITH CHECK (admission_id IN (SELECT id FROM admissions WHERE team_id = current_team_id()) AND current_user_role() IN ('admin','accountant'));

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX idx_patients_team ON patients(team_id);
CREATE INDEX idx_admissions_team ON admissions(team_id);
CREATE INDEX idx_admissions_patient ON admissions(patient_id);
CREATE INDEX idx_admissions_status ON admissions(status);
CREATE INDEX idx_timeline_admission ON timeline_events(admission_id);
CREATE INDEX idx_notes_admission ON patient_notes(admission_id);
CREATE INDEX idx_billing_admission ON billing_records(admission_id);
CREATE INDEX idx_billing_status ON billing_records(status);
