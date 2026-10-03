export function formatKES(amount) {
  const n = Math.round(Number(amount) || 0)
  return `KES ${n.toLocaleString()}`
}

// Calendar-based age (years since date of birth), correctly accounting for
// whether this year's birthday has happened yet. Previously reimplemented
// independently in several files; one of those copies (Outpatient.jsx) used
// a millisecond/365.25 approximation instead, which could report a different
// age for the same patient depending which page you were on.
export function calcAge(dob) {
  if (!dob) return null
  const d = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}

// e.g. "8 Jul 2026"
export function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Today's date as YYYY-MM-DD (local ISO date, no time component)
export function todayStr() {
  return new Date().toISOString().split('T')[0]
}

// Darken a hex color by subtracting `amt` from each RGB channel (clamped at 0).
// Used for glass-card accent gradients. Previously copy-pasted identically in
// Outpatient.jsx, Patients.jsx and components/PatientCard.jsx.
export function darken(hex, amt = 45) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) - amt, g = ((n >> 8) & 0xff) - amt, b = (n & 0xff) - amt
  return '#' + [Math.max(0, r), Math.max(0, g), Math.max(0, b)]
    .map(v => v.toString(16).padStart(2, '0')).join('')
}

// Today's date in Nairobi as YYYY-MM-DD (independent of the device's timezone).
export function nairobiDateStr(d = new Date()) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' })
}

// Short display name for a hospital on narrow screens:
// "The Avenue Hospital" → "Avenue", "MP Shah Hospital" → "MP Shah".
export function shortHospitalName(name = '') {
  return name.replace(/^the\s+/i, '').replace(/\s+(hospital|healthcare|medical centre|medical center)(\s+ltd)?$/i, '').trim() || name
}
