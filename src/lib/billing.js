import { parseEventTimestamp } from './api'

const WARD_COLORS = { 'ICU': '#ef4444', 'HDU': '#f97316', 'General Ward': '#22c55e' }
export function wardColor(name) { return WARD_COLORS[name] || '#3b82f6' }

function fmtShort(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Expands one ward-stay segment into its individual billed calendar days (UTC-midnight
// Date objects) — the single day-math implementation shared by buildWardLines (per-admission
// display) and computeTeamRevenueForRange (range aggregation), so segment expansion never
// drifts between the two.  Last (current) segment: inclusive of today (+1). Past segments:
// exclusive end (end = next segment's start day).
function expandSegmentDays(from, to, isLast) {
  const f = new Date(from)
  const t = new Date(to)
  f.setUTCHours(0, 0, 0, 0)
  t.setUTCHours(0, 0, 0, 0)
  const count = isLast
    ? Math.max(1, Math.floor((t - f) / 86400000) + 1)
    : Math.floor((t - f) / 86400000)
  const dayDates = []
  for (let i = 0; i < count; i++) {
    const d = new Date(f)
    d.setUTCDate(d.getUTCDate() + i)
    dayDates.push(d)
  }
  return dayDates
}

// Ward stay segments derived from timeline_events (single source of truth).
// Discharged/archived stays cap at discharge_date; 0-day past segments are tagged
// isCorrection (wrongful-admission fixes) — excluded from billing, shown as footnotes.
export function buildWardLines(admission) {
  const hospitalServices = admission.hospitals?.hospital_services || []

  const wardEvents = [...(admission.timeline_events || [])]
    .filter(ev => ev.event_type === 'admitted' || ev.event_type === 'transferred')
    .sort((a, b) => {
      // An admission always precedes all transfers, regardless of timestamp granularity.
      // The 'admitted' event sometimes carries a wall-clock time while transfers are date-only,
      // so timestamp comparison alone is unreliable for same-day sequences.
      if (a.event_type === 'admitted' && b.event_type !== 'admitted') return -1
      if (b.event_type === 'admitted' && a.event_type !== 'admitted') return 1
      // All remaining events are transfers — order them chronologically.
      return parseEventTimestamp(a.timestamp) - parseEventTimestamp(b.timestamp)
    })

  // Discharged stays end at the discharge date, not today. Robust to date-only
  // ('2026-06-30') or full-timestamp discharge_date values.
  const dischargeDayStr = admission.discharge_date ? String(admission.discharge_date).slice(0, 10) : null
  const liveEnd = (admission.status === 'discharged' && dischargeDayStr)
    ? new Date(dischargeDayStr + 'T00:00:00Z')
    : new Date()

  return wardEvents.map((ev, i) => {
    const ward = ev.ward || admission.ward
    let from = parseEventTimestamp(ev.timestamp)
    let to = wardEvents[i + 1]?.timestamp ? parseEventTimestamp(wardEvents[i + 1].timestamp) : liveEnd

    const isLast = i === wardEvents.length - 1
    const dayDates = expandSegmentDays(from, to, isLast)
    const days = dayDates.length
    const svc = hospitalServices.find(s => s.service_name === ward)
    const rate = Number(svc?.price_per_day ?? 0)
    const toLabel = isLast ? (admission.status === 'discharged' ? fmtShort(liveEnd) : 'present') : fmtShort(to)
    const eventLabel = ev.event_type === 'admitted' ? 'Admitted to' : 'Transferred to'
    return {
      ward,
      label: `${eventLabel} ${ward} · ${fmtShort(from)} – ${toLabel}`,
      date: new Date(from),
      days,
      dayDates,
      rate,
      total: days * rate,
      isCurrent: isLast,
      isCorrection: !isLast && days === 0,
      correctedTo: (!isLast && days === 0) ? (wardEvents[i + 1]?.ward || null) : null,
    }
  }).filter(Boolean).reverse()
}

// Billable ward rows only (corrections excluded).
export function wardBillingLines(admission) {
  return buildWardLines(admission).filter(line => !line.isCorrection)
}

// Sum of billable ward charges.
export function wardTotal(admission) {
  return wardBillingLines(admission).reduce((s, l) => s + l.total, 0)
}

// Team-wide revenue across many admissions for a date range — ward accrual (day-billed,
// via the same expandSegmentDays used per-admission) plus one-off admission_services charges,
// matching how InvoiceModal/PatientCard already define a patient's Total (ward + services).
// `admissions` must be unfiltered by date (a stay that started before `dateFrom` still owes
// ward-days that fall inside the range); admission_services requires each admission object to
// carry its `admission_services` array (see fetchAllAdmissions).
export function computeTeamRevenueForRange(admissions, dateFrom, dateTo) {
  const from = new Date(dateFrom + 'T00:00:00Z')
  const to = new Date(dateTo + 'T00:00:00Z')
  from.setUTCHours(0, 0, 0, 0)
  to.setUTCHours(0, 0, 0, 0)

  let wardRevenue = 0
  let serviceRevenue = 0

  for (const admission of admissions || []) {
    for (const line of wardBillingLines(admission)) {
      for (const day of line.dayDates) {
        if (day >= from && day <= to) wardRevenue += line.rate
      }
    }
    for (const svc of admission.admission_services || []) {
      const svcDateStr = svc.service_at || svc.added_at
      if (!svcDateStr) continue
      const svcDate = new Date(svcDateStr)
      svcDate.setUTCHours(0, 0, 0, 0)
      if (svcDate >= from && svcDate <= to) serviceRevenue += Number(svc.price || 0)
    }
  }

  return { wardRevenue, serviceRevenue, totalRevenue: wardRevenue + serviceRevenue }
}
