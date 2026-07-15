import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { formatKES } from '../lib/utils'
import {
  getHospitalsByTeam, createHospital, updateHospital, setHospitalStatus, createHospitalService, updateHospitalService,
  fetchTeamProfile, saveTeamProfile, fetchTeamServices, createTeamService, updateTeamService, setTeamServiceStatus, deleteTeamService,
  fetchHospitalWards, addHospitalWard, deleteHospitalWard,
  fetchTeamMembers, fetchUserPermissions, updateUserRole, updateUserPermissions, resetUserPermissions, fetchActivityLogs,
  archiveMember, restoreMember, updateUserProfile, fetchMemberActivity, inviteTeamMember,
  fetchTeamPositions, updateUserPosition, updatePositionClinical, fetchMembersWithPositions,
  fetchTeamDetails,
} from '../lib/api'
import { resolvePermissions, ROLE_LABELS, PERMISSION_LABELS, PERMISSION_KEYS } from '../lib/permissions'
import TopHeader from '../components/TopHeader'
import Backdrop from '../components/Backdrop'
import ModalShell from '../components/ModalShell'
import AddPositionInline from '../components/AddPositionInline'
import Toast from '../components/Toast'


function EyeOpen() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeClosed() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

const ROLE_BADGE_STYLES = {
  admin: 'bg-purple-100 text-purple-700',
  doctor: 'bg-blue-100 text-blue-700',
  assoc_doctor: 'bg-sky-100 text-sky-700',
  nurse: 'bg-green-100 text-green-700',
  accountant: 'bg-amber-100 text-amber-700',
  cashier: 'bg-teal-100 text-teal-700',
}

const ACTION_LABELS = {
  admit: 'Admit', discharge: 'Discharge', transfer: 'Transfer', archive: 'Archive',
  add_note: 'Add Note', add_service: 'Add Service', delete_service: 'Delete Service',
  log_visit: 'Log Visit', change_role: 'Change Role',
  update_permissions: 'Update Permissions', reset_permissions: 'Reset Permissions',
  archive_member: 'Archive Member', restore_member: 'Restore Member',
}

const ACTION_BADGE_STYLES = {
  admit: 'bg-green-100 text-green-700',
  discharge: 'bg-blue-100 text-blue-700',
  transfer: 'bg-orange-100 text-orange-700',
  archive: 'bg-red-100 text-red-700',
  add_note: 'bg-gray-100 text-gray-700',
  add_service: 'bg-purple-100 text-purple-700',
  delete_service: 'bg-red-100 text-red-700',
  log_visit: 'bg-teal-100 text-teal-700',
  change_role: 'bg-indigo-100 text-indigo-700',
  update_permissions: 'bg-indigo-100 text-indigo-700',
  reset_permissions: 'bg-gray-100 text-gray-700',
  archive_member: 'bg-amber-100 text-amber-700',
  restore_member: 'bg-green-100 text-green-700',
}

function actionLabel(action) { return ACTION_LABELS[action] || action }
function actionBadgeClass(action) { return ACTION_BADGE_STYLES[action] || 'bg-gray-100 text-gray-600' }

function fmtLogDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-GB', {
    timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) + ' EAT'
}

// Pulls the single user_permissions row out of a fetchTeamMembers() join, which may
// come back as an array (to-many) or a single object depending on the FK relationship.
function memberOverrideRow(member) {
  const raw = member?.user_permissions
  return (Array.isArray(raw) ? raw[0] : raw) || null
}

function summarizeLogDetails(log) {
  const d = log.details
  if (!d) return '—'
  if (log.action === 'transfer' && d.from_ward && d.to_ward) return `${d.from_ward} → ${d.to_ward}`
  if (log.action === 'add_service' && d.service_name) {
    return `${d.service_name}${d.amount != null ? ` (KES ${Number(d.amount).toLocaleString()})` : ''}`
  }
  if (log.action === 'change_role' && d.new_role) return `→ ${ROLE_LABELS[d.new_role] || d.new_role}`
  try {
    const s = JSON.stringify(d)
    return s.length > 60 ? s.slice(0, 57) + '…' : s
  } catch {
    return '—'
  }
}

const DEFAULT_COLOR = '#3B82F6'
const PALETTE = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F97316',
  '#EC4899', '#14B8A6', '#6366F1', '#EF4444',
  '#F59E0B', '#06B6D4', '#F43F5E', '#64748B',
]
const EMPTY_FORM = { name: '', location: '', address: '', phone: '', email: '', color: DEFAULT_COLOR, hospital_id_prefix: '' }

const CATEGORIES = ['Procedure', 'Test', 'Equipment', 'Consultation', 'Other']
const CATEGORY_COLORS = {
  Procedure:    'bg-teal-100 text-teal-700',
  Test:         'bg-blue-100 text-blue-700',
  Equipment:    'bg-orange-100 text-orange-700',
  Consultation: 'bg-purple-100 text-purple-700',
  Other:        'bg-gray-100 text-gray-600',
}
const EMPTY_SERVICE_FORM = { service_name: '', description: '', category: 'Procedure', price: '', billing_type: 'one-off' }


