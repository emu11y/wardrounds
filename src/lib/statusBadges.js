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
const OUTPATIENT_STATUS_STYLE = {
  seen:      'bg-green-100 text-green-700',
  closed:    'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-100 text-blue-700',
  pending:   'bg-amber-100 text-amber-700',
}

export function getOutpatientStatusStyle(status) {
  return OUTPATIENT_STATUS_STYLE[status] || 'bg-gray-100 text-gray-600'
}
