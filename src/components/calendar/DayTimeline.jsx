// Day timeline — replaces the old chip grid. Renders the ordered row model from
// calendarUtils: status-coloured event cards, merged blocked ranges, collapsed
// free-slot gaps, inline adhoc bookings and a current-time line.
// All click behaviour routes through the SAME page handlers as the old grid:
//   empty slot  → onSlotClick(slot)          (book, or block in block mode)
//   blocked     → onSlotClick(slot)          (unblock)
//   booked      → onSlotClick(slot)          (booked-slot modal)
//   reschedule  → onRescheduleToSlot(slot)   (empty slots only, as before)
import { useEffect, useMemo, useState } from 'react'
import { Lock, Check, HelpCircle } from 'lucide-react'
import { ALL_TIME_SLOTS, fmtSlot } from '../../lib/api'
import { VISIT_STATUS_STYLES, visitStatusKey } from '../../lib/theme'
import { buildDayRows, decorateRows, fmtSlotRange, toHM } from './calendarUtils'
import EventCard from './EventCard'
import SlotGap from './SlotGap'

const STATUS_ICONS = {
  confirmed: <Check size={12} className="flex-shrink-0" />,
  pending: <HelpCircle size={12} className="flex-shrink-0" />,
  reschedule: <HelpCircle size={12} className="flex-shrink-0" />,
}

function patientName(p) {
  return p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Patient' : 'Patient'
}

// Per-day working-hours window, persisted locally. A day defaults to the last
// window the user chose anywhere (the "default" key) — surgeons with a 1 AM
// list widen just that day; booked/blocked events outside the window still show.
const HOURS_KEY = d => `wr-cal-hours::${d}`
const HOURS_DEFAULT_KEY = 'wr-cal-hours::default'
const FALLBACK_WINDOW = { start: '06:00', end: '21:30' }

function loadWindow(date) {
  try {
    const own = localStorage.getItem(HOURS_KEY(date))
    if (own) return JSON.parse(own)
    const def = localStorage.getItem(HOURS_DEFAULT_KEY)
    if (def) return JSON.parse(def)
  } catch { /* corrupted storage → fallback */ }
  return FALLBACK_WINDOW
}

function saveWindow(date, win) {
  try {
    localStorage.setItem(HOURS_KEY(date), JSON.stringify(win))
    localStorage.setItem(HOURS_DEFAULT_KEY, JSON.stringify(win))
  } catch { /* storage full/blocked → non-fatal */ }
}

