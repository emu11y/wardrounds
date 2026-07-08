import { useEffect, useRef, useState } from 'react'

// Defers mounting its children until they scroll near the viewport. This keeps the
// initial landing render to just the nav + hero, instead of synchronously mounting a
// dozen framer-motion sections at once — which is what blocked all interaction (e.g.
// opening the menu) during load on mobile. A spacer of `minHeight` preserves the
// scroll position until the real section mounts.
export default function LazyMount({ children, minHeight = 640, rootMargin = '1200px' }) {
  const ref = useRef(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (show) return
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setShow(true)
      return
    }
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setShow(true)
          io.disconnect()
        }
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [show, rootMargin])

  if (show) return children
  return <div ref={ref} style={{ minHeight }} aria-hidden />
}
