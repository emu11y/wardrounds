import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getCurrentUser } from '../lib/auth'
import { resolvePermissions } from '../lib/permissions'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [user, setUser] = useState(null)
  const [permissions, setPermissions] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authMessage, setAuthMessage] = useState(null)

  useEffect(() => {
    // Force re-login on every page refresh by wiping Supabase session from localStorage.
    // Exempt the URL-token auth flows: /reset-password (PASSWORD_RECOVERY hash token)
    // and /auth/callback (email-confirmation redirect). These flows receive their token
    // via the URL and need the Supabase client to keep the just-established session so
    // the follow-up onboarding writes run as `authenticated` — wiping it mid-flow makes
    // them run as `anon`, which RLS denies.
    const AUTH_URL_FLOW_PATHS = ['/reset-password', '/auth/callback']
    if (!AUTH_URL_FLOW_PATHS.some(p => window.location.pathname.startsWith(p))) {
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-'))
        .forEach(k => localStorage.removeItem(k))
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfile()
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadProfile()
      else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile() {
    try {
      const profile = await getCurrentUser()
      if (profile?.status === 'archived') {
        setAuthMessage(
          'Your account is no longer part of this team. You may have been removed by your administrator. ' +
          'Please contact your admin to be restored, or sign up with a different email address to open a new practice account.'
        )
        await supabase.auth.signOut()
        setUser(null)
        setSession(null)
        return
      }
      setUser(profile)
      const { data: permsData } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle()
      setPermissions(resolvePermissions(permsData, profile.role))
    } catch {
      setUser(null)
      setPermissions(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthContext.Provider value={{ session, user, permissions, loading, authMessage, clearAuthMessage: () => setAuthMessage(null), refreshUser: loadProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