export default function DayTimeline({
  date, isToday, loading, schedule, slotMap, adhocBookings,
  blockMode, rescheduling, onSlotClick, onRescheduleToSlot,
  onToggleBlockMode, onOpenBlockRange,
}) {
  const [expanded, setExpanded] = useState(() => new Set())
  useEffect(() => { setExpanded(new Set()) }, [date])

  const [win, setWin] = useState(() => loadWindow(date))
  useEffect(() => { setWin(loadWindow(date)) }, [date])
  function changeWindow(next) {
    setWin(next)
    saveWindow(date, next)
  }

  const [nowHM, setNowHM] = useState(() => toHM(new Date()))
  useEffect(() => {
    if (!isToday) return
    const t = setInterval(() => setNowHM(toHM(new Date())), 60_000)
    return () => clearInterval(t)
  }, [isToday])

  const rows = useMemo(
    () => decorateRows(
      buildDayRows({ slotMap, adhocBookings, expandedGroups: expanded, windowStart: win.start, windowEnd: win.end }),
      isToday ? nowHM : null,
    ),
    [slotMap, adhocBookings, expanded, isToday, nowHM, win],
  )

  function expand(id) {
    setExpanded(prev => new Set(prev).add(id))
  }

  const windowSlots = ALL_TIME_SLOTS.filter(s => s >= win.start && s <= win.end)
  const freeInWindow = windowSlots.filter(s => !slotMap[s]).length
  const hiddenFree = ALL_TIME_SLOTS.filter(s => !slotMap[s]).length - freeInWindow

  const bookedVisits = schedule.filter(v => v.status !== 'blocked')
  const blockedCount = schedule.filter(v => v.status === 'blocked').length
  const confirmedCount = bookedVisits.filter(v => visitStatusKey(v) === 'confirmed').length
  const counts = [
    { label: 'free', value: freeInWindow, cls: 'text-gray-500', dot: 'bg-gray-300' },
    ...(confirmedCount > 0
      ? [
          { label: "RSVP'd", value: confirmedCount, cls: 'text-green-600', dot: 'bg-green-400' },
          { label: 'no RSVP', value: bookedVisits.length - confirmedCount, cls: 'text-amber-600', dot: 'bg-amber-400' },
        ]
      : [{ label: 'booked', value: bookedVisits.length, cls: 'text-amber-600', dot: 'bg-amber-400' }]),
    ...(blockedCount > 0 ? [{ label: 'blocked', value: blockedCount, cls: 'text-red-500', dot: 'bg-red-400' }] : []),
  ]

  const gapMode = blockMode ? 'block' : rescheduling ? 'reschedule' : 'book'
  const onGap = slot => (rescheduling ? onRescheduleToSlot(slot) : onSlotClick(slot))

  return (
    <div className="border border-gray-200 rounded-2xl bg-white/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-sm font-semibold text-gray-800">Schedule</p>
        {!loading && (
          <div className="flex items-center gap-3">
            {counts.map(c => (
              <span key={c.label} className={`flex items-center gap-1 text-[11px] ${c.cls}`}>
                <span className={`w-2 h-2 rounded-full inline-block ${c.dot}`} />{c.value} {c.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Hours window + block controls — one row so blocking feels part of the booking flow */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1">Hours</span>
        <select
          value={win.start}
          onChange={e => changeWindow({ start: e.target.value, end: e.target.value > win.end ? e.target.value : win.end })}
          className="px-2 py-1 text-xs rounded-lg bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
        >
          {ALL_TIME_SLOTS.map(s => <option key={s} value={s}>{fmtSlot(s)}</option>)}
        </select>
        <span className="text-xs text-gray-400">–</span>
        <select
          value={win.end}
          onChange={e => changeWindow({ start: win.start, end: e.target.value })}
          className="px-2 py-1 text-xs rounded-lg bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
        >
          {ALL_TIME_SLOTS.filter(s => s >= win.start).map(s => <option key={s} value={s}>{fmtSlot(s)}</option>)}
        </select>
        <button
          onClick={() => changeWindow({ start: '00:00', end: '23:30' })}
          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
            win.start === '00:00' && win.end === '23:30' ? 'bg-[#007AFF] text-white' : 'bg-black/[0.06] text-gray-600 hover:bg-black/10'
          }`}
        >
          24h
        </button>
        {hiddenFree > 0 && (
          <span className="text-[10px] text-gray-400">{hiddenFree} off-hours free slots hidden</span>
        )}
        <span className="flex-1" />
        <button
          onClick={onToggleBlockMode}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
            blockMode ? 'bg-red-500 text-white' : 'bg-red-50 text-red-500 hover:bg-red-100'
          }`}
        >
          <Lock size={11} />
          {blockMode ? 'Done blocking' : 'Block'}
        </button>
        <button
          onClick={onOpenBlockRange}
          className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-black/[0.06] text-gray-600 hover:bg-black/10 transition-colors"
        >
          Block range
        </button>
      </div>

      {blockMode && (
        <p className="text-[11px] text-red-500 font-medium -mt-1.5 mb-2">Tap empty slots to block them</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2">
          <div className="w-4 h-4 border-2 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin" />
          <span className="text-xs text-gray-400">Loading schedule…</span>
        </div>
      ) : (
        <div className="space-y-1">
          {rows.map(row => {
            switch (row.type) {
              case 'hour':
                return (
                  <div key={row.id} className="flex items-center gap-2 pt-1.5">
                    <span className="text-[10px] font-medium text-ios-gray-2 w-9 flex-shrink-0 text-right">{row.label}</span>
                    <div className="flex-1 h-px bg-black/[0.05]" />
                  </div>
                )
              case 'now':
                return (
                  <div key={row.id} className="flex items-center gap-1.5" aria-label={`Current time ${fmtSlot(row.start)}`}>
                    <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    <div className="flex-1 h-[1.5px] bg-red-500" />
                    <span className="text-[9px] font-semibold text-red-500">{fmtSlot(row.start)}</span>
                  </div>
                )
              case 'gapGroup':
                return (
                  <SlotGap
                    key={row.id}
                    label={fmtSlotRange(row.start, row.end)}
                    count={row.slots.length}
                    mode={gapMode}
                    onClick={() => expand(row.id)}
                  />
                )
              case 'gap':
                return (
                  <SlotGap key={row.id} label={fmtSlot(row.slot)} mode={gapMode} onClick={() => onGap(row.slot)} />
                )
              case 'blockedGroup':
                return (
                  <EventCard
                    key={row.id}
                    statusKey="blocked"
                    icon={<Lock size={12} className="flex-shrink-0" />}
                    title={row.notes || 'Blocked'}
                    time={fmtSlotRange(row.start, row.end)}
                    sub="Tap to expand and unblock individual slots"
                    onClick={() => expand(row.id)}
                  />
                )
              case 'blocked':
                return (
                  <EventCard
                    key={row.id}
                    statusKey="blocked"
                    icon={<Lock size={12} className="flex-shrink-0" />}
                    title={row.visit.notes || 'Blocked'}
                    time={fmtSlot(row.slot)}
                    sub="Tap to unblock"
                    onClick={() => onSlotClick(row.slot)}
                  />
                )
              case 'visit': {
                const key = visitStatusKey(row.visit)
                return (
                  <EventCard
                    key={row.id}
                    statusKey={key}
                    icon={STATUS_ICONS[key] || null}
                    title={patientName(row.visit.patients)}
                    time={fmtSlotRange(row.start, row.end)}
                    sub={row.visit.hospitals?.name || null}
                    onClick={() => onSlotClick(row.slot)}
                  />
                )
              }
              case 'adhoc': {
                const b = row.booking
                return (
                  <EventCard
                    key={row.id}
                    statusKey="adhoc"
                    title={patientName(b.patients)}
                    badge={
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-100 ${VISIT_STATUS_STYLES.adhoc.title}`}>
                        Other
                      </span>
                    }
                    time={new Date(b.visit_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    sub={[b.hospitals?.name, b.notes].filter(Boolean).join(' · ') || null}
                  />
                )
              }
              default:
                return null
            }
          })}
        </div>
      )}

      <div className="flex items-center gap-4 justify-center flex-wrap pt-4 mt-2 border-t border-black/[0.05]">
        {['confirmed', 'pending', 'blocked', 'seen', 'adhoc'].map(k => (
          <span key={k} className="flex items-center gap-1 text-[10px] text-gray-400">
            <span className={`w-2 h-2 rounded-full ${VISIT_STATUS_STYLES[k].dot}`} />{VISIT_STATUS_STYLES[k].label}
          </span>
        ))}
      </div>
    </div>
  )
}
