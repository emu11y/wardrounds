import { useEffect, useRef } from 'react'
import { useMotionValue, animate } from 'framer-motion'

const HOLD_MS = 3500
const FADE_S = 0.4

export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function useReveal(reduceMotion) {
  const opacity = useMotionValue(reduceMotion ? 1 : 0)
  const y = useMotionValue(reduceMotion ? 0 : 8)
  return { opacity, y }
}

// Drives a scene's phone content through: play the caller's entrance sequence,
// hold, fade out, reset, repeat. Every animated value lives on a motion value
// (not React state), so cancelling on unmount never risks a setState-after-unmount
// warning — we just stop scheduling further animate() calls.
export function useLoopedSequence({ active, reduceMotion, playSequence, reset, fadeOut }) {
  const contentOpacity = useMotionValue(1)
  const cancelledRef = useRef(false)
  const callbacksRef = useRef({ playSequence, reset, fadeOut })
  callbacksRef.current = { playSequence, reset, fadeOut }

  useEffect(() => {
    if (!active || reduceMotion) return

    cancelledRef.current = false
    const isCancelled = () => cancelledRef.current

    async function loop() {
      while (!isCancelled()) {
        await callbacksRef.current.playSequence(isCancelled)
        if (isCancelled()) return
        await wait(HOLD_MS)
        if (isCancelled()) return
        if (callbacksRef.current.fadeOut) {
          // Scaffold stays solid; the scene dissolves only its own animated items.
          await callbacksRef.current.fadeOut(isCancelled)
          if (isCancelled()) return
          callbacksRef.current.reset()
        } else {
          // Legacy whole-scene fade — invoice sits over a static backdrop.
          await animate(contentOpacity, 0, { duration: FADE_S })
          if (isCancelled()) return
          callbacksRef.current.reset()
          contentOpacity.set(1)
        }
      }
    }

    loop()

    return () => {
      cancelledRef.current = true
    }
  }, [active, reduceMotion])

  return contentOpacity
}
