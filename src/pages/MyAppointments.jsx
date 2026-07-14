import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Lock, X, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  fetchScheduleForDate, blockSlot, blockSlotRange, unblockSlot,
  cancelVisit, rescheduleVisit, fetchHospitals, checkInVisit,
  fetchAdhocBookings, createAdhocBooking, deleteAdhocBooking, ALL_TIME_SLOTS,
  updatePatientContact, fetchMembersWithPositions, fmtSlot, slotKeyFromVisit,
} from '../lib/api'
import { extractPatientDataFromTag, matchHospitalFromScan, fileToScaledBase64 } from '../lib/hospitalTagReader'
import { GLASS_CARD } from '../lib/theme'
import { todayStr } from '../lib/utils'
import TopHeader from '../components/TopHeader'
import NewVisitModal from '../components/NewVisitModal'
import ReminderComposeModal from '../components/ReminderComposeModal'
import ModalShell from '../components/ModalShell'
import TagScanDropzone from '../components/TagScanDropzone'
import DoctorPicker from '../components/DoctorPicker'
import PatientSearch from '../components/PatientSearch'
import Toast from '../components/Toast'

// ─── helpers ──────────────────────────────────────────────────────────────────


// ─── Block Range Modal (single-day OR multi-day) ────────────────────────────

