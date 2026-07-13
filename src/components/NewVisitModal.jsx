import { useState, useEffect } from 'react'
import { X, Search, UserPlus, ScanLine, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import PatientSearch from './PatientSearch'
import { extractPatientDataFromTag, matchHospitalFromScan, fileToScaledBase64 } from '../lib/hospitalTagReader'
import { createOutpatientVisit, createPatient, findPatientByHospitalId, fetchScheduleForDate, ALL_TIME_SLOTS, updatePatientContact, fmtSlot, slotKeyFromVisit } from '../lib/api'
import { sendAppointmentConfirmationSafe } from '../lib/email'
import { logActivity } from '../lib/activityLog'
import { todayStr } from '../lib/utils'
import ModalShell from './ModalShell'
import TagScanDropzone from './TagScanDropzone'
import DoctorPicker from './DoctorPicker'

const TABS = [
  { key: 'scan',   Icon: ScanLine, label: 'Scan Tag' },
  { key: 'search', Icon: Search,   label: 'Search Patient' },
  { key: 'new',    Icon: UserPlus, label: 'New Patient' },
]


export default function NewVisitModal({ open, onClose, hospitals, onVisitCreated, slotDate, slotTime, slotStatus, prefillPatient, visitType, lockedDoctorId = null }) {
  const { user } = useAuth()

  const [tab, setTab] = useState('search')
  const [selectedPatient, setSelectedPatient] = useState(null)

  // Internal date/slot state — used only when slotTime is not pre-selected (prefill flow)
  const [internalDate, setInternalDate] = useState(todayStr())
  const [internalSlot, setInternalSlot] = useState('')
  const [slotSchedule, setSlotSchedule] = useState([])
  const [slotFetching, setSlotFetching] = useState(false)
  const [slotFetchError, setSlotFetchError] = useState(false)

  // On open: prefill patient if provided, reset internal date/slot to current schedule date
  useEffect(() => {
    if (open && prefillPatient) setSelectedPatient(prefillPatient)
    if (open) {
      setInternalDate(slotDate || todayStr())
      setInternalSlot('')
      setSlotSchedule([])
      setTimeSlotOpen(true)
      setHospitalOpen(!!slotTime)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch availability for the chosen date when in picker mode (no pre-selected slotTime)
  function loadSlotSchedule() {
    if (!user?.team_id || !user?.id) return
    setSlotFetching(true)
    setSlotFetchError(false)
    fetchScheduleForDate(user.team_id, user.id, internalDate)
      .then(data => setSlotSchedule(data || []))
      .catch(err => { console.error(err); setSlotFetchError(true) })
      .finally(() => setSlotFetching(false))
  }

  useEffect(() => {
    if (!open || slotTime || !user?.team_id || !user?.id) return
    setInternalSlot('')
    setTimeSlotOpen(true)
    loadSlotSchedule()
  }, [open, internalDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const busySlots = new Set(slotSchedule.map(slotKeyFromVisit).filter(Boolean))
  const availableSlots = ALL_TIME_SLOTS.filter(s => !busySlots.has(s))

  const [hospitalId, setHospitalId] = useState('')
  const [doctorId, setDoctorId] = useState('')
  useEffect(() => { if (open && lockedDoctorId) setDoctorId(lockedDoctorId) }, [open, lockedDoctorId])
  const [scannedHospitalId, setScannedHospitalId] = useState(null)

  // Sequential accordion: Time Slot auto-expands once a date is set (always true — date defaults
  // to today), collapses once a slot is chosen; Hospital stays collapsed until a slot is chosen
  // (or immediately, if slotTime already arrived pre-selected via props).
  const [timeSlotOpen, setTimeSlotOpen] = useState(true)
  const [hospitalOpen, setHospitalOpen] = useState(() => !!slotTime)

  // New patient form
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [dob, setDob]             = useState('')
  const [newPatientPhone, setNewPatientPhone] = useState('')
  const [newPatientEmail, setNewPatientEmail] = useState('')

  const [bookingPhone, setBookingPhone] = useState('')
  const [bookingEmail, setBookingEmail] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  const [scanPreview, setScanPreview] = useState(null)
  const [isScanning, setIsScanning]   = useState(false)
  const [scanError, setScanError]     = useState(null)

  function reset() {
    setTab('search')
    setSelectedPatient(null)
    setHospitalId('')
    setDoctorId('')
    setScannedHospitalId(null)
    setFirstName('')
    setLastName('')
    setDob('')
    setNewPatientPhone('')
    setNewPatientEmail('')
    setBookingPhone('')
    setBookingEmail('')
    setError(null)
    setInternalSlot('')
    setScanPreview(null)
    setIsScanning(false)
    setScanError(null)
    setTimeSlotOpen(true)
    setHospitalOpen(!!slotTime)
  }

  function handleClose() {
    reset()
    onClose()
  }

  // Build a draft patient locally — no DB write until Log Visit
  function handleScanExtract(result) {
    setError(null)
    setScannedHospitalId(result.patientHospitalId || null)
    setSelectedPatient({
      first_name:    result.firstName?.trim()  || null,
      last_name:     result.lastName?.trim()   || null,
      date_of_birth: result.dateOfBirth        || null,
    })
    const { hospital } = matchHospitalFromScan(result, hospitals)
    if (hospital) setHospitalId(hospital.id)
  }

  async function handleScanFile(file) {
    if (!file) return
    setScanError(null)
    setScanPreview(URL.createObjectURL(file))
    setIsScanning(true)
    try {
      const { base64, mediaType } = await fileToScaledBase64(file)
      const extracted = await extractPatientDataFromTag(base64, hospitals, mediaType)
      handleScanExtract(extracted)
      setScanPreview(null)
    } catch (err) {
      setScanError(err.message || 'Could not read tag — try a clearer photo.')
    } finally {
      setIsScanning(false)
    }
  }

  // Validate and build a draft — no DB write until Log Visit
  function handleCreatePatient() {
    if (!firstName.trim() && !lastName.trim()) {
      setError('Enter at least a first or last name.')
      return
    }
    setError(null)
    setSelectedPatient({
      first_name:    firstName.trim() || null,
      last_name:     lastName.trim()  || null,
      date_of_birth: dob             || null,
    })
  }

  // Single DB write path: create patient if draft, then log the visit
  async function handleLogVisit() {
    if (!selectedPatient || !hospitalId) {
      setError('Select a hospital to continue.')
      return
    }
    const effectiveSlot = slotTime || internalSlot
    if (!effectiveSlot) {
      setError('Select a time slot to continue.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      let patientId = selectedPatient.id
      if (!patientId) {
        let existing = null
        if (scannedHospitalId) existing = await findPatientByHospitalId(user.team_id, scannedHospitalId)
        if (existing) {
          patientId = existing.id
        } else {
          const p = await createPatient({
            first_name:    selectedPatient.first_name    || null,
            last_name:     selectedPatient.last_name     || null,
            date_of_birth: selectedPatient.date_of_birth || null,
            phone:         newPatientPhone || null,
            email:         newPatientEmail || null,
            team_id:       user.team_id,
          })
          patientId = p.id
        }
      }
      const effectiveDate = slotTime ? (slotDate || todayStr()) : internalDate
      const visitDate = effectiveDate
      const visitTime = new Date(`${effectiveDate}T${effectiveSlot}:00`).toISOString()
      const visit = await createOutpatientVisit({
        patient_id:          patientId,
        hospital_id:         hospitalId,
        team_id:             user.team_id,
        visit_date:          visitDate,
        visit_time:          visitTime,
        status:              slotStatus || 'seen',
        created_by_user_id:  user.id,
        doctor_id:           doctorId,
        patient_hospital_id: scannedHospitalId || selectedPatient.patient_hospital_id || null,
      })
      if (selectedPatient.id && (bookingPhone.trim() || bookingEmail.trim())) {
        const contact = {}
        if (bookingPhone.trim()) contact.phone = bookingPhone.trim()
        if (bookingEmail.trim()) contact.email = bookingEmail.trim()
        await updatePatientContact(selectedPatient.id, contact)
      }

      // Fire-and-forget appointment confirmation email (no-op if no email on file
      // or Resend isn't configured yet). Never blocks the booking.
      sendAppointmentConfirmationSafe({
        to: (selectedPatient?.email || newPatientEmail || bookingEmail || '').trim(),
        patientName,
        dateStr: effectiveDate,
        timeLabel: fmtSlot(effectiveSlot),
        hospitalName: hospitals.find(h => h.id === hospitalId)?.name,
      })
      await logActivity({
        user, action: 'log_visit', entityType: 'visit', entityId: visit?.id,
        patientId, patientName,
      })
      onVisitCreated?.(visit)
      handleClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const patientName = selectedPatient
    ? `${selectedPatient.first_name || ''} ${selectedPatient.last_name || ''}`.trim() || 'Unknown'
    : null

  const effectiveSlot = slotTime || internalSlot
  const canBook = !!hospitalId && !!effectiveSlot && !!doctorId && !loading

  return (
    <ModalShell onClose={handleClose}>
      <div className="glass-rim w-full max-w-lg rounded-3xl p-2.5 max-h-[85vh] flex flex-col">
        <div className="surface-shell flex-1 min-h-0">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0">
          <h2 className="font-bold text-base">
            {selectedPatient
              ? (slotTime ? 'Select Hospital' : 'Book Appointment')
              : slotDate && slotTime
                ? `Book ${slotTime} Slot`
                : 'New Outpatient Visit'}
          </h2>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-6 space-y-4">

          {/* ── Step 1: pick patient ── */}
          {!selectedPatient && (
            <>
              {/* Tab pills */}
              <div className="flex glass rounded-2xl p-1 gap-1">
                {TABS.map(({ key, Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => { setTab(key); setError(null) }}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      tab === key
                        ? 'bg-ios-blue text-white shadow-ios-card'
                        : 'text-gray-500 hover:bg-black/5'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>

              {/* Scan tab */}
              {tab === 'scan' && (
                <TagScanDropzone
                  onFile={handleScanFile}
                  isScanning={isScanning}
                  preview={scanPreview}
                  error={scanError}
                  onClear={() => { setScanPreview(null); setScanError(null) }}
                />
              )}
              {tab === 'scan' && error && (
                <p className="text-xs text-red-500">{error}</p>
              )}

              {/* Search tab */}
              {tab === 'search' && (
                <PatientSearch
                  teamId={user.team_id}
                  onSelect={p => { setSelectedPatient(p); setError(null) }}
                />
              )}

              {/* New patient tab */}
              {tab === 'new' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      className="flex-1 ios-input text-sm"
                      placeholder="First name"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreatePatient()}
                    />
                    <input
                      className="flex-1 ios-input text-sm"
                      placeholder="Last name"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreatePatient()}
                    />
                  </div>
                  <input
                    type="date"
                    className="w-full ios-input text-sm"
                    value={dob}
                    onChange={e => setDob(e.target.value)}
                  />
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Mobile Number <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 0712 345 678"
                      value={newPatientPhone}
                      onChange={e => setNewPatientPhone(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white/80 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Email <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. patient@email.com"
                      value={newPatientEmail}
                      onChange={e => setNewPatientEmail(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white/80 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                    />
                  </div>
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <button
                    onClick={handleCreatePatient}
                    className="w-full py-3 rounded-2xl bg-ios-blue text-white font-semibold text-sm shadow-ios-card"
                  >
                    Continue
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── Step 2: date/slot (if no pre-selected slot) + hospital ── */}
          {selectedPatient && (
            <>
              {/* Patient chip */}
              <div className="flex items-center gap-3 px-4 py-3 bg-green-50 rounded-2xl border border-green-100">
                <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center font-bold text-sm text-green-700 flex-shrink-0">
                  {selectedPatient.first_name?.[0] || '?'}{selectedPatient.last_name?.[0] || ''}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900">{patientName}</p>
                  {selectedPatient.date_of_birth && (
                    <p className="text-xs text-gray-500">DOB: {selectedPatient.date_of_birth}</p>
                  )}
                  {scannedHospitalId && (
                    <p className="text-xs text-ios-blue font-medium">ID: {scannedHospitalId}</p>
                  )}
                </div>
                <button
                  onClick={() => { setSelectedPatient(null); setHospitalId(''); setDoctorId(''); setScannedHospitalId(null); setInternalSlot(''); setError(null); setTimeSlotOpen(true); setHospitalOpen(!!slotTime) }}
                  className="text-green-400 hover:text-green-600 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Date + time slot pickers — only shown when no slot was pre-selected */}
              {!slotTime && (
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1 mb-1.5">Date</p>
                    <input
                      type="date"
                      value={internalDate}
                      onChange={e => setInternalDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
                    />
                  </div>

                  {/* Time Slot — auto-expands once a date is set, collapses to a summary once chosen */}
                  <div className="rounded-2xl border border-gray-200 bg-white/70 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setTimeSlotOpen(o => !o)}
                      className="w-full flex items-center justify-between px-3.5 py-3"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1">Time Slot</span>
                      <span className="flex items-center gap-1.5">
                        <span className={`text-sm font-medium ${internalSlot ? 'text-gray-800' : 'text-gray-400'}`}>
                          {internalSlot ? fmtSlot(internalSlot) : 'Select a time'}
                        </span>
                        {timeSlotOpen
                          ? <ChevronUp size={14} className="text-gray-400" />
                          : <ChevronDown size={14} className="text-gray-400" />}
                      </span>
                    </button>
                    {timeSlotOpen && (
                      <div className="px-3.5 pb-3.5">
                        {slotFetching ? (
                          <div className="flex items-center gap-2 py-2">
                            <div className="w-3 h-3 border-2 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin" />
                            <span className="text-xs text-gray-400">Loading slots…</span>
                          </div>
                        ) : slotFetchError ? (
                          <div className="py-2">
                            <p className="text-xs text-red-500 mb-1.5">
                              Couldn't check existing bookings — showing slots here could double-book a patient.
                            </p>
                            <button
                              type="button"
                              onClick={loadSlotSchedule}
                              className="text-xs font-semibold text-ios-blue underline"
                            >
                              Retry
                            </button>
                          </div>
                        ) : availableSlots.length === 0 ? (
                          <p className="text-xs text-gray-400 py-2">No available slots on this date.</p>
                        ) : (
                          <div className="grid grid-cols-4 gap-1.5">
                            {availableSlots.map(s => (
                              <button
                                key={s}
                                onClick={() => { setInternalSlot(s); setTimeSlotOpen(false); setHospitalOpen(true) }}
                                className={`py-2 rounded-xl text-xs font-medium transition-all ${
                                  internalSlot === s
                                    ? 'bg-ios-blue text-white shadow-ios-card'
                                    : 'bg-white/80 border border-gray-200 text-gray-700 hover:border-ios-blue/50'
                                }`}
                              >
                                {fmtSlot(s)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Hospital picker — auto-expands once a slot is set, collapses to a summary once chosen */}
              <div className="rounded-2xl border border-gray-200 bg-white/70 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setHospitalOpen(o => !o)}
                  className="w-full flex items-center justify-between px-3.5 py-3"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1">Hospital</span>
                  <span className="flex items-center gap-1.5">
                    {hospitalId ? (
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: hospitals.find(h => h.id === hospitalId)?.color || '#3B82F6' }}
                        />
                        <span className="text-sm font-medium text-gray-800">
                          {hospitals.find(h => h.id === hospitalId)?.name}
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-gray-400">Select a hospital</span>
                    )}
                    {hospitalOpen
                      ? <ChevronUp size={14} className="text-gray-400" />
                      : <ChevronDown size={14} className="text-gray-400" />}
                  </span>
                </button>
                {hospitalOpen && (
                <div className="px-3.5 pb-3.5">
                {hospitals.length === 0 ? (
                  <p className="text-sm text-ios-gray-1 text-center py-4">No hospitals configured</p>
                ) : (
                  <div className="space-y-2">
                    {hospitals.map(h => {
                      const isSelected = hospitalId === h.id
                      const color = h.color || '#3B82F6'
                      return (
                        <button
                          key={h.id}
                          onClick={() => { setHospitalId(h.id); setError(null); setHospitalOpen(false) }}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left"
                          style={{
                            borderColor: isSelected ? color : 'rgba(0,0,0,0.08)',
                            backgroundColor: isSelected ? color + '18' : 'rgba(255,255,255,0.5)',
                          }}
                        >
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                          <span className="font-medium text-sm text-gray-800 flex-1">{h.name}</span>
                          {h.location && <span className="text-xs text-gray-400">{h.location}</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
                </div>
                )}
              </div>

              <div className="mt-1">
                <DoctorPicker teamId={user.team_id} value={doctorId} onChange={setDoctorId} locked={!!lockedDoctorId} label={lockedDoctorId ? 'Booked with' : 'Seen by'} />
              </div>

              {selectedPatient.id && !selectedPatient.phone && (
                <div className="mt-3 p-3 rounded-2xl bg-blue-50/80 border border-blue-100">
                  <p className="text-xs font-medium text-blue-700 mb-2">
                    📱 Add mobile for SMS reminders? <span className="font-normal text-blue-400">(optional)</span>
                  </p>
                  <input
                    type="tel"
                    placeholder="e.g. 0712 345 678"
                    value={bookingPhone}
                    onChange={e => setBookingPhone(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-xl border border-blue-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                  />
                  <p className="text-[10px] text-blue-400 mt-1">Skip to book without — you can add it later from the Patients list.</p>
                </div>
              )}
              {selectedPatient.id && selectedPatient.phone && (
                <div className="mt-3 p-3 rounded-2xl bg-white/80 border border-gray-100">
                  <p className="text-xs text-gray-500">
                    📱 SMS reminders will be sent to <span className="font-semibold text-gray-700">{selectedPatient.phone}</span>
                  </p>
                </div>
              )}

              {selectedPatient.id && !selectedPatient.email && (
                <div className="mt-3 p-3 rounded-2xl bg-blue-50/80 border border-blue-100">
                  <p className="text-xs font-medium text-blue-700 mb-2">
                    📧 Add email for reminders? <span className="font-normal text-blue-400">(optional)</span>
                  </p>
                  <input
                    type="email"
                    placeholder="e.g. patient@email.com"
                    value={bookingEmail}
                    onChange={e => setBookingEmail(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-xl border border-blue-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                  />
                  <p className="text-[10px] text-blue-400 mt-1">Skip to book without — you can add it later from the Patients list.</p>
                </div>
              )}
              {selectedPatient.id && selectedPatient.email && (
                <div className="mt-3 p-3 rounded-2xl bg-white/80 border border-gray-100">
                  <p className="text-xs text-gray-500">
                    📧 Email reminders will be sent to <span className="font-semibold text-gray-700">{selectedPatient.email}</span>
                  </p>
                </div>
              )}

              {error && <p className="text-xs text-red-500">{error}</p>}
            </>
          )}
        </div>

        {/* Footer — pinned below the scrollable body so the actions stay reachable without scrolling */}
        <div className="flex gap-2 px-5 py-3 border-t border-white/60 flex-shrink-0">
          {!selectedPatient ? (
            <>
              <button
                onClick={reset}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#007AFF] text-white hover:bg-[#0066CC] transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setSelectedPatient(null); setHospitalId(''); setDoctorId(''); setScannedHospitalId(null); setInternalSlot(''); setError(null); setTimeSlotOpen(true); setHospitalOpen(!!slotTime) }}
                className="flex-1 py-2.5 rounded-2xl text-sm font-semibold bg-black/[0.06] text-gray-700 hover:bg-black/10 transition-colors"
              >
                Back
              </button>
              <button
                onClick={reset}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[#007AFF] text-white hover:bg-[#0066CC] transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleLogVisit}
                disabled={!canBook}
                className="flex-1 py-2.5 rounded-2xl text-sm font-semibold bg-ios-blue text-white disabled:opacity-50 transition-opacity shadow-ios-card"
              >
                {loading
                  ? (slotStatus === 'scheduled' ? 'Booking…' : 'Logging…')
                  : (slotStatus === 'scheduled' ? 'Book' : 'Log Visit')}
              </button>
            </>
          )}
        </div>
        </div>
      </div>
    </ModalShell>
  )
}
