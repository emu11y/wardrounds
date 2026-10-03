import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { BedDouble, Stethoscope, CalendarClock, Settings, Clock3 } from 'lucide-react'
import { routeVisible } from '../lib/onboarding'
import { useAuth } from '../context/AuthContext'
import { usePwaInstall } from '../context/PwaInstallContext'

export default function TabNavigation() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const [isScrollingDown, setIsScrollingDown] = useState(false)
  const lastScrollY = useRef(0)
  const { user, modules, permissions } = useAuth()
  const { isStandalone } = usePwaInstall()
  const avatar_url = user?.avatar_url
  const nameParts = user?.full_name?.trim().split(/\s+/) || []
  const initials = nameParts.length > 1
    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
    : nameParts[0]?.[0]?.toUpperCase() || '?'

  useEffect(() => {
    const scrollEl = document.querySelector('#main-scroll')
      || document.querySelector('main')
      || document.querySelector('.overflow-y-auto')

    if (!scrollEl) return

    const handleScroll = () => {
      const currentY = scrollEl.scrollTop
      setIsScrollingDown(currentY > lastScrollY.current && currentY > 20)
      lastScrollY.current = currentY
    }

    scrollEl.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollEl.removeEventListener('scroll', handleScroll)
  }, [])

  const inpatientActive = pathname === '/' || pathname.startsWith('/dashboard') || pathname.startsWith('/admit')
  const outpatientActive = pathname.startsWith('/outpatient')
  const appointmentsActive = pathname.startsWith('/appointments')
  const settingsActive = pathname.startsWith('/settings')
  const shiftsActive = pathname.startsWith('/shifts')

  // Tabs follow the user's modules (pay types from setup). Shifts gets a tab only
  // for clinicians paid per shift; with no pay types recorded the classic four show.
  const navItems = [
    { to: '/',             label: 'Inpatient',    Icon: BedDouble,     active: inpatientActive },
    { to: '/outpatient',   label: 'Outpatient',   Icon: Stethoscope,   active: outpatientActive },
    { to: '/appointments', label: 'Appointments', Icon: CalendarClock, active: appointmentsActive },
    ...(modules?.shifts && permissions?.view_shifts === true ? [{ to: '/shifts', label: 'Shifts', Icon: Clock3, active: shiftsActive }] : []),
    { to: '/settings',     label: 'Settings',     Icon: Settings,      active: settingsActive },
  ]
    .filter(i => routeVisible(modules, i.to))
    .map(i => ({ ...i, onClick: () => navigate(i.to) }))

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 z-50 sm:hidden transition-all duration-300 ease-in-out ${
        isScrollingDown ? 'scale-90 opacity-80' : 'scale-100 opacity-100'
      }`}
      // Offset from the bottom edge + the iOS home-indicator inset, so the pill
      // never sits under the home indicator when installed (standalone) on iPhone.
      // Installed (standalone): sit lower — no browser toolbar to clear — giving
      // page content more vertical real estate. In-browser: keep a larger gap so
      // the pill clears Safari/Chrome's bottom bar.
      style={{
        bottom: isStandalone
          ? `max(0px, calc(env(safe-area-inset-bottom, 0px) - ${isScrollingDown ? '0.75rem' : '0.5rem'}))`
          : `calc(${isScrollingDown ? '0.75rem' : '1.25rem'} + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <div className="flex items-center gap-1 px-2 py-1.5 rounded-full bg-white/90 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] border border-white/60">
        {navItems.map(({ label, Icon, active, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-full transition-all duration-200 ${
              active ? 'bg-[#007AFF]/10 text-[#007AFF]' : 'bg-transparent text-gray-400'
            }`}
          >
            {label === 'Settings'
              ? (avatar_url
                  ? <img src={avatar_url} alt="Profile" className={`w-6 h-6 rounded-full object-cover ${active ? 'ring-2 ring-[#007AFF] ring-offset-1' : ''}`} />
                  : <div className={`w-6 h-6 rounded-full bg-[#007AFF] flex items-center justify-center text-white font-semibold ${active ? 'ring-2 ring-[#007AFF] ring-offset-1' : 'text-[10px]'}`} style={{ fontSize: '10px' }}>{initials}</div>
                )
              : <Icon size={20} strokeWidth={active ? 2 : 1.8} />
            }
            <span className={`text-[10px] font-medium leading-none ${active ? 'text-[#007AFF]' : 'text-gray-400'}`}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
