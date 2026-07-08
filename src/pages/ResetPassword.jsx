import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const inputCls =
  'w-full bg-gray-50/80 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm ' +
  'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 ' +
  'focus:border-[#007AFF] transition-colors'

const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5'

function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    // Supabase fires onAuthStateChange with event PASSWORD_RECOVERY when the
    // reset link is opened — this establishes the session automatically.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setSessionReady(true)
    })
    // Also handle if session is already present (page reload after token exchange)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit() {
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => navigate('/login', { replace: true }), 2500)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(145deg, #1a1f5e 0%, #2d3282 35%, #1e5fa8 65%, #0a7fd4 100%)' }}
    >
      <div className="bg-white/85 backdrop-blur-xl border border-white/60 rounded-3xl shadow-2xl p-10 w-full max-w-md">
        <div className="flex items-center gap-4 mb-8">
          <img src="/wardrounds-icon.png" className="w-12 h-12 object-contain flex-shrink-0" alt="WardRounds" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 leading-tight">Set new password</h2>
            <p className="text-gray-400 text-sm mt-0.5">Choose a strong password for your account.</p>
          </div>
        </div>

        {done ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-gray-700 font-semibold">Password updated!</p>
            <p className="text-gray-400 text-sm mt-1">Redirecting you to sign in…</p>
          </div>
        ) : !sessionReady ? (
          <div className="text-center py-6">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 text-sm">Verifying your reset link…</p>
          </div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); handleSubmit() }}>
            <input type="text" name="username" autoComplete="username" value="" readOnly hidden />
            <div className="mb-4">
              <label className={labelCls}>New Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                autoFocus
                autoComplete="new-password"
                className={inputCls}
              />
            </div>
            <div className="mb-4">
              <label className={labelCls}>Confirm New Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat new password"
                autoComplete="new-password"
                className={inputCls}
              />
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-red-500 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#007AFF] hover:bg-[#0066DD] disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-all duration-150 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <><Spinner /> Updating…</> : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
