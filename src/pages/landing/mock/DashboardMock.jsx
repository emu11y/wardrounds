import {
  BedDouble, UserPlus, Stethoscope, CalendarClock, Users, BarChart2, Settings,
} from 'lucide-react'
import MockPatientCard from './PatientCard'

const SIDEBAR_ITEMS = [
  { icon: BedDouble, label: 'Inpatient', active: true },
  { icon: UserPlus, label: 'Admit Patient' },
  { icon: Stethoscope, label: 'Outpatient' },
  { icon: CalendarClock, label: 'Appointments' },
  { icon: Users, label: 'Patients' },
  { icon: BarChart2, label: 'Analytics' },
  { icon: Settings, label: 'Settings' },
]

const STAT_CHIPS = [
  { name: 'ALL HOSPITALS', count: 20, bg: 'rgba(0,122,255,0.12)', border: 'rgba(0,122,255,0.3)' },
  { name: 'NAIROBI HOSP.', count: 12, bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' },
  { name: 'AGA KHAN', count: 8, bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
]

// Settled-state values for MockPatientCard's reveal props — the mock renders
// fully revealed, with no animation of its own.
export const REVEALED = { opacity: 1, y: 0 }
export const REVEALS_DONE = [REVEALED, REVEALED, REVEALED]

// The MacBook dashboard screen content (sidebar + stat header + patient grid).
// Consumers wrap it in MacBookFrame themselves; it is static and settled.
export default function DashboardMock() {
  return (
    <div style={{ zoom: 0.62 }} className="flex bg-slate-950">
      <div className="hidden w-40 flex-shrink-0 flex-col bg-white/70 backdrop-blur-xl border-r border-white/30 sm:flex">
        {/* Logo */}
        <div className="flex items-center gap-2 p-3 border-b border-white/20">
          <div
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[9px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #007AFF, #5856D6)' }}
          >
            W
          </div>
          <p className="text-xs font-bold text-gray-900 leading-tight">WardRounds</p>
        </div>

        <div className="flex flex-col gap-1 p-3">
          {SIDEBAR_ITEMS.map(({ icon: Icon, label, active }) => (
            <div
              key={label}
              className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-medium ${
                active ? 'bg-[#007AFF] text-white' : 'text-gray-600'
              }`}
            >
              <Icon size={14} />
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-3 p-3">
        <div className="rounded-2xl bg-gradient-to-r from-[#1a237e] to-[#1565c0] p-3">
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl text-[10px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #007AFF, #5856D6)' }}
            >
              W
            </div>
            <div>
              <p className="text-xs font-bold text-white">WardRounds</p>
              <p className="text-[9px] text-blue-200">Hospital Overview</p>
            </div>
          </div>

          <div className="mt-2.5 flex gap-2">
            {STAT_CHIPS.map(chip => (
              <div
                key={chip.name}
                className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border p-2"
                style={{ backgroundColor: chip.bg, borderColor: chip.border }}
              >
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/35 via-white/8 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                <div className="relative z-10">
                  <p className="truncate text-[8px] font-bold uppercase tracking-wide text-white">{chip.name}</p>
                  <p className="mt-0.5 text-sm font-bold text-white">
                    {chip.count} <span className="text-[8px] font-normal text-white/70">patients</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-ios-gray-6 p-3">
          <div className="grid grid-cols-2 gap-3">
            <MockPatientCard
              accentColor="#007AFF"
              wardLabel="ICU"
              formattedTotal="KES 84,000"
              reveals={REVEALS_DONE}
              footerReveal={REVEALED}
              initials="WK"
              name="Wanjiku Kamau"
              patientNumber="#11482956"
              ageDob="34 yrs · 12 Mar 1992"
              hospitalName="M.P. Shah Hospital"
            />
            <MockPatientCard
              accentColor="#F59E0B"
              wardLabel="General Ward"
              formattedTotal="KES 32,000"
              reveals={REVEALS_DONE}
              footerReveal={REVEALED}
              initials="DO"
              name="David Ochieng"
              patientNumber="#20871134"
              ageDob="58 yrs · 3 Nov 1967"
              hospitalName="Aga Khan Hospital"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
