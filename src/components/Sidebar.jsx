import { useState, useRef } from 'react'
import Backdrop from './Backdrop'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, UserPlus, Stethoscope, BedDouble, CalendarClock,
  BarChart2, Settings, LogOut, Menu, X, ChevronDown, Lock, Download,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSidebar } from '../context/SidebarContext'
import { usePwaInstall } from '../context/PwaInstallContext'
import { signOut } from '../lib/auth'

// Grouped nav: parent groups expand to reveal children; Patients is standalone.
const navGroups = [
  {
    key: 'inpatient',
    permKey: 'view_inpatient',
    icon: BedDouble,
    label: 'Inpatient',
    children: [
      { to: '/', icon: LayoutDashboard, label: 'Inpatient Dashboard', end: true },
      { to: '/admit', icon: UserPlus, label: 'Admit Patient', permKey: 'view_admit' },
    ],
  },
  {
    key: 'outpatient',
    permKeys: ['view_outpatient', 'view_appointments'],
    icon: Stethoscope,
    label: 'Outpatient',
    children: [
      { to: '/outpatient', icon: LayoutDashboard, label: 'Outpatient Dashboard', end: true, permKey: 'view_outpatient' },
      { to: '/appointments', icon: CalendarClock, label: 'Appointments', permKey: 'view_appointments' },
    ],
  },
]

