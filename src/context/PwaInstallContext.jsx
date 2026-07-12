import { createContext, useContext, useState, useEffect, useCallback } from 'react'

/*
 * PWA install state, shared across the app so the Sidebar entry, the dismissible
 * banner and the confirm modal all read one source of truth.
 *
 * Platform reality this encodes:
 *  - Android / Chromium: the browser fires `beforeinstallprompt`; we stash it and
 *    can trigger a REAL one-tap install via deferredPrompt.prompt().
 *  - iOS Safari: Apple exposes NO install API. The best possible flow is a guided
 *    "Share → Add to Home Screen" walkthrough. So on iOS we surface the affordance
 *    (installAvailable = true) but promptInstall() is a no-op — the modal shows
 *    steps instead.
 *  - Already installed (standalone display-mode): hide all install UI.
 */

const PwaInstallContext = createContext(null)

function detectIOS() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isAppleMobile = /iphone|ipad|ipod/i.test(ua)
  // iPadOS 13+ masquerades as desktop Safari (MacIntel + touch).
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return isAppleMobile || isIPadOS
}

function detectStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

export function PwaInstallProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isStandalone, setIsStandalone] = useState(detectStandalone)
  const [modalOpen, setModalOpen] = useState(false)
  const isIOS = detectIOS()

  useEffect(() => {
    const onBeforeInstall = (e) => {
      // Suppress Chrome's mini-infobar; we drive the install from our own UI.
      e.preventDefault()
      setDeferredPrompt(e)
    }
    const onInstalled = () => {
      setDeferredPrompt(null)
      setIsStandalone(true)
      setModalOpen(false)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    const mq = window.matchMedia?.('(display-mode: standalone)')
    const onDisplayChange = (e) =>
      setIsStandalone(e.matches || window.navigator.standalone === true)
    mq?.addEventListener?.('change', onDisplayChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
      mq?.removeEventListener?.('change', onDisplayChange)
    }
  }, [])

  // Android/Chromium: a real native prompt is queued and ready.
  const canPromptInstall = !!deferredPrompt

  // Whether to surface ANY install affordance: not already installed, and either
  // we have a native prompt (Android) or we're on iOS (guided steps).
  const installAvailable = !isStandalone && (canPromptInstall || isIOS)

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return { outcome: 'unavailable' }
    deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    setDeferredPrompt(null) // a prompt can only be used once
    return choice // { outcome: 'accepted' | 'dismissed' }
  }, [deferredPrompt])

  const openInstallModal = useCallback(() => setModalOpen(true), [])
  const closeInstallModal = useCallback(() => setModalOpen(false), [])

  const value = {
    isIOS,
    isStandalone,
    canPromptInstall,
    installAvailable,
    promptInstall,
    modalOpen,
    openInstallModal,
    closeInstallModal,
  }

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>
}

export function usePwaInstall() {
  const ctx = useContext(PwaInstallContext)
  if (!ctx) throw new Error('usePwaInstall must be used within PwaInstallProvider')
  return ctx
}
