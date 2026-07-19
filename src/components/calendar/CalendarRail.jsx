// Right rail (desktop) / stacked sections (mobile): four collapsible cards —
// mini month, today's agenda, blocked dates, counts. Chevron state persisted.
import { useState } from 'react'
import { ChevronDown, ChevronUp, Lock } from 'lucide-react'
import { fmtSlot, slotKeyFromVisit, ALL_TIME_SLOTS } from '../../lib/api'
import { GLASS_CARD, VISIT_STATUS_STYLES, visitStatusKey } from '../../lib/theme'
import { toHM, groupAgendaBlocks, fmtSlotRange } from './calendarUtils'
import MiniMonth from './MiniMonth'
import BlockedDatesCard from './BlockedDatesCard'

const COLLAPSE_KEY = 'wr-cal-rail-collapsed'

function loadCollapsed() {
  try { return new Set(JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '[]')) } catch { return new Set() }
}

function Card({ id, title, icon = null, collapsed, onToggle, children }) {
  return (
    <div className={`${GLASS_CARD} p-3`}>
      <button onClick={() => onToggle(id)} className="w-full flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-800">{icon}{title}</span>
        {collapsed ? <ChevronDown size={14} className="text-ios-gray-1" /> : <ChevronUp size={14} className="text-ios-gray-1" />}
      </button>
      {!collapsed && <div className="mt-2">{children}</div>}
    </div>
  )
}

export default function CalendarRail({ date, schedule, adhocBookings, density, blockedRanges, onSelectDate, onEditBlockRange, onUnblockRange, onSelectVisit }) {
  const [collapsed, setCollapsed] = useState(loadCollapsed)
  function toggle(id) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next])) } catch { /* non-fatal */ }
      return next
    })
  }

  // Blocked slots collapse into ranges (a blocked day is ONE agenda line, not 48)
  const blockedItems = groupAgendaBlocks(
    schedule
      .filter(v => v.status === 'blocked' && slotKeyFromVisit(v))
      .map(v => ({ slot: slotKeyFromVisit(v), label: v.notes || 'Blocked', dot: VISIT_STATUS_STYLES.blocked.dot }))
  ).map(b => ({ time: b.slot, timeLabel: fmtSlotRange(b.slot, b.end), label: b.label, dot: b.dot }))

  const agenda = [
    ...blockedItems,
    ...schedule.filter(v => v.status !== 'blocked').map(v => ({
      time: slotKeyFromVisit(v),
      label: `${v.patients?.first_name || ''} ${v.patients?.last_name || ''}`.trim() || 'Patient',
      dot: VISIT_STATUS_STYLES[visitStatusKey(v)].dot,
      visit: v,
    })),
    ...adhocBookings.filter(b => b.visit_time).map(b => ({
      time: toHM(new Date(b.visit_time)),
      label: `${b.patients?.first_name || ''} ${b.patients?.last_name || ''}`.trim() || 'Patient',
      dot: VISIT_STATUS_STYLES.adhoc.dot,
      visit: b,
    })),
  ].filter(a => a.time).sort((a, b) => a.time.localeCompare(b.time))

  const bookedVisits = schedule.filter(v => v.status !== 'blocked')
  const blockedCount = schedule.length - bookedVisits.length
  const stats = [
    { label: 'Free', value: ALL_TIME_SLOTS.length - schedule.length, cls: 'text-green-600' },
    { label: 'Booked', value: bookedVisits.length + adhocBookings.length, cls: 'text-amber-600' },
    { label: 'Blocked', value: blockedCount, cls: 'text-red-500' },
  ]

  return (
    <div className="flex flex-col gap-3">
      <Card id="mini" title="Calendar" collapsed={collapsed.has('mini')} onToggle={toggle}>
        <MiniMonth date={date} density={density} onSelectDate={onSelectDate} />
      </Card>

      <Card id="agenda" title="Day's agenda" collapsed={collapsed.has('agenda')} onToggle={toggle}>
        {agenda.length === 0
          ? <p className="text-[11px] text-gray-400">Nothing scheduled</p>
          : (
            <div className="flex flex-col gap-0.5">
              {agenda.map((a, i) => a.visit ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSelectVisit?.(a.visit)}
                  className="flex items-center gap-1.5 text-[11px] text-gray-700 min-w-0 -mx-1 px-1 py-0.5 rounded-lg hover:bg-black/[0.05] transition-colors text-left"
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.dot}`} />
                  <span className="text-gray-400 flex-shrink-0">{a.timeLabel || fmtSlot(a.time)}</span>
                  <span className="truncate font-medium text-ios-blue">{a.label}</span>
                </button>
              ) : (
                <span key={i} className="flex items-center gap-1.5 text-[11px] text-gray-700 min-w-0 px-1 py-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.dot}`} />
                  <span className="text-gray-400 flex-shrink-0">{a.timeLabel || fmtSlot(a.time)}</span>
                  <span className="truncate">{a.label}</span>
                </span>
              ))}
            </div>
          )}
      </Card>

      <Card id="blocked" title="Blocked dates" icon={<Lock size={11} className="text-red-400" />} collapsed={collapsed.has('blocked')} onToggle={toggle}>
        <BlockedDatesCard ranges={blockedRanges} onEdit={onEditBlockRange} onUnblock={onUnblockRange} />
      </Card>

      <Card id="stats" title="Day summary" collapsed={collapsed.has('stats')} onToggle={toggle}>
        <div className="flex justify-between text-center">
          {stats.map(s => (
            <span key={s.label}>
              <span className={`block text-base font-semibold ${s.cls}`}>{s.value}</span>
              <span className="block text-[9px] text-ios-gray-1">{s.label}</span>
            </span>
          ))}
        </div>
      </Card>
    </div>
  )
}
