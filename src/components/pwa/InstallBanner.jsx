import { useState } from 'react'
import { Download, X } from 'lucide-react'
import { usePwaInstall } from '../../context/PwaInstallContext'

const DISMISS_KEY = 'wr_install_banner_dismissed'

/*
 * Auto-appearing glass banner shown when the app is installable and not already
 * installed. Dismissal is remembered in localStorage so it doesn't nag. Tapping
 * "Install" opens the shared confirm modal (which then does the real native
 * install on Android, or the guided steps on iOS).
 *
 * Sits above the floating mobile tab pill (bottom-5) and respects the iOS home
 * indicator via safe-area inset.
 */
export default function InstallBanner() {
  const { installAvailable, openInstallModal } = usePwaInstall()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  if (!installAvailable || dismissed) return null

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* private mode — just hide for this session */
    }
  }

  return (
    <div
      className="fixed left-3 right-3 z-[45] sm:left-auto sm:right-5 sm:w-80 bottom-24 sm:bottom-5"
      style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center gap-3 bg-white/90 backdrop-blur-xl border border-white/60 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] px-3.5 py-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-ios-blue/10 flex items-center justify-center">
          <img src="/wardrounds-icon.png" alt="" className="w-7 h-7 object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight">Install WardRounds</p>
          <p className="text-xs text-ios-gray-1 leading-tight truncate">
            Add it to your home screen
          </p>
        </div>
        <button
          onClick={openInstallModal}
          className="flex-shrink-0 flex items-center gap-1.5 bg-ios-blue text-white rounded-full px-3.5 py-2 text-sm font-semibold shadow-ios-card transition-all active:scale-95 hover:bg-blue-600"
        >
          <Download size={15} />
          Install
        </button>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="flex-shrink-0 p-1.5 rounded-full text-ios-gray-1 hover:bg-black/5 transition-all"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
