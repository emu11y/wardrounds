import { useState, useEffect } from 'react'
import { Download, Share, SquarePlus, Check, ArrowDown } from 'lucide-react'
import ModalShell from '../ModalShell'
import { usePwaInstall } from '../../context/PwaInstallContext'

/*
 * Single confirm-first install flow for both platforms:
 *   Android/Chromium → "Install" fires the REAL native prompt (deferredPrompt).
 *   iOS Safari       → "Install" reveals the guided Add-to-Home-Screen steps,
 *                      because Apple exposes no programmatic install.
 */
export default function InstallModal() {
  const { modalOpen, closeInstallModal, isIOS, canPromptInstall, promptInstall } = usePwaInstall()
  const [step, setStep] = useState('confirm') // 'confirm' | 'ios-steps'
  const [busy, setBusy] = useState(false)

  // Reset to the confirm step whenever the modal reopens.
  useEffect(() => {
    if (modalOpen) setStep('confirm')
  }, [modalOpen])

  if (!modalOpen) return null

  async function handleInstall() {
    if (canPromptInstall) {
      setBusy(true)
      try {
        await promptInstall() // native Android sheet; appinstalled closes us
      } finally {
        setBusy(false)
        closeInstallModal()
      }
      return
    }
    // iOS (or any browser without a native prompt): show the guided steps.
    setStep('ios-steps')
  }

  return (
    <ModalShell open={modalOpen} onClose={closeInstallModal} maxWidth="max-w-[300px]">
      <div className="glass-rim rounded-3xl p-5">
        {step === 'confirm' ? (
          <>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-ios-blue/10 flex items-center justify-center mb-4">
                <img
                  src="/wardrounds-icon.png"
                  alt="WardRounds"
                  className="w-12 h-12 object-contain"
                />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Install WardRounds?</h2>
              <p className="mt-1.5 text-sm text-ios-gray-1 leading-relaxed">
                Add WardRounds to your home screen for a full-screen, app-like experience —
                faster to open, no browser bars.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                onClick={handleInstall}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 bg-ios-blue text-white rounded-full px-5 py-3 font-semibold shadow-ios-card transition-all active:scale-95 hover:bg-blue-600 disabled:opacity-50"
              >
                <Download size={18} />
                {busy ? 'Installing…' : 'Install'}
              </button>
              <button
                onClick={closeInstallModal}
                className="w-full rounded-full px-5 py-3 font-medium text-ios-gray-1 bg-black/5 hover:bg-black/10 transition-all active:scale-95"
              >
                Not now
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-ios-blue/10 flex items-center justify-center mb-3">
                <Share size={26} className="text-ios-blue" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Add to Home Screen</h2>
              <p className="mt-1 text-sm text-ios-gray-1 leading-relaxed">
                iPhone &amp; iPad install from the Safari <span className="font-semibold">Share</span> menu —
                two quick taps:
              </p>
            </div>

            <ol className="mt-5 space-y-3">
              <li className="flex items-center gap-3 rounded-2xl bg-black/[0.03] px-4 py-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-ios-blue text-white text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <span className="text-sm text-gray-800 flex items-center gap-1.5">
                  Tap the <Share size={16} className="inline text-ios-blue" />
                  <span className="font-semibold">Share</span> button below
                </span>
              </li>
              <li className="flex items-center gap-3 rounded-2xl bg-black/[0.03] px-4 py-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-ios-blue text-white text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <span className="text-sm text-gray-800 flex items-center gap-1.5">
                  Choose <SquarePlus size={16} className="inline text-ios-blue" />
                  <span className="font-semibold">Add to Home Screen</span>
                </span>
              </li>
            </ol>

            {/* Animated pointer toward the Safari share control (bottom of screen). */}
            <div className="mt-4 flex flex-col items-center text-ios-blue">
              <ArrowDown size={22} className="animate-bounce" />
              <span className="text-[11px] text-ios-gray-1 mt-0.5">Share is at the bottom of Safari</span>
            </div>

            <button
              onClick={closeInstallModal}
              className="mt-5 w-full flex items-center justify-center gap-2 bg-ios-blue text-white rounded-full px-5 py-3 font-semibold shadow-ios-card transition-all active:scale-95 hover:bg-blue-600"
            >
              <Check size={18} />
              Got it
            </button>
          </>
        )}
      </div>
    </ModalShell>
  )
}
