import { useState, useLayoutEffect, useRef } from 'react'
import { Download, X } from 'lucide-react'
import { usePwaInstall } from '../../context/PwaInstallContext'

const DISMISS_KEY = 'wr_install_banner_dismissed'

/*
 * Full-width install bar pinned to the very TOP of the screen (above the page
 * header), so it never floats over or obscures hero/content. While visible it
 * publishes its height to the `--install-banner-h` CSS variable; the landing
 * headers read that var and shift down by exactly this much, so nothing is
 * covered. Dismissal is remembered in localStorage.
 *
 * Mobile-only (sm:hidden) and logged-out surfaces only — inside the app the
 * Sidebar "Install App" row handles this instead.
 */
export default function InstallBanner() {
  const { installAvailable, openInstallModal } = usePwaInstall()
  const ref = useRef(null)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  const visible = installAvailable && !dismissed

  // Publish the bar's height so page headers can offset themselves beneath it.
  useLayoutEffect(() => {
    const root = document.documentElement
    if (visible && ref.current) {
      root.style.setProperty('--install-banner-h', `${ref.current.offsetHeight}px`)
    } else {
      root.style.setProperty('--install-banner-h', '0px')
    }
    return () => root.style.setProperty('--install-banner-h', '0px')
  }, [visible])

  if (!visible) return null

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
      ref={ref}
      className="fixed top-0 inset-x-0 z-[60] sm:hidden bg-white/95 backdrop-blur-xl border-b border-black/10 shadow-sm"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-ios-blue/10 flex items-center justify-center">
          <img src="/wardrounds-icon.png" alt="" className="w-6 h-6 object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight">Install WardRounds</p>
          <p className="text-xs text-ios-gray-1 leading-tight truncate">Add it to your home screen</p>
        </div>
        <button
          onClick={openInstallModal}
          className="flex-shrink-0 flex items-center gap-1.5 bg-ios-blue text-white rounded-full px-3.5 py-1.5 text-sm font-semibold shadow-ios-card transition-all active:scale-95 hover:bg-blue-600"
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
