import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, UserPlus, Stethoscope, BarChart2, Settings, LogOut, Menu, X, ChevronDown,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSidebar } from '../context/SidebarContext'
import { signOut } from '../lib/auth'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/patients', icon: Users, label: 'Patients' },
  { to: '/outpatient', icon: Stethoscope, label: 'Outpatient' },
  { to: '/admit', icon: UserPlus, label: 'Admit' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [userExpanded, setUserExpanded] = useState(false)
  const { mobileOpen, setMobileOpen } = useSidebar()
  const { user } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}


      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-3 bottom-3 left-3 md:relative md:top-auto md:bottom-auto md:left-auto
          z-40 md:z-auto
          flex flex-col md:h-[calc(100vh-1.5rem)]
          rounded-2xl
          glass border border-white/30
          shadow-xl
          transition-all duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-[120%] md:translate-x-0'}
          ${collapsed ? 'md:w-[72px]' : 'md:w-56'}
          w-64
        `}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 p-4 border-b border-white/20 ${collapsed ? 'md:justify-center' : ''}`}>
          <div className="w-9 h-9 rounded-2xl bg-ios-blue flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold">W</span>
          </div>
          {!collapsed && (
            <div className="flex-1 md:block">
              <p className="font-bold text-sm leading-tight">WardRounds</p>
              <p className="text-xs text-ios-gray-1 leading-tight">Clinical Tracker</p>
            </div>
          )}
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1.5 rounded-xl hover:bg-black/5 transition-colors ml-auto"
          >
            <X size={16} className="text-ios-gray-1" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all
                 ${isActive
                   ? 'bg-ios-blue text-white shadow-ios-card'
                   : 'text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'
                 }
                 ${collapsed ? 'md:justify-center md:px-2' : ''}
                `
              }
            >
              <Icon size={18} className="flex-shrink-0" />
              <span className={collapsed ? 'md:hidden' : ''}>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className={`px-3 pt-3 pb-4 border-t border-white/20 space-y-1`}>
          {user && !collapsed && (
            <div className="mb-1">
              {/* Collapsible user header */}
              <button
                onClick={() => setUserExpanded(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-2xl hover:bg-black/5 dark:hover:bg-white/10 transition-all"
              >
                <div className="min-w-0 text-left">
                  <p className="text-sm font-medium truncate">{user.full_name}</p>
                  <p className="text-xs text-ios-gray-1 capitalize">{user.role?.replace('_', ' ')}</p>
                </div>
                <ChevronDown
                  size={14}
                  className={`text-ios-gray-1 flex-shrink-0 ml-2 transition-transform duration-200 ${userExpanded ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Sub-links */}
              {userExpanded && (
                <div className="mt-1 space-y-0.5 pl-3">
                  <button
                    onClick={() => { navigate('/analytics'); setMobileOpen(false); setUserExpanded(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-all"
                  >
                    <BarChart2 size={13} className="flex-shrink-0" />
                    Analytics
                  </button>
                  <button
                    onClick={() => { navigate('/settings'); setMobileOpen(false); setUserExpanded(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 transition-all"
                  >
                    <Settings size={13} className="flex-shrink-0" />
                    Settings
                  </button>
                  <button
                    onClick={() => { handleLogout(); setMobileOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-ios-red hover:bg-ios-red/10 transition-all"
                  >
                    <LogOut size={13} className="flex-shrink-0" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}

          {collapsed && (
            <>
              <button
                onClick={() => navigate('/analytics')}
                className="hidden md:flex w-full items-center justify-center px-2 py-2.5 rounded-2xl text-sm text-ios-gray-1 hover:bg-black/5 transition-all"
                title="Analytics"
              >
                <BarChart2 size={18} />
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="hidden md:flex w-full items-center justify-center px-2 py-2.5 rounded-2xl text-sm text-ios-gray-1 hover:bg-black/5 transition-all"
                title="Settings"
              >
                <Settings size={18} />
              </button>
              <button
                onClick={handleLogout}
                className="hidden md:flex w-full items-center justify-center px-2 py-2.5 rounded-2xl text-sm text-ios-red hover:bg-ios-red/10 transition-all"
                title="Sign Out"
              >
                <LogOut size={18} />
              </button>
            </>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`hidden md:flex w-full items-center gap-3 px-3 py-2.5 rounded-2xl text-sm
                        text-ios-gray-1 hover:bg-black/5 transition-all
                        ${collapsed ? 'justify-center px-2' : ''}`}
          >
            {collapsed ? <Menu size={18} /> : <X size={18} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
