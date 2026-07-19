// Doctor selector as a dropdown menu rather than a row of pills — keeps the
// header compact for teams with many clinicians. Supports an optional "All"
// entry (Outpatient's multi-doctor queue) and optional per-doctor count badges.
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export default function DoctorFilterDropdown({ doctors, value, onChange, allowAll = false, counts = null, label = 'Doctor' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const selectedDoctor = doctors.find(d => d.id === value)
  const currentLabel = selectedDoctor ? selectedDoctor.full_name : (allowAll ? 'All Doctors' : 'Select doctor')
  const currentCount = counts ? (value ? counts[value] : counts.all) : null

  return (
    <div className="relative" ref={ref}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1 mb-2">{label}</p>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full sm:w-72 flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-white/90 backdrop-blur border border-gray-200 shadow-ios-card text-sm font-semibold text-gray-800 hover:border-gray-300 transition-colors"
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="truncate">{currentLabel}</span>
          {currentCount > 0 && (
            <span className="flex-shrink-0 text-[9px] font-bold rounded-full px-1.5 py-0.5 bg-ios-blue/10 text-ios-blue">{currentCount}</span>
          )}
        </span>
        <ChevronDown size={14} className={`flex-shrink-0 text-ios-gray-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full sm:w-72 max-h-72 overflow-y-auto rounded-2xl bg-white shadow-lg border border-gray-100 py-1.5">
          {allowAll && (
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              className="w-full flex items-center justify-between gap-2 px-4 py-2 text-sm text-left hover:bg-black/[0.04] transition-colors"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Check size={14} className={value === null ? 'text-ios-blue' : 'text-transparent'} />
                <span className={`truncate ${value === null ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>All Doctors</span>
              </span>
              {counts?.all > 0 && (
                <span className="flex-shrink-0 text-[9px] font-bold rounded-full px-1.5 py-0.5 bg-black/10 text-gray-500">{counts.all}</span>
              )}
            </button>
          )}
          {doctors.map(d => (
            <button
              key={d.id}
              type="button"
              onClick={() => { onChange(d.id); setOpen(false) }}
              className="w-full flex items-center justify-between gap-2 px-4 py-2 text-sm text-left hover:bg-black/[0.04] transition-colors"
            >
              <span className="flex items-center gap-2 min-w-0">
                <Check size={14} className={value === d.id ? 'text-ios-blue' : 'text-transparent'} />
                <span className={`truncate ${value === d.id ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{d.full_name}</span>
              </span>
              {counts?.[d.id] > 0 && (
                <span className="flex-shrink-0 text-[9px] font-bold rounded-full px-1.5 py-0.5 bg-black/10 text-gray-500">{counts[d.id]}</span>
              )}
            </button>
          ))}
          {doctors.length === 0 && !allowAll && (
            <p className="px-4 py-2 text-xs text-gray-400">No clinical staff configured.</p>
          )}
        </div>
      )}
    </div>
  )
}
