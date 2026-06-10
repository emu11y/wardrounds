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