function BlockRangeModal({ onClose, onBlocked }) {
  const [fromDate, setFromDate] = useState(todayStr())
  const [fromSlot, setFromSlot] = useState('08:00')
  const [toDate, setToDate]     = useState(todayStr())
  const [toSlot, setToSlot]     = useState('17:00')
  const [reason, setReason]     = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState(null)

  // Build all (date, time) pairs in the range
  function buildSlotPairs() {
    const pairs = []
    // iterate dates fromDate → toDate
    const start = new Date(fromDate + 'T12:00:00')
    const end   = new Date(toDate   + 'T12:00:00')
    if (end < start) return pairs

    const cur = new Date(start)
    while (cur <= end) {
      const dateStr = cur.toISOString().split('T')[0]
      const isFirst = dateStr === fromDate
      const isLast  = dateStr === toDate
      for (const slot of ALL_TIME_SLOTS) {
        if (isFirst && slot < fromSlot) continue
        if (isLast  && slot > toSlot)   continue
        pairs.push({ date: dateStr, time: slot })
      }
      cur.setDate(cur.getDate() + 1)
    }
    return pairs
  }

  const pairs = buildSlotPairs()
  const dayCount = pairs.length > 0
    ? new Set(pairs.map(p => p.date)).size
    : 0

  async function handleBlock() {
    if (pairs.length === 0) { setError('End must be after start.'); return }
    setError(null)
    setSubmitting(true)
    try {
      await onBlocked(pairs, reason)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const multiDay = fromDate !== toDate

  return (
    <ModalShell onClose={onClose}>
      <div className="glass-rim w-full max-w-sm rounded-3xl p-2.5">
        <div className="surface-shell">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="font-bold text-base text-gray-900">Block Availability</h2>
            <p className="text-xs text-gray-500">Single day or multi-day range</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="px-5 pb-5 space-y-4">

          {/* FROM row */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ios-gray-1 mb-1.5">From</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={fromDate}
                onChange={e => {
                  setFromDate(e.target.value)
                  if (e.target.value > toDate) setToDate(e.target.value)
                }}
                className="flex-1 px-3 py-2 text-sm rounded-xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
              />
              <select value={fromSlot} onChange={e => setFromSlot(e.target.value)} className="px-2 py-2 text-sm rounded-xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30">
                {ALL_TIME_SLOTS.map(s => <option key={s} value={s}>{fmtSlot(s)}</option>)}
              </select>
            </div>
          </div>

          {/* TO row */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ios-gray-1 mb-1.5">To</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={e => setToDate(e.target.value)}
                className="flex-1 px-3 py-2 text-sm rounded-xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
              />
              <select value={toSlot} onChange={e => setToSlot(e.target.value)} className="px-2 py-2 text-sm rounded-xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30">
                {ALL_TIME_SLOTS.map(s => <option key={s} value={s}>{fmtSlot(s)}</option>)}
              </select>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ios-gray-1 mb-1.5">Reason</label>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Theatre list, Annual leave, Meeting…"
              className="w-full px-3 py-2 text-sm rounded-xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
            />
          </div>

          {/* Summary */}
          {pairs.length > 0 && (
            <p className="text-xs text-gray-500">
              {pairs.length} slot{pairs.length !== 1 ? 's' : ''} across {dayCount} day{dayCount !== 1 ? 's' : ''} will be blocked.
              {multiDay && <span className="text-red-500 font-medium"> (Multi-day)</span>}
            </p>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-2xl text-sm font-semibold bg-black/[0.06] text-gray-700 hover:bg-black/10 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleBlock}
              disabled={submitting || pairs.length === 0}
              className="flex-1 py-2.5 rounded-2xl text-sm font-semibold bg-red-500 text-white disabled:opacity-40 transition-opacity"
            >
              {submitting ? 'Blocking…' : `Block ${pairs.length} slot${pairs.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
        </div>
      </div>
    </ModalShell>
  )
}

// ─── Booked Slot Popover ──────────────────────────────────────────────────────

function BookedSlotModal({ visit, onClose, onCancelBooking, onChangeBooking, onCheckIn, onSendReminder }) {
  const [checkInError, setCheckInError] = useState(null)
  const [checkingIn, setCheckingIn] = useState(false)
  const [doctorId, setDoctorId] = useState('')
  const patient = visit.patients
  const name = patient ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() : 'Unknown'

  async function handleCheckIn() {
    setCheckInError(null)
    setCheckingIn(true)
    try {
      await onCheckIn(visit, doctorId)
    } catch (err) {
      setCheckInError(err.message)
    } finally {
      setCheckingIn(false)
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="glass-rim w-full max-w-sm rounded-3xl p-2.5">
        <div className="surface-shell">
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <div>
            <h2 className="font-bold text-base text-gray-900">{name}</h2>
            <p className="text-xs text-gray-500">
              {fmtSlot(slotKeyFromVisit(visit))}{visit.hospitals?.name ? ` · ${visit.hospitals.name}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="px-5 pb-5 pt-2 space-y-2">
          <DoctorPicker teamId={visit.team_id} value={doctorId} onChange={setDoctorId} />
          <button
            onClick={handleCheckIn}
            disabled={checkingIn || !doctorId}
            className="w-full py-2.5 rounded-2xl text-sm font-semibold bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            {checkingIn ? 'Checking in…' : 'Check In'}
          </button>
          {checkInError && <p className="text-xs text-red-500">{checkInError}</p>}
          <button
            onClick={() => onChangeBooking(visit)}
            className="w-full py-2.5 rounded-2xl text-sm font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
          >
            Change Booking
          </button>
          <button
            onClick={() => onSendReminder(visit)}
            className="w-full py-2.5 rounded-2xl text-sm font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
          >
            Send Reminder
          </button>
          <button
            onClick={() => onCancelBooking(visit)}
            className="w-full py-2.5 rounded-2xl text-sm font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
          >
            Cancel Booking
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl text-sm font-semibold bg-black/[0.06] text-gray-700 hover:bg-black/10 transition-colors"
          >
            Exit
          </button>
        </div>
        </div>
      </div>
    </ModalShell>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyAppointments() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [date, setDate] = useState(todayStr())
  const [doctors, setDoctors] = useState([])
  const [selectedDoctorId, setSelectedDoctorId] = useState(null)
  const [toast, setToast] = useState(null)
  function showToast(message, type = 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    if (!user?.team_id) return
    fetchMembersWithPositions(user.team_id)
      .then(members => {
        const clinical = (members || []).filter(m => m.is_clinical === true)
        // Fallback for a practice with nobody marked clinical (e.g. a fresh solo
        // admin whose position isn't set yet): let the current user act as the
        // doctor so the schedule is usable instead of hanging with no selection.
        const docs = clinical.length > 0
          ? clinical
          : (members || []).filter(m => m.id === user.id)
        setDoctors(docs)
        setSelectedDoctorId(prev => prev || (docs.some(d => d.id === user.id) ? user.id : (docs[0]?.id ?? null)))
      })
      .catch(() => setDoctors([]))
  }, [user?.team_id, user?.id])
  const [schedule, setSchedule] = useState([])
  const [hospitals, setHospitals] = useState([])
  const [loading, setLoading] = useState(true)
  const [prefillPatient, setPrefillPatient] = useState(null)
  const [pendingPrefillOpen, setPendingPrefillOpen] = useState(false)

  // Modals / interaction state
  const [blockMode, setBlockMode] = useState(false)        // single-slot block toggle
  const [showRangeModal, setShowRangeModal] = useState(false)
  const [bookingSlot, setBookingSlot] = useState(null)     // { time, status } for NewVisitModal
  const [bookedSlotVisit, setBookedSlotVisit] = useState(null)
  const [reminderVisit, setReminderVisit] = useState(null)
  const [blockReasonSlot, setBlockReasonSlot] = useState(null) // slot pending a reason
  const [blockReason, setBlockReason] = useState('')
  const [adhocBookings, setAdhocBookings] = useState([])

  // Inline adhoc booking form
  const [showAdhocForm, setShowAdhocForm] = useState(false)
  const [showAdhocScan, setShowAdhocScan] = useState(false)
  const [adhocScanPreview, setAdhocScanPreview] = useState(null)
  const [adhocIsScanning, setAdhocIsScanning]   = useState(false)
  const [adhocScanError, setAdhocScanError]     = useState(null)
  const [adhocFormPatient, setAdhocFormPatient] = useState(null)
  const [adhocFormHospital, setAdhocFormHospital] = useState(null)
  const [adhocFormTime, setAdhocFormTime] = useState('')
  const [adhocFormDate, setAdhocFormDate] = useState(todayStr())
  const [adhocFormNote, setAdhocFormNote] = useState('')
  const [adhocFormSaving, setAdhocFormSaving] = useState(false)
  const [bookingPhone, setBookingPhone] = useState('')

  useEffect(() => {
    if (!user?.team_id) return
    fetchHospitals(user.team_id).then(h => setHospitals(h || [])).catch(err => { console.error(err); showToast('Failed to load hospitals.') })
  }, [user?.team_id])

  useEffect(() => {
    const p = location.state?.prefillPatient
    if (p) {
      setPrefillPatient(p)
      setPendingPrefillOpen(true)
      window.history.replaceState({}, '')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadSchedule = useCallback(async () => {
    if (!user?.team_id) return
    // No doctor selected yet (e.g. a practice with nobody marked clinical): don't
    // leave the spinner running forever — clear it and show the empty schedule.
    if (!selectedDoctorId) { setSchedule([]); setLoading(false); return }
    setLoading(true)
    try {
      const data = await fetchScheduleForDate(user.team_id, selectedDoctorId, date)
      setSchedule(data)
      fetchAdhocBookings(user.team_id, date, selectedDoctorId).then(setAdhocBookings).catch(() => setAdhocBookings([]))
    } catch (err) {
      console.error(err)
      showToast('Failed to load the schedule — please try again.')
    } finally {
      setLoading(false)
    }
  }, [user?.team_id, selectedDoctorId, date])

  useEffect(() => { loadSchedule() }, [loadSchedule])

  useEffect(() => { setAdhocFormDate(date) }, [date])

  // When a prefill patient arrived via location state, open the booking modal once the
  // schedule finishes loading. Date + slot selection happens inside the modal.
  useEffect(() => {
    if (!loading && pendingPrefillOpen) {
      setPendingPrefillOpen(false)
      setBookingSlot({ time: null, status: 'scheduled' })
    }
  }, [loading, pendingPrefillOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Map slot time → visit/block row
  const slotMap = {}
  for (const v of schedule) {
    const key = slotKeyFromVisit(v)
    if (key) slotMap[key] = v
  }

  const bookedCount  = schedule.filter(v => v.status !== 'blocked').length
  const blockedCount = schedule.filter(v => v.status === 'blocked').length
  const availableCount = ALL_TIME_SLOTS.length - schedule.length

  function prevDay() {
    const d = new Date(date); d.setDate(d.getDate() - 1)
    setDate(d.toISOString().split('T')[0])
  }
  function nextDay() {
    const d = new Date(date); d.setDate(d.getDate() + 1)
    setDate(d.toISOString().split('T')[0])
  }

  const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  async function handleSlotClick(slot) {
    const existing = slotMap[slot]

    // Block mode: clicking an empty slot prompts for a reason
    if (blockMode && !existing) {
      setBlockReasonSlot(slot)
      setBlockReason('')
      return
    }

    if (!existing) {
      // Empty slot → open New Visit modal prefilled to this slot, status scheduled
      setBookingSlot({ time: slot, status: 'scheduled' })
      return
    }

    if (existing.status === 'blocked') {
      // Unblock on click
      await unblockSlot(existing.id)
      loadSchedule()
      return
    }

    // Booked slot → options popover
    setBookedSlotVisit(existing)
  }

  async function confirmBlockReason() {
    try {
      await blockSlot(user.team_id, user.id, date, blockReasonSlot, blockReason || 'Blocked', selectedDoctorId)
      setBlockReasonSlot(null)
      setBlockReason('')
      loadSchedule()
    } catch (err) {
      console.error(err)
      showToast('Failed to block the slot — please try again.')
    }
  }

  async function handleCheckIn(visit, doctorId) {
    await checkInVisit(visit.id, doctorId)
    setBookedSlotVisit(null)
    navigate('/outpatient')
  }

  async function handleCancelBooking(visit) {
    await cancelVisit(visit.id)
    setBookedSlotVisit(null)
    loadSchedule()
  }

  function handleChangeBooking(visit) {
    // Free the current slot, then reopen the booking flow for a new slot
    setBookedSlotVisit(null)
    setRescheduling(visit)
  }

  // Reschedule: pick a new empty slot, then move the visit there
  const [rescheduling, setRescheduling] = useState(null)
  async function handleRescheduleToSlot(slot) {
    if (!rescheduling) return
    try {
      await rescheduleVisit(rescheduling.id, date, slot)
      setRescheduling(null)
      loadSchedule()
    } catch (err) {
      console.error(err)
      showToast('Failed to reschedule the visit — please try again.')
    }
  }

  async function handleAdhocScanFile(file) {
    if (!file) return
    setAdhocScanError(null)
    setAdhocScanPreview(URL.createObjectURL(file))
    setAdhocIsScanning(true)
    try {
      const { base64, mediaType } = await fileToScaledBase64(file)
      const extracted = await extractPatientDataFromTag(base64, hospitals, mediaType)
      const { hospital: matchedHospital } = matchHospitalFromScan(extracted, hospitals)
      if (matchedHospital) setAdhocFormHospital(matchedHospital)
      setShowAdhocScan(false)
      setAdhocScanPreview(null)
      setAdhocScanError(null)
    } catch (err) {
      setAdhocScanError(err.message || 'Could not read tag — try a clearer photo.')
    } finally {
      setAdhocIsScanning(false)
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopHeader title="Appointments" />
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="p-4 space-y-4 pb-24 sm:pb-4">
        {/* Action row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-gray-900 whitespace-nowrap">Appointments</h1>
            {blockMode
              ? <p className="text-sm text-red-500 font-medium">Tap empty slots to block</p>
              : <p className="text-sm text-gray-500">{user?.full_name}</p>
            }
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setBlockMode(m => !m); setRescheduling(null) }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-sm font-semibold transition-colors ${
                blockMode ? 'bg-red-500 text-white' : 'bg-red-50 text-red-500 hover:bg-red-100'
              }`}
            >
              <Lock size={14} />
              {blockMode ? 'Done Blocking' : 'Block Availability'}
            </button>
            <button
              onClick={() => setShowRangeModal(true)}
              className="px-3 py-2 rounded-2xl text-sm font-semibold bg-black/[0.06] text-gray-700 hover:bg-black/10 transition-colors"
            >
              Block Range
            </button>
          </div>
        </div>

        {/* Reschedule banner */}
        {rescheduling && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-blue-50 border border-blue-100">
            <span className="text-xs text-blue-700 font-medium">
              Pick a new slot for {rescheduling.patients?.first_name} {rescheduling.patients?.last_name}
            </span>
            <button onClick={() => setRescheduling(null)} className="text-xs font-semibold text-blue-500">Cancel</button>
          </div>
        )}

        {/* Doctor selector */}
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1 mb-2">Doctor</p>
            <div className="flex flex-wrap gap-2">
              {doctors.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDoctorId(d.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${selectedDoctorId === d.id ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:text-gray-700'}`}
                  style={selectedDoctorId === d.id ? { backgroundColor: '#007AFF' } : undefined}
                >
                  {d.full_name}
                </button>
              ))}
            </div>
          </div>

        {/* Date picker */}
        <div className="border border-gray-200 rounded-2xl bg-white/70 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1 mb-2">Date</p>
          <div className="flex items-center gap-2">
            <button onClick={prevDay} className="w-8 h-8 rounded-xl bg-black/[0.06] flex items-center justify-center hover:bg-black/10 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="flex-1 px-3 py-2 text-sm rounded-xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
            />
            <button onClick={nextDay} className="w-8 h-8 rounded-xl bg-black/[0.06] flex items-center justify-center hover:bg-black/10 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
        </div>

        {/* Schedule grid */}
        <div className="border border-gray-200 rounded-2xl bg-white/70 p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-800">{formattedDate}</p>
            {!loading && (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[11px] text-green-600">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />{availableCount} available
                </span>
                <span className="flex items-center gap-1 text-[11px] text-blue-500">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />{bookedCount} booked
                </span>
                {blockedCount > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-red-500">
                    <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{blockedCount} blocked
                  </span>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2">
              <div className="w-4 h-4 border-2 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin" />
              <span className="text-xs text-gray-400">Loading schedule…</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {ALL_TIME_SLOTS.map(slot => {
                const v = slotMap[slot]
                const isBlocked = v?.status === 'blocked'
                const isBooked  = v && !isBlocked
                const patientName = isBooked
                  ? `${v.patients?.first_name || ''} ${v.patients?.last_name || ''}`.trim() || 'Patient'
                  : null
                const isRescheduleTarget = rescheduling && !v

                return (
                  <button
                    key={slot}
                    onClick={() => isRescheduleTarget ? handleRescheduleToSlot(slot) : handleSlotClick(slot)}
                    className={`rounded-2xl px-3 py-3 text-left transition-all border min-h-[64px] ${
                      isBlocked
                        ? 'bg-red-50 border-red-100 hover:bg-red-100'
                        : isBooked
                          ? 'bg-blue-50 border-blue-100 hover:bg-blue-100'
                          : isRescheduleTarget
                            ? 'bg-blue-50 border-blue-300 border-dashed hover:bg-blue-100 ring-2 ring-blue-200'
                            : blockMode
                              ? 'bg-green-50 border-green-100 hover:bg-red-50 hover:border-red-200'
                              : 'bg-green-50 border-green-100 hover:bg-green-100'
                    }`}
                  >
                    <p className={`text-xs font-bold leading-tight ${
                      isBlocked ? 'text-red-600' : isBooked ? 'text-blue-700' : 'text-green-700'
                    }`}>
                      {fmtSlot(slot)}
                    </p>
                    <p className={`text-[10px] mt-0.5 truncate ${
                      isBlocked ? 'text-red-400' : isBooked ? 'text-blue-500' : 'text-green-500'
                    }`}>
                      {isBlocked ? (v.notes || 'Blocked') : isBooked ? patientName : 'Available'}
                    </p>
                  </button>
                )
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 justify-center pt-4 mt-2 border-t border-black/[0.05]">
            {[
              { color: 'bg-green-400', label: 'Available' },
              { color: 'bg-blue-400', label: 'Booked' },
              { color: 'bg-red-400', label: 'Blocked' },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1 text-[10px] text-gray-400">
                <span className={`w-2 h-2 rounded-full ${color}`} />{label}
              </span>
            ))}
          </div>
        </div>

        {/* Other Bookings */}
        <div className={`${GLASS_CARD} p-4 shadow-sm`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Other Bookings</p>
              <p className="text-xs text-gray-400">{adhocBookings.length} booking{adhocBookings.length !== 1 ? 's' : ''}</p>
            </div>
            {!showAdhocForm && (
              <button
                onClick={() => setShowAdhocForm(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#007AFF] text-white hover:bg-[#0063cc] transition-colors"
              >
                <Plus size={13} />
                Add Booking
              </button>
            )}
          </div>

          {adhocBookings.length === 0 && !showAdhocForm ? (
            <p className="text-xs text-gray-400 text-center py-4">No other bookings for this day</p>
          ) : (
            <div className="space-y-2">
              {adhocBookings.map(b => (
                <div key={b.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {b.patients?.first_name} {b.patients?.last_name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {b.visit_time ? new Date(b.visit_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—'} · {b.hospitals?.name}
                    </p>
                    {b.notes && <p className="text-xs text-gray-400 truncate mt-0.5">{b.notes}</p>}
                  </div>
                  <button
                    onClick={async () => {
                      try { await deleteAdhocBooking(b.id); setAdhocBookings(prev => prev.filter(x => x.id !== b.id)) }
                      catch (e) { console.error(e); showToast('Failed to remove the booking — please try again.') }
                    }}
                    className="ml-3 w-6 h-6 flex items-center justify-center rounded-full bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Inline adhoc booking form */}
          {showAdhocForm && (
            <div className="flex flex-col gap-3 border-t border-gray-100 pt-3 mt-1">

              {/* Scan Tag button */}
              <button
                onClick={() => setShowAdhocScan(s => !s)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#007AFF]/30 bg-[#007AFF]/[0.08] text-[#007AFF] text-sm font-medium w-full justify-center hover:bg-[#007AFF]/[0.15] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75z" />
                </svg>
                {showAdhocScan ? 'Hide Scanner' : 'Scan Hospital Tag'}
              </button>


              {/* Patient */}
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1.5">Patient</p>
                {adhocFormPatient ? (
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-green-50 border border-green-100">
                    <span className="text-sm font-semibold text-gray-800">
                      {adhocFormPatient.first_name} {adhocFormPatient.last_name}
                    </span>
                    <button onClick={() => setAdhocFormPatient(null)} className="text-green-400 hover:text-green-600 ml-2">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <PatientSearch
                    teamId={user.team_id}
                    onSelect={p => setAdhocFormPatient(p)}
                  />
                )}
              </div>

              {/* Hospital */}
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1.5">Hospital</p>
                <div className="flex flex-wrap gap-1.5">
                  {hospitals.map(h => (
                    <button
                      key={h.id}
                      onClick={() => setAdhocFormHospital(h)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                        adhocFormHospital?.id === h.id
                          ? 'bg-[#007AFF] text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {h.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date + Time */}
              <div className="flex gap-2">
                <input
                  type="date"
                  value={adhocFormDate}
                  onChange={e => setAdhocFormDate(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                />
                <input
                  type="time"
                  value={adhocFormTime}
                  onChange={e => setAdhocFormTime(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                />
              </div>

              {/* Note */}
              <input
                type="text"
                placeholder="Reason for visit (optional)"
                value={adhocFormNote}
                onChange={e => setAdhocFormNote(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
              />

              {/* SMS phone prompt — only when patient has no phone on record */}
              {adhocFormPatient && !adhocFormPatient.phone && (
                <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-100">
                  <p className="text-xs font-medium text-blue-700 mb-2">📱 Add mobile number for SMS reminders?</p>
                  <input
                    type="tel"
                    placeholder="e.g. 0712 345 678"
                    value={bookingPhone}
                    onChange={e => setBookingPhone(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-xl border border-blue-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
                  />
                  <p className="text-[10px] text-blue-400 mt-1.5">Optional — skip if you prefer</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowAdhocForm(false)
                    setAdhocFormPatient(null)
                    setAdhocFormHospital(null)
                    setAdhocFormTime('')
                    setAdhocFormNote('')
                    setBookingPhone('')
                  }}
                  className="text-sm text-gray-400 px-3 py-2 hover:text-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={!adhocFormPatient || !adhocFormHospital || !adhocFormTime || adhocFormSaving}
                  onClick={async () => {
                    setAdhocFormSaving(true)
                    try {
                      const visitTime = new Date(`${adhocFormDate}T${adhocFormTime}:00`).toISOString()
                      const newBooking = await createAdhocBooking(
                        user.team_id, user.id,
                        adhocFormPatient.id, adhocFormHospital.id,
                        adhocFormDate, visitTime, adhocFormNote,
                        selectedDoctorId
                      )
                      if (bookingPhone.trim()) {
                        await updatePatientContact(adhocFormPatient.id, { phone: bookingPhone.trim() })
                          .catch(err => { console.error(err); showToast('Booking created, but the phone number could not be saved.', 'error') })
                      }
                      setAdhocBookings(prev => [...prev, {
                        ...newBooking,
                        patients: adhocFormPatient,
                        hospitals: adhocFormHospital,
                      }])
                      setShowAdhocForm(false)
                      setAdhocFormPatient(null)
                      setAdhocFormHospital(null)
                      setAdhocFormTime('')
                      setAdhocFormNote('')
                      setBookingPhone('')
                    } catch (e) {
                      console.error('Adhoc booking failed:', e)
                      showToast('Failed to create the booking — please try again.')
                    } finally {
                      setAdhocFormSaving(false)
                    }
                  }}
                  className="bg-[#007AFF] text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-40 transition-opacity"
                >
                  {adhocFormSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Adhoc scan modal */}
      {showAdhocScan && (
        <ModalShell onClose={() => { setShowAdhocScan(false); setAdhocScanPreview(null); setAdhocScanError(null) }}>
          <div className="glass-rim rounded-3xl p-2.5 w-full max-w-sm">
            <div className="surface-shell">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <p className="text-sm font-semibold text-gray-800">Scan Hospital Tag</p>
              <button
                onClick={() => { setShowAdhocScan(false); setAdhocScanPreview(null); setAdhocScanError(null) }}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="px-4 pb-4 space-y-3">
              <TagScanDropzone
                onFile={handleAdhocScanFile}
                isScanning={adhocIsScanning}
                preview={adhocScanPreview}
                error={adhocScanError}
                onClear={() => { setAdhocScanPreview(null); setAdhocScanError(null) }}
              />
            </div>
            </div>
          </div>
        </ModalShell>
      )}

      {/* New Visit modal — prefilled to selected slot */}
      <NewVisitModal
        open={!!bookingSlot}
        onClose={() => { setBookingSlot(null); setPrefillPatient(null) }}
        hospitals={hospitals}
        slotDate={date}
        slotTime={bookingSlot?.time}
        slotStatus={bookingSlot?.status}
        lockedDoctorId={selectedDoctorId}
        prefillPatient={prefillPatient}
        notify={showToast}
        onVisitCreated={() => {
          setBookingSlot(null)
          setPrefillPatient(null)
          loadSchedule()
        }}
      />

      {/* Booked slot options */}
      {bookedSlotVisit && (
        <BookedSlotModal
          visit={bookedSlotVisit}
          onClose={() => setBookedSlotVisit(null)}
          onCheckIn={handleCheckIn}
          onCancelBooking={handleCancelBooking}
          onChangeBooking={handleChangeBooking}
          onSendReminder={(visit) => { setBookedSlotVisit(null); setReminderVisit(visit) }}
        />
      )}

      {/* Manual reminder compose modal */}
      {reminderVisit && (
        <ReminderComposeModal
          visit={reminderVisit}
          onClose={() => setReminderVisit(null)}
          notify={showToast}
        />
      )}

      {/* Block range modal */}
      {showRangeModal && (
        <BlockRangeModal
          onClose={() => setShowRangeModal(false)}
          onBlocked={async (pairs, reason) => {
            // Group pairs by date and call blockSlotRange for each day in parallel
            const byDate = {}
            for (const { date: d, time } of pairs) {
              if (!byDate[d]) byDate[d] = []
              byDate[d].push(time)
            }
            await Promise.all(
              Object.entries(byDate).map(([d, times]) =>
                blockSlotRange(user.team_id, user.id, d, times, reason, selectedDoctorId)
              )
            )
            loadSchedule()
          }}
        />
      )}

      {/* Single-slot block reason prompt */}
      {blockReasonSlot && (
        <ModalShell onClose={() => setBlockReasonSlot(null)}>
          <div className="glass-rim w-full max-w-sm rounded-3xl p-2.5">
            <div className="surface-shell">
            <div className="px-5 pt-5 pb-2">
              <h2 className="font-bold text-base text-gray-900">Block {fmtSlot(blockReasonSlot)}</h2>
              <p className="text-xs text-gray-500">{formattedDate}</p>
            </div>
            <div className="px-5 pb-5 pt-2 space-y-3">
              <input
                autoFocus
                value={blockReason}
                onChange={e => setBlockReason(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmBlockReason()}
                placeholder="Reason (e.g. Theatre, Leave)…"
                className="w-full px-3 py-2 text-sm rounded-xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
              />
              <div className="flex gap-2">
                <button onClick={() => setBlockReasonSlot(null)} className="flex-1 py-2.5 rounded-2xl text-sm font-semibold bg-black/[0.06] text-gray-700 hover:bg-black/10 transition-colors">
                  Cancel
                </button>
                <button onClick={confirmBlockReason} className="flex-1 py-2.5 rounded-2xl text-sm font-semibold bg-red-500 text-white transition-opacity">
                  Block Slot
                </button>
              </div>
            </div>
            </div>
          </div>
        </ModalShell>
      )}


    </div>
  )
}
