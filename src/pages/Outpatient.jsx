import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Stethoscope, Plus, X, ChevronDown, ChevronUp, Camera, Search, UserPlus, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  fetchOutpatientVisits, createOutpatientVisit, updateOutpatientVisit, deleteOutpatientVisit,
  fetchVisitServices, addVisitService, deleteVisitService,
  searchPatients, createPatient, fetchHospitals,
} from '../lib/api'
import { extractPatientDataFromTag } from '../lib/hospitalTagReader'

const STATUS_COLORS = {
  seen: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
}

function calcAge(dob) {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 3600 * 1000))
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

// ─── Visit Services ───────────────────────────────────────────────────────────

function VisitServices({ visitId }) {
  const [services, setServices] = useState(null)
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetchVisitServices(visitId).then(setServices).catch(console.error)
  }, [visitId])

  async function handleAdd() {
    if (!newName.trim() || !newPrice) return
    setAdding(true)
    try {
      const svc = await addVisitService(visitId, newName.trim(), Number(newPrice))
      setServices(prev => [...(prev || []), svc])
      setNewName('')
      setNewPrice('')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id) {
    await deleteVisitService(id)
    setServices(prev => (prev || []).filter(s => s.id !== id))
  }

  if (services === null) return <p className="text-xs text-gray-400">Loading…</p>

  const total = services.reduce((sum, s) => sum + Number(s.price), 0)

  return (
    <div className="space-y-1">
      {services.map(s => (
        <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/60">
          <span className="flex-1 text-xs text-gray-700 break-words min-w-0">{s.service_name}</span>
          <span className="text-xs font-medium text-gray-700 flex-shrink-0">KES {Number(s.price).toLocaleString()}</span>
          <button
            onClick={() => handleDelete(s.id)}
            className="w-5 h-5 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-200 transition-colors flex-shrink-0"
          >
            <X size={10} />
          </button>
        </div>
      ))}
      {services.length > 0 && (
        <div className="flex justify-between px-2 pt-1.5 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total</span>
          <span className="text-xs font-semibold text-gray-700">KES {total.toLocaleString()}</span>
        </div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <input
          className="flex-1 text-xs px-3 py-2 rounded-xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
          placeholder="Service name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <input
          className="w-20 text-xs px-3 py-2 rounded-xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
          placeholder="Price"
          type="number"
          value={newPrice}
          onChange={e => setNewPrice(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newName.trim() || !newPrice}
          className="w-7 h-7 flex items-center justify-center rounded-xl bg-ios-blue text-white disabled:opacity-40 transition-opacity flex-shrink-0"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  )
}

// ─── Visit Card ───────────────────────────────────────────────────────────────

function VisitCard({ visit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [notes, setNotes] = useState(visit.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const patient = visit.patients
  const age = calcAge(patient?.date_of_birth)
  const patientName = patient
    ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unknown'
    : 'Unknown'
  const fee = Number(visit.consultation_fee || 0)

  async function handleNotesSave() {
    if (notes === (visit.notes || '')) return
    setSavingNotes(true)
    try {
      await updateOutpatientVisit(visit.id, { notes })
    } finally {
      setSavingNotes(false)
    }
  }

  async function handleDelete() {
    await deleteOutpatientVisit(visit.id)
    onDelete(visit.id)
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-900">{patientName}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[visit.status] || 'bg-gray-100 text-gray-600'}`}>
              {visit.status}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            <span className="text-xs text-gray-500">{formatDate(visit.visit_date)}</span>
            {visit.patient_hospital_id && (
              <>
                <span className="text-gray-300 text-xs">·</span>
                <span className="text-xs font-medium text-blue-500">#{visit.patient_hospital_id}</span>
              </>
            )}
            {age !== null && (
              <>
                <span className="text-gray-300 text-xs">·</span>
                <span className="text-xs text-gray-500">{age} yrs</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {fee > 0 && (
            <span className="text-sm font-semibold text-gray-800">KES {fee.toLocaleString()}</span>
          )}
          {expanded
            ? <ChevronUp size={16} className="text-gray-400" />
            : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/30 space-y-4 pt-3">
          {patient?.date_of_birth && (
            <p className="text-xs text-gray-500">
              {age !== null ? `${age} yrs · ` : ''}
              {formatDate(patient.date_of_birth)}
            </p>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Services</p>
            <VisitServices visitId={visit.id} />
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Notes</p>
            <textarea
              className="w-full text-sm px-3 py-2 rounded-xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30 resize-none"
              rows={3}
              placeholder="Visit notes…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={handleNotesSave}
            />
            {savingNotes && <p className="text-[10px] text-gray-400 mt-0.5">Saving…</p>}
          </div>

          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600 flex-1">Delete this visit?</span>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="text-xs px-3 py-1.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 text-xs text-ios-red hover:opacity-75 transition-opacity"
            >
              <Trash2 size={13} />
              Delete Visit
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── New Visit Modal ──────────────────────────────────────────────────────────

function NewVisitModal({ teamId, hospitals, onClose, onCreated }) {
  const [modalTab, setModalTab] = useState('search')

  // Scan
  const [scanPreview, setScanPreview] = useState(null)
  const [scanError, setScanError] = useState(null)
  const [isScanning, setIsScanning] = useState(false)
  const fileInputRef = useRef(null)

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  // Patient
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newDob, setNewDob] = useState('')

  // Visit form
  const [patientHospitalId, setPatientHospitalId] = useState('')
  const [consultationFee, setConsultationFee] = useState('')
  const [visitDate, setVisitDate] = useState(todayStr())
  const [status, setStatus] = useState('seen')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || modalTab !== 'search') {
      setSearchResults([])
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const results = await searchPatients(teamId, searchQuery)
        setSearchResults(results || [])
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery, teamId, modalTab])

  async function handleScanFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanError(null)
    setIsScanning(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result
      const base64 = dataUrl.split(',')[1]
      setScanPreview(dataUrl)
      try {
        const extracted = await extractPatientDataFromTag(base64, hospitals, file.type)
        if (extracted.firstName) setNewFirstName(extracted.firstName)
        if (extracted.lastName) setNewLastName(extracted.lastName)
        if (extracted.dateOfBirth) setNewDob(extracted.dateOfBirth)
        if (extracted.patientHospitalId) setPatientHospitalId(extracted.patientHospitalId)
        setModalTab('new')
      } catch (err) {
        setScanError(err.message)
      } finally {
        setIsScanning(false)
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    try {
      let patient = selectedPatient

      if (!patient && modalTab === 'new') {
        if (!newFirstName.trim() && !newLastName.trim()) {
          setError('Please enter a patient name.')
          setSubmitting(false)
          return
        }
        patient = await createPatient({
          first_name: newFirstName.trim(),
          last_name: newLastName.trim(),
          date_of_birth: newDob || null,
          team_id: teamId,
        })
      }

      if (!patient) {
        setError('Please select or create a patient.')
        setSubmitting(false)
        return
      }

      const visit = await createOutpatientVisit({
        patient_id: patient.id,
        team_id: teamId,
        visit_date: visitDate,
        visit_time: new Date().toISOString(),
        consultation_fee: Number(consultationFee) || 0,
        status,
        notes: notes || null,
        patient_hospital_id: patientHospitalId || null,
      })

      onCreated(visit)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const modalTabs = [
    { key: 'scan', Icon: Camera, label: 'Scan' },
    { key: 'search', Icon: Search, label: 'Search' },
    { key: 'new', Icon: UserPlus, label: 'New Patient' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="glass w-full max-w-md rounded-3xl border border-white/30 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <h2 className="font-bold text-base">New Outpatient Visit</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-5 space-y-4">
          {/* Tab row */}
          <div className="flex glass rounded-2xl p-1 gap-1">
            {modalTabs.map(({ key, Icon, label }) => (
              <button
                key={key}
                onClick={() => setModalTab(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  modalTab === key ? 'bg-ios-blue text-white shadow-ios-card' : 'text-gray-500 hover:bg-black/5'
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>

          {/* Scan tab */}
          {modalTab === 'scan' && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleScanFile}
              />
              {scanPreview ? (
                <img src={scanPreview} alt="Tag preview" className="w-full max-h-48 object-contain rounded-2xl" />
              ) : (
                <div
                  className="flex flex-col items-center justify-center gap-3 py-10 rounded-2xl bg-white/40 border-2 border-dashed border-gray-200 cursor-pointer hover:bg-white/60 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera size={28} className="text-ios-blue" />
                  <p className="text-sm text-gray-500">Tap to scan patient tag</p>
                </div>
              )}
              {isScanning && (
                <p className="text-xs text-center text-ios-gray-1 animate-pulse">Reading tag…</p>
              )}
              {scanError && <p className="text-xs text-red-500 text-center">{scanError}</p>}
              {(scanPreview || scanError) && !isScanning && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full text-sm text-center text-ios-blue font-medium"
                >
                  Scan again
                </button>
              )}
            </div>
          )}

          {/* Search tab */}
          {modalTab === 'search' && (
            <div className="space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="w-full pl-8 pr-3 py-2.5 text-sm rounded-2xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
                  placeholder="Search by name…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
              {searching && <p className="text-xs text-ios-gray-1 text-center py-2">Searching…</p>}
              <div className="space-y-1.5">
                {searchResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPatient(p)}
                    className={`w-full text-left px-3 py-2.5 rounded-2xl text-sm transition-all ${
                      selectedPatient?.id === p.id
                        ? 'bg-ios-blue text-white shadow-ios-card'
                        : 'bg-white/60 hover:bg-white/80'
                    }`}
                  >
                    <p className="font-medium">{p.first_name} {p.last_name}</p>
                    {p.date_of_birth && (
                      <p className={`text-xs mt-0.5 ${selectedPatient?.id === p.id ? 'text-white/70' : 'text-gray-500'}`}>
                        {calcAge(p.date_of_birth)} yrs · {formatDate(p.date_of_birth)}
                      </p>
                    )}
                  </button>
                ))}
              </div>
              {selectedPatient && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-2xl border border-green-100">
                  <span className="text-xs text-green-700 font-medium flex-1">
                    {selectedPatient.first_name} {selectedPatient.last_name} selected
                  </span>
                  <button onClick={() => setSelectedPatient(null)} className="text-green-500 hover:text-green-700">
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* New Patient tab */}
          {modalTab === 'new' && (
            <div className="space-y-2">
              {scanPreview && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-2xl border border-blue-100">
                  <Camera size={13} className="text-ios-blue flex-shrink-0" />
                  <span className="text-xs text-blue-700">Fields pre-filled from tag scan</span>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  className="flex-1 px-3 py-2.5 text-sm rounded-2xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
                  placeholder="First name"
                  value={newFirstName}
                  onChange={e => setNewFirstName(e.target.value)}
                />
                <input
                  className="flex-1 px-3 py-2.5 text-sm rounded-2xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
                  placeholder="Last name"
                  value={newLastName}
                  onChange={e => setNewLastName(e.target.value)}
                />
              </div>
              <input
                className="w-full px-3 py-2.5 text-sm rounded-2xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
                type="date"
                value={newDob}
                onChange={e => setNewDob(e.target.value)}
              />
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-white/40" />

          {/* Common visit fields */}
          <div className="space-y-2">
            <input
              className="w-full px-3 py-2.5 text-sm rounded-2xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
              placeholder="Hospital IP number (optional)"
              value={patientHospitalId}
              onChange={e => setPatientHospitalId(e.target.value)}
            />
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2.5 text-sm rounded-2xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
                type="number"
                placeholder="Consultation fee (KES)"
                value={consultationFee}
                onChange={e => setConsultationFee(e.target.value)}
              />
              <input
                className="flex-1 px-3 py-2.5 text-sm rounded-2xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
                type="date"
                value={visitDate}
                onChange={e => setVisitDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              {['seen', 'pending'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`flex-1 py-2 rounded-2xl text-sm font-medium capitalize transition-all ${
                    status === s
                      ? s === 'seen'
                        ? 'bg-green-500 text-white shadow-sm'
                        : 'bg-amber-500 text-white shadow-sm'
                      : 'bg-white/60 text-gray-500 hover:bg-white/80'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <textarea
              className="w-full px-3 py-2.5 text-sm rounded-2xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30 resize-none"
              rows={2}
              placeholder="Notes (optional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-xs text-red-500 text-center">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 rounded-2xl bg-ios-blue text-white font-semibold text-sm disabled:opacity-50 transition-opacity shadow-ios-card"
          >
            {submitting ? 'Creating…' : 'Create Visit'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Outpatient() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'today'

  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [hospitals, setHospitals] = useState([])

  useEffect(() => {
    if (!user?.team_id) return
    setLoading(true)
    fetchOutpatientVisits(user.team_id)
      .then(setVisits)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user?.team_id])

  useEffect(() => {
    if (!user?.team_id) return
    fetchHospitals(user.team_id).then(setHospitals).catch(console.error)
  }, [user?.team_id])

  const today = todayStr()
  const filteredVisits = tab === 'today'
    ? visits.filter(v => v.visit_date === today)
    : visits

  function handleVisitCreated(visit) {
    setVisits(prev => [visit, ...prev])
    setShowModal(false)
  }

  function handleVisitDeleted(id) {
    setVisits(prev => prev.filter(v => v.id !== id))
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-ios-blue flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">W</span>
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Outpatient</h1>
            {user?.email && <p className="text-xs text-ios-gray-1">{user.email}</p>}
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-ios-blue text-white text-sm font-medium shadow-ios-card"
        >
          <Plus size={15} />
          <span className="hidden sm:inline">New Visit</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="px-5 pb-3">
        <div className="inline-flex glass rounded-2xl p-1 gap-1">
          {[['today', 'Today'], ['all', 'All Visits']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSearchParams({ tab: key })}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${
                tab === key
                  ? 'bg-ios-blue text-white shadow-ios-card'
                  : 'text-gray-600 hover:bg-black/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Visit list */}
      <div className="flex-1 px-4 pb-4 space-y-3">
        {loading ? (
          <p className="text-sm text-ios-gray-1 text-center py-8">Loading…</p>
        ) : filteredVisits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-3xl bg-ios-blue/10 flex items-center justify-center">
              <Stethoscope size={24} className="text-ios-blue" />
            </div>
            <p className="text-sm text-ios-gray-1">
              {tab === 'today' ? 'No visits today' : 'No visits yet'}
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="text-sm font-medium text-ios-blue"
            >
              Record first visit
            </button>
          </div>
        ) : (
          filteredVisits.map(visit => (
            <VisitCard key={visit.id} visit={visit} onDelete={handleVisitDeleted} />
          ))
        )}
      </div>

      {showModal && (
        <NewVisitModal
          teamId={user.team_id}
          hospitals={hospitals}
          onClose={() => setShowModal(false)}
          onCreated={handleVisitCreated}
        />
      )}
    </div>
  )
}
