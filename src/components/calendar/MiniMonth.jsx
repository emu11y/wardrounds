// Rail mini calendar: density dots (amber booked / red blocked / purple adhoc),
// blocked days tinted, click a day to jump the Day view there.
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { todayStr } from '../../lib/utils'
import { monthMatrix, shiftMonth } from './calendarUtils'

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export default function MiniMonth({ date, density = {}, onSelectDate }) {
  const [anchor, setAnchor] = useState(date)
  useEffect(() => { setAnchor(date) }, [date])
  const weeks = monthMatrix(anchor)
  const monthLabel = new Date(anchor + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const today = todayStr()

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-gray-800">{monthLabel}</span>
        <span className="flex gap-1">
          <button onClick={() => setAnchor(shiftMonth(anchor, -1))} aria-label="Previous month" className="w-6 h-6 rounded-lg bg-black/[0.04] flex items-center justify-center hover:bg-black/10 transition-colors">
            <ChevronLeft size={12} />
          </button>
          <button onClick={() => setAnchor(shiftMonth(anchor, 1))} aria-label="Next month" className="w-6 h-6 rounded-lg bg-black/[0.04] flex items-center justify-center hover:bg-black/10 transition-colors">
            <ChevronRight size={12} />
          </button>
        </span>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {DOW.map((d, i) => <span key={i} className="text-[9px] text-ios-gray-2">{d}</span>)}
        {weeks.flat().map(({ date: d, inMonth }) => {
          const dens = density[d]
          const isSel = d === date
          const isToday = d === today
          const blockedDay = dens?.blocked > 0
          return (
            <button
              key={d}
              onClick={() => onSelectDate(d)}
              className={`rounded-lg py-0.5 text-[10px] leading-tight transition-colors ${
                isSel ? 'bg-[#007AFF] text-white font-semibold'
                : isToday ? 'ring-1 ring-[#007AFF] text-[#007AFF] font-semibold'
                : blockedDay ? 'bg-red-50 text-red-600 hover:bg-red-100'
                : inMonth ? 'text-gray-700 hover:bg-black/[0.05]' : 'text-gray-300 hover:bg-black/[0.03]'
              }`}
            >
              {Number(d.split('-')[2])}
              <span className="flex justify-center gap-0.5 h-1">
                {!isSel && dens?.booked > 0 && <span className="w-1 h-1 rounded-full bg-amber-400" />}
                {!isSel && dens?.blocked > 0 && <span className="w-1 h-1 rounded-full bg-red-400" />}
                {!isSel && dens?.adhoc > 0 && <span className="w-1 h-1 rounded-full bg-purple-400" />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
