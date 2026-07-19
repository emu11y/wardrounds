// Calendar navigation header: Today · ‹ › · date title (tap = native picker) ·
// Day/Week/Month segmented pill (Week/Month land in later phases — inert for now).
import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { todayStr } from '../../lib/utils'

const VIEWS = ['day', 'week', 'month']

export default function CalendarHeader({ date, onDateChange, onPrev, onNext, view = 'day', onViewChange = null }) {
  const inputRef = useRef(null)
  const formatted = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
  const isToday = date === todayStr()

  function openPicker() {
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
          disabled={isToday}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/80 border border-gray-200 text-gray-700 hover:bg-white disabled:opacity-40 transition-colors"
        >
          Today
        </button>
        <button onClick={onPrev} aria-label="Previous day" className="w-8 h-8 rounded-xl bg-black/[0.06] flex items-center justify-center hover:bg-black/10 transition-colors">
          <ChevronLeft size={14} strokeWidth={2.5} />
        </button>
        <button onClick={onNext} aria-label="Next day" className="w-8 h-8 rounded-xl bg-black/[0.06] flex items-center justify-center hover:bg-black/10 transition-colors">
          <ChevronRight size={14} strokeWidth={2.5} />
        </button>
        <div className="relative min-w-0">
          <button onClick={openPicker} className="px-2 py-1.5 text-sm font-semibold text-gray-900 truncate hover:text-[#007AFF] transition-colors">
            {formatted}
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
        {VIEWS.map(v => {
          const active = v === view
          const available = v === 'day' || !!onViewChange
          return (
            <button
              key={v}
              onClick={() => available && !active && onViewChange?.(v)}
              disabled={!available}
              title={available ? undefined : 'Coming soon'}
              className={`px-3.5 py-1 rounded-full text-xs font-semibold capitalize transition-colors ${
                active ? 'bg-[#007AFF] text-white shadow-sm' : available ? 'text-gray-500 hover:text-gray-700' : 'text-gray-300 cursor-not-allowed'
              }`}
            >
              {v}
            </button>
          )
        })}
      </div>
    </div>
  )
}
