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
  declined: <HelpCircle size={12} className="flex-shrink-0" />,
}

function patientName(p) {
  return p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Patient' : 'Patient'
}

export default function DayTimeline({
  date, isToday, loading, schedule, slotMap, adhocBookings,
  blockMode, rescheduling, onSlotClick, onRescheduleToSlot,
}) {
  const [expanded, setExpanded] = useState(() => new Set())
  useEffect(() => { setExpanded(new Set()) }, [date])

  const [nowHM, setNowHM] = useState(() => toHM(new Date()))
  useEffect(() => {
    if (!isToday) return
    const t = setInterval(() => setNowHM(toHM(new Date())), 60_000)
    return () => clearInterval(t)
  }, [isToday])

  const rows = useMemo(
    () => decorateRows(
      buildDayRows({ slotMap, adhocBookings, expandedGroups: expanded }),
      isToday ? nowHM : null,
    ),
    [slotMap, adhocBookings, expanded, isToday, nowHM],
  )

  function expand(id) {
    setExpanded(prev => new Set(prev).add(id))
  }

  const bookedVisits = schedule.filter(v => v.status !== 'blocked')
  const blockedCount = schedule.filter(v => v.status === 'blocked').length
  const confirmedCount = bookedVisits.filter(v => visitStatusKey(v) === 'confirmed').length
  const counts = [
    { label: 'free', value: ALL_TIME_SLOTS.length - schedule.length, cls: 'text-green-600', dot: 'bg-green-400' },
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
      <div className="flex items-center justify-between mb-3">
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
