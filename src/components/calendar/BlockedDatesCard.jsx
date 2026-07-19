// Upcoming blocked dates with reasons, grouped into ranges by calendarUtils,
// e.g. "12 – 20 Jul 2026 · ECo conference" or "Today, 10:30 AM – 12:00 PM · Theatre".
import { fmtSlot } from '../../lib/api'
import { todayStr } from '../../lib/utils'
import { fmtDateRange } from './calendarUtils'

export default function BlockedDatesCard({ ranges, onSelectDate }) {
  if (!ranges.length) {
    return <p className="text-[11px] text-gray-400">No upcoming blocked dates</p>
  }
  const today = todayStr()
  return (
    <div className="flex flex-col gap-2">
      {ranges.map((r, i) => (
        <button
          key={i}
          onClick={() => onSelectDate(r.from)}
          className="text-left border-l-2 border-red-400 pl-2 hover:bg-red-50/60 rounded-r-lg transition-colors"
        >
          <p className="text-[11px] font-semibold text-gray-800 leading-tight">
            {r.from === today && r.to === today ? 'Today' : fmtDateRange(r.from, r.to)}
            {r.partial && r.fromTime && (
              <span className="font-normal text-gray-500">, {fmtSlot(r.fromTime)} – {fmtSlot(r.toTime)}</span>
            )}
          </p>
          <p className="text-[11px] text-gray-500 truncate">{r.notes}</p>
        </button>
      ))}
    </div>
  )
}
