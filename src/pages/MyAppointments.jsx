import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  fetchScheduleForDate, blockSlot, blockSlotRange, unblockSlot,
  cancelVisit, rescheduleVisit, fetchHospitals, checkInVisit,
  fetchAdhocBookings, fetchScheduleForRange, fetchMonthDensity, fetchBlockedSlots,
  unblockSlots, ALL_TIME_SLOTS, fetchMembersWithPositions, fmtSlot, slotKeyFromVisit,
} from '../lib/api'
import { todayStr } from '../lib/utils'
import TopHeader from '../components/TopHeader'
import NewVisitModal from '../components/NewVisitModal'
import ReminderComposeModal from '../components/ReminderComposeModal'
import ModalShell from '../components/ModalShell'
import DoctorFilterDropdown from '../components/DoctorFilterDropdown'
import Toast from '../components/Toast'
import CalendarHeader from '../components/calendar/CalendarHeader'
import DayTimeline from '../components/calendar/DayTimeline'
import WeekStrip from '../components/calendar/WeekStrip'
import WeekGrid from '../components/calendar/WeekGrid'
import MonthGrid from '../components/calendar/MonthGrid'
import CalendarRail from '../components/calendar/CalendarRail'
import BookedSlotModal from '../components/calendar/BookedSlotModal'
import PatientBookingSearch from '../components/calendar/PatientBookingSearch'
import { shiftDate, shiftMonth, weekDates, monthBounds, groupBlockedRanges } from '../components/calendar/calendarUtils'

// ─── helpers ──────────────────────────────────────────────────────────────────


// ─── Block Range Modal (single-day OR multi-day) ────────────────────────────

