import { motion } from 'framer-motion'
import { CalendarDays } from 'lucide-react'
import { darken } from './colors'

export default function MockCardHeader({ accentColor, initials, name, patientNumber, ageDob, formattedTotal }) {
  return (
    <div
      className="pt-3 pb-2 px-4"
      style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${darken(accentColor, 45)} 100%)` }}
    >
      {/* Row 1 — identity */}
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/25 backdrop-blur flex items-center justify-center">
          <span className="text-white font-semibold text-sm">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate leading-tight uppercase">{name}</p>
          <p className="text-white/70 text-xs mt-0.5">{patientNumber}</p>
        </div>
      </div>

      {/* Row 2 — total */}
      <div className="mt-1.5 flex justify-end">
        <div className="text-right">
          <p className="text-white/70 text-xs">Total (Live)</p>
          <motion.p className="text-lg font-bold text-white tabular-nums">{formattedTotal}</motion.p>
        </div>
      </div>

      {/* Row 3 — age/DOB */}
      <div className="mt-1.5 pb-2 flex items-center justify-end text-white/80 text-xs">
        <div className="flex items-center gap-1">
          <CalendarDays size={11} className="text-white/70 flex-shrink-0" />
          <span>{ageDob}</span>
        </div>
      </div>
    </div>
  )
}
