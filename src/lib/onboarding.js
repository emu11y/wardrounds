// ─────────────────────────────────────────────────────────────────────────────
// onboarding.js — everything the setup wizard knows, in one place:
//   • vocabularies (pay types, colours, suggestions, profession fallback)
//   • modulesFor(payModels) — which parts of the app a clinician sees
//   • applyOnboarding(draft, ctx) — writes the wizard's answers, idempotently
//     (every created record's id is written back into the draft, so a retry
//      after a network blip never duplicates hospitals, wards or services)
// ─────────────────────────────────────────────────────────────────────────────
import {
  saveTeamProfile, createHospital, addHospitalWard, fetchTeamServices, createTeamService,
  fetchPayers, createPayer, savePayModels, completeOnboarding,
} from './api'

// Mirrors the professions seed in WARDROUNDS_SQL_ONBOARDING.sql (used if the lookup can't load).
export const PROFESSIONS_FALLBACK = [
  { key: 'doctor', label: 'Doctor' }, { key: 'surgeon', label: 'Surgeon' },
  { key: 'clinical_officer', label: 'Clinical officer' }, { key: 'nurse', label: 'Nurse' },
  { key: 'physiotherapist', label: 'Physiotherapist' }, { key: 'pharmacist', label: 'Pharmacist' },
  { key: 'dentist', label: 'Dentist' }, { key: 'nutritionist', label: 'Nutritionist' },
  { key: 'other', label: 'Other' },
]

export const PAY_MODELS = [
  { key: 'ward_rounds',   label: 'Ward rounds',   hint: 'Billed per day, at each ward’s daily rate, while your patient is admitted' },
  { key: 'per_patient',   label: 'Per patient',   hint: 'A consultation fee — a fixed amount or a percentage — for each patient you see' },
  { key: 'per_procedure', label: 'Per procedure', hint: 'A set price for each procedure or test you perform' },
  { key: 'per_shift',     label: 'Per shift',     hint: 'Paid for each shift — per shift or per hour, with optional overtime' },
]

// Same accent family used across the app (Settings hospitals default to #3B82F6).
export const HOSPITAL_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#0EA5E9', '#EC4899', '#14B8A6']

export const WARD_SUGGESTIONS = ['General ward', 'Private ward', 'HDU', 'ICU', 'Maternity', 'Paediatrics']
export const PROCEDURE_SUGGESTIONS = ['ECG', 'Echocardiogram', 'Ultrasound', 'Endoscopy', 'Minor procedure', 'Wound dressing']

// Settings → "Run setup again" dispatches this; App opens the wizard.
export const OPEN_SETUP_EVENT = 'wr:open-setup'

// ── Modules ──────────────────────────────────────────────────────────────────
// No pay models recorded (everyone who used WardRounds before the wizard) → null,
// meaning "show everything", so nothing disappears for existing users.
export function modulesFor(payModels = []) {
  if (!payModels?.length) return null
  const has = k => payModels.some(m => m.pay_model === k)
  return {
    inpatient: has('ward_rounds'),
    outpatient: has('per_patient') || has('per_procedure'),
    shifts: has('per_shift'),
  }
}

// Route → module. Routes not listed (Patients, Analytics, Settings) are always shown.
const ROUTE_MODULE = { '/': 'inpatient', '/admit': 'inpatient', '/billing': 'inpatient', '/outpatient': 'outpatient', '/appointments': 'outpatient', '/shifts': 'shifts' }
export function routeVisible(modules, path) {
  if (!modules) return true
  const m = ROUTE_MODULE[path]
  return !m || modules[m] === true
}

// Where a freshly set-up user should land.
export function homeRouteFor(modules) {
  if (!modules || modules.inpatient) return '/'
  if (modules.outpatient) return '/outpatient'
  if (modules.shifts) return '/shifts'
  return '/patients'
}

// ── Draft ────────────────────────────────────────────────────────────────────
export const newLocalId = () => Math.random().toString(36).slice(2, 10)

export function emptyDraft(user) {
  const team = user?.teams || {}
  return {
    step: 0,
    fullName: user?.full_name || '',
    professionKey: user?.profession_key || '',
    speciality: user?.speciality || '',
    phone: user?.phone || '',
    practiceName: team.practice_name || team.name || '',
    practiceType: team.practice_type || 'solo',
    teamSize: team.expected_team_size || 2,
    membersSeeFinancials: team.members_see_financials !== false,
    pay: {
      ward_rounds: { on: false },
      per_patient: { on: false, mode: 'fixed', amount: '', percent: '' },
      per_procedure: { on: false },
      per_shift: { on: false, rate: '', unit: 'shift' },
    },
    hospitals: [],     // [{ localId, id?, name, color, prefix, existing, wards: [{ localId, id?, name, rate }] }]
    procedures: [],    // [{ localId, id?, name, price }]
    consultationServiceId: null,
    payersDone: false,
    done: false,
  }
}

export const anyPay = d => Object.values(d.pay).some(p => p.on)
export const needsHospitals = d => d.pay.ward_rounds.on || d.pay.per_patient.on || d.pay.per_procedure.on

