// ─────────────────────────────────────────────────────────────────────────────
// earnings.js — the single source of truth for SHIFT pay maths (and the shared
// payer/shift vocabularies). Totals are derived on read, never stored — the same
// principle as ward billing in billing.js. Every consumer (Shifts page cards,
// summary chips, PDF/Excel exports, future Analytics) calls these functions.
// ─────────────────────────────────────────────────────────────────────────────

// ── Vocabularies (mirror the CHECK constraints in WARDROUNDS_SQL_SHIFT_MONITOR.sql)
export const SHIFT_TYPES = [
  { key: 'day',     label: 'Day' },
  { key: 'night',   label: 'Night' },
  { key: 'weekend', label: 'Weekend' },
  { key: 'on_call', label: 'On-call' },
  { key: 'other',   label: 'Other' },
]
export const SHIFT_TYPE_LABEL = Object.fromEntries(SHIFT_TYPES.map(t => [t.key, t.label]))

export const RATE_UNITS = [
  { key: 'shift', label: 'Per shift' },
  { key: 'hour',  label: 'Per hour' },
]

export const PER_PATIENT_MODES = [
  { key: 'fixed',   label: 'Fixed amount per patient' },
  { key: 'percent', label: 'Percentage of fee per patient' },
]

export const PAYER_TYPES = [
  { key: 'hospital', label: 'Hospital' },
  { key: 'agency',   label: 'Locum agency' },
  { key: 'patient',  label: 'Patient (direct)' },
  { key: 'insurer',  label: 'Insurer' },
  { key: 'other',    label: 'Other' },
]
export const PAYER_TYPE_LABEL = Object.fromEntries(PAYER_TYPES.map(t => [t.key, t.label]))

// ── Helpers
const num = v => (v === '' || v == null || Number.isNaN(Number(v)) ? 0 : Number(v))
const round2 = v => Math.round(v * 100) / 100

// Display name for a payer row (hospital payers take the hospital's name — never duplicated).
export function payerName(payer, hospitalsById = {}) {
  if (!payer) return ''
  if (payer.payer_type === 'hospital') {
    return payer.hospitals?.name || hospitalsById[payer.hospital_id]?.name || 'Hospital'
  }
  return payer.name || PAYER_TYPE_LABEL[payer.payer_type] || 'Payer'
}

// Scheduled length of a shift in hours (2 dp). Overnight shifts work naturally
// because starts_at / ends_at are full timestamps.
export function shiftHours(shift) {
  const s = new Date(shift?.starts_at).getTime()
  const e = new Date(shift?.ends_at).getTime()
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0
  return round2((e - s) / 3_600_000)
}

// Line-item breakdown of one shift's pay. Each part is 0 when its option is off.
//   base      = rate (per shift)  |  rate × scheduled hours (per hour)
//   overtime  = overtime_hours × overtime_rate
//   perPatient= patient_count × amount                     (fixed)
//             | patient_count × amount × percent / 100     (percent of fee)
export function shiftBreakdown(shift) {
  const hours = shiftHours(shift)
  const base = shift?.rate_unit === 'hour' ? num(shift.base_rate) * hours : num(shift?.base_rate)

  const overtime = shift?.overtime_enabled
    ? num(shift.overtime_hours) * num(shift.overtime_rate)
    : 0

  let perPatient = 0
  if (shift?.per_patient_enabled) {
    const each = shift.per_patient_mode === 'percent'
      ? num(shift.per_patient_amount) * num(shift.per_patient_percent) / 100
      : num(shift.per_patient_amount)
    perPatient = num(shift.patient_count) * each
  }

  return {
    hours,
    base: round2(base),
    overtime: round2(overtime),
    perPatient: round2(perPatient),
    total: round2(base + overtime + perPatient),
  }
}

export const shiftTotal = shift => shiftBreakdown(shift).total

// Human-readable lines for the card / exports, e.g. "Base · 12 h × KES 1,500".
export function shiftBreakdownLines(shift, fmt = v => String(v)) {
  const b = shiftBreakdown(shift)
  const lines = [{
    key: 'base',
    label: shift?.rate_unit === 'hour'
      ? `Base · ${b.hours} h × ${fmt(num(shift.base_rate))}`
      : 'Base · per shift',
    amount: b.base,
  }]
  if (shift?.overtime_enabled) {
    lines.push({ key: 'overtime', label: `Overtime · ${num(shift.overtime_hours)} h × ${fmt(num(shift.overtime_rate))}`, amount: b.overtime })
  }
  if (shift?.per_patient_enabled) {
    const n = num(shift.patient_count)
    lines.push({
      key: 'perPatient',
      label: shift.per_patient_mode === 'percent'
        ? `Per patient · ${n} × ${num(shift.per_patient_percent)}% of ${fmt(num(shift.per_patient_amount))}`
        : `Per patient · ${n} × ${fmt(num(shift.per_patient_amount))}`,
      amount: b.perPatient,
    })
  }
  return lines
}

// The amount a billing record should be judged against: the recorded/hospital
// figure when present, otherwise the system-derived total. Shared by the Billing
// and Shifts pages (summary "Outstanding" and exports).
export function effectiveAmount(record, systemTotal) {
  return record?.amount != null ? Number(record.amount) : systemTotal
}

// ── Time helpers — shifts are entered and shown in Nairobi time (UTC+3, no DST).
const TZ = 'Africa/Nairobi'
const NAIROBI_OFFSET = '+03:00'

// timestamptz → { date: 'YYYY-MM-DD', time: 'HH:MM' } in Nairobi.
export function toNairobiParts(iso) {
  if (!iso) return { date: '', time: '' }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(iso)).map(p => [p.type, p.value])
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

// date + start/end clock times (Nairobi) → { starts_at, ends_at, overnight }.
// An end time at or before the start means the shift ends the next day.
export function fromNairobiParts(date, startTime, endTime) {
  if (!date || !startTime || !endTime) return null
  const start = new Date(`${date}T${startTime}:00${NAIROBI_OFFSET}`)
  let end = new Date(`${date}T${endTime}:00${NAIROBI_OFFSET}`)
  const overnight = end <= start
  if (overnight) end = new Date(end.getTime() + 86_400_000)
  return { starts_at: start.toISOString(), ends_at: end.toISOString(), overnight }
}

// "Sat 3 Oct" and "19:00–07:00" labels for cards/exports.
export function shiftDateLabel(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
export function shiftTimeLabel(shift) {
  return `${toNairobiParts(shift.starts_at).time}–${toNairobiParts(shift.ends_at).time}`
}
// 'YYYY-MM' month a shift belongs to (by its Nairobi start date).
export const shiftMonth = shift => toNairobiParts(shift.starts_at).date.slice(0, 7)

// Sensible defaults for a new shift: copy the pay settings of the clinician's most
// recent shift at the same hospital (else their most recent shift at all), so
// repeat shifts take one tap. Times/notes/patient counts are never copied.
export function prefillFromLastShift(shifts, hospitalId) {
  const last = shifts.find(s => hospitalId && s.hospital_id === hospitalId) || shifts[0]
  if (!last) return {}
  const keys = ['shift_type', 'payer_id', 'rate_unit', 'base_rate', 'overtime_enabled', 'overtime_rate',
    'per_patient_enabled', 'per_patient_mode', 'per_patient_amount', 'per_patient_percent']
  const out = Object.fromEntries(keys.map(k => [k, last[k]]))
  out._startTime = toNairobiParts(last.starts_at).time
  out._endTime = toNairobiParts(last.ends_at).time
  return out
}
