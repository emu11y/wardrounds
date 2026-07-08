import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useIdleTimer } from '../hooks/useIdleTimer'

const IDLE_MS = 15 * 60 * 1000
const WARNING_SECS = 30

export default function SessionGuard({ children }) {
  const navigate = useNavigate()
  const [showWarning, setShowWarning] = useState(false)
  const [countdown, setCountdown] = useState(WARNING_SECS)
  const countdownRef = useRef(null)

  const signOut = useCallback(async () => {
    clearInterval(countdownRef.current)
    await supabase.auth.signOut()
    navigate('/')
  }, [navigate])

  const startCountdown = useCallback(() => {
    setCountdown(WARNING_SECS)
    setShowWarning(true)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current)
          signOut()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [signOut])

  const handleStaySignedIn = useCallback(() => {
    clearInterval(countdownRef.current)
    setShowWarning(false)
    setCountdown(WARNING_SECS)
  }, [])

  useIdleTimer({
    idleMs: IDLE_MS,
    onIdle: startCountdown,
    onActivity: () => {
      if (showWarning) handleStaySignedIn()
    },
  })

  useEffect(() => {
    return () => clearInterval(countdownRef.current)
  }, [])

  return (
    <>
      {children}
      {showWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white/85 backdrop-blur-xl border border-white/60 rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Session Expiring</h2>
            <p className="text-gray-600 mb-6">
              You've been inactive. Signing out in <span className="font-semibold text-gray-900">{countdown}</span> seconds.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={signOut}
                className="bg-red-500 text-white rounded-2xl px-6 py-3 font-medium"
              >
                Sign Out Now
              </button>
              <button
                onClick={handleStaySignedIn}
                className="bg-[#007AFF] text-white rounded-2xl px-6 py-3 font-medium"
              >
                Stay Signed In
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
