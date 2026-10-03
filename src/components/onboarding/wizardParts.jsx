import { Check, Minus, Plus } from 'lucide-react'
import { modalFieldCls, labelCls } from '../billing/BillingDetailsEditor'

// Small building blocks for the onboarding wizard. Field styles come from the
// shared billing editor (modalFieldCls / labelCls) so forms look the same app-wide.

export { modalFieldCls as fieldCls, labelCls }
export { default as Segmented } from '../Segmented'

// Large tappable choice card. `multi` shows a checkbox tick instead of a radio dot.
export function OptionCard({ selected, onClick, icon: Icon, title, hint, multi = false, compact = false, children }) {
  return (
    <div className={`rounded-2xl border transition-colors ${selected ? 'border-ios-blue bg-blue-50/60' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
      <button type="button" onClick={onClick} aria-pressed={selected}
        className={`w-full text-left flex items-start gap-3 ${compact ? 'p-3 items-center' : 'p-4'}`}>
        {Icon && (
          <span className={`flex-shrink-0 ${compact ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-xl'} flex items-center justify-center ${selected ? 'bg-ios-blue text-white' : 'bg-gray-100 text-gray-500'}`}>
            <Icon size={20} />
          </span>
        )}
        <span className="flex-1 min-w-0">
          <span className={`block font-semibold text-gray-900 ${compact ? 'text-[13.5px] leading-tight' : 'text-[15px]'}`}>{title}</span>
          {hint && <span className="block text-[12.5px] text-gray-500 mt-0.5 leading-snug">{hint}</span>}
        </span>
        {!compact && (
          <span className={`flex-shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center border-2 ${multi ? 'rounded-md' : 'rounded-full'} ${selected ? 'bg-ios-blue border-ios-blue text-white' : 'border-gray-300'}`}>
            {selected && <Check size={12} strokeWidth={3} />}
          </span>
        )}
      </button>
      {selected && children && <div className="px-4 pb-4 -mt-1">{children}</div>}
    </div>
  )
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className={labelCls}>{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="block text-[11.5px] text-gray-400 mt-1">{hint}</span>}
    </label>
  )
}

export function MoneyInput({ value, onChange, placeholder = '0', suffix = 'KES' }) {
  return (
    <div className="relative">
      <input type="number" inputMode="decimal" min="0" value={value ?? ''} placeholder={placeholder}
        onChange={e => onChange(e.target.value)} className={`${modalFieldCls} tabular-nums pr-12 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>
    </div>
  )
}

export function Stepper({ value, onChange, min = 1, max = 500 }) {
  const n = Number(value) || min
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-black/[0.05] p-1">
      <button type="button" aria-label="Fewer" onClick={() => onChange(Math.max(min, n - 1))} className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700 disabled:opacity-40" disabled={n <= min}><Minus size={15} /></button>
      <span className="w-12 text-center text-base font-semibold tabular-nums">{n}</span>
      <button type="button" aria-label="More" onClick={() => onChange(Math.min(max, n + 1))} className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700"><Plus size={15} /></button>
    </div>
  )
}

export function ColorDots({ colors, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map(c => (
        <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => onChange(c)}
          className={`w-8 h-8 rounded-full transition ${value === c ? 'ring-2 ring-offset-2 ring-gray-800' : ''}`} style={{ backgroundColor: c }} />
      ))}
    </div>
  )
}

export function SuggestionChips({ items, onPick, taken = [] }) {
  const lower = taken.map(t => t.trim().toLowerCase())
  const left = items.filter(i => !lower.includes(i.toLowerCase()))
  if (!left.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {left.map(i => (
        <button key={i} type="button" onClick={() => onPick(i)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-600 bg-white border border-gray-200 hover:border-ios-blue hover:text-ios-blue">
          <Plus size={12} /> {i}
        </button>
      ))}
    </div>
  )
}
