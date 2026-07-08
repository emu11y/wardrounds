import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthForm from '../components/auth/AuthForm'

// Focused sign-in page for returning users — logout and protected-route
// fallbacks land here. Marketing lives at "/" (src/pages/landing/Landing.jsx).
// AuthForm is the shared auth component (also used by the landing AuthModal);
// all Supabase auth calls stay in that one place.

const BRAND_GRADIENT = 'linear-gradient(155deg,#0B1031 0%,#1a1f5e 38%,#1e5fa8 72%,#0a7fd4 100%)'

export default function Login() {
  const [mode, setMode] = useState('signin')
  const [stage, setStage] = useState('form')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{ background: BRAND_GRADIENT }}>
      <Link to="/" className="flex items-center gap-3 mb-8">
        <img src="/wardrounds-icon.png" alt="WardRounds" className="w-10 h-10 rounded-xl" />
        <span className="text-white font-bold text-xl tracking-tight">WardRounds</span>
      </Link>

      <div className="bg-white/85 backdrop-blur-2xl border border-white/60 rounded-3xl shadow-2xl p-8 w-full max-w-md">
        {stage === 'form' && (mode === 'signin' || mode === 'signup') && (
          <div className="flex bg-gray-100/80 rounded-2xl p-1 mb-6">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                mode === 'signin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                mode === 'signup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Sign Up
            </button>
          </div>
        )}
        <AuthForm mode={mode} onModeChange={setMode} onStageChange={setStage} idPrefix="login-page" />
      </div>

      <Link to="/" className="mt-6 text-sm text-white/70 hover:text-white transition-colors">
        ← Back to the WardRounds site
      </Link>
    </div>
  )
}
