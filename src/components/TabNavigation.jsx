import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, Stethoscope, UserPlus, Settings } from 'lucide-react'

const tabs = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/patients', icon: Users, label: 'Patients' },
  { to: '/outpatient', icon: Stethoscope, label: 'Outpatient' },
  { to: '/admit', icon: UserPlus, label: 'Admit' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function TabNavigation() {
  return (
    <nav className="md:hidden fixed bottom-4 left-4 right-4 z-30">
      <div className="flex glass border border-white/30 shadow-xl rounded-2xl px-2 py-2">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-all
               ${isActive ? 'text-ios-blue' : 'text-ios-gray-1'}`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-ios-blue/10' : ''}`}>
                  <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                </div>
                <span className="text-[10px] font-medium leading-tight">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
