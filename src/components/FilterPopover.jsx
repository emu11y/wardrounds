import { useEffect } from 'react'
import { SlidersHorizontal } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// FilterPopover — the single "Filters" pill + glass popover used by list pages
// (Billing, Shifts, …). Shows a count badge for active filters, closes on any
// scroll (it's anchored to the pill), and renders Clear all / Done.
// Children are the filter fields (use <FilterSelect>).
// ─────────────────────────────────────────────────────────────────────────────

export const filterSelectCls = 'w-full px-3 py-2 rounded-xl bg-white/70 border border-white/60 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-ios-blue/40'

export function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} className={`${filterSelectCls} mt-1`}>
        {children}
      </select>
    </label>
  )
}

export default function FilterPopover({ open, onOpenChange, activeCount = 0, onClear, children }) {
  // Mobile UX: any scroll dismisses the popover so it never floats detached.
  useEffect(() => {
    if (!open) return
    const close = () => onOpenChange(false)
    const scroller = document.getElementById('main-scroll')
    scroller?.addEventListener('scroll', close, { passive: true })
    window.addEventListener('scroll', close, { passive: true })
    return () => {
      scroller?.removeEventListener('scroll', close)
      window.removeEventListener('scroll', close)
    }
  }, [open])

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => onOpenChange(!open)}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-sm font-semibold shadow-sm transition ${
          open || activeCount > 0
            ? 'bg-ios-blue text-white border-ios-blue'
            : 'bg-white/70 text-gray-700 border-white/60 hover:bg-white'}`}
      >
        <SlidersHorizontal size={15} />
        Filters
        {activeCount > 0 && (
          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-white/25 text-white text-[10px] font-bold flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* click-away layer */}
          <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-[calc(100vw-3rem)] max-w-xs bg-white/90 backdrop-blur-xl border border-white/60 rounded-2xl shadow-2xl p-4 space-y-3">
            {children}
            <div className="flex items-center justify-between pt-1">
              <button onClick={onClear} disabled={activeCount === 0}
                className="text-xs font-semibold text-gray-400 hover:text-gray-600 disabled:opacity-40">
                Clear all
              </button>
              <button onClick={() => onOpenChange(false)}
                className="px-4 py-1.5 rounded-full bg-ios-blue text-white text-xs font-semibold">
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
