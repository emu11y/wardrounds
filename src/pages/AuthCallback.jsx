import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { GLASS_CARD } from '../lib/theme'

export default function AuthCallback() {
  const searchParams = new URLSearchParams(window.location.search)
  const practiceName = searchParams.get('practice') || ''
  const fullName = searchParams.get('name') || ''

  const navigate = useNavigate()
  const [status, setStatus] = useState('Completing your setup...')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!practiceName) return

    async function handleCallback() {
      try {
        // Establish session from URL (handles both hash and PKCE flows)
        const { data: sessionData } = await supabase.auth.getSession()
        let session = sessionData?.session

        // If no session yet, try exchanging the code (PKCE flow)
        if (!session) {
          const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href)
          if (exchangeError || !exchanged?.session) {
            setError('Could not establish your session. Please try signing in again.')
            return
          }
          session = exchanged.session
        }

        const userId = session.user.id

        setStatus('Creating your practice...')

        // Generate the team id client-side so we never have to read it back with
        // `.select()`. The `teams_select` RLS policy is `id = current_user_team_id()`,
        // but at this moment the user isn't linked to the team yet, so a RETURNING
        // row would be filtered out (empty → `.single()` error). Knowing the id up
        // front lets us insert, then link the user, without any filtered read.
        const teamId = crypto.randomUUID()
        const { error: teamError } = await supabase
          .from('teams')
          .insert({ id: teamId, name: practiceName, admin_id: userId })
        if (teamError) throw new Error('Error creating practice: ' + teamError.message)

        setStatus('Setting up your account...')

        // Wait for auth trigger to insert the users row, then update it
        let updated = false
        for (let i = 0; i < 8; i++) {
          await new Promise(r => setTimeout(r, 800))

          // Check if the row exists yet
          const { data: existing } = await supabase
            .from('users')
            .select('id, role, team_id')
            .eq('id', userId)
            .maybeSingle()

          if (!existing) continue // Row not yet inserted by trigger — wait more

          // Row exists — update it
          const { error: updateError } = await supabase
            .from('users')
            .update({ role: 'admin', team_id: teamId, full_name: fullName })
            .eq('id', userId)

          if (!updateError) {
            const { data: check } = await supabase
              .from('users')
              .select('role, team_id')
              .eq('id', userId)
              .maybeSingle()
            if (check?.role === 'admin' && check?.team_id === teamId) {
              updated = true
              break
            }
          }
        }

        if (!updated) {
          console.warn('Profile not fully reconciled — user can still access app')
        }

        setStatus('All done! Redirecting...')
        setTimeout(() => navigate('/', { replace: true }), 800)
      } catch (err) {
        console.error('Auth callback error:', err)
        setError(err.message || 'Something went wrong. Please try logging in.')
      }
    }

    handleCallback()
  }, [navigate, practiceName, fullName])

  if (!practiceName) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-950">
        <div className={`${GLASS_CARD} p-8 max-w-md text-center shadow-xl`}>
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Registration Incomplete</h2>
          <p className="text-slate-600 mb-6">
            It looks like the confirmation link was opened in a different browser or the registration data was lost.
            Please register again to complete setup.
          </p>
          <a
            href="/login"
            className="inline-block px-6 py-3 rounded-xl text-white font-semibold"
            style={{ background: '#007AFF' }}
          >
            Back to Register
          </a>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(145deg, #1a1f5e 0%, #2d3282 35%, #1e5fa8 65%, #0a7fd4 100%)' }}
    >
      <div className="bg-white/80 backdrop-blur-2xl border border-white/60 rounded-3xl p-10 max-w-sm w-full mx-4 text-center shadow-2xl">
        {error ? (
          <>
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Setup Failed</h2>
            <p className="text-gray-600 text-sm mb-6">{error}</p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm"
              style={{ background: '#007AFF' }}
            >
              Back to Login
            </button>
          </>
        ) : (
          <>
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Setting up WardRounds</h2>
            <p className="text-gray-500 text-sm">{status}</p>
          </>
        )}
      </div>
    </div>
  )
}