function BlockRangeModal({ onClose, onBlocked, initial = null }) {
  const [fromDate, setFromDate] = useState(initial?.fromDate || todayStr())
  const [fromSlot, setFromSlot] = useState(initial?.fromSlot || '08:00')
  const [toDate, setToDate]     = useState(initial?.toDate || todayStr())
  const [toSlot, setToSlot]     = useState(initial?.toSlot || '17:00')
  const [reason, setReason]     = useState(initial?.reason || '')
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
            <h2 className="font-bold text-base text-gray-900">{initial ? 'Edit Block' : 'Block Availability'}</h2>
            <p className="text-xs text-gray-500">{initial ? 'Adjust dates, times or reason — the old block is replaced' : 'Single day or multi-day range'}</p>
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
  const [pendingReschedulingVisit, setPendingReschedulingVisit] = useState(null)

  // Modals / interaction state
  const [blockMode, setBlockMode] = useState(false)        // single-slot block toggle
  const [showRangeModal, setShowRangeModal] = useState(false)
  const [bookingSlot, setBookingSlot] = useState(null)     // { time, status } for NewVisitModal
  const [bookedSlotVisit, setBookedSlotVisit] = useState(null)
  const [reminderVisit, setReminderVisit] = useState(null)
  const [blockReasonSlot, setBlockReasonSlot] = useState(null) // slot pending a reason
  const [blockReason, setBlockReason] = useState('')
  const [adhocBookings, setAdhocBookings] = useState([])

  // View state: day (default) | week | month
  const [view, setView] = useState('day')
  const [editingRange, setEditingRange] = useState(null) // blocked range being edited via BlockRangeModal
  const [weekSchedule, setWeekSchedule] = useState([])
  const [weekLoading, setWeekLoading] = useState(false)
  const [density, setDensity] = useState({})
  const [blockedRanges, setBlockedRanges] = useState([])

  useEffect(() => {
    if (!user?.team_id) return
    fetchHospitals(user.team_id).then(h => setHospitals(h || [])).catch(err => { console.error(err); showToast('Failed to load hospitals.') })
  }, [user?.team_id])

  useEffect(() => {
    const state = location.state
    if (!state) return
    if (state.prefillPatient) {
      setPrefillPatient(state.prefillPatient)
      setPendingPrefillOpen(true)
    }
    // Arriving from another page's calendar rail (e.g. Outpatient) — jump to the
    // visit's date/doctor and open the reschedule flow once that day has loaded.
    if (state.reschedulingVisit) {
      const v = state.reschedulingVisit
      setDate(v.visit_date)
      if (v.doctor_id) setSelectedDoctorId(v.doctor_id)
      setPendingReschedulingVisit(v)
    } else if (state.openDate) {
      setDate(state.openDate)
    }
    window.history.replaceState({}, '')
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

  // Week view data
  useEffect(() => {
    if (view !== 'week' || !user?.team_id || !selectedDoctorId) return
    const days = weekDates(date)
    setWeekLoading(true)
    fetchScheduleForRange(user.team_id, selectedDoctorId, days[0], days[6])
      .then(setWeekSchedule)
      .catch(err => { console.error(err); showToast('Failed to load the week — please try again.') })
      .finally(() => setWeekLoading(false))
  }, [view, date, user?.team_id, selectedDoctorId, schedule]) // eslint-disable-line react-hooks/exhaustive-deps

  // Month density (Month view + MiniMonth/WeekStrip dots) — refreshed after day mutations too
  useEffect(() => {
    if (!user?.team_id || !selectedDoctorId) return
    const { from, to } = monthBounds(date)
    fetchMonthDensity(user.team_id, selectedDoctorId, from, to)
      .then(rows => {
        const map = {}
        for (const r of rows) {
          const e = map[r.visit_date] || (map[r.visit_date] = { booked: 0, blocked: 0, adhoc: 0 })
          if (r.status === 'blocked') e.blocked++
          else if (r.is_adhoc) e.adhoc++
          else e.booked++
        }
        setDensity(map)
      })
      .catch(() => setDensity({}))
  }, [date, user?.team_id, selectedDoctorId, schedule])

  // Upcoming blocked ranges (rail card)
  useEffect(() => {
    if (!user?.team_id || !selectedDoctorId) return
    fetchBlockedSlots(user.team_id, selectedDoctorId, todayStr())
      .then(rows => setBlockedRanges(groupBlockedRanges(rows)))
      .catch(() => setBlockedRanges([]))
  }, [user?.team_id, selectedDoctorId, schedule])

  // When a prefill patient arrived via location state, open the booking modal once the
  // schedule finishes loading. Date + slot selection happens inside the modal.
  useEffect(() => {
    if (!loading && pendingPrefillOpen) {
      setPendingPrefillOpen(false)
      setBookingSlot({ time: null, status: 'scheduled' })
    }
  }, [loading, pendingPrefillOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Adhoc rows live in `schedule` too (is_adhoc=true, arbitrary times) — keep
  // them OFF the slot grid; they render inline via the adhocBookings fetch.
  const gridSchedule = schedule.filter(v => !v.is_adhoc)

  // Map slot time → visit/block row
  const slotMap = {}
  for (const v of gridSchedule) {
    const key = slotKeyFromVisit(v)
    if (key) slotMap[key] = v
  }

  // View-aware navigation: day ±1, week ±7, month ±1 month
  function goPrev() {
    setDate(view === 'day' ? shiftDate(date, -1) : view === 'week' ? shiftDate(date, -7) : shiftMonth(date, -1))
  }
  function goNext() {
    setDate(view === 'day' ? shiftDate(date, 1) : view === 'week' ? shiftDate(date, 7) : shiftMonth(date, 1))
  }
  function openDay(d) {
    setDate(d)
    setView('day')
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
      // Unblock on click — with visible feedback (silent success felt broken)
      try {
        await unblockSlot(existing.id)
        showToast(`${fmtSlot(slot)} unblocked`, 'success')
      } catch (err) {
        console.error(err)
        showToast('Failed to unblock the slot — please try again.')
      }
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

  // Once a cross-page reschedule request (from Outpatient's calendar rail) has
  // loaded its target day's schedule, drop straight into "pick a new slot" mode.
  useEffect(() => {
    if (!loading && pendingReschedulingVisit) {
      setRescheduling(pendingReschedulingVisit)
      setPendingReschedulingVisit(null)
    }
  }, [loading, pendingReschedulingVisit]) // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div className="flex flex-col min-h-full">
      <TopHeader title="Appointments" />
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="p-4 space-y-4 pb-24 sm:pb-4">
        {/* Page heading (block controls live inside the Schedule card) */}
        <div className="flex flex-col mb-4">
          <h1 className="text-xl font-bold text-gray-900 whitespace-nowrap">Appointments</h1>
          <p className="text-sm text-gray-500">{user?.full_name}</p>
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
          <DoctorFilterDropdown doctors={doctors} value={selectedDoctorId} onChange={setSelectedDoctorId} />
        </div>

        {/* "When is this patient booked?" search */}
        <PatientBookingSearch teamId={user.team_id} onPickDate={openDay} />

        {/* Calendar header: Today · arrows · view-aware title · Day/Week/Month pill */}
        <CalendarHeader
          date={date}
          view={view}
          onDateChange={setDate}
          onViewChange={setView}
          onPrev={goPrev}
          onNext={goNext}
        />

        {view === 'day' && (
          <>
            {/* Mobile week strip */}
            <WeekStrip date={date} density={density} onSelectDate={setDate} />

            <div className="flex flex-col lg:flex-row gap-4 items-start">
              <div className="flex-1 min-w-0 w-full">
                {/* Day timeline (status-coloured cards, merged blocks, collapsed gaps, hours filter) */}
                <DayTimeline
                  date={date}
                  isToday={date === todayStr()}
                  loading={loading}
                  schedule={gridSchedule}
                  slotMap={slotMap}
                  adhocBookings={adhocBookings}
                  blockMode={blockMode}
                  rescheduling={rescheduling}
                  onSlotClick={handleSlotClick}
                  onRescheduleToSlot={handleRescheduleToSlot}
                  onToggleBlockMode={() => { setBlockMode(m => !m); setRescheduling(null) }}
                  onOpenBlockRange={() => setShowRangeModal(true)}
                />
              </div>
              <div className="w-full lg:w-64 flex-shrink-0">
                <CalendarRail
                  date={date}
                  schedule={gridSchedule}
                  adhocBookings={adhocBookings}
                  density={density}
                  blockedRanges={blockedRanges}
                  onSelectDate={openDay}
                  onEditBlockRange={r => { setEditingRange(r); setShowRangeModal(true) }}
                  onUnblockRange={async r => {
                    try {
                      await unblockSlots(r.ids)
                      showToast(`Unblocked ${r.ids.length} slot${r.ids.length !== 1 ? 's' : ''}`, 'success')
                    } catch (err) {
                      console.error(err)
                      showToast('Failed to unblock — please try again.')
                    }
                    loadSchedule()
                  }}
                  onSelectVisit={setBookedSlotVisit}
                />
              </div>
            </div>
          </>
        )}

        {view === 'week' && (
          <WeekGrid date={date} schedule={weekSchedule} loading={weekLoading} onSelectDate={openDay} />
        )}

        {view === 'month' && (
          <MonthGrid date={date} density={density} loading={false} onSelectDate={openDay} />
        )}
      </div>

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
          teamId={user.team_id}
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

      {/* Block range modal (also used to EDIT an existing range: old slots are
          removed first, then the new range is created) */}
      {showRangeModal && (
        <BlockRangeModal
          initial={editingRange ? {
            fromDate: editingRange.from,
            toDate: editingRange.to,
            fromSlot: editingRange.fromTime || '00:00',
            toSlot: editingRange.lastSlot || '23:30',
            reason: editingRange.notes,
          } : null}
          onClose={() => { setShowRangeModal(false); setEditingRange(null) }}
          onBlocked={async (pairs, reason) => {
            if (editingRange) await unblockSlots(editingRange.ids)
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
            setEditingRange(null)
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
