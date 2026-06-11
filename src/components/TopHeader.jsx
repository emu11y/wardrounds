import { useState } from 'react'
import { Bell, Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSidebar } from '../context/SidebarContext'
import NotificationCenter from './NotificationCenter'

export default function TopHeader({ title, onMenuToggle, menuOpen }) {
  const { user } = useAuth()
  const sidebar = useSidebar()
  const [showNotifications, setShowNotifications] = useState(false)

  const handleMenuToggle = onMenuToggle ?? sidebar?.toggleMobile
  const isMenuOpen = menuOpen ?? sidebar?.mobileOpen

  return (
    <>
      <header className="sticky top-0 z-30 glass border-b border-white/20 px-4 py-3 flex items-center gap-3">
        <button
          onClick={handleMenuToggle}
          className="md:hidden p-2 rounded-xl hover:bg-black/5 transition-colors"
        >
          {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div className="flex items-center gap-2.5 flex-1">
          <div className="w-8 h-8 rounded-xl bg-ios-blue flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">W</span>
          </div>
          <div>
            <h1 className="font-semibold text-base leading-tight">{title || 'WardRounds'}</h1>
            {user && (
              <p className="text-xs text-ios-gray-1 leading-tight">{user.full_name}</p>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowNotifications(true)}
          className="relative p-2 rounded-xl hover:bg-black/5 transition-colors"
        >
          <Bell size={20} className="text-ios-gray-1" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-ios-red rounded-full" />
        </button>
      </header>

      <NotificationCenter
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </>
  )
}
