import { useState } from 'react'
import { Bell, Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSidebar } from '../context/SidebarContext'
import NotificationCenter from './NotificationCenter'

export default function TopHeader({ title, onMenuToggle, menuOpen }) {
  const { user } = useAuth()
  const sidebar = useSidebar()
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const handleMenuToggle = onMenuToggle ?? sidebar?.toggleMobile
  const isMenuOpen = menuOpen ?? sidebar?.mobileOpen

  return (
    <>
      <header className="sticky top-0 z-[61] bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shadow-[0_4px_24px_rgba(0,0,0,0.10)]">
        <button
          onClick={handleMenuToggle}
          className="md:hidden p-2 rounded-xl hover:bg-black/5 transition-colors"
        >
          {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div className="flex items-center gap-2.5 flex-1">
          <img src="/wardrounds-icon.png" className="w-8 h-8 object-contain flex-shrink-0" alt="WardRounds" />
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
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </header>

      <NotificationCenter
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
        onUnreadCountChange={setUnreadCount}
      />
    </>
  )
}
