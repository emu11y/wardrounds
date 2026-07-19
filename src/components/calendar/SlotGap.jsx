// Slim free-slot row for the day timeline.
// mode: 'book' (default) | 'block' (block mode active) | 'reschedule' (picking a target)
// Collapsed multi-slot groups pass `count`; clicking those expands (handled by parent).
export default function SlotGap({ label, count = null, mode = 'book', onClick }) {
  const styles = {
    book:       { row: 'border-gray-200 hover:border-[#007AFF]/40 hover:bg-[#007AFF]/[0.04]', action: 'text-[#007AFF]', actionLabel: '+ Book' },
    block:      { row: 'border-red-200 hover:border-red-400 hover:bg-red-50',                 action: 'text-red-500',   actionLabel: 'Block' },
    reschedule: { row: 'border-blue-300 ring-1 ring-blue-200 hover:bg-blue-50',               action: 'text-blue-600',  actionLabel: 'Move here' },
  }[mode]
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between rounded-xl border border-dashed px-3 py-1.5 transition-colors ${styles.row}`}
    >
      <span className="text-[11px] text-ios-gray-2">
        {label}{count != null && <span> · {count} slots free</span>}
      </span>
      <span className={`text-[11px] font-semibold ${styles.action}`}>
        {count != null ? 'Choose slot' : styles.actionLabel}
      </span>
    </button>
  )
}
