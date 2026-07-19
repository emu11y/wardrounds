// Calendar navigation header: Today · ‹ › · view-aware title (tap = native date
// picker in Day view) · Day/Week/Month segmented pill.
import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { todayStr } from '../../lib/utils'
import { weekDates, fmtDateRange } from './calendarUtils'

const VIEWS = ['day', 'week', 'month']

function titleFor(view, date) {
  const d = new Date(date + 'T12:00:00')
  if (view === 'week') {
    const days = weekDates(date)
    return fmtDateRange(days[0], days[6])
  }
  if (view === 'month') return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CalendarHeader({ date, view = 'day', onDateChange, onViewChange, onPrev, onNext }) {
  const inputRef = useRef(null)
  const isToday = date === todayStr()

  function openPicker() {
    if (view !== 'day') return
    const el = inputRef.current
    if (!el) return
    if (typeof el.showPicker === 'function') { try { el.showPicker(); return } catch { /* fall through */ } }
    el.focus()
    el.click()
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 min-w-0">
        <button
          onClick={() => onDateChange(todayStr())}
          disabled={isToday && view === 'day'}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/80 border border-gray-200 text-gray-700 hover:bg-white disabled:opacity-40 transition-colors"
        >
          Today
        </button>
        <button onClick={onPrev} aria-label={`Previous ${view}`} className="w-8 h-8 rounded-xl bg-black/[0.06] flex items-center justify-center hover:bg-black/10 transition-colors">
          <ChevronLeft size={14} strokeWidth={2.5} />
        </button>
        <button onClick={onNext} aria-label={`Next ${view}`} className="w-8 h-8 rounded-xl bg-black/[0.06] flex items-center justify-center hover:bg-black/10 transition-colors">
          <ChevronRight size={14} strokeWidth={2.5} />
        </button>
        <div className="relative min-w-0">
          <button
            onClick={openPicker}
            className={`px-2 py-1.5 text-sm font-semibold text-gray-900 truncate transition-colors ${view === 'day' ? 'hover:text-[#007AFF]' : 'cursor-default'}`}
          >
            {titleFor(view, date)}
          </button>
          <input
            ref={inputRef}
            type="date"
            value={date}
            onChange={e => e.target.value && onDateChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="flex bg-black/[0.06] rounded-full p-0.5">
        {VIEWS.map(v => (
          <button
            key={v}
            onClick={() => v !== view && onViewChange(v)}
            className={`px-3.5 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${
              v === view ? 'bg-[#007AFF] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}
