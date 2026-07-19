// Mobile horizontal 7-day strip (Day view only). Density dots mirror MiniMonth.
import { todayStr } from '../../lib/utils'
import { weekDates } from './calendarUtils'

export default function WeekStrip({ date, density = {}, onSelectDate }) {
  const days = weekDates(date)
  const today = todayStr()
  return (
    <div className="grid grid-cols-7 gap-1 sm:hidden">
      {days.map(d => {
        const dt = new Date(d + 'T12:00:00')
        const isSel = d === date
        const dens = density[d]
        return (
          <button
            key={d}
            onClick={() => onSelectDate(d)}
            className={`flex flex-col items-center rounded-2xl py-1.5 transition-colors ${
              isSel ? 'bg-[#007AFF] text-white' : 'bg-white/70 border border-gray-200 text-gray-700 hover:bg-white'
            }`}
          >
            <span className={`text-[9px] font-medium ${isSel ? 'text-white/80' : d === today ? 'text-[#007AFF]' : 'text-ios-gray-1'}`}>
              {dt.toLocaleDateString('en-GB', { weekday: 'short' })}
            </span>
            <span className="text-sm font-semibold leading-tight">{dt.getDate()}</span>
            <span className="flex gap-0.5 h-1">
              {!isSel && dens?.booked > 0 && <span className="w-1 h-1 rounded-full bg-amber-400" />}
              {!isSel && dens?.blocked > 0 && <span className="w-1 h-1 rounded-full bg-red-400" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
