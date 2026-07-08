import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'

const inputCls =
  'w-full bg-gray-50/80 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm ' +
  'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 ' +
  'focus:border-[#007AFF] transition-colors'

const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5'

const primaryBtnCls =
  'w-full bg-[#007AFF] hover:bg-[#0066DD] active:bg-[#0055CC] disabled:opacity-60 ' +
  'text-white font-semibold py-3 rounded-xl text-sm transition-all duration-150 ' +
  'flex items-center justify-center gap-2'

function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
}

function EyeOpen() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeClosed() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

const CHECK = (
  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const MODE_CONFIG = {
  signin: { heading: 'Welcome back', sub: 'Sign in to your WardRounds account' },
  signup: { heading: 'Register your practice', sub: 'Set up WardRounds for your clinical team' },
  forgot: { heading: 'Reset your password', sub: "Enter your email and we'll send a reset link." },
}

/*
 * mode: 'signin' | 'signup' | 'forgot' — controlled by the parent (drives which
 * top-level form renders; the parent also owns any mode-switcher chrome, e.g. a
 * Sign In / Sign Up toggle, since that chrome differs by consumer).
 *
 * stage: internal — 'form' | 'sent' (forgot email sent) | 'confirm' (signup email
 * sent). Resets to 'form' whenever `mode` changes. Exposed via onStageChange so a
 * parent can hide its own mode-switcher chrome during the success screens, exactly
 * as the original Login page hid its toggle outside the login/signup views.
 */
export default function AuthForm({ mode, onModeChange, onStageChange, onSuccess, idPrefix = 'auth' }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [practiceName, setPracticeName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stage, setStageState] = useState('form')

  const { authMessage, clearAuthMessage } = useAuth()

  function setStage(next) {
    setStageState(next)
    onStageChange?.(next)
  }

  useEffect(() => {
    setStage('form')
    setError('')
    // Only reset when the parent switches modes, not on every local re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const pwId = `${idPrefix}-password`

  async function handleSignIn() {
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) {
        setError(err.message)
        return
      }
      onSuccess?.()
      // On success: AuthContext's session listener + the app's default-route
      // redirect handle navigation — no manual navigation here.
    } finally {
      setLoading(false)
    }
  }

  function handleSignInSubmit(e) {
    e.preventDefault()
    handleSignIn()
  }

  async function handleReset() {
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (err) {
        setError(err.message)
        return
      }
      setStage('sent')
    } finally {
      setLoading(false)
    }
  }

  function handleForgotSubmit(e) {
    e.preventDefault()
    handleReset()
  }

  /*
   * SQL for Emu — run in Supabase SQL editor, do NOT execute from app:
   *
   * CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
   * RETURNS TRIGGER AS $$
   * DECLARE
   *   v_team_id uuid;
   *   v_role text;
   *   v_full_name text;
   * BEGIN
   *   v_full_name := COALESCE(
   *     NEW.raw_user_meta_data->>'full_name',
   *     split_part(NEW.email, '@', 1)
   *   );
   *   SELECT team_id, role INTO v_team_id, v_role
   *   FROM public.users WHERE email = NEW.email LIMIT 1;
   *   IF FOUND THEN
   *     UPDATE public.users SET id = NEW.id, full_name = v_full_name
   *     WHERE email = NEW.email;
   *   ELSE
   *     INSERT INTO public.users (id, email, full_name, role)
   *     VALUES (NEW.id, NEW.email, v_full_name, 'doctor');
   *   END IF;
   *   RETURN NEW;
   * END;
   * $$ LANGUAGE plpgsql SECURITY DEFINER;
   *
   * NOTIFY pgrst, 'reload schema';
   */
  async function handleSignUpSubmit(e) {
    e.preventDefault()
    setError('')
    if (!practiceName.trim()) { setError('Please enter your practice name.'); return }
    if (!fullName.trim()) { setError('Please enter your full name.'); return }
    if (!email.trim()) { setError('Please enter your email address.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }

    setLoading(true)
    try {
      const params = new URLSearchParams({
        practice: practiceName.trim(),
        name: fullName.trim(),
      })
      const redirectTo = `${window.location.origin}/auth/callback?${params.toString()}`

      const { error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: { full_name: fullName.trim() },
        },
      })
      if (authError) throw new Error(authError.message)

      setStage('confirm')
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.')
      console.error('Signup error:', err)
    } finally {
      setLoading(false)
    }
  }

  function goForgot() {
    setError('')
    onModeChange?.('forgot')
  }

  function goSignin() {
    setError('')
    onModeChange?.('signin')
  }

  function finishSignup() {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setFullName('')
    setPracticeName('')
    goSignin()
  }

  return (
    <>
      {authMessage && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex-shrink-0 text-amber-500">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800 mb-1">Account access removed</p>
              <p className="text-xs text-amber-700 leading-relaxed">{authMessage}</p>
            </div>
            <button
              onClick={clearAuthMessage}
              className="flex-shrink-0 text-amber-400 hover:text-amber-600 transition-colors"
              aria-label="Dismiss"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {stage === 'form' && (
        <div className="flex items-center gap-4 mb-8">
          <img src="/wardrounds-icon.png" className="w-12 h-12 object-contain flex-shrink-0" alt="WardRounds" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 leading-tight">{MODE_CONFIG[mode].heading}</h2>
            <p className="text-gray-400 text-sm mt-0.5">{MODE_CONFIG[mode].sub}</p>
          </div>
        </div>
      )}

      {stage === 'form' && mode === 'signin' && (
        <form onSubmit={handleSignInSubmit}>
          <div>
            <label className={labelCls}>Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && document.getElementById(pwId)?.focus()}
              placeholder="you@hospital.com"
              autoComplete="username"
              className={inputCls}
            />
          </div>
          <div className="mt-4">
            <div className="flex justify-between items-center mb-1.5">
              <label className={labelCls.replace('mb-1.5', '')}>Password</label>
              <button type="button" onClick={goForgot} className="text-[#007AFF] text-xs font-medium hover:underline">
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <input
                id={pwId}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className={`${inputCls} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeClosed /> : <EyeOpen />}
              </button>
            </div>
          </div>
          {error && <div className="mt-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-red-500 text-sm">{error}</div>}
          <button type="submit" disabled={loading} className={`${primaryBtnCls} mt-6`}>
            {loading ? (
              <>
                <Spinner /> Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </button>
          <p className="mt-6 text-center text-xs text-gray-400">New to WardRounds? Contact your team administrator.</p>
        </form>
      )}

      {stage === 'form' && mode === 'signup' && (
        <form onSubmit={handleSignUpSubmit}>
          <div className="mb-4">
            <label className={labelCls}>Practice Name</label>
            <input
              type="text"
              value={practiceName}
              onChange={e => setPracticeName(e.target.value)}
              placeholder="e.g. Comprehensive Diabetes Centre"
              autoComplete="organization"
              className={inputCls}
            />
          </div>
          <div className="mb-4">
            <label className={labelCls}>Your Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Dr. Jane Muthoni"
              autoComplete="name"
              className={inputCls}
            />
          </div>
          <div className="mb-4">
            <label className={labelCls}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@yourpractice.com"
              autoComplete="email"
              className={inputCls}
            />
          </div>
          <div className="mb-4">
            <label className={labelCls}>Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
                className={`${inputCls} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeClosed /> : <EyeOpen />}
              </button>
            </div>
          </div>
          <div className="mb-4">
            <label className={labelCls}>Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                autoComplete="new-password"
                className={`${inputCls} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showConfirmPassword ? <EyeClosed /> : <EyeOpen />}
              </button>
            </div>
          </div>
          {error && <div className="mb-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-red-500 text-sm">{error}</div>}
          <button type="submit" disabled={loading} className={`${primaryBtnCls} mt-2`}>
            {loading ? (
              <>
                <Spinner /> Registering…
              </>
            ) : (
              'Register Practice'
            )}
          </button>
          <p className="mt-4 text-center text-xs text-gray-400">
            Already have an account?{' '}
            <button type="button" onClick={goSignin} className="text-[#007AFF] font-medium hover:underline">
              Sign in
            </button>
          </p>
          <p className="mt-2 text-center text-xs text-gray-400">
            Joining an existing team? <span className="text-gray-500 font-medium">Ask your team admin to invite you.</span>
          </p>
        </form>
      )}

      {stage === 'form' && mode === 'forgot' && (
        <form onSubmit={handleForgotSubmit}>
          <button
            type="button"
            onClick={goSignin}
            className="flex items-center gap-1 text-gray-400 hover:text-gray-600 text-sm mb-6 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to sign in
          </button>
          <div>
            <label className={labelCls}>Email address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@hospital.com"
              autoComplete="email"
              className={inputCls}
            />
          </div>
          {error && <div className="mt-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-red-500 text-sm">{error}</div>}
          <button type="submit" disabled={loading} className={`${primaryBtnCls} mt-6`}>
            {loading ? (
              <>
                <Spinner /> Sending…
              </>
            ) : (
              'Send Reset Link'
            )}
          </button>
        </form>
      )}

      {stage === 'sent' && (
        <div className="text-center py-2">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">{CHECK}</div>
          <p className="text-sm text-gray-500 mb-6">
            We sent a reset link to <span className="font-medium text-gray-700">{email}</span>. Check your email for the link.
          </p>
          <button
            type="button"
            onClick={goSignin}
            className="w-full border border-gray-200 text-gray-700 font-semibold py-3 rounded-xl text-sm transition-all duration-150 hover:bg-gray-50"
          >
            Back to sign in
          </button>
        </div>
      )}

      {stage === 'confirm' && (
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-6">{CHECK}</div>
          <p className="text-sm text-gray-500 mb-6">
            Confirm the email sent to <span className="font-medium text-gray-700">{email}</span> to activate your account.
          </p>
          <button type="button" onClick={finishSignup} className={primaryBtnCls}>
            Go to Sign In
          </button>
        </div>
      )}
    </>
  )
}