export default function Settings() {
  const { user, refreshUser, permissions } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'billing'

  const [teamDetails, setTeamDetails] = useState(null)
  const [hospitals, setHospitals] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingHospital, setEditingHospital] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [expandedHospitalId, setExpandedHospitalId] = useState(null)
  const [hospitalWards, setHospitalWards] = useState({})

  const EMPTY_PRACTICE = { practice_name: '', doctor_name: '', doctor_title: 'Attending Physician', address: '', phone: '', email: '', logo_url: '', reminders_enabled: true }
  const [practiceForm, setPracticeForm] = useState(EMPTY_PRACTICE)
  const [savingPractice, setSavingPractice] = useState(false)
  const [practiceSaved, setPracticeSaved] = useState(false)

  const [services, setServices] = useState([])
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [serviceForm, setServiceForm] = useState(EMPTY_SERVICE_FORM)
  const [savingService, setSavingService] = useState(false)

  const [wardModal, setWardModal] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)
  const [errorModal, setErrorModal] = useState(null) // { title, message }
  const [toast, setToast] = useState(null)

  const [removingMemberId, setRemovingMemberId] = useState(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const logoUploadRef = useRef(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarUploadRef = useRef(null)
  const memberAvatarUploadRef = useRef(null)

  const [isNewMember, setIsNewMember] = useState(false)
  const [newMemberForm, setNewMemberForm] = useState({ full_name: '', email: '', positionId: '', role: 'member', password: '', confirmPassword: '' })
  const [newMemberError, setNewMemberError] = useState('')
  const [creatingMember, setCreatingMember] = useState(false)
  const [showNewMemberPw, setShowNewMemberPw] = useState(false)
  const [showNewMemberConfirmPw, setShowNewMemberConfirmPw] = useState(false)
  const [requiresPermissionSetup, setRequiresPermissionSetup] = useState(false)
  const [newMemberTabWarning, setNewMemberTabWarning] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [pwError, setPwError] = useState('')

  const [drawerMemberId, setDrawerMemberId] = useState(null)
  const [drawerTab, setDrawerTab] = useState('profile')
  const [drawerForm, setDrawerForm] = useState({})
  const [savingDrawer, setSavingDrawer] = useState(false)
  const [memberActivity, setMemberActivity] = useState([])
  const [loadingActivity, setLoadingActivity] = useState(false)
  const [permAccordion, setPermAccordion] = useState({ role: false, pageAccess: false, actions: false })

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleChangePassword() {
    setPwError('')
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPwError('All three fields are required.')
      return
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setPwError('New password and confirmation do not match.')
      return
    }
    setSavingPw(true)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: authUser.email,
        password: currentPassword,
      })
      if (signInError) throw new Error('Current password is incorrect.')
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw new Error(error.message)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      showToast('Password updated successfully')
    } catch (err) {
      setErrorModal({ title: 'Password Change Failed', message: err.message })
    } finally {
      setSavingPw(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'security') setSearchParams({ tab: 'billing' }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // ── Admin Settings: access guard ──────────────────────────────────────────
  const [myPermissionsRow, setMyPermissionsRow] = useState(null)
  const [myPermsLoaded, setMyPermsLoaded] = useState(false)
  const myPermissions = resolvePermissions(myPermissionsRow, user?.role)
  const canAccessAdmin = myPermsLoaded && myPermissions.can_access_admin

  useEffect(() => {
    if (!user?.id) return
    fetchUserPermissions(user.id)
      .then(setMyPermissionsRow)
      .catch(() => setMyPermissionsRow(null))
      .finally(() => setMyPermsLoaded(true))
  }, [user?.id])

  // ── Admin Settings: Team Members / Permissions ────────────────────────────
  const [teamMembers, setTeamMembers] = useState([])
  const [memberView, setMemberView] = useState('active')
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [positions, setPositions] = useState([])
  const [addingPositionFor, setAddingPositionFor] = useState(null) // 'newMember' | 'drawer' | null
  const [permToggles, setPermToggles] = useState(null)
  const [savingPerms, setSavingPerms] = useState(false)

  const reloadTeamMembers = async () => {
    if (!user?.team_id) return []
    const data = await fetchMembersWithPositions(user.team_id, { includeArchived: true })
    setTeamMembers(data || [])
    return data || []
  }

  useEffect(() => {
    if ((activeTab !== 'admin' && activeTab !== 'activity') || (activeTab === 'activity' && !canAccessAdmin) || !user?.team_id) return
    setLoadingMembers(true)
    fetchTeamPositions(user.team_id).then(setPositions).catch(() => {})
    reloadTeamMembers()
      .catch(err => setErrorModal({ title: 'Load Failed', message: 'Failed to load team members: ' + err.message }))
      .finally(() => setLoadingMembers(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, canAccessAdmin, user?.team_id])

  async function handleChangeRole(member, newRole) {
    if (newRole === member.role) return
    if (member.id === user.id && member.role === 'admin' && newRole !== 'admin') {
      const otherAdmins = teamMembers.filter(m => m.id !== member.id && m.role === 'admin')
      if (otherAdmins.length === 0) {
        setErrorModal({
          title: 'Action Blocked',
          message: 'You are the only admin on this team. Promote another member to admin before changing your own role.',
        })
        return
      }
    }
    try {
      await updateUserRole(member.id, newRole, user)
      setTeamMembers(prev => prev.map(m => (m.id === member.id ? { ...m, role: newRole } : m)))
    } catch (err) {
      setErrorModal({ title: 'Update Failed', message: 'Failed to change role: ' + err.message })
    }
  }

  async function handleSavePermissions() {
    if (!drawerMember || !permToggles) return
    setSavingPerms(true)
    try {
      await updateUserPermissions(drawerMember.id, user.team_id, permToggles, user)
      await reloadTeamMembers()
      showToast('Permissions updated successfully')
    } catch (err) {
      setErrorModal({ title: 'Save Failed', message: 'Failed to save permissions: ' + err.message })
    }
    setSavingPerms(false)
  }

  function handleResetPermissions() {
    if (!drawerMember) return
    setConfirmModal({
      title: 'Reset to Role Defaults?',
      message: `This removes any custom permission overrides for ${drawerMember.full_name} and reverts to the ${ROLE_LABELS[drawerMember.role] || drawerMember.role} defaults.`,
      confirmLabel: 'Reset',
      onConfirm: async () => {
        try {
          await resetUserPermissions(drawerMember.id, user)
          await reloadTeamMembers()
          setPermToggles(resolvePermissions(null, drawerMember.role))
          showToast('Permissions reset to role defaults')
        } catch (err) {
          setErrorModal({ title: 'Reset Failed', message: 'Failed to reset permissions: ' + err.message })
        } finally {
          setConfirmModal(null)
        }
      },
    })
  }

  function handleArchiveMember(member) {
    if (member.role === 'admin') {
      const otherAdmins = teamMembers.filter(m => m.id !== member.id && m.role === 'admin' && m.status !== 'archived')
      if (otherAdmins.length === 0) {
        setErrorModal({
          title: 'Action Blocked',
          message: 'This is the only active admin on the team. Promote another member to admin before archiving this one.',
        })
        return
      }
    }
    setConfirmModal({
      title: `Archive ${member.full_name}?`,
      message: `They will immediately lose access to WardRounds, but all their patient records, visits, and history are preserved. You can restore them at any time.`,
      confirmLabel: 'Archive Member',
      onConfirm: async () => {
        setRemovingMemberId(member.id)
        try {
          await archiveMember(member.id, user)
          await reloadTeamMembers()
          showToast(`${member.full_name} archived`)
        } catch (err) {
          setErrorModal({ title: 'Archive Failed', message: 'Failed to archive team member: ' + err.message })
        } finally {
          setRemovingMemberId(null)
          setConfirmModal(null)
        }
      },
    })
  }

  function handleRestoreMember(member) {
    setConfirmModal({
      title: `Restore ${member.full_name}?`,
      message: `They will regain access to WardRounds with their previous role and permissions.`,
      confirmLabel: 'Restore Member',
      onConfirm: async () => {
        setRemovingMemberId(member.id)
        try {
          await restoreMember(member.id, user)
          await reloadTeamMembers()
          showToast(`${member.full_name} restored`)
        } catch (err) {
          setErrorModal({ title: 'Restore Failed', message: 'Failed to restore team member: ' + err.message })
        } finally {
          setRemovingMemberId(null)
          setConfirmModal(null)
        }
      },
    })
  }

  const drawerMember = teamMembers.find(m => m.id === drawerMemberId) || null

  function openDrawer(member) {
    setDrawerMemberId(member.id)
    setDrawerTab('profile')
    const resolvedPerms = resolvePermissions(memberOverrideRow(member), member.role)
    setDrawerForm({
      full_name: member.full_name || '',
      position_id: member.position_id ?? null,
      job_title: member.job_title || '',
      speciality: member.speciality || '',
      phone: member.phone || '',
      licence_number: member.licence_number || '',
      role: member.role || '',
      permissions: resolvedPerms,
    })
    setPermToggles(resolvedPerms)
    setMemberActivity([])
  }

  function closeDrawer() {
    setDrawerMemberId(null)
    setDrawerTab('profile')
    setDrawerForm({})
    setPermToggles(null)
    setMemberActivity([])
    setIsNewMember(false)
    setNewMemberForm({ full_name: '', email: '', positionId: '', role: 'member', password: '', confirmPassword: '' })
    setNewMemberError('')
    setRequiresPermissionSetup(false)
    setNewMemberTabWarning(false)
  }

  async function handleDrawerTabChange(tab) {
    if (isNewMember && tab !== 'new-member') {
      setNewMemberTabWarning(true)
      return
    }
    setNewMemberTabWarning(false)
    setDrawerTab(tab)
    if (tab === 'activity' && drawerMember && memberActivity.length === 0) {
      setLoadingActivity(true)
      try {
        const logs = await fetchMemberActivity(user.team_id, drawerMember.id)
        setMemberActivity(logs || [])
      } catch {
        setMemberActivity([])
      } finally {
        setLoadingActivity(false)
      }
    }
  }

  async function handleSaveDrawer() {
    if (!drawerMember) return
    setSavingDrawer(true)
    try {
      await Promise.all([
        updateUserProfile(drawerMember.id, drawerForm),
        updateUserPosition(drawerMemberId, drawerForm.position_id || null),
      ])
      await reloadTeamMembers()
      showToast('Profile updated')
    } catch (err) {
      setErrorModal({ title: 'Save Failed', message: 'Failed to update profile: ' + err.message })
    } finally {
      setSavingDrawer(false)
    }
  }

  async function handleCreateMember() {
    const { full_name, email, positionId, role, password, confirmPassword } = newMemberForm
    const trimmedEmail = email.trim().toLowerCase()
    if (!full_name.trim()) { setNewMemberError('Full name is required.'); return }
    if (!trimmedEmail || !trimmedEmail.includes('@')) { setNewMemberError('Please enter a valid email address.'); return }
    if (!positionId) { setNewMemberError('Position is required.'); return }
    if (password.length < 8) { setNewMemberError('Password must be at least 8 characters.'); return }
    if (password !== confirmPassword) { setNewMemberError('Passwords do not match.'); return }
    setCreatingMember(true)
    setNewMemberError('')
    try {
      await inviteTeamMember(user.team_id, trimmedEmail, role || 'member', full_name.trim(), password, positionId)
      const members = await reloadTeamMembers()
      const newMember = members.find(m => m.email === trimmedEmail)
      setIsNewMember(false)
      setNewMemberTabWarning(false)
      if (newMember) {
        openDrawer(newMember)
        setDrawerForm(prev => ({
          ...prev,
          permissions: {
            can_manage_patients: false, can_discharge: false, can_transfer: false,
            can_edit_billing: false, can_mark_paid: false, can_view_all_patients: false,
            can_manage_outpatient: false, can_view_reports: false,
            can_access_admin: false, can_manage_team: false,
            can_view_revenue: true,
          },
        }))
        setDrawerTab('permissions')
        setRequiresPermissionSetup(true)
      }
    } catch (err) {
      setNewMemberError(err.message || 'Failed to create account.')
      setCreatingMember(false)
    }
  }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setErrorModal({ title: 'File Too Large', message: 'Logo must be under 2 MB.' })
      return
    }
    setLogoUploading(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const fileName = `${user.team_id}/logo.${ext}`
      const { error: uploadError } = await supabase.storage.from('team-logos').upload(fileName, file, { upsert: true })
      if (uploadError) throw new Error(uploadError.message)
      const { data: { publicUrl } } = supabase.storage.from('team-logos').getPublicUrl(fileName)
      await supabase.from('teams').update({ logo_url: publicUrl }).eq('id', user.team_id)
      setPracticeForm(f => ({ ...f, logo_url: publicUrl }))
      showToast('Logo uploaded successfully')
    } catch (err) {
      setErrorModal({ title: 'Upload Failed', message: 'Failed to upload logo: ' + err.message })
    } finally {
      setLogoUploading(false)
      e.target.value = ''
    }
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setErrorModal({ title: 'File Too Large', message: 'Profile picture must be under 2 MB.' })
      return
    }
    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const fileName = `${user.id}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage.from('profile-pictures').upload(fileName, file, { upsert: true })
      if (uploadError) throw new Error(uploadError.message)
      const { data: { publicUrl } } = supabase.storage.from('profile-pictures').getPublicUrl(fileName)
      await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user.id)
      await refreshUser()
      showToast('Profile picture updated')
    } catch (err) {
      setErrorModal({ title: 'Upload Failed', message: 'Failed to upload profile picture: ' + err.message })
    } finally {
      setAvatarUploading(false)
      e.target.value = ''
    }
  }

  async function handleMemberAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !drawerMember) return
    if (file.size > 2 * 1024 * 1024) {
      setErrorModal({ title: 'File Too Large', message: 'Profile picture must be under 2 MB.' })
      return
    }
    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const fileName = `${drawerMember.id}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage.from('profile-pictures').upload(fileName, file, { upsert: true })
      if (uploadError) throw new Error(uploadError.message)
      const { data: { publicUrl } } = supabase.storage.from('profile-pictures').getPublicUrl(fileName)
      await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', drawerMember.id)
      await reloadTeamMembers()
      showToast('Profile picture updated')
    } catch (err) {
      setErrorModal({ title: 'Upload Failed', message: 'Failed to upload profile picture: ' + err.message })
    } finally {
      setAvatarUploading(false)
      e.target.value = ''
    }
  }

  async function handleSendPasswordReset() {
    if (!drawerMember?.email) return
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(drawerMember.email, { redirectTo: window.location.origin })
      if (error) throw new Error(error.message)
      showToast(`Password reset email sent to ${drawerMember.email}`)
    } catch (err) {
      setErrorModal({ title: 'Failed', message: err.message })
    }
  }

  // ── Admin Settings: Activity Log ───────────────────────────────────────────
  const [activityLogs, setActivityLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [logFiltersOpen, setLogFiltersOpen] = useState(false)
  const [logUserFilter, setLogUserFilter] = useState('')
  const [logActionFilter, setLogActionFilter] = useState('')
  const [logDateFrom, setLogDateFrom] = useState('')
  const [logDateTo, setLogDateTo] = useState('')
  const [exportingLogs, setExportingLogs] = useState(false)

  useEffect(() => {
    if (activeTab !== 'activity' || !canAccessAdmin || !user?.team_id) return
    setLoadingLogs(true)
    fetchActivityLogs(user.team_id, {
      userId: logUserFilter || undefined,
      action: logActionFilter || undefined,
      fromDate: logDateFrom || undefined,
      toDate: logDateTo || undefined,
    })
      .then(setActivityLogs)
      .catch(err => setErrorModal({ title: 'Load Failed', message: 'Failed to load activity log: ' + err.message }))
      .finally(() => setLoadingLogs(false))
  }, [activeTab, canAccessAdmin, user?.team_id, logUserFilter, logActionFilter, logDateFrom, logDateTo])

  function resetLogFilters() {
    setLogUserFilter('')
    setLogActionFilter('')
    setLogDateFrom('')
    setLogDateTo('')
  }

  async function handleExportLogs() {
    if (activityLogs.length === 0) return
    setExportingLogs(true)
    try {
      const rows = activityLogs.map(log => ({
        'Date/Time': fmtLogDate(log.created_at),
        'User': log.user_name || log.user_email || '—',
        'Action': actionLabel(log.action),
        'Entity Type': log.entity_type || '—',
        'Patient': log.patient_name || '—',
        'Details': log.details ? JSON.stringify(log.details) : '',
      }))
      const header = ['Date/Time', 'User', 'Action', 'Entity Type', 'Patient', 'Details']
      const ws = XLSX.utils.json_to_sheet(rows, { header })
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Activity Log')
      ws['!cols'] = header.map(key => ({
        wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length), 8),
      }))
      const today = new Date().toISOString().split('T')[0]
      XLSX.writeFile(wb, `activity-log-${today}.xlsx`)
    } catch (err) {
      setErrorModal({ title: 'Export Failed', message: 'Failed to export activity log: ' + err.message })
    } finally {
      setExportingLogs(false)
    }
  }

  const loadHospitals = async () => {
    if (!user?.team_id) return
    const data = await getHospitalsByTeam(user.team_id)
    setHospitals(data)
  }

  const loadServices = async () => {
    if (!user?.team_id) return
    try {
      const data = await fetchTeamServices(user.team_id)
      setServices(data)
    } catch { /* ignore */ }
  }

  const loadPractice = async () => {
    if (!user?.team_id) return
    try {
      const data = await fetchTeamProfile(user.team_id)
      if (data) {
        setPracticeForm({
          practice_name: data.practice_name || '',
          doctor_name:   data.doctor_name   || '',
          doctor_title:  data.doctor_title  || 'Attending Physician',
          address:       data.address       || '',
          phone:         data.phone         || '',
          email:         data.email         || '',
          logo_url:      data.logo_url      || '',
          reminders_enabled: data.reminders_enabled !== false,
        })
      }
    } catch { /* columns may not exist yet — silently ignore */ }
  }

  const handleSavePractice = async () => {
    if (!user?.team_id) return
    setSavingPractice(true)
    try {
      await saveTeamProfile(user.team_id, {
        practice_name: practiceForm.practice_name.trim(),
        doctor_name:   practiceForm.doctor_name.trim(),
        doctor_title:  practiceForm.doctor_title.trim(),
        address:       practiceForm.address.trim(),
        phone:         practiceForm.phone.trim(),
        email:         practiceForm.email.trim(),
        logo_url:      practiceForm.logo_url.trim(),
        reminders_enabled: practiceForm.reminders_enabled,
      })
      setPracticeSaved(true)
      setTimeout(() => setPracticeSaved(false), 3000)
    } catch (err) {
      setErrorModal({ title: 'Save Failed', message: 'Failed to save practice details: ' + err.message })
    }
    setSavingPractice(false)
  }

  useEffect(() => {
    loadHospitals()
    loadPractice()
    loadServices()
    if (user?.team_id) {
      fetchTeamDetails(user.team_id).then(setTeamDetails).catch(() => {})
    }
  }, [user?.team_id])

  useEffect(() => {
    if (hospitals.length === 0) return
    const loadAllWards = async () => {
      const entries = await Promise.all(
        hospitals.map(async h => {
          const wards = await fetchHospitalWards(h.id)
          return [h.id, wards]
        })
      )
      setHospitalWards(Object.fromEntries(entries))
    }
    loadAllWards()
  }, [hospitals])

  const openAddModal = () => {
    setEditingHospital(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEditModal = (hospital) => {
    setEditingHospital(hospital)
    setForm({
      name: hospital.name || '',
      location: hospital.location || '',
      address: hospital.address || '',
      phone: hospital.phone || '',
      email: hospital.email || '',
      color: hospital.color || DEFAULT_COLOR,
      hospital_id_prefix: hospital.hospital_id_prefix || '',
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingHospital(null)
    setForm(EMPTY_FORM)
  }

  const handleSaveHospital = async () => {
    if (!form.name.trim()) { setErrorModal({ title: 'Validation Error', message: 'Hospital name is required.' }); return }
    setSaving(true)
    try {
      if (editingHospital) {
        await updateHospital(editingHospital.id, {
          name: form.name.trim(),
          location: form.location.trim(),
          address: form.address.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          color: form.color,
          hospital_id_prefix: form.hospital_id_prefix.trim() || null,
        })
      } else {
        if (!user?.team_id) { setErrorModal({ title: 'Error', message: 'No team found for current user.' }); setSaving(false); return }
        await createHospital({
          name: form.name.trim(),
          location: form.location.trim(),
          address: form.address.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          color: form.color,
          hospital_id_prefix: form.hospital_id_prefix.trim() || null,
          team_id: user.team_id,
        })
      }
      closeModal()
      loadHospitals()
    } catch (err) {
      setErrorModal({ title: 'Save Failed', message: 'Failed to save hospital: ' + err.message })
    }
    setSaving(false)
  }

  const handleToggleStatus = (hospital) => {
    const isActive = hospital.status !== 'inactive'
    if (!isActive) {
      setHospitalStatus(hospital.id, 'active').then(loadHospitals).catch(err => { console.error(err); showToast('Failed to reactivate hospital.', 'error') })
      return
    }
    setConfirmModal({
      title: `Deactivate ${hospital.name}?`,
      message: 'It will be hidden from new admissions.',
      confirmLabel: 'Deactivate',
      onConfirm: async () => {
        await setHospitalStatus(hospital.id, 'inactive')
        setConfirmModal(null)
        loadHospitals()
      },
    })
  }

  const handleExpandHospital = (hospitalId) => {
    setExpandedHospitalId(prev => prev === hospitalId ? null : hospitalId)
  }

  const handleAddWard = (hospitalId) => {
    setWardModal({ hospitalId, name: '', rate: '' })
  }

  const handleWardModalSave = async () => {
    if (!wardModal.name.trim() || !wardModal.rate) return
    await addHospitalWard(wardModal.hospitalId, wardModal.name.trim(), Number(wardModal.rate))
    const wards = await fetchHospitalWards(wardModal.hospitalId)
    setHospitalWards(prev => ({ ...prev, [wardModal.hospitalId]: wards }))
    setWardModal(null)
  }

  const handleRemoveWard = (hospitalId, wardId) => {
    setConfirmModal({
      title: 'Remove Ward',
      message: 'Are you sure you want to remove this ward?',
      confirmLabel: 'Remove',
      onConfirm: async () => {
        await deleteHospitalWard(wardId)
        const wards = await fetchHospitalWards(hospitalId)
        setHospitalWards(prev => ({ ...prev, [hospitalId]: wards }))
        setConfirmModal(null)
      },
    })
  }


  const openAddServiceModal = () => {
    setEditingService(null)
    setServiceForm(EMPTY_SERVICE_FORM)
    setShowServiceModal(true)
  }

  const openEditServiceModal = (svc) => {
    setEditingService(svc)
    setServiceForm({
      service_name: svc.service_name || '',
      description:  svc.description  || '',
      category:     svc.category     || 'Procedure',
      price:        svc.price != null ? String(svc.price) : '',
      billing_type: svc.billing_type  || 'one-off',
    })
    setShowServiceModal(true)
  }

  const closeServiceModal = () => {
    setShowServiceModal(false)
    setEditingService(null)
    setServiceForm(EMPTY_SERVICE_FORM)
  }

  const handleSaveService = async () => {
    if (!serviceForm.service_name.trim()) { setErrorModal({ title: 'Validation Error', message: 'Service name is required.' }); return }
    const price = parseFloat(serviceForm.price)
    if (isNaN(price) || price < 0) { setErrorModal({ title: 'Validation Error', message: 'Please enter a valid price.' }); return }
    setSavingService(true)
    try {
      const payload = {
        service_name: serviceForm.service_name.trim(),
        description:  serviceForm.description.trim(),
        category:     serviceForm.category,
        price,
        billing_type: serviceForm.billing_type,
      }
      if (editingService) {
        await updateTeamService(editingService.id, payload)
      } else {
        await createTeamService({ ...payload, team_id: user.team_id, status: 'active' })
      }
      closeServiceModal()
      loadServices()
    } catch (err) {
      setErrorModal({ title: 'Save Failed', message: 'Failed to save service: ' + err.message })
    }
    setSavingService(false)
  }

  const handleToggleServiceStatus = async (svc) => {
    const next = svc.status === 'active' ? 'hidden' : 'active'
    try {
      await setTeamServiceStatus(svc.id, next)
      loadServices()
    } catch (err) {
      setErrorModal({ title: 'Update Failed', message: 'Failed to update status: ' + err.message })
    }
  }

  const handleDeleteService = (svc) => {
    setConfirmModal({
      title: `Delete "${svc.service_name}"?`,
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await deleteTeamService(svc.id)
          loadServices()
        } catch (err) {
          console.error('Failed to delete service:', err)
        }
        setConfirmModal(null)
      },
    })
  }

  const tabCls = (active, padding = 'px-3 py-1.5') => active
    ? `text-white text-xs font-semibold ${padding} rounded-full border border-transparent transition-all whitespace-nowrap`
    : `text-slate-500 text-xs font-medium ${padding} rounded-full border border-slate-200 bg-white/60 backdrop-blur-sm transition-all whitespace-nowrap`
  const tabStyle = (active) => active ? { background: '#007AFF' } : undefined

  return (
    <div className="flex flex-col min-h-full">
      <TopHeader title="Settings" />
      <div className="p-4 space-y-4">

      {/* Tab navigation */}
      <div className="flex gap-2 flex-wrap mb-4">
        {[['billing', 'Billing Settings']].map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setSearchParams({ tab })}
            className={tabCls(activeTab === tab)}
            style={tabStyle(activeTab === tab)}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setSearchParams({ tab: 'admin' })}
          className={tabCls(activeTab === 'admin')}
          style={tabStyle(activeTab === 'admin')}
        >
          Admin Settings
        </button>
        {permissions?.view_admin === true && (
          <button
            onClick={() => setSearchParams({ tab: 'activity' })}
            className={tabCls(activeTab === 'activity')}
            style={tabStyle(activeTab === 'activity')}
          >
            Activity Log
          </button>
        )}
      </div>

      {activeTab === 'billing' && (
        <>
      {/* ── Practice Details ─────────────────────────────────────────────────── */}
      <div id="settings-practice-form" className="bg-white p-4 md:p-6 rounded-xl shadow">
        <h2 className="text-xl font-bold mb-1">Practice Details</h2>
        <p className="text-sm text-gray-500 mb-5">Used on invoices — doctor name, clinic info, and optional logo.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Practice / Clinic Name</label>
            <input
              type="text"
              value={practiceForm.practice_name}
              onChange={e => setPracticeForm(f => ({ ...f, practice_name: e.target.value }))}
              placeholder="e.g. City Medical Centre"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Doctor Name</label>
            <input
              type="text"
              value={practiceForm.doctor_name}
              onChange={e => setPracticeForm(f => ({ ...f, doctor_name: e.target.value }))}
              placeholder="e.g. Dr. Jane Muthoni"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Doctor Title</label>
            <input
              type="text"
              value={practiceForm.doctor_title}
              onChange={e => setPracticeForm(f => ({ ...f, doctor_title: e.target.value }))}
              placeholder="e.g. Attending Physician"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <input
              type="text"
              value={practiceForm.address}
              onChange={e => setPracticeForm(f => ({ ...f, address: e.target.value }))}
              placeholder="e.g. 2nd Floor, ABC Towers, Nairobi"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input
              type="text"
              value={practiceForm.phone}
              onChange={e => setPracticeForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="e.g. +254 700 000 000"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={practiceForm.email}
              onChange={e => setPracticeForm(f => ({ ...f, email: e.target.value }))}
              placeholder="e.g. info@citymedical.co.ke"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">Practice Logo</label>
            {practiceForm.logo_url ? (
              <div className="flex items-center gap-4">
                <img
                  src={practiceForm.logo_url}
                  alt="Practice logo"
                  className="w-24 h-24 object-contain rounded-2xl border border-gray-200 shadow-sm"
                  onError={e => { e.currentTarget.style.display = 'none' }}
                />
                <button
                  type="button"
                  onClick={() => logoUploadRef.current?.click()}
                  disabled={logoUploading}
                  className="text-sm text-ios-blue font-medium hover:underline disabled:opacity-50"
                >
                  {logoUploading ? 'Uploading…' : 'Change logo'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => logoUploadRef.current?.click()}
                disabled={logoUploading}
                className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-300 py-7 transition-colors disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6 text-gray-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span className="text-sm text-gray-500 font-medium">{logoUploading ? 'Uploading…' : 'Upload logo'}</span>
                <span className="text-xs text-gray-400">JPEG, PNG or WebP · max 2 MB</span>
              </button>
            )}
            <input
              ref={logoUploadRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>
        </div>

        {/* Automatic appointment reminders — team-level gate for the send-reminders
            cron. Off = no scheduled 1-week / 1-day / day-of emails go out. Manual
            "Send Reminder" on Appointments is unaffected. */}
        <div className="mt-6 pt-5 border-t border-gray-100">
          <div className="flex items-center justify-between gap-4">
            <div>
              <label htmlFor="reminders-enabled" className="block text-sm font-medium text-slate-700">
                Automatic appointment reminders
              </label>
              <p className="text-xs text-gray-500 mt-0.5">
                Email patients a branded reminder 1 week before, the day before, and the morning of their appointment.
              </p>
            </div>
            <button
              id="reminders-enabled"
              type="button"
              role="switch"
              aria-checked={practiceForm.reminders_enabled}
              onClick={() => setPracticeForm(f => ({ ...f, reminders_enabled: !f.reminders_enabled }))}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40 ${
                practiceForm.reminders_enabled ? 'bg-ios-blue' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  practiceForm.reminders_enabled ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSavePractice}
            disabled={savingPractice}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {savingPractice ? 'Saving...' : 'Save Practice Details'}
          </button>
          {practiceSaved && <span className="text-green-600 text-sm font-medium">Saved!</span>}
        </div>
      </div>

          <div id="settings-wards-section" className="bg-white p-4 md:p-6 rounded-xl shadow mt-6">
        <div className="mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">Daily Visit Rates (KES)</h2>
              <p className="text-sm text-gray-500 mt-0.5">Click a hospital to manage its wards and rates.</p>
            </div>
            <button id="settings-add-hospital-btn" onClick={openAddModal} className="hidden sm:block px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold shadow-sm hover:bg-blue-700 transition text-sm flex-shrink-0">
              + Add Hospital
            </button>
          </div>
          <button onClick={openAddModal} className="sm:hidden w-full mt-3 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors">
            + Add Hospital
          </button>
        </div>
        {hospitals.length === 0 ? (
          <p className="text-gray-500">No hospitals yet. Click "Add Hospital" to get started.</p>
        ) : (
          <div className="space-y-2">
            {hospitals.map(hospital => {
              const isExpanded = expandedHospitalId === hospital.id
              const isInactive = hospital.status === 'inactive'
              return (
                <div key={hospital.id} className={`border border-gray-200 rounded-2xl bg-white/70 overflow-hidden w-full ${isInactive ? 'opacity-60' : ''}`}>
                  {/* Hospital header */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      onClick={() => handleExpandHospital(hospital.id)}
                      className="flex-1 min-w-0 flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: hospital.color || DEFAULT_COLOR }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                            {hospital.name}
                            {isInactive && <span className="px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded">Inactive</span>}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {hospital.location}
                            {hospital.hospital_id_prefix && ` · Tag: ${hospital.hospital_id_prefix}`}
                          </p>
                        </div>
                      </div>
                      <span className={`text-gray-400 text-xs ml-3 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                    </button>
                    <div className="flex gap-2 flex-shrink-0 self-start sm:self-auto px-4 pb-3 sm:px-0 sm:pb-0 sm:pr-3">
                      <button
                        onClick={() => openEditModal(hospital)}
                        className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(hospital)}
                        className={`px-2.5 py-1 text-xs border rounded-lg transition ${
                          isInactive
                            ? 'border-green-300 text-green-600 hover:bg-green-50'
                            : 'border-orange-200 text-orange-500 hover:bg-orange-50'
                        }`}
                      >
                        {isInactive ? 'Activate' : 'Deactivate'}
                      </button>
                    </div>
                  </div>

                  {/* Expandable ward list */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      {(hospitalWards[hospital.id] || []).length === 0 ? (
                        <p className="text-xs text-gray-400 py-3">No wards yet. Add one below.</p>
                      ) : (
                        <>
                          {/* Column headers */}
                          <div className="flex items-center gap-2 px-3 pb-1 mt-3 mb-1">
                            <p className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Ward</p>
                            <p className="w-20 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex-shrink-0">KES / day</p>
                            <div className="w-6 flex-shrink-0" />
                          </div>
                          {(hospitalWards[hospital.id] || []).map(ward => (
                            <div key={ward.id} className="flex items-start gap-2 px-3 py-2 rounded-xl bg-white/60 border border-gray-100 mb-1">
                              <span className="flex-1 text-sm text-gray-800 break-words min-w-0">{ward.service_name}</span>
                              <span className="w-20 text-right text-sm font-medium text-gray-700 flex-shrink-0">
                                {Number(ward.price_per_day).toLocaleString()}
                              </span>
                              <button
                                onClick={() => handleRemoveWard(hospital.id, ward.id)}
                                className="w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-600 flex-shrink-0 transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </>
                      )}
                      <button
                        onClick={() => handleAddWard(hospital.id)}
                        className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 transition-colors"
                      >
                        + Add Ward
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Additional Services & Charges ───────────────────────────────────── */}
      <div id="settings-services-section" className="bg-white p-4 md:p-6 rounded-xl shadow mt-6">
        <div className="mb-1">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold">Additional Services &amp; Charges</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Create services that can be added to any patient's bill — procedures, tests, equipment, or one-off charges. These appear as line items on the invoice.
              </p>
            </div>
            <button
              onClick={openAddServiceModal}
              className="hidden sm:block flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-blue-700 transition ml-4"
            >
              + New Service
            </button>
          </div>
          <button
            onClick={openAddServiceModal}
            className="sm:hidden w-full mt-3 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors"
          >
            + New Service
          </button>
        </div>

        {services.length === 0 ? (
          <p className="text-gray-400 text-sm mt-4">No services yet. Click "+ New Service" to create your first.</p>
        ) : (
          <>
            {/* ── Mobile: card layout ─────────────────────────────────────── */}
            <div className="block md:hidden mt-4 space-y-3">
              {services.map((svc) => (
                <div key={svc.id} className="border border-gray-200 rounded-2xl bg-white/70 p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold text-slate-800">{svc.service_name}</p>
                      {svc.description && <p className="text-xs text-gray-500 mt-0.5">{svc.description}</p>}
                    </div>
                    <span className={`flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[svc.category] || CATEGORY_COLORS.Other}`}>
                      {svc.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
                    <span className="font-medium text-slate-700">{formatKES(svc.price)}</span>
                    <span className="text-gray-400">·</span>
                    <span className="capitalize">{svc.billing_type}</span>
                    <span className="text-gray-400">·</span>
                    {svc.status === 'active'
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                      : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Hidden</span>
                    }
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEditServiceModal(svc)} className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition">Edit</button>
                    <button
                      onClick={() => handleToggleServiceStatus(svc)}
                      className={`flex-1 px-3 py-1.5 text-sm border rounded-lg transition ${svc.status === 'active' ? 'border-orange-200 text-orange-500 hover:bg-orange-50' : 'border-green-300 text-green-600 hover:bg-green-50'}`}
                    >
                      {svc.status === 'active' ? 'Hide' : 'Unhide'}
                    </button>
                    <button
                      onClick={() => handleDeleteService(svc)}
                      className="px-3 py-1.5 text-sm border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition"
                      title="Delete service"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop: table layout ───────────────────────────────────── */}
            <div className="hidden md:block mt-4 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2">
                    <th className="text-left px-4 py-2 text-sm font-semibold text-gray-600">Service</th>
                    <th className="text-left px-4 py-2 text-sm font-semibold text-gray-600">Category</th>
                    <th className="text-right px-4 py-2 text-sm font-semibold text-gray-600">Price (KES)</th>
                    <th className="text-left px-4 py-2 text-sm font-semibold text-gray-600">Billing</th>
                    <th className="text-left px-4 py-2 text-sm font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((svc) => (
                    <tr key={svc.id} className="border-b hover:bg-gray-50/50 transition">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{svc.service_name}</p>
                        {svc.description && <p className="text-xs text-gray-500 mt-0.5">{svc.description}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[svc.category] || CATEGORY_COLORS.Other}`}>
                          {svc.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">
                        {Number(svc.price).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                        {svc.billing_type}
                      </td>
                      <td className="px-4 py-3">
                        {svc.status === 'active'
                          ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                          : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Hidden</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => openEditServiceModal(svc)}
                          className="px-3 py-1 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition mr-2"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleServiceStatus(svc)}
                          className={`px-3 py-1 text-sm border rounded-lg transition mr-2 ${svc.status === 'active' ? 'border-orange-200 text-orange-500 hover:bg-orange-50' : 'border-green-300 text-green-600 hover:bg-green-50'}`}
                        >
                          {svc.status === 'active' ? 'Hide' : 'Unhide'}
                        </button>
                        <button
                          onClick={() => handleDeleteService(svc)}
                          className="inline-flex items-center justify-center px-2 py-1 border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition"
                          title="Delete service"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
        </>
      )}

      {activeTab === 'admin' && (
        !myPermsLoaded ? (
          <div className="border border-gray-200 rounded-2xl bg-white/70 p-10 text-center text-sm text-ios-gray-1">Loading…</div>
        ) : (
          <div className="space-y-4">
            {teamDetails?.created_at && (
              <p className="text-xs text-gray-400 mb-4">
                Practice established {new Date(teamDetails.created_at).toLocaleDateString('en-KE', { month: 'long', year: 'numeric', timeZone: 'Africa/Nairobi' })}
              </p>
            )}
            {permissions?.view_admin === true && permissions?.can_manage_team === true && (
              <div className="flex justify-end">
                <button
                  id="settings-invite-btn"
                  onClick={() => {
                    setIsNewMember(true)
                    setNewMemberForm({ full_name: '', email: '', positionId: '', role: 'member', password: '', confirmPassword: '' })
                    setNewMemberError('')
                    setDrawerMemberId('new')
                    setDrawerTab('new-member')
                    setDrawerForm({})
                  }}
                  style={{ backgroundColor: '#007AFF' }}
                  className="px-4 py-2 rounded-2xl text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-sm"
                >
                  + Add Team Member
                </button>
              </div>
            )}

            {loadingMembers ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3].map(i => <div key={i} className="border border-gray-200 rounded-2xl bg-white/70 h-28 animate-pulse" />)}
              </div>
            ) : teamMembers.length === 0 ? (
              <div className="rounded-2xl p-10 text-center bg-white/90 backdrop-blur-xl border border-white/60 shadow-2xl">
                <p className="text-sm text-gray-500">No team members found.</p>
              </div>
            ) : (
              <>
                {(() => {
                  const activeMembers = teamMembers.filter(m => m.status !== 'archived')
                  const archivedMembers = teamMembers.filter(m => m.status === 'archived')

                  const renderCard = (member) => {
                    const isArchived = member.status === 'archived'
                    return (
                      <div
                        key={member.id}
                        className={`p-4 rounded-2xl flex flex-col gap-3 transition-all cursor-pointer ${isArchived ? 'bg-white/60 backdrop-blur-xl border border-white/40 shadow-sm opacity-60' : 'bg-white/90 backdrop-blur-xl border border-white/60 shadow-sm hover:shadow-md hover:border-blue-200/60 hover:bg-white/95'}`}
                      >
                        <div className="flex items-start gap-3">
                          {member.avatar_url
                            ? <img src={member.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-white shadow-sm flex-shrink-0" />
                            : <div className="w-14 h-14 rounded-full flex items-center justify-center text-base font-semibold ring-2 ring-white shadow-sm flex-shrink-0" style={{ backgroundColor: '#007AFF20', color: '#007AFF' }}>{member.full_name?.[0]?.toUpperCase() || '?'}</div>
                          }
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-semibold text-gray-900 truncate">{member.full_name || '—'}</p>
                              {member.id === user?.id && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-ios-blue/10 text-ios-blue">You</span>
                              )}
                              {isArchived && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">Archived</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate">{member.email}</p>
                            <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${member.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                              {member.role === 'admin' ? 'Administrator' : 'Member'}
                            </span>
                            {member.position_name && (
                              <span className="inline-block mt-1 ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                                {member.position_name}
                              </span>
                            )}
                            {member.created_at && (
                              <p className="text-[10px] text-gray-400 mt-1">
                                Member since {new Date(member.created_at).toLocaleDateString('en-KE', { month: 'long', year: 'numeric', timeZone: 'Africa/Nairobi' })}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1 border-t border-gray-50">
                          {isArchived ? (
                            <>
                              {permissions?.view_admin === true && (
                                <button
                                  onClick={() => handleRestoreMember(member)}
                                  disabled={removingMemberId === member.id}
                                  className="flex-1 py-1.5 rounded-xl text-xs font-semibold text-green-700 bg-green-100 hover:bg-green-200 transition-colors disabled:opacity-50"
                                >
                                  Restore
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => openDrawer(member)}
                                className="flex-1 py-1.5 rounded-xl text-xs font-semibold text-ios-blue bg-ios-blue/10 hover:bg-ios-blue/20 transition-colors"
                              >
                                {member.id === user?.id ? 'Manage' : 'View Profile'}
                              </button>
                              {permissions?.view_admin === true && member.id !== user?.id && (
                                <button
                                  onClick={() => handleArchiveMember(member)}
                                  disabled={removingMemberId === member.id}
                                  className="p-1.5 rounded-xl text-amber-500 hover:text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-50"
                                  title="Archive member"
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />
                                  </svg>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )
                  }

                  const shownMembers = memberView === 'archived' ? archivedMembers : activeMembers

                  return (
                    <>
                      <div className="inline-flex items-center gap-1 p-1 rounded-full bg-gray-100/80 backdrop-blur mb-4">
                        <button
                          type="button"
                          onClick={() => setMemberView('active')}
                          style={memberView === 'active' ? { backgroundColor: '#007AFF' } : undefined}
                          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${memberView === 'active' ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          Active ({activeMembers.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setMemberView('archived')}
                          style={memberView === 'archived' ? { backgroundColor: '#007AFF' } : undefined}
                          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${memberView === 'archived' ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          Archived ({archivedMembers.length})
                        </button>
                      </div>

                      {shownMembers.length === 0 ? (
                        <div className="rounded-2xl p-10 text-center bg-white/90 backdrop-blur-xl border border-white/60 shadow-sm">
                          <p className="text-sm text-gray-500">
                            {memberView === 'archived' ? 'No archived members.' : 'No active members.'}
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {shownMembers.map(renderCard)}
                        </div>
                      )}
                    </>
                  )
                })()}
              </>
            )}
          </div>
        )
      )}

      {activeTab === 'activity' && permissions?.view_admin === true && (
        !canAccessAdmin ? (
          <div className="rounded-2xl p-10 text-center bg-white/90 backdrop-blur-xl border border-white/60 shadow-2xl">
            <h3 className="font-semibold text-gray-800 mb-1">Access Restricted</h3>
            <p className="text-sm text-gray-500">You don't have permission to view the Activity Log.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <button
                onClick={() => setLogFiltersOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl bg-black/[0.05] hover:bg-black/[0.08] transition-colors"
              >
                <span className="text-xs font-semibold text-gray-700">
                  Filters {logFiltersOpen ? '▾' : '▸'}
                </span>
                {(logUserFilter || logActionFilter || logDateFrom || logDateTo) && (
                  <span className="text-[10px] text-ios-blue font-semibold">Active</span>
                )}
              </button>

              {logFiltersOpen && (
                <div className="mt-2 rounded-2xl p-4 space-y-4 bg-white/90 backdrop-blur-xl border border-white/60 shadow-2xl">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1 mb-2">User</p>
                    <select value={logUserFilter} onChange={e => setLogUserFilter(e.target.value)} className="ios-input w-full text-sm">
                      <option value="">All Users</option>
                      {teamMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1 mb-2">Action</p>
                    <select value={logActionFilter} onChange={e => setLogActionFilter(e.target.value)} className="ios-input w-full text-sm">
                      <option value="">All Actions</option>
                      {Object.entries(ACTION_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1 mb-2">Date Range</p>
                    <div className="flex items-center gap-2">
                      <input type="date" value={logDateFrom} onChange={e => setLogDateFrom(e.target.value)} className="ios-input flex-1 text-xs py-1.5" />
                      <span className="text-xs text-ios-gray-1">to</span>
                      <input type="date" value={logDateTo} onChange={e => setLogDateTo(e.target.value)} className="ios-input flex-1 text-xs py-1.5" />
                    </div>
                  </div>
                  <button
                    onClick={resetLogFilters}
                    className="w-full py-2 rounded-xl text-xs font-semibold text-ios-gray-1 bg-black/[0.04] hover:bg-black/[0.08] transition-colors"
                  >
                    Reset Filters
                  </button>
                </div>
              )}
            </div>

            {!loadingLogs && activityLogs.length > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-ios-gray-1">{activityLogs.length} log{activityLogs.length !== 1 ? 's' : ''}</p>
                <button
                  onClick={handleExportLogs}
                  disabled={exportingLogs}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-ios-green hover:opacity-90 transition-opacity shadow-sm disabled:opacity-40"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  {exportingLogs ? 'Exporting…' : 'Export to Excel'}
                </button>
              </div>
            )}

            {loadingLogs ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="border border-gray-200 rounded-2xl bg-white/70 h-12 animate-pulse" />)}
              </div>
            ) : activityLogs.length === 0 ? (
              <div className="rounded-2xl p-10 text-center bg-white/90 backdrop-blur-xl border border-white/60 shadow-2xl">
                <p className="text-sm text-gray-500">
                  {logUserFilter || logActionFilter || logDateFrom || logDateTo
                    ? 'No logs match these filters.'
                    : 'No activity recorded yet.'}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-x-auto bg-white/90 backdrop-blur-xl border border-white/60 shadow-2xl">
                <table className="w-full border-collapse min-w-[640px]">
                  <thead>
                    <tr className="border-b border-white/40">
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Date/Time</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">User</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Action</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Patient</th>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityLogs.map(log => (
                      <tr key={log.id} className="border-b border-white/30 hover:bg-black/[0.02] transition-colors">
                        <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{fmtLogDate(log.created_at)}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-800">{log.user_name || log.user_email || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${actionBadgeClass(log.action)}`}>
                            {actionLabel(log.action)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-700">{log.patient_name || '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{summarizeLogDetails(log)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      )}

      <ModalShell open={showServiceModal} onClose={closeServiceModal} maxWidth="max-w-md">
        <div className="glass-rim rounded-3xl p-2.5">
          <div className="surface-shell p-6">
          <div className="pb-4 border-b border-gray-100 mb-4">
            <h2 className="text-xl font-bold text-slate-800">{editingService ? 'Edit Service' : 'New Service'}</h2>
            <p className="text-sm text-slate-500 mt-0.5">This service will appear as a line item on invoices.</p>
          </div>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Service Name *</label>
              <input
                type="text"
                value={serviceForm.service_name}
                onChange={e => setServiceForm(f => ({ ...f, service_name: e.target.value }))}
                placeholder="e.g. CT Scan Abdomen"
                className="w-full rounded-lg border border-white/60 bg-white/60 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                rows={2}
                value={serviceForm.description}
                onChange={e => setServiceForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional short description"
                className="w-full rounded-lg border border-white/60 bg-white/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                value={serviceForm.category}
                onChange={e => setServiceForm(f => ({ ...f, category: e.target.value }))}
                className="w-full rounded-lg border border-white/60 bg-white/60 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Price (KES) *</label>
              <input
                type="number"
                min="0"
                step="any"
                value={serviceForm.price}
                onChange={e => setServiceForm(f => ({ ...f, price: e.target.value }))}
                placeholder="e.g. 5000"
                className="w-full rounded-lg border border-white/60 bg-white/60 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Billing Type</label>
              <div className="flex gap-3">
                {[['one-off', 'One-off'], ['daily', 'Daily']].map(([val, label]) => (
                  <label key={val} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="billing_type"
                      value={val}
                      checked={serviceForm.billing_type === val}
                      onChange={() => setServiceForm(f => ({ ...f, billing_type: val }))}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="pt-4 flex gap-3 justify-end border-t border-gray-100 mt-4">
            <button onClick={closeServiceModal} className="px-4 py-2 rounded-lg border border-slate-300 bg-white/50 text-slate-700 hover:bg-white/80 transition">Cancel</button>
            <button onClick={handleSaveService} disabled={savingService} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-700 disabled:opacity-50 transition">
              {savingService ? 'Saving...' : (editingService ? 'Save Changes' : 'Create Service')}
            </button>
          </div>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={showModal} onClose={closeModal} maxWidth="max-w-md">
        <div className="glass-rim rounded-3xl p-2.5">
          <div className="surface-shell p-6">
          <div className="pb-4 border-b border-gray-100 mb-4">
            <h2 className="text-xl font-bold text-slate-800">{editingHospital ? 'Edit Hospital' : 'Add Hospital'}</h2>
            <p className="text-sm text-slate-500 mt-0.5">Details here will appear on invoices</p>
          </div>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hospital Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Aga Khan Hospital" className="w-full rounded-lg border border-white/60 bg-white/60 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Nairobi" className="w-full rounded-lg border border-white/60 bg-white/60 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="e.g. 3rd Parklands Ave, P.O. Box 30270" className="w-full rounded-lg border border-white/60 bg-white/60 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. +254 20 366 2000" className="w-full rounded-lg border border-white/60 bg-white/60 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e.g. billing@hospital.com" className="w-full rounded-lg border border-white/60 bg-white/60 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hospital ID Prefix</label>
              <input
                type="text"
                value={form.hospital_id_prefix}
                onChange={(e) => setForm({ ...form, hospital_id_prefix: e.target.value })}
                placeholder="e.g. AK, UHID, IP No., 3PH"
                className="w-full rounded-lg border border-white/60 bg-white/60 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
              />
              <p className="text-xs text-slate-400 mt-1">Used to auto-identify hospital from patient tags (e.g., AK0113939366 matches prefix "AK")</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Colour</label>
              <div className="flex flex-wrap gap-2">
                {PALETTE.map(hex => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setForm({ ...form, color: hex })}
                    className={`w-7 h-7 rounded-lg transition-transform hover:scale-110 ${form.color === hex ? 'ring-2 ring-offset-2 ring-slate-600 scale-110' : ''}`}
                    style={{ backgroundColor: hex }}
                    title={hex}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="pt-4 flex gap-3 justify-end border-t border-gray-100 mt-4">
            <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-slate-300 bg-white/50 text-slate-700 hover:bg-white/80 transition">Cancel</button>
            <button onClick={handleSaveHospital} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-700 disabled:opacity-50 transition">
              {saving ? 'Saving...' : (editingHospital ? 'Save Changes' : 'Save Hospital')}
            </button>
          </div>
          </div>
        </div>
      </ModalShell>

      {/* ── Member Drawer ───────────────────────────────────────────────────── */}
      {drawerMemberId && (isNewMember || drawerMember) && (() => {
        const drawerContent = (
          <>
            {/* Header */}
            <div className="sticky top-0 z-10 bg-transparent border-b border-gray-100 px-6 py-4 flex items-center gap-4 flex-shrink-0">
              {isNewMember ? (
                <div className="bg-blue-100 text-blue-600 rounded-full p-2 flex-shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                  </svg>
                </div>
              ) : drawerMember?.avatar_url ? (
                <img src={drawerMember.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover ring-2 ring-white shadow-md flex-shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold ring-2 ring-white shadow-md flex-shrink-0" style={{ backgroundColor: '#007AFF20', color: '#007AFF' }}>{drawerMember?.full_name?.[0]?.toUpperCase() || '?'}</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{isNewMember ? 'New Team Member' : (drawerMember?.full_name || '—')}</p>
                {!isNewMember && <p className="text-xs text-gray-500 truncate">{drawerMember?.email}</p>}
              </div>
              <button onClick={closeDrawer} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Drawer tabs — underline style */}
            <div className="sticky top-[68px] z-10 bg-transparent border-b border-gray-100 px-6 flex flex-shrink-0 overflow-x-auto">
              {isNewMember && (
                <button
                  onClick={() => handleDrawerTabChange('new-member')}
                  className={drawerTab === 'new-member'
                    ? 'py-3 text-sm font-medium text-[#007AFF] border-b-2 border-[#007AFF] mr-5 whitespace-nowrap'
                    : 'py-3 text-sm font-medium text-gray-500 hover:text-gray-700 mr-5 border-b-2 border-transparent whitespace-nowrap'}
                >
                  New Member
                </button>
              )}
              {[['profile', 'Profile'], ['permissions', 'Permissions'], ['activity', 'Activity']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => handleDrawerTabChange(key)}
                  className={drawerTab === key
                    ? 'py-3 text-sm font-medium text-[#007AFF] border-b-2 border-[#007AFF] mr-5 whitespace-nowrap'
                    : 'py-3 text-sm font-medium text-gray-500 hover:text-gray-700 mr-5 border-b-2 border-transparent whitespace-nowrap'}
                >
                  {label}
                </button>
              ))}
              {(drawerMemberId === user?.id || user?.role === 'admin') && !isNewMember && (
                <button
                  onClick={() => handleDrawerTabChange('security')}
                  className={drawerTab === 'security'
                    ? 'py-3 text-sm font-medium text-[#007AFF] border-b-2 border-[#007AFF] mr-5 whitespace-nowrap'
                    : 'py-3 text-sm font-medium text-gray-500 hover:text-gray-700 mr-5 border-b-2 border-transparent whitespace-nowrap'}
                >
                  Security
                </button>
              )}
            </div>

            {newMemberTabWarning && (
              <div className="mx-4 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2">
                <p className="text-xs text-amber-700">Complete registration first — fill in the details and click "Create Account".</p>
                <button onClick={() => setNewMemberTabWarning(false)} className="text-amber-400 hover:text-amber-600 flex-shrink-0 text-xs">✕</button>
              </div>
            )}

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto p-4">

              {/* New Member tab */}
              {drawerTab === 'new-member' && (
                <form id="new-member-form" onSubmit={e => { e.preventDefault(); handleCreateMember() }} className="space-y-4">
                  {[
                    { key: 'full_name', label: 'Full Name', type: 'text', placeholder: 'Dr. Jane Muthoni' },
                    { key: 'email',     label: 'Email',     type: 'email', placeholder: 'jane@clinic.com' },
                  ].map(({ key, label, type, placeholder }) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
                      <input
                        type={type}
                        value={newMemberForm[key]}
                        onChange={e => setNewMemberForm(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Position</label>
                    <select
                      value={newMemberForm.positionId}
                      onChange={e => { const v = e.target.value; if (v === '__other') { setAddingPositionFor('newMember') } else { setAddingPositionFor(null); setNewMemberForm(prev => ({ ...prev, positionId: v })) } }}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      <option value="">— Select position —</option>
                      {positions.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                      {permissions?.can_manage_team === true && <option value="__other">Other… (add new)</option>}
                    </select>
                    {addingPositionFor === 'newMember' && (
                      <AddPositionInline
                        teamId={user.team_id}
                        existingNames={positions.map(p => p.name)}
                        onCancel={() => { setAddingPositionFor(null); setNewMemberForm(prev => ({ ...prev, positionId: '' })) }}
                        onCreated={pos => {
                          setPositions(prev => [...prev, pos])
                          setNewMemberForm(prev => ({ ...prev, positionId: pos.id }))
                          setAddingPositionFor(null)
                        }}
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Access Level</label>
                    <div className="flex gap-2">
                      {[['member', 'Member'], ['admin', 'Admin']].map(([val, label]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setNewMemberForm(prev => ({ ...prev, role: val }))}
                          className={tabCls(newMemberForm.role === val)}
                          style={tabStyle(newMemberForm.role === val)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showNewMemberPw ? 'text' : 'password'}
                        value={newMemberForm.password}
                        onChange={e => setNewMemberForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Min. 8 characters"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <button type="button" onClick={() => setShowNewMemberPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                        {showNewMemberPw ? <EyeClosed /> : <EyeOpen />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showNewMemberConfirmPw ? 'text' : 'password'}
                        value={newMemberForm.confirmPassword}
                        onChange={e => setNewMemberForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="Repeat password"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <button type="button" onClick={() => setShowNewMemberConfirmPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                        {showNewMemberConfirmPw ? <EyeClosed /> : <EyeOpen />}
                      </button>
                    </div>
                  </div>
                  {newMemberError && <p className="text-xs text-red-500">{newMemberError}</p>}
                </form>
              )}

              {/* Profile tab */}
              {drawerTab === 'profile' && (
                <div>
                  {/* Full Name */}
                  <div className="mb-5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Full Name</label>
                    {user?.id === drawerMemberId ? (
                      <input
                        type="text"
                        value={drawerForm.full_name || ''}
                        onChange={e => setDrawerForm(f => ({ ...f, full_name: e.target.value }))}
                        className="w-full bg-white/60 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] mt-1"
                      />
                    ) : (
                      <div className="field-box mt-1">{drawerForm.full_name || '—'}</div>
                    )}
                  </div>

                  {/* Position */}
                  <div className="mb-5">
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Position</label>
                    <select
                      value={drawerForm.position_id || ''}
                      onChange={e => { const v = e.target.value; if (v === '__other') { setAddingPositionFor('drawer') } else { setAddingPositionFor(null); setDrawerForm(f => ({ ...f, position_id: v || null })) } }}
                      disabled={user?.role !== 'admin' && drawerMemberId !== user?.id}
                      className={`w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none${user?.role !== 'admin' && drawerMemberId !== user?.id ? ' opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <option value="">— No position —</option>
                      {positions.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                      {permissions?.can_manage_team === true && <option value="__other">Other… (add new)</option>}
                    </select>
                    {addingPositionFor === 'drawer' && (
                      <AddPositionInline
                        teamId={user.team_id}
                        existingNames={positions.map(p => p.name)}
                        onCancel={() => { setAddingPositionFor(null); setDrawerForm(f => ({ ...f, position_id: null })) }}
                        onCreated={pos => {
                          setPositions(prev => [...prev, pos])
                          setDrawerForm(f => ({ ...f, position_id: pos.id }))
                          setAddingPositionFor(null)
                        }}
                      />
                    )}
                    {/* Clinical toggle for the selected position — admin only. Doctors are
                        clinical by default; admins can opt a nurse/physio/etc. in here.
                        Affects everyone holding this position. */}
                    {drawerForm.position_id && permissions?.can_manage_team === true && addingPositionFor !== 'drawer' && (() => {
                      const pos = positions.find(p => p.id === drawerForm.position_id)
                      if (!pos) return null
                      return (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-[11px] text-gray-400">In doctor pickers &amp; bookings:</span>
                          {[[true, 'Clinical'], [false, 'Non-clinical']].map(([val, label]) => (
                            <button
                              key={label}
                              type="button"
                              onClick={async () => {
                                try {
                                  const updated = await updatePositionClinical(pos.id, val)
                                  setPositions(prev => prev.map(p => p.id === pos.id ? { ...p, is_clinical: updated.is_clinical } : p))
                                  showToast(`"${pos.name}" is now ${val ? 'clinical' : 'non-clinical'}`)
                                } catch (e) { showToast('Could not update position') }
                              }}
                              style={pos.is_clinical === val ? { backgroundColor: '#007AFF' } : undefined}
                              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${pos.is_clinical === val ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:text-gray-700'}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )
                    })()}
                  </div>

                  {/* Remaining fields */}
                  {[
                    { key: 'speciality', label: 'Speciality' },
                    { key: 'phone', label: 'Phone' },
                    { key: 'licence_number', label: 'Licence Number' },
                  ].map(({ key, label }) => (
                    <div key={key} className="mb-5">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
                      {user?.id === drawerMemberId ? (
                        <input
                          type="text"
                          value={drawerForm[key] || ''}
                          onChange={e => setDrawerForm(f => ({ ...f, [key]: e.target.value }))}
                          className="w-full bg-white/60 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] mt-1"
                        />
                      ) : (
                        <div className="field-box mt-1">{drawerForm[key] || '—'}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Permissions tab */}
              {drawerTab === 'permissions' && permToggles && (() => {
                const isAdminViewing = user?.role === 'admin'
                const adminCount = teamMembers.filter(m => m.role === 'admin' && m.status !== 'archived').length
                const isLastAdmin = adminCount === 1 && drawerMemberId === teamMembers.find(m => m.role === 'admin' && m.status !== 'archived')?.id
                return (
                  <div>
                    {requiresPermissionSetup && (
                      <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-xl px-3 py-2 mb-3">
                        Member created! Now set up their permissions below. You must save before they take effect.
                      </div>
                    )}
                    {!isAdminViewing && (
                      <p className="text-xs text-gray-400 mb-3">Permissions are managed by your administrator.</p>
                    )}

                    {/* Role accordion */}
                    <div className="border-b border-gray-100">
                      <button
                        className="flex items-center justify-between py-3 cursor-pointer select-none w-full"
                        onClick={() => setPermAccordion(prev => ({ ...prev, role: !prev.role }))}
                      >
                        <span className="text-sm font-semibold text-gray-700">Role</span>
                        {permAccordion.role ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </button>
                      {permAccordion.role && (
                        <div className="pb-3 px-1">
                          {isAdminViewing ? (
                            <>
                              <select
                                value={drawerForm.role || drawerMember.role}
                                onChange={e => {
                                  const val = e.target.value
                                  if (isLastAdmin && val !== 'admin') {
                                    setErrorModal({
                                      title: 'Cannot demote last admin',
                                      message: 'There must always be at least one Administrator on the team. Promote another member to Admin first, then you can change this role.',
                                    })
                                    return
                                  }
                                  setDrawerForm(prev => ({ ...prev, role: val }))
                                }}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                              >
                                <option value="admin">Administrator</option>
                                <option value="member">Member</option>
                              </select>
                              {drawerMemberId === user?.id && drawerForm.role !== 'admin' && adminCount > 1 && (
                                <p className="text-xs text-amber-600 mt-1">You are changing your own role. You will lose administrator access after saving.</p>
                              )}
                            </>
                          ) : (
                            <span className={`inline-block px-2 py-1 rounded-xl text-sm font-semibold ${ROLE_BADGE_STYLES[drawerMember.role] || 'bg-gray-100 text-gray-600'}`}>
                              {ROLE_LABELS[drawerMember.role] || drawerMember.role}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Page Access accordion */}
                    <div className="border-b border-gray-100">
                      <button
                        className="flex items-center justify-between py-3 cursor-pointer select-none w-full"
                        onClick={() => setPermAccordion(prev => ({ ...prev, pageAccess: !prev.pageAccess }))}
                      >
                        <span className="text-sm font-semibold text-gray-700">Page Access</span>
                        {permAccordion.pageAccess ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </button>
                      {permAccordion.pageAccess && (
                        <div className={`bg-white/40 rounded-2xl p-3 mb-3${isAdminViewing ? '' : ' opacity-50'}`}>
                          {[
                            { key: 'can_manage_patients',   label: 'Inpatient',        description: 'Ward rounds & admissions' },
                            { key: 'can_manage_outpatient', label: 'Outpatient',       description: 'Dashboard & appointments' },
                            { key: 'can_view_all_patients', label: 'Patients',         description: 'Patient list & records' },
                            { key: 'can_view_reports',      label: 'Analytics',        description: 'Reports & analytics' },
                            { key: 'can_access_admin',      label: 'Settings & Admin', description: 'Team settings and admin panel' },
                          ].map(({ key, label, description }) => (
                            <div key={key} className="flex items-center justify-between py-2.5 border-b border-white/40 last:border-0">
                              <span className="text-sm text-gray-800">
                                {label}
                                <span className="block text-xs text-gray-400">{description}</span>
                              </span>
                              <input
                                type="checkbox"
                                checked={isAdminViewing ? !!(drawerForm.permissions?.[key]) : !!permToggles[key]}
                                onChange={isAdminViewing
                                  ? e => setDrawerForm(prev => ({ ...prev, permissions: { ...prev.permissions, [key]: e.target.checked } }))
                                  : () => {}}
                                disabled={!isAdminViewing}
                                className="w-4 h-4 accent-ios-blue flex-shrink-0"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions accordion */}
                    <div className="border-b border-gray-100">
                      <button
                        className="flex items-center justify-between py-3 cursor-pointer select-none w-full"
                        onClick={() => setPermAccordion(prev => ({ ...prev, actions: !prev.actions }))}
                      >
                        <span className="text-sm font-semibold text-gray-700">Actions</span>
                        {permAccordion.actions ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </button>
                      {permAccordion.actions && (
                        <div className={`bg-white/40 rounded-2xl p-3 mb-3${isAdminViewing ? '' : ' opacity-50'}`}>
                          {[
                            { key: 'can_discharge',   label: 'Discharge Patients' },
                            { key: 'can_transfer',    label: 'Transfer Patients' },
                            { key: 'can_edit_billing', label: 'Edit Billing' },
                            { key: 'can_mark_paid',   label: 'Mark as Paid' },
                            { key: 'can_manage_team', label: 'Manage Team' },
                            { key: 'can_view_revenue', label: 'View Revenue Details' },
                          ].map(({ key, label }) => (
                            <div key={key} className="flex items-center justify-between py-2.5 border-b border-white/40 last:border-0">
                              <span className="text-sm text-gray-800">{label}</span>
                              <input
                                type="checkbox"
                                checked={isAdminViewing ? !!(drawerForm.permissions?.[key]) : !!permToggles[key]}
                                onChange={isAdminViewing
                                  ? e => setDrawerForm(prev => ({ ...prev, permissions: { ...prev.permissions, [key]: e.target.checked } }))
                                  : () => {}}
                                disabled={!isAdminViewing}
                                className="w-4 h-4 accent-ios-blue flex-shrink-0"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {isAdminViewing && (
                      <>
                      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-4">
                        <button
                          onClick={() => setConfirmModal({
                            title: 'Reset to Role Defaults?',
                            message: `This removes any custom permission overrides for ${drawerMember.full_name} and reverts to the ${ROLE_LABELS[drawerMember.role] || drawerMember.role} defaults.`,
                            confirmLabel: 'Reset',
                            onConfirm: async () => {
                              try {
                                await resetUserPermissions(drawerMember.id, user)
                                const members = await reloadTeamMembers()
                                const refreshed = members.find(m => m.id === drawerMember.id)
                                const role = refreshed?.role || drawerMember.role
                                const resetPerms = resolvePermissions(null, role)
                                setDrawerForm(prev => ({ ...prev, permissions: resetPerms, role }))
                                setPermToggles(resetPerms)
                                showToast('Permissions reset to role defaults')
                              } catch (err) {
                                setErrorModal({ title: 'Reset Failed', message: 'Failed to reset permissions: ' + err.message })
                              } finally {
                                setConfirmModal(null)
                              }
                            },
                          })}
                          className="px-4 py-2 rounded-full text-sm font-semibold text-gray-700 bg-white/70 backdrop-blur border border-white/60 hover:bg-white/90 transition-colors whitespace-nowrap"
                        >
                          Reset to Role Defaults
                        </button>
                        <button
                          onClick={async () => {
                            if (isLastAdmin && drawerForm.role !== 'admin') {
                              setErrorModal({
                                title: 'Cannot demote last admin',
                                message: 'There must always be at least one Administrator on the team. Promote another member to Admin first, then you can change this role.',
                              })
                              return
                            }
                            setSavingPerms(true)
                            try {
                              if (drawerForm.role && drawerForm.role !== drawerMember.role) {
                                await updateUserRole(drawerMember.id, drawerForm.role, user)
                              }
                              await updateUserPermissions(drawerMember.id, user.team_id, drawerForm.permissions, user)
                              await reloadTeamMembers()
                              setRequiresPermissionSetup(false)
                              showToast('Permissions saved')
                            } catch (err) {
                              setErrorModal({ title: 'Save Failed', message: 'Failed to save permissions: ' + err.message })
                            } finally {
                              setSavingPerms(false)
                            }
                          }}
                          disabled={savingPerms || (requiresPermissionSetup && Object.values(drawerForm.permissions || {}).every(v => !v))}
                          className="px-4 py-2 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 whitespace-nowrap"
                          style={{ background: '#007AFF' }}
                        >
                          {savingPerms ? 'Saving…' : 'Save Permissions'}
                        </button>
                      </div>
                      {requiresPermissionSetup && Object.values(drawerForm.permissions || {}).every(v => !v) && (
                        <p className="text-xs text-gray-400 text-center mt-1">Select at least one permission to save</p>
                      )}
                      </>
                    )}
                  </div>
                )
              })()}

              {/* Activity tab */}
              {drawerTab === 'activity' && (
                loadingActivity ? (
                  <div>
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => <div key={i} className="rounded-xl h-10 bg-gray-100 animate-pulse" />)}
                    </div>
                  </div>
                ) : memberActivity.length === 0 ? (
                  <div>
                    <p className="text-sm text-gray-500 text-center py-8">No activity recorded for this member.</p>
                  </div>
                ) : (
                  <div>
                    {memberActivity.map(log => (
                      <div key={log.id} className="flex items-start gap-3 py-3 border-b border-white/30 last:border-0">
                        <span className={`mt-0.5 inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${actionBadgeClass(log.action)}`}>
                          {actionLabel(log.action)}
                        </span>
                        <div className="flex-1 min-w-0">
                          {log.patient_name && <p className="text-xs text-gray-700 truncate">{log.patient_name}</p>}
                          <p className="text-[10px] text-gray-400">{fmtLogDate(log.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Security tab */}
              {drawerTab === 'security' && (drawerMemberId === user?.id || user?.role === 'admin') && (
                <div className="space-y-4">
                  {drawerMemberId === user?.id ? (
                    <>
                      {/* Own card — profile picture + change password */}
                      <div className="section-frame">
                        <h2 className="text-xl font-bold mb-1">Profile Picture</h2>
                        <p className="text-sm text-gray-500 mb-5">Shown in the sidebar and your profile.</p>
                        <div className="flex flex-col items-center gap-4">
                          {user?.avatar_url ? (
                            <img src={user.avatar_url} alt="Profile" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg" />
                          ) : (
                            <div className="w-24 h-24 rounded-full bg-ios-blue/10 flex items-center justify-center border-4 border-white shadow-lg">
                              <span className="text-3xl font-bold text-ios-blue">{user?.full_name?.[0]?.toUpperCase() || '?'}</span>
                            </div>
                          )}
                          <div className="flex flex-col items-center gap-1.5">
                            <button type="button" onClick={() => avatarUploadRef.current?.click()} disabled={avatarUploading}
                              className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all" style={{ background: '#007AFF' }}>
                              {avatarUploading ? 'Uploading…' : 'Upload Photo'}
                            </button>
                            <span className="text-xs text-gray-400">JPEG, PNG or WebP · max 2 MB</span>
                          </div>
                        </div>
                        <input ref={avatarUploadRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarUpload} />
                      </div>

                      <div className="section-frame">
                        <h2 className="text-xl font-bold mb-1">Change Password</h2>
                        <p className="text-sm text-gray-500 mb-5">Update your WardRounds account password.</p>
                        <form onSubmit={e => { e.preventDefault(); handleChangePassword() }} className="space-y-4">
                          <input type="text" name="username" autoComplete="username" value={user?.email || ''} readOnly hidden />
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                            <div className="relative">
                              <input type={showCurrentPw ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                                placeholder="••••••••" autoComplete="current-password"
                                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] transition-colors" />
                              <button type="button" onClick={() => setShowCurrentPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                                {showCurrentPw ? <EyeClosed /> : <EyeOpen />}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                            <div className="relative">
                              <input type={showNewPw ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                                placeholder="Min. 8 characters" autoComplete="new-password"
                                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] transition-colors" />
                              <button type="button" onClick={() => setShowNewPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                                {showNewPw ? <EyeClosed /> : <EyeOpen />}
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                            <div className="relative">
                              <input type={showConfirmPw ? 'text' : 'password'} value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)}
                                placeholder="Repeat new password" autoComplete="new-password"
                                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] transition-colors" />
                              <button type="button" onClick={() => setShowConfirmPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                                {showConfirmPw ? <EyeClosed /> : <EyeOpen />}
                              </button>
                            </div>
                          </div>
                          {pwError && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-red-500 text-sm">{pwError}</div>}
                          <button type="submit" disabled={savingPw}
                            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50" style={{ background: '#007AFF' }}>
                            {savingPw ? 'Updating…' : 'Update Password'}
                          </button>
                        </form>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Admin viewing another member — profile picture + send reset email */}
                      <div className="section-frame">
                        <h2 className="text-xl font-bold mb-1">Profile Picture</h2>
                        <p className="text-sm text-gray-500 mb-5">Update the profile picture for this member.</p>
                        <div className="flex flex-col items-center gap-4">
                          {drawerMember.avatar_url ? (
                            <img src={drawerMember.avatar_url} alt="Profile" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg" />
                          ) : (
                            <div className="w-24 h-24 rounded-full bg-ios-blue/10 flex items-center justify-center border-4 border-white shadow-lg">
                              <span className="text-3xl font-bold text-ios-blue">{drawerMember.full_name?.[0]?.toUpperCase() || '?'}</span>
                            </div>
                          )}
                          <div className="flex flex-col items-center gap-1.5">
                            <button type="button" onClick={() => memberAvatarUploadRef.current?.click()} disabled={avatarUploading}
                              className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all" style={{ background: '#007AFF' }}>
                              {avatarUploading ? 'Uploading…' : 'Upload Photo'}
                            </button>
                            <span className="text-xs text-gray-400">JPEG, PNG or WebP · max 2 MB</span>
                          </div>
                        </div>
                        <input ref={memberAvatarUploadRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleMemberAvatarUpload} />
                      </div>

                      <div className="section-frame">
                        <h2 className="text-xl font-bold mb-1">Reset Password</h2>
                        <p className="text-sm text-gray-500 mb-5">Sends a reset link to {drawerMember.email}</p>
                        <button onClick={handleSendPasswordReset}
                          className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all" style={{ background: '#007AFF' }}>
                          Send Password Reset Email
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Drawer footer */}
            <div className="sticky bottom-0 bg-transparent border-t border-gray-100 px-6 py-4 flex gap-3 flex-shrink-0">
              {drawerTab === 'new-member' && (
                <button
                  type="submit"
                  form="new-member-form"
                  disabled={creatingMember}
                  className="px-4 py-2 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 whitespace-nowrap"
                  style={{ background: '#007AFF' }}
                >
                  {creatingMember ? 'Creating…' : 'Create Account'}
                </button>
              )}
              {drawerTab === 'profile' && user?.id === drawerMemberId && (
                <button
                  onClick={handleSaveDrawer}
                  disabled={savingDrawer}
                  className="px-4 py-2 rounded-full text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 whitespace-nowrap"
                  style={{ background: '#007AFF' }}
                >
                  {savingDrawer ? 'Saving…' : 'Save'}
                </button>
              )}
              {permissions?.view_admin === true && permissions?.can_manage_team === true && drawerMember && drawerMember.id !== user?.id && (
                drawerMember.status === 'archived' ? (
                  <button
                    onClick={() => { closeDrawer(); handleRestoreMember(drawerMember) }}
                    disabled={removingMemberId === drawerMember.id}
                    className="px-4 py-2 rounded-full text-sm font-semibold text-green-600 border border-green-400 bg-green-50/50 hover:bg-green-50 transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    Restore Member
                  </button>
                ) : (
                  <button
                    onClick={() => { closeDrawer(); handleArchiveMember(drawerMember) }}
                    disabled={removingMemberId === drawerMember.id}
                    className="px-4 py-2 rounded-full text-sm font-semibold text-amber-600 border border-amber-400 bg-amber-50/50 hover:bg-amber-50 transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    Archive Member
                  </button>
                )
              )}
            </div>
          </>
        )
        return (
          <>
            <Backdrop onClick={closeDrawer} className={`transition-opacity duration-300 ${drawerMemberId ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} />
            <div className={`glass-rim fixed z-[60] rounded-3xl p-2.5 flex flex-col transition-all duration-300 ease-in-out ${drawerMemberId ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'} inset-x-4 bottom-4 top-16 sm:top-[72px] sm:bottom-6 sm:right-6 sm:left-auto sm:w-[420px]`}>
              <div className="surface-shell flex-1 min-h-0">
                {drawerContent}
              </div>
            </div>
          </>
        )
      })()}

      {/* ── Ward Add Modal ───────────────────────────────────────────────────── */}
      <ModalShell open={!!wardModal} onClose={() => setWardModal(null)} maxWidth="max-w-sm">
        {wardModal && (
          <div className="glass-rim rounded-3xl p-2.5">
            <div className="surface-shell p-6">
            <h3 className="text-base font-bold text-gray-900 mb-4">Add Ward</h3>
            <div className="space-y-3 mb-6">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Ward Name</label>
                <input
                  autoFocus
                  value={wardModal.name}
                  onChange={e => setWardModal(p => ({ ...p, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && document.getElementById('ward-rate-input').focus()}
                  placeholder="e.g. General Ward, ICU, Maternity"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Rate (KES per day)</label>
                <input
                  id="ward-rate-input"
                  type="number"
                  value={wardModal.rate}
                  onChange={e => setWardModal(p => ({ ...p, rate: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleWardModalSave()}
                  placeholder="e.g. 6000"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setWardModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleWardModalSave}
                disabled={!wardModal.name.trim() || !wardModal.rate}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Add Ward
              </button>
            </div>
            </div>
          </div>
        )}
      </ModalShell>

      {/* ── Error Modal ─────────────────────────────────────────────────────── */}
      <ModalShell open={!!errorModal} onClose={() => setErrorModal(null)} maxWidth="max-w-sm">
        {errorModal && (
          <div className="glass-rim rounded-3xl p-2.5">
            <div className="surface-shell p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">{errorModal.title}</h3>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">{errorModal.message}</p>
            <button
              onClick={() => setErrorModal(null)}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">
              OK
            </button>
            </div>
          </div>
        )}
      </ModalShell>

      {/* ── Confirm Modal ────────────────────────────────────────────────────── */}
      <ModalShell open={!!confirmModal} onClose={() => setConfirmModal(null)} maxWidth="max-w-sm">
        {confirmModal && (
          <div className="glass-rim rounded-3xl p-2.5">
            <div className="surface-shell p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">{confirmModal.title}</h3>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors">
                {confirmModal.confirmLabel || 'Confirm'}
              </button>
            </div>
            </div>
          </div>
        )}
      </ModalShell>


      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      <Toast toast={toast} />

      </div>
    </div>
  )
}