const standaloneItems = [
  { to: '/patients', icon: Users, label: 'Patients', permKey: 'view_patients' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { mobileOpen, setMobileOpen } = useSidebar()

  const { user, permissions } = useAuth()
  const { installAvailable, openInstallModal } = usePwaInstall()
  const navigate = useNavigate()
  const location = useLocation()

  // SHOW-LOCKED: locked items stay visible (dimmed, with a lock) and still
  // navigate — PageGuard renders the denied state on arrival.
  const isLocked = (key) => Boolean(key) && permissions?.[key] === false
  const groupLocked = (group) => group.permKeys ? group.permKeys.every(k => permissions?.[k] === false) : isLocked(group.permKey)

  // A group starts open if the current route belongs to one of its children
  const groupContainsActive = (group) =>
    group.children.some(c => c.end ? location.pathname === c.to : location.pathname.startsWith(c.to))

  const [openGroup, setOpenGroup] = useState(() => {
    const active = navGroups.find(g => groupContainsActive(g))
    return active ? active.key : 'inpatient'
  })

  // Collapsed-sidebar hover flyout (desktop only). Generic: holds a label + a list of
  // { key, icon, label, onClick, active?, danger? } items, so it serves both nav groups
  // and the user menu. Anchored via getBoundingClientRect so it escapes the nav's
  // overflow-y-auto clip; a short close-delay bridges the icon→flyout gap.
  const [flyout, setFlyout] = useState(null)
  const flyoutTimer = useRef(null)

  const cancelClose = () => {
    if (flyoutTimer.current) { clearTimeout(flyoutTimer.current); flyoutTimer.current = null }
  }
  const scheduleClose = () => {
    cancelClose()
    flyoutTimer.current = setTimeout(() => setFlyout(null), 80)
  }

  const openGroupFlyout = (e, group) => {
    cancelClose()
    const r = e.currentTarget.getBoundingClientRect()
    const items = group.children
      .map(c => ({
        key: c.to,
        icon: c.icon,
        label: c.label,
        locked: isLocked(c.permKey),
        active: c.end ? location.pathname === c.to : location.pathname.startsWith(c.to),
        onClick: () => { navigate(c.to); setFlyout(null); setMobileOpen(false) },
      }))
    setFlyout({ label: group.label, items, top: r.top, left: r.right })
  }

  const openUserFlyout = (e) => {
    cancelClose()
    const r = e.currentTarget.getBoundingClientRect()
    const items = []
    items.push({
      key: 'analytics', icon: BarChart2, label: 'Analytics',
      locked: isLocked('view_analytics'),
      active: location.pathname.startsWith('/analytics'),
      onClick: () => { navigate('/analytics'); setFlyout(null); setMobileOpen(false) },
    })
    items.push({
      key: 'settings', icon: Settings, label: 'Settings',
      active: location.pathname.startsWith('/settings'),
      onClick: () => { navigate('/settings'); setFlyout(null); setMobileOpen(false) },
    })
    if (installAvailable) {
      items.push({
        key: 'install', icon: Download, label: 'Install App',
        onClick: () => { openInstallModal(); setFlyout(null); setMobileOpen(false) },
      })
    }
    items.push({
      key: 'signout', icon: LogOut, label: 'Sign Out', danger: true,
      onClick: () => { handleLogout(); setFlyout(null); setMobileOpen(false) },
    })
    // Bottom-anchored: flyout grows upward from the avatar so it can't run off-screen.
    setFlyout({ label: user?.full_name || 'Account', items, bottom: window.innerHeight - r.bottom, left: r.right })
  }

  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <Backdrop zIndex="z-40" onClick={() => setMobileOpen(false)} className="md:hidden" />
      )}


      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-3 md:relative md:top-auto md:bottom-auto md:left-auto
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
          <img src="/wardrounds-icon.png" className="w-9 h-9 object-contain flex-shrink-0" alt="WardRounds" />
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
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {/* Expandable groups */}
          {navGroups.map((group) => {
            const parentLocked = groupLocked(group)
            const GroupIcon = group.icon
            const isOpen = openGroup === group.key
            const hasActiveChild = groupContainsActive(group)

            // Collapsed sidebar: icon jumps to first child on click, reveals flyout on hover
            if (collapsed) {
              return (
                <button
                  key={group.key}
                  onClick={() => { navigate(group.children[0].to); setMobileOpen(false) }}
                  onMouseEnter={(e) => openGroupFlyout(e, group)}
                  onMouseLeave={scheduleClose}
                  className={`hidden md:flex w-full items-center justify-center px-2 py-2.5 rounded-2xl text-sm transition-all
                    ${hasActiveChild ? 'bg-ios-blue text-white shadow-ios-card' : 'text-gray-600 hover:bg-black/5'}
                    ${parentLocked ? 'opacity-60' : ''}`}
                >
                  <GroupIcon size={18} />
                </button>
              )
            }

            return (
              <div key={group.key}>
                {/* Parent toggle — expand/collapse only */}
                <button
                  onClick={() => setOpenGroup(openGroup === group.key ? null : group.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all
                    ${hasActiveChild ? 'text-ios-blue' : 'text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'}
                    ${parentLocked ? 'opacity-60' : ''}`}
                >
                  <GroupIcon size={18} className="flex-shrink-0" />
                  <span className="flex-1 text-left">{group.label}</span>
                  {parentLocked && <Lock size={12} className="flex-shrink-0 text-ios-gray-1" />}
                  <ChevronDown
                    size={14}
                    className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Children */}
                <div className={`overflow-hidden transition-all duration-300 ease-out ${isOpen ? 'max-h-40 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                  <div className="pl-3 space-y-0.5">
                    {group.children.map(({ to, icon: ChildIcon, label, end, permKey: childPermKey }) => {
                      const locked = isLocked(childPermKey)
                      return (
                        <NavLink
                          key={to}
                          to={to}
                          end={end}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all
                             ${isActive
                               ? 'bg-ios-blue text-white shadow-ios-card'
                               : 'text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'}
                             ${locked ? 'opacity-60' : ''}`
                          }
                        >
                          <ChildIcon size={15} className="flex-shrink-0" />
                          <span>{label}</span>
                          {locked && <Lock size={12} className="ml-auto flex-shrink-0 text-ios-gray-1" />}
                        </NavLink>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Standalone items */}
          {standaloneItems.map(({ to, icon: Icon, label, permKey }) => {
            const locked = isLocked(permKey)
            return (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all
                   ${isActive
                     ? 'bg-ios-blue text-white shadow-ios-card'
                     : 'text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10'
                   }
                   ${collapsed ? 'md:justify-center md:px-2' : ''}
                   ${locked ? 'opacity-60' : ''}
                  `
                }
              >
                <Icon size={18} className="flex-shrink-0" />
                <span className={collapsed ? 'md:hidden' : ''}>{label}</span>
                {locked && <Lock size={12} className={`ml-auto flex-shrink-0 text-ios-gray-1 ${collapsed ? 'md:hidden' : ''}`} />}
              </NavLink>
            )
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 pt-3 pb-4 border-t border-white/20">
          {user && !collapsed && (
            // Glassmorphic account card — the #023859 tint stays visible whether
            // collapsed or expanded (only the menu section's height animates),
            // so the container always reads as high-contrast, not just on hover.
            <div className="rounded-2xl overflow-hidden bg-[#023859]/85 backdrop-blur-xl border border-white/10 shadow-lg">
              {/* Profile row — always visible accordion toggle */}
              <button
                onClick={() => setOpenGroup(openGroup === 'user' ? null : 'user')}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 transition-colors"
              >
                <div className="flex-shrink-0">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover ring-2 ring-white/20" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center">
                      <span className="text-xl font-bold text-white">{user.full_name?.[0]?.toUpperCase() || '?'}</span>
                    </div>
                  )}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white leading-tight break-words">{user.full_name}</p>
                  <p className="text-xs text-white/60 capitalize">{user.role?.replace('_', ' ')}</p>
                </div>
                <ChevronDown
                  size={14}
                  className={`text-white/60 flex-shrink-0 transition-transform duration-[400ms] ${openGroup === 'user' ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Toggleable menu — smooth (not-too-fast) expand within the same tinted card */}
              <div className={`overflow-hidden transition-all duration-[400ms] ease-in-out ${openGroup === 'user' ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="space-y-0.5 px-2 pb-2 pt-1 border-t border-white/10 mx-2">
                  <button
                    onClick={() => { navigate('/analytics'); setMobileOpen(false) }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/80 hover:bg-white/10 transition-colors ${isLocked('view_analytics') ? 'opacity-60' : ''}`}
                  >
                    <BarChart2 size={13} className="flex-shrink-0" />
                    Analytics
                    {isLocked('view_analytics') && <Lock size={12} className="ml-auto flex-shrink-0 text-white/50" />}
                  </button>
                  <button
                    onClick={() => { navigate('/settings'); setMobileOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/80 hover:bg-white/10 transition-colors"
                  >
                    <Settings size={13} className="flex-shrink-0" />
                    Settings
                  </button>
                  {installAvailable && (
                    <button
                      onClick={() => { openInstallModal(); setMobileOpen(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-sky-300 hover:bg-white/10 transition-colors"
                    >
                      <Download size={13} className="flex-shrink-0" />
                      Install App
                    </button>
                  )}
                  <button
                    onClick={() => { handleLogout(); setMobileOpen(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-red-300 hover:bg-red-500/20 transition-colors"
                  >
                    <LogOut size={13} className="flex-shrink-0" />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Collapsed footer: avatar (hover → user menu flyout) + expand toggle */}
          {collapsed && (
            <div className="hidden md:flex flex-col items-center gap-1">
              {user && (
                <button
                  onMouseEnter={openUserFlyout}
                  onMouseLeave={scheduleClose}
                  onClick={() => { navigate('/settings'); setMobileOpen(false) }}
                  title={user.full_name}
                  className="w-full flex items-center justify-center px-2 py-2 rounded-2xl hover:bg-black/5 transition-all"
                >
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-ios-blue/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-ios-blue">{user.full_name?.[0]?.toUpperCase() || '?'}</span>
                    </div>
                  )}
                </button>
              )}
              <button
                onClick={() => { setCollapsed(!collapsed); setFlyout(null) }}
                className="w-full flex items-center justify-center px-2 py-2.5 rounded-2xl text-sm text-ios-gray-1 hover:bg-black/5 transition-all"
                title="Expand sidebar"
              >
                <Menu size={18} />
              </button>
            </div>
          )}
        </div>

        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="hidden md:flex items-center gap-2 mx-3 mb-3 px-3 py-2 rounded-xl text-xs text-ios-gray-1 hover:bg-black/5 transition-all"
          >
            <X size={13} className="flex-shrink-0" />
            Collapse
          </button>
        )}
      </aside>

      {/* Collapsed hover flyout — fixed so it escapes the nav overflow clip (desktop only).
          Serves both nav groups and the user menu via the generic items model. */}
      {flyout && (
        <div
          className="hidden md:block fixed z-50 pl-2"
          style={{ top: flyout.top, bottom: flyout.bottom, left: flyout.left }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="glass border border-white/40 rounded-2xl shadow-xl py-2 min-w-44 overflow-hidden">
            <p className="px-3 pt-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-ios-gray-1 truncate">
              {flyout.label}
            </p>
            <div className="px-1.5 space-y-0.5">
              {flyout.items.map(({ key, icon: ItemIcon, label, onClick, active, danger, locked }) => (
                <button
                  key={key}
                  onClick={onClick}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-left transition-all
                    ${danger
                      ? 'text-ios-red hover:bg-ios-red/10'
                      : active
                        ? 'bg-ios-blue text-white shadow-ios-card'
                        : 'text-gray-600 hover:bg-black/5'}
                    ${locked ? 'opacity-60' : ''}`}
                >
                  <ItemIcon size={15} className="flex-shrink-0" />
                  <span>{label}</span>
                  {locked && <Lock size={12} className="ml-auto flex-shrink-0 text-ios-gray-1" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
