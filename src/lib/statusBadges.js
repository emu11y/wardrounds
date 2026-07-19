export function getStatusBadgeStyle(status) {
  switch (status) {
    case 'discharged':
      return { text: 'Discharged', className: 'bg-gray-200 text-gray-700', icon: '✓' }
    case 'archived':
      return { text: 'Archived', className: 'bg-red-100 text-red-700', icon: '🗂️' }
    case 'admitted':
      return { text: 'Active', className: 'bg-green-100 text-green-700', icon: '●' }
    default:
      return { text: status || 'Unknown', className: 'bg-gray-100 text-gray-600', icon: '?' }
  }
}

// Tailwind badge classes for an outpatient-visit status. Previously duplicated
// as STATUS_STYLE in Outpatient.jsx and OP_STATUS_STYLE in Patients.jsx.
// Colour rule: green is reserved for RSVP'd (VISIT_STATUS_STYLES.confirmed) —
// "seen" uses pink so it never reads as an RSVP, and stays visually distinct
// from scheduled (blue), pending (amber), blocked (red) and adhoc (purple)
// wherever it's shown alongside the calendar/agenda (e.g. the Outpatient
// dashboard's calendar rail).
const OUTPATIENT_STATUS_STYLE = {
  seen:      'bg-pink-100 text-pink-700',
  closed:    'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-100 text-blue-700',
  pending:   'bg-amber-100 text-amber-700',
}

export function getOutpatientStatusStyle(status) {
  return OUTPATIENT_STATUS_STYLE[status] || 'bg-gray-100 text-gray-600'
}
