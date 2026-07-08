import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import ModalShell from '../../components/ModalShell'
import AuthForm from '../../components/auth/AuthForm'

export default function AuthModal({ open, mode, onModeChange, onClose }) {
  const [stage, setStage] = useState('form')

  useEffect(() => {
    if (!open) return
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  return (
    <ModalShell open={open} onClose={onClose} maxWidth="max-w-md" backdropVariant="dark">
      <div className="glass-rim rounded-3xl p-2.5 max-h-[90vh] flex flex-col">
        <div className="surface-shell flex-1 min-h-0 relative">
          <button
            onClick={onClose}
            className="absolute right-5 top-5 z-10 text-gray-400 transition-colors hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="overflow-y-auto flex-1 min-h-0 p-8" data-lenis-prevent>
            <AuthTogglePill mode={mode} stage={stage} onModeChange={onModeChange} />

            <AuthForm
              mode={mode || 'signin'}
              onModeChange={onModeChange}
              onStageChange={setStage}
              idPrefix="landing-auth"
              onSuccess={onClose}
            />
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

function AuthTogglePill({ mode, stage, onModeChange }) {
  if (stage !== 'form' || (mode !== 'signin' && mode !== 'signup')) return null

  return (
    <div className="mb-6 flex rounded-2xl bg-gray-100/80 p-1">
      <button
        type="button"
        onClick={() => onModeChange('signin')}
        className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 ${
          mode === 'signin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Sign In
      </button>
      <button
        type="button"
        onClick={() => onModeChange('signup')}
        className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 ${
          mode === 'signup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Sign Up
      </button>
    </div>
  )
}
