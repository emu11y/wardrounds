// Page-visibility keys — control which nav sections a user can see.
export const PAGE_ACCESS_KEYS = [
  'view_inpatient',
  'view_outpatient',
  'view_patients',
  'view_analytics',
  'view_admin',
  'view_admit',
  'view_appointments',
]

// Action permission keys mirror the boolean columns on user_permissions.
export const PERMISSION_KEYS = [
  'can_manage_patients',
  'can_discharge',
  'can_transfer',
  'can_edit_billing',
  'can_mark_paid',
  'can_view_all_patients',
  'can_manage_outpatient',
  'can_view_reports',
  'can_access_admin',
  'can_manage_team',
  'can_view_revenue',
]

const ALL_KEYS = [...PAGE_ACCESS_KEYS, ...PERMISSION_KEYS]

// Builds a full permission object with `trueKeys` set true and every other key false.
function onlyTrue(trueKeys) {
  return Object.fromEntries(ALL_KEYS.map(k => [k, trueKeys.includes(k)]))
}

const ALL_TRUE = onlyTrue(ALL_KEYS)
const ALL_FALSE = onlyTrue([])

const VIEW_ALL = ['view_inpatient', 'view_outpatient', 'view_patients', 'view_analytics', 'view_admit', 'view_appointments']

// Defaults applied when a user has no row in user_permissions.
export const ROLE_DEFAULTS = {
  admin: ALL_TRUE,
  doctor: onlyTrue(['can_manage_patients', 'can_discharge', 'can_transfer', 'can_manage_outpatient', 'can_view_reports', ...VIEW_ALL]),
  assoc_doctor: onlyTrue(['can_manage_patients', 'can_discharge', 'can_transfer', 'can_manage_outpatient', ...VIEW_ALL]),
  nurse: onlyTrue(['can_view_all_patients', ...VIEW_ALL]),
  accountant: onlyTrue(['can_edit_billing', 'can_mark_paid', 'can_view_reports', 'can_view_all_patients', ...VIEW_ALL]),
  cashier: onlyTrue(['can_mark_paid', 'can_view_all_patients', ...VIEW_ALL]),
  // users.role is constrained to admin|member (Session 28); member inherits
  // fail-closed actions (real members carry explicit user_permissions rows)
  // but sees revenue by default — admins restrict per person via override.
  member: onlyTrue(['can_view_revenue', ...VIEW_ALL]),
}

export const ROLE_LABELS = {
  admin: 'Administrator',
  member: 'Member',
  doctor: 'Doctor',
  assoc_doctor: 'Associate Doctor',
  nurse: 'Nurse',
  accountant: 'Accountant',
  cashier: 'Cashier',
}

export const PERMISSION_LABELS = {
  can_manage_patients: 'Manage Patients',
  can_discharge: 'Discharge Patients',
  can_transfer: 'Transfer Patients',
  can_edit_billing: 'Edit Billing',
  can_mark_paid: 'Mark Paid',
  can_view_all_patients: 'View All Patients',
  can_manage_outpatient: 'Manage Outpatient',
  can_view_reports: 'View Reports',
  can_access_admin: 'Access Admin',
  can_manage_team: 'Manage Team',
  can_view_revenue: 'View Revenue Details',
}

// Effective permissions for a user: each key on the override row wins when explicitly
// true/false; null/undefined/missing keys inherit the role's defaults. Unknown roles
// get everything denied. Always returns a fully-populated object of strict booleans —
// never null — so callers never need to null-check individual keys.
export function resolvePermissions(row, role) {
  const base = ROLE_DEFAULTS[role] || ALL_FALSE
  const resolved = Object.fromEntries(ALL_KEYS.map(k => {
    if (row?.[k] === true) return [k, true]
    if (row?.[k] === false) return [k, false]
    return [k, base[k] === true]
  }))
  // Admins always see revenue — no override can dim an admin.
  if (role === 'admin') resolved.can_view_revenue = true
  // Page access DERIVES from the action keys the Settings drawer persists,
  // so enforcement matches exactly what the Page Access toggles promise.
  // Analytics additionally requires revenue access — the page is revenue by nature.
  resolved.view_inpatient = resolved.can_manage_patients
  resolved.view_admit = resolved.can_manage_patients
  resolved.view_outpatient = resolved.can_manage_outpatient
  resolved.view_appointments = resolved.can_manage_outpatient
  resolved.view_patients = resolved.can_view_all_patients
  resolved.view_analytics = resolved.can_view_reports === true && resolved.can_view_revenue === true
  resolved.view_admin = resolved.can_access_admin
  return resolved
}

export function hasPermission(user, permissionsRow, key) {
  if (!user || !ALL_KEYS.includes(key)) return false
  return resolvePermissions(permissionsRow, user.role)[key] === true
}
