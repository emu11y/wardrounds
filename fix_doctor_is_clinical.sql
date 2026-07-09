-- ============================================================================
-- fix_doctor_is_clinical.sql  —  follow-up #6 (PROD)
-- Project: WardRounds Production (ref bannxzyidkgmbejyrzea)
--
-- WHY: seed_default_positions() inserted the doctor positions WITHOUT setting
-- is_clinical, so they defaulted to FALSE. The Appointments page lists doctors
-- where is_clinical = true; with all positions false, multi-doctor practices
-- see no selectable doctors. (A code fallback unblocks SOLO admins, but seed
-- data must be correct for multi-doctor teams.)
--
-- This script: (1) inspects current state, (2) backfills existing teams,
-- (3) replaces the seed function so NEW teams are correct. Run in the Supabase
-- SQL Editor. Ends with NOTIFY pgrst per the DB standards.
-- ============================================================================

-- ─── 1. INSPECT — what do existing teams look like? ─────────────────────────
SELECT team_id, name, sort_order, is_clinical
FROM public.team_positions
ORDER BY team_id, sort_order;
-- The three doctor rows (Primary/Associate/Intern Doctor) SHOULD be is_clinical=true.
-- Accountant / Accounts Team should be false.

-- Which users currently sit on a clinical position?
SELECT u.full_name, u.role, tp.name AS position, tp.is_clinical
FROM public.users u
LEFT JOIN public.team_positions tp ON tp.id = u.position_id
ORDER BY u.team_id, u.full_name;

-- ─── 2. BACKFILL — fix existing teams ───────────────────────────────────────
UPDATE public.team_positions
SET is_clinical = true
WHERE name IN ('Primary Doctor', 'Associate Doctor', 'Intern Doctor')
  AND is_clinical = false;
-- (Non-doctor positions are left false.)

-- ─── 3. FIX THE SEED FUNCTION — new teams get correct flags ─────────────────
CREATE OR REPLACE FUNCTION public.seed_default_positions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.team_positions (team_id, name, sort_order, is_clinical) VALUES
    (NEW.id, 'Primary Doctor',   1, true),
    (NEW.id, 'Associate Doctor', 2, true),
    (NEW.id, 'Intern Doctor',    3, true),
    (NEW.id, 'Accountant',       4, false),
    (NEW.id, 'Accounts Team',    5, false);
  RETURN NEW;
END;
$function$;

-- ─── 4. VERIFY ──────────────────────────────────────────────────────────────
SELECT team_id, name, sort_order, is_clinical
FROM public.team_positions
WHERE name IN ('Primary Doctor', 'Associate Doctor', 'Intern Doctor')
ORDER BY team_id, sort_order;
-- Expect: is_clinical = true on all three per team.

-- Reload PostgREST schema cache (required after function change).
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- NOTE — admin's own position on signup:
-- create_team_for_user()/handle_new_auth_user() set role='admin' but do NOT
-- assign position_id. So a solo admin has NO clinical position; the app's
-- current-user fallback (MyAppointments.jsx) is what keeps solo practices
-- working. If you want the admin to appear as a doctor by default, assign them
-- the 'Primary Doctor' position after team creation, e.g.:
--
--   UPDATE public.users u
--   SET position_id = tp.id
--   FROM public.team_positions tp
--   WHERE tp.team_id = u.team_id
--     AND tp.name = 'Primary Doctor'
--     AND u.role = 'admin'
--     AND u.position_id IS NULL;
--
-- (Left commented — decide per your onboarding UX.)
-- ============================================================================
