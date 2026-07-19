// Generic status-coloured event card shell for the day timeline.
// Purely presentational — colours come from VISIT_STATUS_STYLES via statusKey.
import { VISIT_STATUS_STYLES } from '../../lib/theme'

export default function EventCard({ statusKey, icon = null, title, time, sub = null, badge = null, onClick = null }) {
  const st = VISIT_STATUS_STYLES[statusKey] || VISIT_STATUS_STYLES.pending
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick || undefined}
      className={`w-full text-left rounded-r-2xl rounded-l border-l-4 px-3 py-2 transition-colors ${st.card} ${onClick ? '' : 'cursor-default'}`}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className={`flex items-center gap-1.5 text-sm font-semibold truncate ${st.title}`}>
          {icon}
          <span className="truncate">{title}</span>
          {badge}
        </span>
        <span className={`text-[10px] whitespace-nowrap flex-shrink-0 ${st.sub}`}>
          {time} · {st.label}
        </span>
      </div>
      {sub && <p className={`text-[11px] truncate mt-0.5 ${st.sub}`}>{sub}</p>}
    </Tag>
  )
}