// Pay models in the shape savePayModels() expects.
export function payModelRows(d) {
  const rows = []
  if (d.pay.ward_rounds.on) rows.push({ pay_model: 'ward_rounds' })
  if (d.pay.per_patient.on) rows.push({
    pay_model: 'per_patient', per_patient_mode: d.pay.per_patient.mode,
    per_patient_amount: d.pay.per_patient.amount === '' ? null : Number(d.pay.per_patient.amount),
    per_patient_percent: d.pay.per_patient.mode === 'percent' && d.pay.per_patient.percent !== '' ? Number(d.pay.per_patient.percent) : null,
  })
  if (d.pay.per_procedure.on) rows.push({ pay_model: 'per_procedure' })
  if (d.pay.per_shift.on) rows.push({
    pay_model: 'per_shift', shift_rate: d.pay.per_shift.rate === '' ? null : Number(d.pay.per_shift.rate), shift_rate_unit: d.pay.per_shift.unit,
  })
  return rows
}

// Pay-model rows from the DB → the wizard's `pay` shape (for re-running setup).
export function payFromRows(rows = []) {
  const pay = emptyDraft().pay
  for (const r of rows) {
    if (r.pay_model === 'ward_rounds') pay.ward_rounds.on = true
    if (r.pay_model === 'per_procedure') pay.per_procedure.on = true
    if (r.pay_model === 'per_patient') Object.assign(pay.per_patient, { on: true, mode: r.per_patient_mode || 'fixed', amount: r.per_patient_amount ?? '', percent: r.per_patient_percent ?? '' })
    if (r.pay_model === 'per_shift') Object.assign(pay.per_shift, { on: true, rate: r.shift_rate ?? '', unit: r.shift_rate_unit || 'shift' })
  }
  return pay
}

// ── Apply ────────────────────────────────────────────────────────────────────
// Writes the wizard's answers in dependency order. `onProgress(label, nextDraft)`
// is called after each completed write with the updated draft (ids filled in) so
// the caller can persist it. Admin-only steps are skipped for members.
export async function applyOnboarding(draft, { user, isAdmin, professionLabel, onProgress = () => {} }) {
  let d = structuredClone(draft)
  const teamId = user.team_id
  const save = (label) => onProgress(label, d)

  if (isAdmin) {
    await saveTeamProfile(teamId, {
      name: d.practiceName.trim(),
      practice_name: d.practiceName.trim(),
      doctor_name: d.fullName.trim(),                                      // invoice signature
      doctor_title: d.speciality.trim() || professionLabel || null,
      practice_type: d.practiceType,
      expected_team_size: d.practiceType === 'team' ? Number(d.teamSize) || 2 : 1,
      members_see_financials: d.practiceType === 'team' ? d.membersSeeFinancials : true,
    })
    save('Practice details saved')

    for (const h of d.hospitals) {
      if (!h.id) {
        const row = await createHospital({ team_id: teamId, name: h.name.trim(), color: h.color, hospital_id_prefix: h.prefix?.trim() || null, status: 'active' })
        h.id = row.id
        save(`Added ${h.name}`)
      }
      if (d.pay.ward_rounds.on) {
        for (const w of h.wards) {
          if (w.id || !w.name.trim()) continue
          const row = await addHospitalWard(h.id, w.name.trim(), Number(w.rate) || 0)
          w.id = row.id
          save(`Added ${w.name} at ${h.name}`)
        }
      }
    }

    const services = await fetchTeamServices(teamId).catch(() => [])
    const hasService = name => services.some(s => s.service_name?.trim().toLowerCase() === name.trim().toLowerCase())

    if (d.pay.per_patient.on && d.pay.per_patient.mode === 'fixed' && Number(d.pay.per_patient.amount) > 0 && !d.consultationServiceId && !hasService('Consultation')) {
      const row = await createTeamService({ team_id: teamId, service_name: 'Consultation', category: 'Consultation', price: Number(d.pay.per_patient.amount), billing_type: 'one-off', status: 'active' })
      d.consultationServiceId = row.id
      save('Consultation fee added')
    }

    if (d.pay.per_procedure.on) {
      for (const p of d.procedures) {
        if (p.id || !p.name.trim() || hasService(p.name)) continue
        const row = await createTeamService({ team_id: teamId, service_name: p.name.trim(), category: 'Procedure', price: Number(p.price) || 0, billing_type: 'one-off', status: 'active' })
        p.id = row.id
        save(`Added ${p.name}`)
      }
    }

    if (d.pay.per_shift.on && !d.payersDone) {
      const payers = await fetchPayers(teamId).catch(() => [])
      for (const h of d.hospitals) {
        if (!payers.some(p => p.payer_type === 'hospital' && p.hospital_id === h.id)) {
          await createPayer(teamId, { payer_type: 'hospital', hospital_id: h.id }, user)
        }
      }
      d.payersDone = true
      save('Payers set up for your hospitals')
    }
  }

  await savePayModels(user.id, teamId, payModelRows(d), user)
  save('Pay types saved')

  await completeOnboarding(user.id, { full_name: d.fullName.trim(), profession_key: d.professionKey, speciality: d.speciality.trim(), phone: d.phone.trim() })
  d.done = true
  save('All set')
  return d
}
