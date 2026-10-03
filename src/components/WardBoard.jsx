import { RefreshCw } from 'lucide-react'
import { shortHospitalName } from '../lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// WardBoard — the Inpatient dashboard header, styled like the whiteboard at a
// nurses' station: warm paper tone, light large numerals, hairline columns.
// It is ALSO the hospital filter (replaces the old gradient tiles + the separate
// hospital tab row, which duplicated the same choice).
//
// Props
//   practiceName, now (Date), onRefresh, refreshing
//   total, admittedToday, dischargedToday       — whole-practice figures
//   hospitals: [{ id, name, color, count, wards: [names], newCount, showBadge }]
//   selectedId (null = all), onSelect(id|null)
// ─────────────────────────────────────────────────────────────────────────────

const INK = '#2b241a'
const MUTED = '#988c78'

function Column({ selected, onClick, children, first }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative text-left flex-1 sm:flex-none min-w-[92px] sm:min-w-[150px] px-3 sm:px-4 py-2.5 rounded-xl transition-colors
        ${first ? '' : 'border-l border-[#ebe5da]'}
        ${selected ? 'bg-[#f1ebdf]' : 'hover:bg-[#f5f1e8]'}`}
    >
      {children}
    </button>
  )
}

export default function WardBoard({
  practiceName, now, onRefresh, refreshing,
  total, admittedToday, dischargedToday,
  hospitals, selectedId, onSelect,
}) {
  const longDate = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Nairobi' })
  const shortDate = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' })
  const time = now.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Africa/Nairobi' }).toLowerCase()
  const numeral = selected => `block tabular-nums leading-none mt-1.5 text-[34px] sm:text-[40px] tracking-tight ${selected ? 'font-medium' : 'font-light'}`

  return (
    <section className="rounded-[18px] border border-[#ebe5da] bg-[#faf8f4] px-4 sm:px-5 pt-4 pb-3" style={{ color: INK }}>
      {/* Title line */}
      <div className="flex items-start sm:items-baseline justify-between gap-3 pb-3 border-b border-dashed border-[#e0d8c9]">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold truncate">
            {practiceName} <span className="font-normal" style={{ color: MUTED }}>— inpatients</span>
          </p>
          <p className="sm:hidden text-xs tabular-nums mt-0.5" style={{ color: MUTED }}>{shortDate} · {time}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="hidden sm:inline text-xs tabular-nums" style={{ color: MUTED }}>{longDate} · {time}</span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh"
            className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center hover:bg-[#f1ebdf] disabled:opacity-50"
            style={{ color: MUTED }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Columns — the first is the whole practice; the rest filter by hospital */}
      <div className="flex mt-2 -mx-1 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
        <Column first selected={selectedId === null} onClick={() => onSelect(null)}>
          <span className={`text-xs whitespace-nowrap ${selectedId === null ? "font-semibold" : ""}`}>On the ward</span>
          <span className={numeral(selectedId === null)}>{total}</span>
          <span className="mt-1.5 flex flex-col sm:flex-row gap-x-3 gap-y-0.5 text-[11.5px] whitespace-nowrap">
            <span className={admittedToday ? 'text-[#3f8a5c]' : ''} style={admittedToday ? undefined : { color: MUTED }}>
              {admittedToday}<span className="sm:hidden"> in today</span><span className="hidden sm:inline"> admitted today</span>
            </span>
            <span style={{ color: MUTED }}>{dischargedToday}<span className="sm:hidden"> out</span><span className="hidden sm:inline"> discharged</span></span>
          </span>
        </Column>

        {hospitals.map(h => {
          const selected = selectedId === h.id
          const wardsLabel = h.wards.length === 0 ? '' : h.wards.length <= 2 ? h.wards.join(' · ') : `${h.wards[0]} +${h.wards.length - 1} wards`
          return (
            <Column key={h.id} selected={selected} onClick={() => onSelect(selected ? null : h.id)}>
              <span className={`flex items-center gap-1.5 text-xs whitespace-nowrap ${selected ? 'font-semibold' : ''}`} style={selected ? undefined : { color: '#7d715e' }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: h.color || '#3B82F6' }} />
                <span className="sm:hidden">{shortHospitalName(h.name)}</span>
                <span className="hidden sm:inline">{h.name}</span>
                {h.showBadge && (
                  <span className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#c2410c] text-white text-[10px] font-semibold flex items-center justify-center"
                    title={`${h.newCount} new today`}>
                    {h.newCount}
                  </span>
                )}
              </span>
              <span className={numeral(selected)}>{h.count}</span>
              <span className="mt-1.5 block text-[11.5px] truncate max-w-[110px] sm:max-w-[170px]" style={{ color: MUTED }}>{wardsLabel || ' '}</span>
            </Column>
          )
        })}
      </div>
    </section>
  )
}
