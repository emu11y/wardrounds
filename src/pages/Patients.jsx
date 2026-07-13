import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, ChevronDown, ChevronUp, UserPlus, Clock, MapPin, RotateCcw, Receipt, FileText, Stethoscope, Building2 } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { fetchPatients, fetchAdmissionsForPatient, createAdmission, fetchAdmissionServices, fetchOutpatientVisitsForPatient, fetchVisitNotes, fetchHospitals, createOutpatientVisit, updatePatient } from '../lib/api'
import { wardBillingLines, wardTotal, wardColor } from '../lib/billing'
import { getStatusBadgeStyle, getOutpatientStatusStyle } from '../lib/statusBadges'
import { calcAge, formatDate, darken, formatKES } from '../lib/utils'
import TopHeader from '../components/TopHeader'
import ModalShell from '../components/ModalShell'
import DoctorPicker from '../components/DoctorPicker'
import RevenueValue from '../components/RevenueValue'
import Toast from '../components/Toast'
import InvoiceModal from './modals/InvoiceModal'
import * as XLSX from 'xlsx'

const APP_BLUE = '#007AFF'
const HEADER_GREY = '#8E8E93'

function HospitalPickerModal({ open, mode, patient, hospitals, teamId, onClose, onConfirm, loading }) {
  const [hospitalId, setHospitalId] = useState('')
  const [doctorId, setDoctorId] = useState('')
  useEffect(() => { if (open) { setHospitalId(''); setDoctorId('') } }, [open])
  if (!open) return null
  const selected = hospitals.find(h => h.id === hospitalId)
  return (
    <ModalShell onClose={onClose} maxWidth="max-w-sm">
      <div className="glass-rim rounded-3xl p-2.5">
        <div className="surface-shell p-6 space-y-4">
          <h2 className="font-bold text-base">{mode === 'checkin' ? 'Check In' : 'Admit Patient'}</h2>
          <p className="text-sm text-gray-600">{patient?.first_name} {patient?.last_name}</p>
          <div className="space-y-2">
            {hospitals.map(h => (
              <button
                key={h.id}
                onClick={() => setHospitalId(h.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${
                  hospitalId === h.id ? 'border-ios-blue bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: h.color || '#3B82F6' }} />
                <span className="font-medium text-sm">{h.name}</span>
                {h.location && <span className="text-xs text-gray-400 ml-auto">{h.location}</span>}
              </button>
            ))}
          </div>
          {mode === 'checkin' && (
            <DoctorPicker teamId={teamId} value={doctorId} onChange={setDoctorId} />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => selected && onConfirm(selected, doctorId)}
              disabled={!selected || (mode === 'checkin' && !doctorId) || loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-ios-blue text-white disabled:opacity-50 transition-opacity"
            >
              {loading ? '…' : mode === 'checkin' ? 'Check In' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

function EditPatientModal({ open, patient, onClose, onSaved }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [dob, setDob]             = useState('')
  const [phone, setPhone]         = useState('')
  const [email, setEmail]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)

  useEffect(() => {
    if (open && patient) {
      setFirstName(patient.first_name || '')
      setLastName(patient.last_name || '')
      setDob(patient.date_of_birth || '')
      setPhone(patient.phone || '')
      setEmail(patient.email || '')
      setError(null)
    }
  }, [open, patient])

  if (!open) return null

  async function handleSave() {
    if (!firstName.trim() && !lastName.trim()) {
      setError('Enter at least a first or last name.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await updatePatient(patient.id, {
        first_name:    firstName.trim() || null,
        last_name:     lastName.trim()  || null,
        date_of_birth: dob              || null,
        phone:         phone.trim()     || null,
        email:         email.trim()     || null,
      })
      onSaved?.()
    } catch (e) {
      console.error('Failed to update patient', e)
      setError(e.message || 'Failed to save changes — please try again.')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white/80 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30'

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-sm">
      <div className="glass-rim rounded-3xl p-2.5">
        <div className="surface-shell p-6 space-y-3">
          <h2 className="font-bold text-base text-gray-900">Edit Patient Details</h2>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">First name</label>
              <input className={inputClass} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Last name</label>
              <input className={inputClass} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date of birth</label>
            <input type="date" className={inputClass} value={dob} onChange={e => setDob(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Mobile number <span className="text-gray-400 font-normal">(for SMS reminders)</span>
            </label>
            <input type="tel" className={inputClass} value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 0712 345 678" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Email <span className="text-gray-400 font-normal">(for email reminders)</span>
            </label>
            <input type="email" className={inputClass} value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. patient@email.com" />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-ios-blue text-white disabled:opacity-50 transition-opacity"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

export default function Patients() {
  const { user, permissions } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const highlightPatientId = searchParams.get('highlight')
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [flashId, setFlashId] = useState(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [admissionsMap, setAdmissionsMap] = useState({})
  const [loadingAdmissions, setLoadingAdmissions] = useState({})
  const [expandedAdmissionId, setExpandedAdmissionId] = useState(null)
  const [servicesMap, setServicesMap] = useState({})
  const [loadingBilling, setLoadingBilling] = useState({})
  const [invoiceAdmission, setInvoiceAdmission] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)
  const [errorModal, setErrorModal] = useState(null)
  const [timeFilter, setTimeFilter] = useState(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [outpatientVisitsMap, setOutpatientVisitsMap] = useState({})
  const [loadingOutpatient, setLoadingOutpatient] = useState({})
  const [admSectionOpen, setAdmSectionOpen] = useState({})
  const [opSectionOpen, setOpSectionOpen] = useState({})
  const [expandedOpVisitId, setExpandedOpVisitId] = useState(null)
  const [visitNotesMap, setVisitNotesMap] = useState({})
  const [loadingVisitNotes, setLoadingVisitNotes] = useState({})
  const [recordTypeFilter, setRecordTypeFilter] = useState('all')
  const [hospitals, setHospitals] = useState([])
  const [hospitalPickerOpen, setHospitalPickerOpen] = useState(false)
  const [pickerMode, setPickerMode] = useState('checkin')
  const [pickerPatient, setPickerPatient] = useState(null)
  const [pickerLoading, setPickerLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [isScrollingPatients, setIsScrollingPatients] = useState(false)
  const scrollTimerRef = useRef(null)
  const [editPatient, setEditPatient] = useState(null)
  const [toast, setToast] = useState(null)
  const [outpatientErrorMap, setOutpatientErrorMap] = useState({})
  const [visitNotesErrorMap, setVisitNotesErrorMap] = useState({})

  function showToast(message, type = 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    if (!user?.team_id) return
    try {
      const data = await fetchPatients(user.team_id)
      setPatients(data || [])
    } catch (e) {
      console.error(e)
      showToast('Failed to load patients — pull to refresh or try again.')
    } finally {
      setLoading(false)
    }
  }, [user?.team_id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!user?.team_id) return
    fetchHospitals(user.team_id)
      .then(setHospitals)
      .catch(err => { console.error(err); showToast('Failed to load hospitals.') })
  }, [user?.team_id])

  function loadVisitNotes(visitId) {
    setLoadingVisitNotes(prev => ({ ...prev, [visitId]: true }))
    setVisitNotesErrorMap(prev => ({ ...prev, [visitId]: false }))
    fetchVisitNotes(visitId)
      .then(notes => setVisitNotesMap(prev => ({ ...prev, [visitId]: notes })))
      .catch(err => { console.error(err); setVisitNotesErrorMap(prev => ({ ...prev, [visitId]: true })) })
      .finally(() => setLoadingVisitNotes(prev => ({ ...prev, [visitId]: false })))
  }

  useEffect(() => {
    const container = document.getElementById('main-scroll')
    if (!container) return
    const handleScroll = () => {
      setIsScrollingPatients(true)
      clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = setTimeout(() => {
        setIsScrollingPatients(false)
      }, 1200)
    }
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!highlightPatientId || loading) return
    toggleExpand(highlightPatientId)
    setFlashId(highlightPatientId)
    const scrollTimer = setTimeout(() => {
      const el = document.getElementById(`patient-${highlightPatientId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 400)
    const flashTimer = setTimeout(() => setFlashId(null), 2400)
    return () => { clearTimeout(scrollTimer); clearTimeout(flashTimer) }
  }, [highlightPatientId, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleExpand(patientId) {
    if (expandedId === patientId) {
      setExpandedId(null)
      return
    }
    setExpandedId(patientId)
    setAdmSectionOpen(prev => ({ ...prev, [patientId]: true }))
    setOpSectionOpen(prev => ({ ...prev, [patientId]: false }))

    const needsAdmissions = !admissionsMap[patientId]
    const needsOutpatient = !outpatientVisitsMap[patientId]

    if (needsAdmissions) {
      setLoadingAdmissions(prev => ({ ...prev, [patientId]: true }))
    }
    if (needsOutpatient) {
      setLoadingOutpatient(prev => ({ ...prev, [patientId]: true }))
    }

    try {
      const [admData, opData] = await Promise.all([
        needsAdmissions ? fetchAdmissionsForPatient(patientId) : Promise.resolve(null),
        needsOutpatient ? fetchOutpatientVisitsForPatient(patientId) : Promise.resolve(null),
      ])
      if (admData !== null) setAdmissionsMap(prev => ({ ...prev, [patientId]: admData }))
      if (opData !== null) setOutpatientVisitsMap(prev => ({ ...prev, [patientId]: opData }))
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingAdmissions(prev => ({ ...prev, [patientId]: false }))
      setLoadingOutpatient(prev => ({ ...prev, [patientId]: false }))
    }
  }

  async function toggleAdmissionExpand(admissionId) {
    if (expandedAdmissionId === admissionId) {
      setExpandedAdmissionId(null)
      return
    }
    setExpandedAdmissionId(admissionId)
    if (!servicesMap[admissionId]) {
      setLoadingBilling(prev => ({ ...prev, [admissionId]: true }))
      try {
        const services = await fetchAdmissionServices(admissionId)
        setServicesMap(prev => ({ ...prev, [admissionId]: services || [] }))
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingBilling(prev => ({ ...prev, [admissionId]: false }))
      }
    }
  }

  function handleReadmit(patient) {
    setConfirmModal({
      title: `Re-admit ${patient.first_name} ${patient.last_name}?`,
      message: 'This will create a new active admission for this patient.',
      confirmLabel: 'Re-admit',
      onConfirm: async () => {
        setConfirmModal(null)
        try {
          await createAdmission({
            patient_id: patient.id,
            team_id: user.team_id,
            hospital_id: patient.hospital_id || null,
            admission_date: new Date().toISOString(),
            status: 'admitted',
          })
          navigate('/')
        } catch (e) {
          setErrorModal({ title: 'Re-admit Failed', message: e.message })
        }
      },
    })
  }

  async function handlePickerConfirm(hospital, doctorId) {
    if (pickerMode === 'checkin') {
      setPickerLoading(true)
      try {
        await createOutpatientVisit({
          patient_id: pickerPatient.id,
          hospital_id: hospital.id,
          team_id: user.team_id,
          visit_date: new Date().toISOString().split('T')[0],
          visit_time: new Date().toISOString(),
          status: 'seen',
          created_by_user_id: user.id,
          doctor_id: doctorId,
        })
        setHospitalPickerOpen(false)
        navigate('/outpatient')
      } catch (e) {
        console.error(e)
      } finally {
        setPickerLoading(false)
      }
    } else {
      setHospitalPickerOpen(false)
      navigate('/admit', { state: { prefillPatient: pickerPatient, prefillHospitalId: hospital.id } })
    }
  }

  function getTimeFilterCutoff(filter) {
    if (!filter) return null
    const now = new Date()
    const map = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }
    const days = map[filter]
    if (!days) return null
    const d = new Date(now)
    d.setDate(d.getDate() - days)
    return d
  }

  async function handleExport() {
    setExportLoading(true)
    const hospitalMap = Object.fromEntries((hospitals || []).map(h => [h.id, h.name]))
    try {
      const fullAdmissionsByPatient = await Promise.all(
        filtered.map(p =>
          fetchAdmissionsForPatient(p.id)
            .then(adms => (adms || []).map(a => ({ ...a, _patient: p })))
            .catch(() => [])
        )
      )
      const allAdmissions = recordTypeFilter === 'outpatient'
        ? []
        : fullAdmissionsByPatient
            .flat()
            .filter(a => a.id && a.status !== 'deleted')

      const exportFrom = dateFrom || '2020-01-01'
      const exportTo = dateTo || new Date().toISOString().slice(0, 10)

      const billingResults = await Promise.all(
        allAdmissions.map(a => fetchAdmissionServices(a.id).catch(() => []))
      )

      const opResults = recordTypeFilter === 'inpatient'
        ? filtered.map(() => [])
        : await Promise.all(
            filtered.map(p => fetchOutpatientVisitsForPatient(p.id).catch(() => []))
          )

      const { data: teamMembersData } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('team_id', user.team_id)
      const memberMap = Object.fromEntries(
        (teamMembersData || []).map(m => [m.id, m.full_name])
      )

      const today = new Date().toISOString().slice(0, 10)
      const fromLabel = dateFrom || (timeFilter ? timeFilter + '_days' : 'All_Time')
      const toLabel = dateTo || today

      const sheet1 = allAdmissions.map((a, i) => {
        const services = billingResults[i]
        const p = a._patient
        const wardTotalVal = wardTotal(a)
        const svcTotal = (services || []).reduce((s, r) => s + Number(r.price || 0), 0)
        const admDate = new Date(a.admission_date)
        const disDate = a.discharge_date ? new Date(a.discharge_date) : new Date()
        const los = Math.max(1, Math.round((disDate - admDate) / 86400000))
        return {
          'IP Number': a.patient_hospital_id || '—',
          'First Name': p.first_name,
          'Last Name': p.last_name,
          'Date of Birth': formatDate(p.date_of_birth),
          'Age': p.date_of_birth ? (new Date().getFullYear() - new Date(p.date_of_birth).getFullYear()) : '—',
          'Insurance': p.insurance_name || '—',
          'Hospital': a.hospitals?.name || '—',
          'Ward': a.ward || '—',
          'Ward History': (() => {
            const rawEvents = a.timeline_events || []
            const events = rawEvents
              .map((e, i) => ({ ...e, _idx: i }))
              .sort((x, y) => {
                const tDiff = new Date(x.timestamp) - new Date(y.timestamp)
                if (tDiff !== 0) return tDiff
                if (x.event_type === 'admitted' && y.event_type !== 'admitted') return -1
                if (y.event_type === 'admitted' && x.event_type !== 'admitted') return 1
                return x._idx - y._idx
              })
            if (!events.length) return a.ward || '—'
            return events
              .filter(e => e.event_type === 'admitted' || e.event_type === 'transferred')
              .map(e => {
                const date = new Date(e.timestamp).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi'
                })
                return `${e.ward} (${date})`
              })
              .join(' → ')
          })(),
          'Transfer Count': (a.timeline_events || []).filter(e => e.event_type === 'transferred').length,
          'Admission Date': formatDate(a.admission_date),
          'Discharge Date': a.discharge_date ? formatDate(a.discharge_date) : 'Still Admitted',
          'LOS (days)': los,
          'Status': a.status || '—',
          'Ward Charges (KES)': wardTotalVal,
          'Services (KES)': svcTotal,
          'Grand Total (KES)': wardTotalVal + svcTotal,
        }
      })

      const sheet2 = allAdmissions.flatMap(a => {
        const p = a._patient
        return wardBillingLines(a).map(line => ({
          'IP Number': a.patient_hospital_id || '—',
          'Patient Name': `${p.first_name} ${p.last_name}`,
          'Hospital': a.hospitals?.name || '—',
          'Ward': line.ward,
          'Days': line.days,
          'Rate/day (KES)': line.rate,
          'Segment Total (KES)': line.total,
          'Admission Status': a.status || '—',
        }))
      })

      const sheet3 = allAdmissions.flatMap((a, i) => {
        const services = billingResults[i]
        const p = a._patient
        return (services || []).map(s => ({
          'IP Number': a.patient_hospital_id || '—',
          'Patient Name': `${p.first_name} ${p.last_name}`,
          'Hospital': a.hospitals?.name || '—',
          'Ward': a.ward || '—',
          'Service Name': s.service_name || s.team_services?.service_name || '—',
          'Category': s.team_services?.category || '—',
          'Billing Type': s.billing_type || s.team_services?.billing_type || '—',
          'Amount (KES)': Number(s.price || 0),
          'Date Added': formatDate(s.added_at || s.created_at),
        }))
      })

      const sheetTransfers = allAdmissions.flatMap(a => {
        const p = a._patient
        const events = (a.timeline_events || [])
          .sort((x, y) => new Date(x.timestamp) - new Date(y.timestamp))
        return events
          .filter(e => e.event_type === 'transferred')
          .map(e => ({
            'IP Number': a.patient_hospital_id || '—',
            'Patient Name': `${p.first_name} ${p.last_name}`,
            'Hospital': a.hospitals?.name || '—',
            'Transferred To': e.ward || '—',
            'Transfer Date': new Date(e.timestamp).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi'
            }),
            'Transfer Time': new Date(e.timestamp).toLocaleTimeString('en-GB', {
              hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi'
            }),
            'Notes': e.notes || '—',
          }))
      })

      const sheet4 = filtered.flatMap((p, i) => {
        const visits = opResults[i] || []
        return visits.map(v => {
          const svcTotal = (v.visit_services || []).reduce((s, vs) => s + Number(vs.price || 0), 0)
          return {
            'Patient Name': `${p.first_name} ${p.last_name}`,
            'Date of Birth': formatDate(p.date_of_birth),
            'Hospital': hospitalMap[v.hospital_id] || v.hospitals?.name || '—',
            'Visit Date': formatDate(v.visit_date),
            'Doctor': memberMap[v.created_by_user_id] || '—',
            'Visit Time': (() => {
              if (!v.visit_time) return '—'
              try {
                return new Date(v.visit_time).toLocaleTimeString('en-GB', {
                  hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi'
                })
              } catch { return v.visit_time }
            })(),
            'Status': v.status || '—',
            'Services Count': (v.visit_services || []).length,
            'Total Charged (KES)': svcTotal,
            'Notes': v.chief_complaint || v.notes || '—',
          }
        })
      })

      const sheet5 = filtered.flatMap((p, i) => {
        const visits = opResults[i] || []
        return visits.flatMap(v =>
          (v.visit_services || []).map(vs => ({
            'Patient Name': `${p.first_name} ${p.last_name}`,
            'Hospital': hospitalMap[v.hospital_id] || v.hospitals?.name || '—',
            'Visit Date': formatDate(v.visit_date),
            'Visit Status': v.status || '—',
            'Service Name': vs.service_name || '—',
            'Price (KES)': Number(vs.price || 0),
          }))
        )
      })

      const wb = XLSX.utils.book_new()
      const addSheet = (data, name) => {
        if (data.length === 0) {
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Note: 'No records in this period' }]), name)
        } else {
          const ws = XLSX.utils.json_to_sheet(data)
          const cols = Object.keys(data[0]).map(k => ({
            wch: Math.max(k.length, ...data.map(r => String(r[k] ?? '').length)) + 2
          }))
          ws['!cols'] = cols
          XLSX.utils.book_append_sheet(wb, ws, name)
        }
      }

      addSheet(sheet1, 'Admissions Summary')
      addSheet(sheet2, 'Ward Segments')
      addSheet(sheet3, 'IP Services')
      addSheet(sheetTransfers, 'Ward Transfers')
      addSheet(sheet4, 'Outpatient Visits')
      addSheet(sheet5, 'OP Services Itemised')

      XLSX.writeFile(wb, `WardRounds_Billing_${fromLabel}_to_${toLabel}.xlsx`)
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed: ' + (err.message || 'Unknown error'))
    } finally {
      setExportLoading(false)
    }
  }

  const handleResetFilters = () => {
    setTimeFilter(null)
    setStatusFilter('all')
    setQuery('')
    setDateFrom('')
    setDateTo('')
    setRecordTypeFilter('all')
  }

  const filtered = patients.filter(p => {
    const name = `${p.first_name} ${p.last_name}`.toLowerCase()
    if (!name.includes(query.toLowerCase())) return false

    if (recordTypeFilter === 'inpatient') {
      const hasAdmitted = (p.admissions || []).some(a => a.status === 'admitted')
      if (!hasAdmitted) return false
    } else if (recordTypeFilter === 'outpatient') {
      if (!(p.outpatient_visits || []).length) return false
    }

    if (statusFilter !== 'all') {
      const hasMatch = (p.admissions || []).some(a => a.status === statusFilter)
      if (!hasMatch) return false
    }

    const cutoff = getTimeFilterCutoff(timeFilter)
    if (cutoff && new Date(p.created_at) < cutoff) return false

    if (dateFrom && new Date(p.created_at) < new Date(dateFrom)) return false
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      if (new Date(p.created_at) > to) return false
    }

    return true
  })

  const grouped = {}
  filtered.forEach(p => {
    const letter = ((p.last_name || p.first_name || '?')[0]).toUpperCase()
    if (!grouped[letter]) grouped[letter] = []
    grouped[letter].push(p)
  })
  const sortedLetters = Object.keys(grouped).sort()
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('')

  return (
    <div className="flex flex-col min-h-full">
      <TopHeader title="Patients" />
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="p-4 pb-24 sm:pb-0 space-y-4">
        {/* Record type filter */}
        <div className="flex gap-1.5">
          {[['all', 'All Records'], ['inpatient', 'Inpatient Only'], ['outpatient', 'Outpatient Only']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setRecordTypeFilter(key)}
              className={`flex-1 py-2 rounded-2xl text-xs font-semibold transition-all ${
                recordTypeFilter === key ? 'bg-ios-blue text-white shadow-ios-card' : 'bg-black/[0.06] text-gray-600 hover:bg-black/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search + status filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ios-gray-1" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search patients…"
              className="ios-input pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="ios-input w-auto pl-3 pr-8"
          >
            <option value="all">All</option>
            <option value="admitted">Admitted</option>
            <option value="discharged">Discharged</option>
          </select>
        </div>

        {/* Time filter tabs */}
        <div className="border border-gray-200 rounded-2xl bg-white/70 p-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {[null, '1W', '1M', '3M', '6M', '1Y'].map(f => (
              <button
                key={f ?? 'all'}
                onClick={() => { setTimeFilter(f); setDateFrom(''); setDateTo('') }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  timeFilter === f && !dateFrom && !dateTo
                    ? 'bg-ios-blue text-white'
                    : 'bg-black/[0.06] text-gray-600 hover:bg-black/10'
                }`}
              >
                {f ?? 'All Time'}
              </button>
            ))}
            <button
              onClick={handleResetFilters}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors ml-auto"
            >
              ↺ Reset
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setTimeFilter(null) }}
              className="ios-input flex-1 text-xs py-1.5"
            />
            <span className="text-xs text-ios-gray-1">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setTimeFilter(null) }}
              className="ios-input flex-1 text-xs py-1.5"
            />
          </div>
        </div>

        {/* Count + export */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-ios-gray-1">
            {filtered.length} patient{filtered.length !== 1 ? 's' : ''}
            {(timeFilter || dateFrom || dateTo) ? ' in selected period' : ''}
          </p>
          {permissions?.can_view_revenue === true && (
          <button
            onClick={handleExport}
            disabled={exportLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white text-sm font-semibold transition-opacity disabled:opacity-60"
            style={{ background: '#007AFF' }}
          >
            {exportLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
                Export
              </>
            )}
          </button>
          )}
        </div>

        {/* Patient list */}
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="border border-gray-200 rounded-2xl bg-white/70 animate-pulse h-16" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 text-ios-gray-1">
            <Search size={36} strokeWidth={1.2} className="opacity-30" />
            <p className="text-sm">{query ? 'No patients found' : 'No patients yet'}</p>
            <button onClick={() => navigate('/admit')} className="ios-blue-btn text-sm py-2 px-4">
              <span className="flex items-center gap-1.5"><UserPlus size={15} />Admit Patient</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3 pr-2">
            {sortedLetters.map(letter => (
              <div key={letter} id={`section-${letter}`} className="mb-4">
                <div className="px-2 py-1 text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {letter}
                </div>
                {grouped[letter].map(patient => {
              const isOpen = expandedId === patient.id
              const admissions = admissionsMap[patient.id] || []
              const isLoadingA = loadingAdmissions[patient.id]
              const latest = admissions[0]
              const age = calcAge(patient.date_of_birth)
              const recentAdmission = [...(patient.admissions || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
              const patientHospitalId = recentAdmission?.patient_hospital_id || null
              const outpatientVisits = outpatientVisitsMap[patient.id] || []
              const isLoadingOp = loadingOutpatient[patient.id]
              const opError = outpatientErrorMap[patient.id]
              const admOpen = admSectionOpen[patient.id] ?? true
              const opOpen = opSectionOpen[patient.id] ?? false

              function loadOutpatientVisits() {
                setLoadingOutpatient(prev => ({ ...prev, [patient.id]: true }))
                setOutpatientErrorMap(prev => ({ ...prev, [patient.id]: false }))
                fetchOutpatientVisitsForPatient(patient.id)
                  .then(data => setOutpatientVisitsMap(prev => ({ ...prev, [patient.id]: data })))
                  .catch(err => { console.error(err); setOutpatientErrorMap(prev => ({ ...prev, [patient.id]: true })) })
                  .finally(() => setLoadingOutpatient(prev => ({ ...prev, [patient.id]: false })))
              }

              return (
                <div
                  key={patient.id}
                  id={`patient-${patient.id}`}
                  className={`mb-2 rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-1 ${flashId === patient.id ? 'ring-blue-400/60' : 'ring-gray-200'}`}
                  style={{ backgroundColor: '#F2F2F7' }}
                >
                  {/* ── GRADIENT HEADER ── */}
                  <div
                    className="px-3 py-1.5 cursor-pointer"
                    onClick={() => toggleExpand(patient.id)}
                    style={{ background: 'linear-gradient(135deg, #F2F2F7 0%, #E5E5EA 100%)' }}
                  >
                    <div className="flex items-start gap-2">
                      {/* Avatar */}
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-600 font-semibold text-xs">
                          {patient.first_name[0]}{patient.last_name[0]}
                        </span>
                      </div>
                      {/* Two-line block */}
                      <div className="flex-1 min-w-0">
                        {/* ROW 1: name */}
                        <p className="text-sm font-bold text-gray-900 leading-tight uppercase truncate">
                          {patient.first_name} {patient.last_name}
                        </p>
                        {/* ROW 2: IP · age · DOB (left) + status badge (right) */}
                        <div className="mt-0.5 flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-wrap">
                            {patientHospitalId && <span>#{patientHospitalId}</span>}
                            {patientHospitalId && (age !== null || patient.date_of_birth) && <span className="text-gray-300">·</span>}
                            {age !== null && <span>{age} yrs</span>}
                            {age !== null && patient.date_of_birth && <span className="text-gray-300">·</span>}
                            {patient.date_of_birth && <span>{formatDate(patient.date_of_birth)}</span>}
                          </div>
                          {latest && (() => {
                            const s = getStatusBadgeStyle(latest.status)
                            return (
                              <span className={`flex-shrink-0 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${s.className}`}>
                                {s.icon} {s.text}
                              </span>
                            )
                          })()}
                        </div>
                        {/* ROW 3: contact (read-only) + single edit-details button */}
                        <div className="mt-0.5 flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="flex items-center gap-1 text-gray-500">
                              {patient.phone ? (
                                <>
                                  <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.137l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.137-.502l4.493 1.498A1 1 0 0121 17.72V21a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"/>
                                  </svg>
                                  <span className="text-xs truncate">{patient.phone}</span>
                                </>
                              ) : (
                                <span className="text-xs text-gray-400 italic">No mobile</span>
                              )}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1 text-gray-500">
                              {patient.email ? (
                                <>
                                  <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                  </svg>
                                  <span className="text-xs break-all">{patient.email}</span>
                                </>
                              ) : (
                                <span className="text-xs text-gray-400 italic">No email</span>
                              )}
                            </span>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); setEditPatient(patient) }}
                            title="Edit patient details"
                            className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-[#007AFF] bg-[#007AFF]/10 hover:bg-[#007AFF]/20 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                            </svg>
                            Edit
                          </button>
                        </div>
                      </div>
                      {/* Chevron — self-centre against the full two-line block */}
                      <div className="flex-shrink-0 self-center pl-2">
                        {isOpen
                          ? <ChevronUp size={16} className="text-gray-400" />
                          : <ChevronDown size={16} className="text-gray-400" />
                        }
                      </div>
                    </div>
                  </div>

                  {/* ── EXPANDED BODY ── */}
                  {isOpen && (
                    <div className="p-4 space-y-4" style={{ backgroundColor: '#F2F2F7' }}>

                      {/* ── ADMISSIONS SECTION ── */}
                      <div>
                        <button
                          className="w-full flex items-center justify-between mb-3"
                          onClick={() => setAdmSectionOpen(prev => ({ ...prev, [patient.id]: !admOpen }))}
                        >
                          <span className="text-xs font-bold tracking-wide text-gray-500">
                            ADMISSIONS ({isLoadingA ? '…' : admissions.length})
                          </span>
                          {admOpen
                            ? <ChevronUp size={12} className="text-gray-400" />
                            : <ChevronDown size={12} className="text-gray-400" />
                          }
                        </button>

                        {admOpen && (
                          isLoadingA ? (
                            <div className="space-y-2">
                              {[1, 2].map(i => <div key={i} className="h-10 bg-white/40 rounded-xl animate-pulse" />)}
                            </div>
                          ) : admissions.length === 0 ? (
                            <p className="text-xs text-gray-500 text-center py-2">No admission history</p>
                          ) : (
                            <div className="space-y-2">
                              {admissions.map(adm => {
                                const admAccent = adm.hospitals?.color || '#007AFF'
                                const isAdmExpanded = expandedAdmissionId === adm.id
                                const services = servicesMap[adm.id] || []
                                const billingLines = wardBillingLines(adm)
                                const wardTotalVal = wardTotal(adm)
                                const servicesTotal = services.reduce((s, r) => s + Number(r.price || 0), 0)
                                const grandTotal = wardTotalVal + servicesTotal
                                const isActive = adm.status === 'admitted'
                                const s = getStatusBadgeStyle(adm.status)

                                return (
                                  <div
                                    key={adm.id}
                                    className="rounded-3xl overflow-hidden border border-white/50"
                                    style={{ backgroundColor: admAccent + '08' }}
                                  >
                                    {/* Admission gradient header strip */}
                                    <div
                                      className="p-3 cursor-pointer"
                                      onClick={() => toggleAdmissionExpand(adm.id)}
                                      style={{ background: `linear-gradient(135deg, ${admAccent} 0%, ${darken(admAccent)} 100%)` }}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                                          {adm.ward && (
                                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-white bg-white/25 flex-shrink-0">
                                              {adm.ward}
                                            </span>
                                          )}
                                          <span className="text-xs font-semibold text-white truncate">
                                            {adm.hospitals?.name || 'Unknown Hospital'}
                                          </span>
                                        </div>
                                        <div className="flex-shrink-0 flex items-center gap-2">
                                          {grandTotal > 0 && (
                                            <RevenueValue tone="light" className="text-xs">
                                              <span className="text-xs font-bold text-white tabular-nums">
                                                {formatKES(grandTotal)}
                                              </span>
                                            </RevenueValue>
                                          )}
                                          <ChevronDown
                                            size={13}
                                            className={`text-white/70 transition-transform duration-200 ${isAdmExpanded ? 'rotate-180' : ''}`}
                                          />
                                        </div>
                                      </div>
                                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                        <span className="text-[11px] text-white/70">
                                          {formatDate(adm.team_start_date || adm.admission_date)}
                                          {adm.discharge_date ? ` → ${formatDate(adm.discharge_date)}` : isActive ? ' → Present' : ''}
                                        </span>
                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${s.className}`}>
                                          {s.text}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Admission billing body */}
                                    {isAdmExpanded && (
                                      <div
                                        className="p-3 space-y-3"
                                        style={{ backgroundColor: admAccent + '20', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                                      >
                                        {loadingBilling[adm.id] ? (
                                          <div className="h-8 bg-white/40 rounded-xl animate-pulse" />
                                        ) : (
                                          <div>
                                            <p className="text-xs font-bold tracking-wide text-gray-600 mb-2">BILLING BREAKDOWN</p>
                                            {billingLines.length === 0 && services.length === 0 ? (
                                              <p className="text-[11px] text-gray-500">No billing records</p>
                                            ) : (
                                              <div>
                                                {billingLines.map((line, i) => (
                                                  <div key={i}>
                                                    {i > 0 && <div className="border-t border-white/40 my-1" />}
                                                    <div className="flex items-center gap-3 py-2">
                                                      <div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center flex-shrink-0">
                                                        <Building2 size={16} style={{ color: wardColor(line.ward) }} />
                                                      </div>
                                                      <div className="flex-1 min-w-0">
                                                        <p className="text-[12px] font-semibold text-gray-900">{line.ward}</p>
                                                        <p className="text-[11px] text-gray-500">{line.days}d @ {formatKES(line.rate)}/day</p>
                                                      </div>
                                                      <RevenueValue className="text-[12px] flex-shrink-0">
                                                        <span className="text-[12px] font-bold text-[#007AFF] tabular-nums flex-shrink-0">
                                                          {formatKES(line.total)}
                                                        </span>
                                                      </RevenueValue>
                                                    </div>
                                                  </div>
                                                ))}
                                                {services.map((svc, i) => (
                                                  <div key={svc.id}>
                                                    {(billingLines.length > 0 || i > 0) && <div className="border-t border-white/40 my-1" />}
                                                    <div className="flex items-center gap-3 py-2">
                                                      <div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center flex-shrink-0">
                                                        <FileText size={16} className="text-purple-500" />
                                                      </div>
                                                      <div className="flex-1 min-w-0">
                                                        <p className="text-[12px] font-semibold text-gray-900">{svc.service_name}</p>
                                                        <p className="text-[11px] text-gray-500">(one-off)</p>
                                                      </div>
                                                      <RevenueValue className="text-[12px] flex-shrink-0">
                                                        <span className="text-[12px] font-bold text-[#007AFF] tabular-nums flex-shrink-0">
                                                          {formatKES(svc.price)}
                                                        </span>
                                                      </RevenueValue>
                                                    </div>
                                                  </div>
                                                ))}
                                                <div className="border-t border-white/40 mt-2 pt-3 flex justify-between items-center">
                                                  <span className="text-sm font-bold text-gray-900">
                                                    Total{isActive ? ' (live)' : ''}
                                                  </span>
                                                  <RevenueValue variant="block">
                                                    <span
                                                      className="rounded-xl px-3 py-1.5 text-sm font-bold tabular-nums"
                                                      style={{ backgroundColor: admAccent + '30', color: darken(admAccent, 20) }}
                                                    >
                                                      {formatKES(grandTotal)}
                                                    </span>
                                                  </RevenueValue>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        <div className="flex gap-2">
                                          {permissions?.can_view_revenue === true && (
                                            <button
                                              onClick={() => setInvoiceAdmission(adm)}
                                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold text-ios-blue bg-blue-50 hover:bg-blue-100 transition-colors"
                                            >
                                              <Receipt size={12} /> Invoice
                                            </button>
                                          )}
                                          {(adm.status === 'discharged' || adm.status === 'archived') && (
                                            <button
                                              onClick={() => handleReadmit(patient)}
                                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold text-ios-green bg-green-50 hover:bg-green-100 transition-colors"
                                            >
                                              <RotateCcw size={12} /> Re-admit
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )
                        )}
                      </div>

                      {/* ── OUTPATIENT VISITS SECTION ── */}
                      <div>
                        <button
                          className="w-full flex items-center justify-between mb-3"
                          onClick={() => {
                            const next = !opOpen
                            setOpSectionOpen(prev => ({ ...prev, [patient.id]: next }))
                            if (next && !outpatientVisitsMap[patient.id] && !loadingOutpatient[patient.id]) {
                              loadOutpatientVisits()
                            }
                          }}
                        >
                          <span className="text-xs font-bold tracking-wide text-gray-500">
                            OUTPATIENT VISITS ({isLoadingOp ? '…' : outpatientVisits.length})
                          </span>
                          {opOpen
                            ? <ChevronUp size={12} className="text-gray-400" />
                            : <ChevronDown size={12} className="text-gray-400" />
                          }
                        </button>

                        {opOpen && (
                          isLoadingOp ? (
                            <div className="space-y-2">
                              {[1].map(i => <div key={i} className="h-10 bg-white/40 rounded-xl animate-pulse" />)}
                            </div>
                          ) : opError ? (
                            <div className="text-center py-2">
                              <p className="text-xs text-red-500 mb-1">Failed to load outpatient visits</p>
                              <button onClick={loadOutpatientVisits} className="text-xs font-semibold text-ios-blue underline">
                                Retry
                              </button>
                            </div>
                          ) : outpatientVisits.length === 0 ? (
                            <p className="text-xs text-gray-500 text-center py-2">No outpatient visits</p>
                          ) : (
                            <div className="space-y-2">
                              {outpatientVisits.map(visit => {
                                const svcList = visit.visit_services || []
                                const svcTotal = svcList.reduce((s, sv) => s + Number(sv.price || 0), 0)
                                const grandTotal = svcTotal + Number(visit.consultation_fee || 0)
                                const visitDateStr = (visit.visit_date || '').split('T')[0]
                                const visitAccent = visit.hospitals?.color || hospitals.find(h => h.id === visit.hospital_id)?.color || '#007AFF'
                                const visitHospitalName = visit.hospitals?.name || hospitals.find(h => h.id === visit.hospital_id)?.name
                                const isOpExpanded = expandedOpVisitId === visit.id

                                return (
                                  <div
                                    key={visit.id}
                                    className="rounded-3xl overflow-hidden border border-white/50"
                                    style={{ backgroundColor: visitAccent + '08' }}
                                  >
                                    {/* Visit gradient header strip */}
                                    <div
                                      className="p-3 cursor-pointer"
                                      onClick={() => {
                                        const next = expandedOpVisitId === visit.id ? null : visit.id
                                        setExpandedOpVisitId(next)
                                        if (next && visitNotesMap[next] === undefined && !loadingVisitNotes[next]) {
                                          loadVisitNotes(next)
                                        }
                                      }}
                                      style={{ background: `linear-gradient(135deg, ${visitAccent} 0%, ${darken(visitAccent)} 100%)` }}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                                          <span className="text-xs font-semibold text-white">{formatDate(visitDateStr)}</span>
                                          {visitHospitalName && (
                                            <span className="text-[11px] text-white/80">{visitHospitalName}</span>
                                          )}
                                          {visit.doctor?.full_name && (
                                            <span className="text-[11px] text-white/80">· {visit.doctor.full_name}</span>
                                          )}
                                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${getOutpatientStatusStyle(visit.status)}`}>
                                            {visit.status}
                                          </span>
                                        </div>
                                        <div className="flex-shrink-0 flex items-center gap-2">
                                          {grandTotal > 0 && (
                                            <RevenueValue tone="light" className="text-xs">
                                              <span className="text-xs font-bold text-white tabular-nums">
                                                {formatKES(grandTotal)}
                                              </span>
                                            </RevenueValue>
                                          )}
                                          <ChevronDown
                                            size={13}
                                            className={`text-white/70 transition-transform duration-200 ${isOpExpanded ? 'rotate-180' : ''}`}
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    {/* Visit body */}
                                    {isOpExpanded && (
                                      <div
                                        className="p-3 space-y-3"
                                        style={{ backgroundColor: visitAccent + '20', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                                      >
                                        {/* Services */}
                                        <div>
                                          <p className="text-xs font-bold tracking-wide text-gray-600 mb-2">SERVICES</p>
                                          {svcList.length === 0 ? (
                                            <p className="text-[11px] text-gray-500">No charges recorded</p>
                                          ) : (
                                            <>
                                              {svcList.map((svc, i) => (
                                                <div key={svc.id}>
                                                  {i > 0 && <div className="border-t border-white/40 my-1" />}
                                                  <div className="flex items-center gap-3 py-2">
                                                    <div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center flex-shrink-0">
                                                      <Stethoscope size={16} style={{ color: visitAccent }} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                      <p className="text-[12px] font-semibold text-gray-900">{svc.service_name}</p>
                                                    </div>
                                                    <RevenueValue className="text-[12px] flex-shrink-0">
                                                      <span className="text-[12px] font-bold text-[#007AFF] tabular-nums flex-shrink-0">
                                                        {formatKES(svc.price)}
                                                      </span>
                                                    </RevenueValue>
                                                  </div>
                                                </div>
                                              ))}
                                              <div className="border-t border-white/40 mt-2 pt-3 flex justify-between items-center">
                                                <span className="text-sm font-bold text-gray-900">Total</span>
                                                <RevenueValue variant="block">
                                                  <span
                                                    className="rounded-xl px-3 py-1.5 text-sm font-bold tabular-nums"
                                                    style={{ backgroundColor: visitAccent + '30', color: darken(visitAccent, 20) }}
                                                  >
                                                    {formatKES(svcTotal)}
                                                  </span>
                                                </RevenueValue>
                                              </div>
                                            </>
                                          )}
                                        </div>

                                        {/* Notes */}
                                        <div>
                                          <p className="text-xs font-bold tracking-wide text-gray-600 mb-2">NOTES</p>
                                          {loadingVisitNotes[visit.id] ? (
                                            <div className="h-6 bg-white/40 rounded animate-pulse" />
                                          ) : visitNotesErrorMap[visit.id] ? (
                                            <div className="flex items-center gap-2">
                                              <p className="text-[11px] text-red-500">Failed to load notes</p>
                                              <button
                                                onClick={() => loadVisitNotes(visit.id)}
                                                className="text-[11px] font-semibold text-ios-blue underline"
                                              >
                                                Retry
                                              </button>
                                            </div>
                                          ) : (visitNotesMap[visit.id] || []).length === 0 ? (
                                            <p className="text-[11px] text-gray-500">No notes</p>
                                          ) : (
                                            (visitNotesMap[visit.id] || []).map(note => (
                                              <div key={note.id} className="py-1.5 border-b last:border-0" style={{ borderColor: visitAccent + '30' }}>
                                                <p className="text-xs text-gray-700">{note.note_text}</p>
                                                <p className="text-[10px] text-gray-500 mt-0.5">
                                                  {new Date(note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                  {' · '}
                                                  {new Date(note.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                              </div>
                                            ))
                                          )}
                                        </div>

                                        {/* Invoice */}
                                        <div className="flex gap-2">
                                          {permissions?.can_view_revenue === true && (
                                            <button
                                              onClick={() => setInvoiceAdmission({ ...visit, admission_date: visit.visit_date })}
                                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold text-ios-blue bg-blue-50 hover:bg-blue-100 transition-colors"
                                            >
                                              <Receipt size={12} /> Invoice
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )
                        )}
                      </div>

                      {/* ── QUICK ACTIONS ── */}
                      <div className="flex gap-2 pt-2 mt-2 border-t border-white/20">
                        <button
                          onClick={() => navigate('/appointments', { state: { prefillPatient: patient } })}
                          className="text-xs px-3 py-1.5 rounded-full border font-medium border-blue-200 text-blue-600 hover:bg-blue-50"
                        >
                          Book Appointment
                        </button>
                        <button
                          onClick={() => { setPickerMode('checkin'); setPickerPatient(patient); setHospitalPickerOpen(true) }}
                          className="text-xs px-3 py-1.5 rounded-full border font-medium border-green-200 text-green-600 hover:bg-green-50"
                        >
                          Check In
                        </button>
                        <button
                          onClick={() => { setPickerMode('admit'); setPickerPatient(patient); setHospitalPickerOpen(true) }}
                          className="text-xs px-3 py-1.5 rounded-full border font-medium border-red-200 text-red-600 hover:bg-red-50"
                        >
                          Admit
                        </button>
                      </div>

                    </div>
                  )}
                </div>
              )
            })}
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className={`fixed right-1 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center select-none transition-all duration-200 ${isScrollingPatients ? 'bg-white/90 backdrop-blur-xl border border-white/60 rounded-full shadow-lg px-1 py-2' : ''}`}
        style={{ maxHeight: '70vh', overflowY: 'hidden' }}
      >
        {ALPHABET.map(letter => {
          const hasPatients = sortedLetters.includes(letter)
          if (!isScrollingPatients && !hasPatients) return null
          return (
            <button
              key={letter}
              onClick={() => {
                const el = document.getElementById(`section-${letter}`)
                const scrollContainer = document.getElementById('main-scroll')
                if (el && scrollContainer) {
                  scrollContainer.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' })
                } else if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }}
              className={`font-semibold flex items-center justify-center rounded-full transition-all duration-200
                ${isScrollingPatients ? 'text-[10px] w-5 h-5' : 'text-[10px] w-4 h-4'}
                ${hasPatients
                  ? 'text-[#007AFF] hover:bg-[#007AFF]/10 cursor-pointer'
                  : 'text-gray-300 cursor-default'
                }`}
            >
              {isScrollingPatients ? letter : (hasPatients ? '·' : null)}
            </button>
          )
        })}
      </div>

      {invoiceAdmission && (
        <InvoiceModal
          admission={invoiceAdmission}
          onClose={() => setInvoiceAdmission(null)}
        />
      )}

      <HospitalPickerModal
        open={hospitalPickerOpen}
        mode={pickerMode}
        patient={pickerPatient}
        hospitals={hospitals}
        teamId={user.team_id}
        loading={pickerLoading}
        onClose={() => setHospitalPickerOpen(false)}
        onConfirm={handlePickerConfirm}
      />

      <EditPatientModal
        open={!!editPatient}
        patient={editPatient}
        onClose={() => setEditPatient(null)}
        onSaved={() => { setEditPatient(null); load(); showToast('Patient details updated.', 'success') }}
      />

      {/* ── Confirm Modal ── */}
      {confirmModal && (
        <ModalShell onClose={() => setConfirmModal(null)} maxWidth="max-w-sm">
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
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-ios-blue hover:opacity-90 text-white transition-opacity">
                {confirmModal.confirmLabel || 'Confirm'}
              </button>
            </div>
            </div>
          </div>
        </ModalShell>
      )}

      {/* ── Error Modal ── */}
      {errorModal && (
        <ModalShell onClose={() => setErrorModal(null)} maxWidth="max-w-sm">
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
        </ModalShell>
      )}
    </div>
  )
}
