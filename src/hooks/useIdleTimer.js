import { useEffect, useRef, useCallback } from 'react'

export function useIdleTimer({ idleMs, onIdle, onActivity }) {
  const timer = useRef(null)

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    onActivity?.()
    timer.current = setTimeout(onIdle, idleMs)
  }, [idleMs, onIdle, onActivity])

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      events.forEach(e => window.removeEventListener(e, reset))
      if (timer.current) clearTimeout(timer.current)
    }
  }, [reset])
}
