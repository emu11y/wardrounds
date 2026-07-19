// Week view: 7 Monday-start columns of compact status-coloured chips.
// Clicking a chip or a day column jumps to that day's Day view for management.
import { todayStr } from '../../lib/utils'
import { slotKeyFromVisit } from '../../lib/api'
import { VISIT_STATUS_STYLES, visitStatusKey } from '../../lib/theme'
import { weekDates, toHM, fmtSlotCompact } from './calendarUtils'

export default function WeekGrid({ date, schedule, loading, onSelectDate }) {
  const days = weekDates(date)
  const today = todayStr()

  const byDay = Object.fromEntries(days.map(d => [d, []]))
  for (const v of schedule) {
    if (!byDay[v.visit_date]) continue
    const key = v.is_adhoc ? 'adhoc' : visitStatusKey(v)
    const time = v.is_adhoc
      ? (v.visit_time ? toHM(new Date(v.visit_time)) : null)
      : slotKeyFromVisit(v)
    byDay[v.visit_date].push({
      id: v.id,
      time,
      key,
      label: v.status === 'blocked'
        ? (v.notes || 'Blocked')
        : `${v.patients?.first_name || ''} ${v.patients?.last_name || ''}`.trim() || 'Patient',
    })
  }
  for (const d of days) byDay[d].sort((a, b) => (a.time || '').localeCompare(b.time || ''))

  return (
    <div className="border border-gray-200 rounded-2xl bg-white/70 p-3">
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2">
          <div className="w-4 h-4 border-2 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin" />
          <span className="text-xs text-gray-400">Loading week…</span>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1.5 overflow-x-auto">
          {days.map(d => {
            const dt = new Date(d + 'T12:00:00')
            const isToday = d === today
            const isSel = d === date
            return (
              <div key={d} className="min-w-0">
                <button
                  onClick={() => onSelectDate(d)}
                  className={`w-full text-center rounded-xl py-1 mb-1.5 transition-colors ${
                    isSel ? 'bg-[#007AFF] text-white' : isToday ? 'text-[#007AFF] font-semibold hover:bg-black/[0.04]' : 'text-gray-600 hover:bg-black/[0.04]'
                  }`}
                >
                  <span className="block text-[9px] font-medium opacity-80">{dt.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                  <span className="block text-sm font-semibold leading-tight">{dt.getDate()}</span>
                </button>
                <div
                  onClick={() => onSelectDate(d)}
                  className="min-h-[140px] rounded-xl bg-black/[0.02] p-1 flex flex-col gap-1 cursor-pointer hover:bg-black/[0.04] transition-colors"
                >
                  {byDay[d].map(ev => {
                    const st = VISIT_STATUS_STYLES[ev.key]
                    return (
                      <span key={ev.id} className={`flex items-baseline gap-1 rounded-lg px-1.5 py-1 text-[9px] leading-tight border-l-2 ${st.card} ${st.title}`}>
                        {ev.time && <span className="flex-shrink-0 font-semibold">{fmtSlotCompact(ev.time)}</span>}
                        <span className="truncate min-w-0">{ev.label}</span>
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <p className="text-[10px] text-gray-400 text-center pt-2">Tap a day to open it and book</p>
    </div>
  )
}
