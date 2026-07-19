// Month view: matrix with density dots (amber booked / red blocked / purple adhoc)
// and a booked-count badge. Navigation only — click a day to open its Day view.
import { todayStr } from '../../lib/utils'
import { monthMatrix } from './calendarUtils'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function MonthGrid({ date, density = {}, loading, onSelectDate }) {
  const weeks = monthMatrix(date)
  const today = todayStr()

  return (
    <div className="border border-gray-200 rounded-2xl bg-white/70 p-3">
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2">
          <div className="w-4 h-4 border-2 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin" />
          <span className="text-xs text-gray-400">Loading month…</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DOW.map(d => <span key={d} className="text-center text-[9px] font-medium text-ios-gray-2">{d}</span>)}
          </div>
          <div className="flex flex-col gap-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map(({ date: d, inMonth }) => {
                  const dens = density[d]
                  const isToday = d === today
                  const isSel = d === date
                  const total = (dens?.booked || 0) + (dens?.adhoc || 0)
                  return (
                    <button
                      key={d}
                      onClick={() => onSelectDate(d)}
                      className={`h-14 rounded-xl p-1 text-left align-top transition-colors ${
                        isSel ? 'bg-[#007AFF]/10 ring-1 ring-[#007AFF]'
                        : dens?.blocked > 0 ? 'bg-red-50 hover:bg-red-100'
                        : 'bg-black/[0.02] hover:bg-black/[0.05]'
                      } ${inMonth ? '' : 'opacity-40'}`}
                    >
                      <span className={`block text-[10px] font-semibold leading-none mb-1 ${
                        isToday ? 'text-[#007AFF]' : 'text-gray-700'
                      }`}>
                        {Number(d.split('-')[2])}
                      </span>
                      <span className="flex items-center gap-0.5 flex-wrap">
                        {dens?.booked > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                        {dens?.blocked > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                        {dens?.adhoc > 0 && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                        {total > 0 && <span className="text-[9px] text-gray-500 leading-none">{total}</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 text-center pt-2">Tap a day to open it</p>
        </>
      )}
    </div>
  )
}
