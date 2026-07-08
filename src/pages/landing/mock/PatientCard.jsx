import { motion } from 'framer-motion'
import { Building2, Clock, Pencil, ChevronDown } from 'lucide-react'
import MockCardHeader from './MockCardHeader'
import MockIconTile from './MockIconTile'
import MockSectionPanel from './MockSectionPanel'

const ENTRIES = [
  { label: 'Admitted to ICU · 12 Jun', sub: '3d · KES 20,000/day', dot: '#ef4444', current: false },
  { label: 'Transferred to HDU · 15 Jun', sub: '2d · KES 15,000/day', dot: '#f97316', current: false },
  { label: 'Transferred to General Ward · 17 Jun', sub: '4d · KES 8,000/day', dot: '#22c55e', current: true },
]

export default function PatientCard({
  accentColor = '#007AFF',
  wardLabel,
  formattedTotal,
  reveals,
  footerReveal,
  initials = 'AB',
  name = 'Abraham Bayusuf',
  patientNumber = '#24963483',
  ageDob = '41 yrs · 6 Jun 1985',
  hospitalName = 'M.P. Shah Hospital',
}) {
  return (
    <div
      className="rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-2 ring-white/60"
      style={{ backgroundColor: accentColor + '08' }}
    >
      <MockCardHeader
        accentColor={accentColor}
        initials={initials}
        name={name}
        patientNumber={patientNumber}
        ageDob={ageDob}
        formattedTotal={formattedTotal}
      />

      {/* BODY */}
      <div className="p-4 space-y-3">
        {/* WARD / HOSPITAL ROW */}
        <div className="flex items-center gap-3">
          <MockIconTile accentColor={accentColor} icon={Building2} />
          <div className="min-w-0 flex-1">
            <motion.p className="font-semibold text-gray-900 text-sm truncate">{wardLabel}</motion.p>
            <p className="text-gray-500 text-xs truncate">{hospitalName}</p>
          </div>
        </div>

        {/* STAY TIMELINE */}
        <MockSectionPanel accentColor={accentColor}>
          <div className="flex items-center gap-2 w-full p-4">
            <Clock size={13} style={{ color: accentColor }} className="flex-shrink-0" />
            <span className="text-xs font-bold tracking-wide flex-1" style={{ color: accentColor }}>
              STAY TIMELINE
            </span>
            <Pencil size={13} style={{ color: accentColor }} />
            <ChevronDown size={13} className="rotate-180" style={{ color: accentColor }} />
          </div>

          <div className="px-4 pb-4 border-t border-white/30">
            {ENTRIES.map((entry, i) => (
              <motion.div
                key={entry.label}
                style={{ opacity: reveals[i].opacity, y: reveals[i].y }}
                className="flex gap-3 pt-3"
              >
                <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                  <div className="w-2.5 h-2.5 rounded-full border-[1.5px] border-white" style={{ backgroundColor: entry.dot }} />
                  <div className="w-px flex-1 bg-ios-gray-4 mt-1" style={{ minHeight: '2rem' }} />
                </div>
                <div className="flex-1 pb-2">
                  <p className="text-[12px] font-semibold text-gray-800 leading-tight">{entry.label}</p>
                  <p className="text-[11px] text-ios-gray-1 mt-0.5">
                    {entry.sub}
                    {entry.current && <span className="ml-1.5 text-ios-green font-medium">(current)</span>}
                  </p>
                </div>
              </motion.div>
            ))}
            <motion.div style={{ opacity: footerReveal.opacity, y: footerReveal.y }} className="flex gap-3 pt-2">
              <div className="w-2.5 h-2.5 rounded-full bg-ios-green animate-pulse flex-shrink-0 mt-0.5" />
              <p className="text-[12px] font-semibold text-ios-green">Active · 9 days total</p>
            </motion.div>
          </div>
        </MockSectionPanel>
      </div>
    </div>
  )
}
