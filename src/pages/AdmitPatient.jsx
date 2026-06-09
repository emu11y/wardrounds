import { useState, useEffect } from 'react'
import { Search, UserPlus, QrCode, CheckCircle, X, Calendar, Building2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { createPatient, createAdmission, fetchHospitals } from '../lib/api'
import TopHeader from '../components/TopHeader'
import PatientSearch from '../components/PatientSearch'
import HospitalSelect from '../components/HospitalSelect'
import QRScanner from '../components/QRScanner'

const TABS = [
  { id: 'search', label: 'Search Patient', icon: Search },
  { id: 'new', label: 'New Patient', icon: UserPlus },
  { id: 'scan', label: 'Scan QR', icon: QrCode },
]

const EMPTY_NEW_PATIENT = { first_name: '', last_name: '', date_of_birth: '', insurance_name: '' }
const EMPTY_ADMISSION = { hospital_id: '', ward: '', insurance_name: '', admission_date: '', team_start_date: '' }

export default function AdmitPatient() {
  const { user, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState('search')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [hospitals, setHospitals] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [newPatient, setNewPatient] = useState(EMPTY_NEW_PATIENT)
  const [admission, setAdmission] = useState({ ...EMPTY_ADMISSION, admission_date: nowLocal(), team_start_date: new Date().toISOString().slice(0, 10) })

  useEffect(() => {
    if (user?.team_id) fetchHospitals(user.team_id).then(setHospitals).catch(console.error)
  }, [user?.team_id])

  useEffect(() => {
    if (selectedPatient?.insurance_name) {
      setAdmission(a => ({ ...a, insurance_name: selectedPatient.insurance_name }))
    }
  }, [selectedPatient])

  function nowLocal() {
    return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  function handleScanExtract(info) {
    setNewPatient({
      first_name: info.firstName || '',
      last_name: info.lastName || '',
      date_of_birth: info.dateOfBirth || '',
      insurance_name: info.insuranceName || '',
    })
    setActiveTab('new')
    showToast('Patient info extracted — please review and confirm.', 'info')
  }

  async function handleSaveNewPatient(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const patient = await createPatient({ ...newPatient, team_id: user.team_id })
      setSelectedPatient(patient)
      setNewPatient(EMPTY_NEW_PATIENT)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleAdmit(e) {
    e.preventDefault()
    if (!selectedPatient || !admission.ward) return
    setLoading(true)
    try {
      await createAdmission({
        patient_id: selectedPatient.id,
        team_id: user.team_id,
        hospital_id: admission.hospital_id || null,
        ward: admission.ward,
        admission_date: new Date(admission.admission_date).toISOString(),
        team_start_date: admission.team_start_date,
        status: 'admitted',
      })
      const hospitalName = hospitals.find(h => h.id === admission.hospital_id)?.name
      showToast(
        `${selectedPatient.first_name} ${selectedPatient.last_name} admitted to ${hospitalName ? `${hospitalName} — ` : ''}${admission.ward}`
      )
      setSelectedPatient(null)
      setAdmission({ ...EMPTY_ADMISSION, admission_date: nowLocal() })
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex flex-col min-h-full">
        <TopHeader title="Admit Patient" />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-ios-gray-1">
            <div className="w-6 h-6 border-2 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin" />
            <p className="text-sm">Loading user info…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopHeader title="Admit Patient" />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-glass-md flex items-center gap-2 text-sm font-medium text-white transition-all
          ${toast.type === 'error' ? 'bg-ios-red' : toast.type === 'info' ? 'bg-ios-orange' : 'bg-ios-green'}`}>
          {toast.type === 'success' && <CheckCircle size={16} />}
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="p-4 max-w-lg mx-auto w-full space-y-4">

        {/* Tab bar */}
        <div className="glass-card p-1.5">
          <div className="grid grid-cols-3 gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all
                  ${activeTab === id
                    ? 'bg-white dark:bg-white/15 text-ios-blue shadow-ios-card'
                    : 'text-ios-gray-1 hover:text-gray-700 dark:hover:text-gray-300'}`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab panels */}
        <div className="glass-card">
          {activeTab === 'search' && (
            <div>
              <p className="text-xs font-semibold text-ios-gray-1 uppercase tracking-wide mb-3">Find existing patient</p>
              <PatientSearch teamId={user?.team_id} onSelect={setSelectedPatient} />
            </div>
          )}

          {activeTab === 'new' && (
            <form onSubmit={handleSaveNewPatient} className="space-y-3">
              <p className="text-xs font-semibold text-ios-gray-1 uppercase tracking-wide mb-3">Enter patient details</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">First Name</label>
                  <input
                    required
                    value={newPatient.first_name}
                    onChange={e => setNewPatient(p => ({ ...p, first_name: e.target.value }))}
                    className="ios-input"
                    placeholder="First"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Last Name</label>
                  <input
                    required
                    value={newPatient.last_name}
                    onChange={e => setNewPatient(p => ({ ...p, last_name: e.target.value }))}
                    className="ios-input"
                    placeholder="Last"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Date of Birth</label>
                <input
                  type="date"
                  value={newPatient.date_of_birth}
                  onChange={e => setNewPatient(p => ({ ...p, date_of_birth: e.target.value }))}
                  className="ios-input"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Insurance <span className="text-ios-gray-2 font-normal">(optional)</span></label>
                <input
                  value={newPatient.insurance_name}
                  onChange={e => setNewPatient(p => ({ ...p, insurance_name: e.target.value }))}
                  className="ios-input"
                  placeholder="e.g. BUPA, NHS, Private"
                />
              </div>
              <button type="submit" disabled={loading} className="ios-blue-btn w-full">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </span>
                ) : 'Save & Continue to Admission →'}
              </button>
            </form>
          )}

          {activeTab === 'scan' && (
            <div>
              <p className="text-xs font-semibold text-ios-gray-1 uppercase tracking-wide mb-3">Scan hospital ID or insurance card</p>
              <QRScanner onExtract={handleScanExtract} />
            </div>
          )}
        </div>

        {/* Selected patient chip */}
        {selectedPatient && (
          <div className="glass-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-ios-blue flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {selectedPatient.first_name[0]}{selectedPatient.last_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{selectedPatient.first_name} {selectedPatient.last_name}</p>
                <p className="text-xs text-ios-gray-1 truncate">
                  {selectedPatient.date_of_birth ? `DOB: ${selectedPatient.date_of_birth}` : ''}
                  {selectedPatient.date_of_birth && selectedPatient.insurance_name ? ' · ' : ''}
                  {selectedPatient.insurance_name || ''}
                </p>
              </div>
              <button
                onClick={() => setSelectedPatient(null)}
                className="p-1 text-ios-gray-1 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Admission form */}
        {selectedPatient && (
          <form onSubmit={handleAdmit} className="glass-card space-y-4">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-ios-blue" />
              <h3 className="font-semibold">Admission Details</h3>
            </div>

            <HospitalSelect
              hospitals={hospitals}
              hospitalId={admission.hospital_id}
              ward={admission.ward}
              onHospitalChange={v => setAdmission(a => ({ ...a, hospital_id: v }))}
              onWardChange={v => setAdmission(a => ({ ...a, ward: v }))}
            />

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Insurance <span className="text-ios-gray-2 font-normal">(optional)</span></label>
              <input
                value={admission.insurance_name}
                onChange={e => setAdmission(a => ({ ...a, insurance_name: e.target.value }))}
                className="ios-input"
                placeholder="e.g. BUPA, NHS, Private"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Calendar size={13} className="text-ios-gray-1" />
                Hospital Admission Date &amp; Time
                  <span className="text-[11px] text-ios-gray-1 font-normal ml-1">(when patient was admitted to hospital)</span>
              </label>
              <input
                type="datetime-local"
                value={admission.admission_date}
                onChange={e => setAdmission(a => ({ ...a, admission_date: e.target.value }))}
                className="ios-input"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                WardRounds Start Date
                <span className="text-[11px] text-ios-gray-1 font-normal ml-1">(when your team begins seeing this patient)</span>
              </label>
              <input
                type="date"
                value={admission.team_start_date}
                onChange={e => setAdmission(a => ({ ...a, team_start_date: e.target.value }))}
                className="ios-input"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !admission.ward}
              className="ios-blue-btn w-full py-3.5 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Admitting…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle size={18} />
                  Admit Patient
                </span>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
