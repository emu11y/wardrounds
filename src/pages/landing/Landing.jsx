import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { MotionConfig } from 'framer-motion'
import Lenis from 'lenis'
import LandingNav from './LandingNav'
import Hero from './Hero'
import AuthModal from './AuthModal'
import LazyMount from './LazyMount'

// Below-the-fold sections are code-split into their own chunks. Combined with
// LazyMount, each section's JavaScript is fetched only when it scrolls near the
// viewport — so the initial landing download is just the nav + hero, not the whole
// 230 KB sections bundle (plus framer-motion no longer needs to parse up front).
const WhatIsWardRounds = lazy(() => import('./WhatIsWardRounds'))
const HowItWorks       = lazy(() => import('./HowItWorks'))
const FeatureBlocks    = lazy(() => import('./FeatureBlocks'))
const ExportShowcase   = lazy(() => import('./ExportShowcase'))
const AnalyticsShowcase = lazy(() => import('./AnalyticsShowcase'))
const Testimonials     = lazy(() => import('./Testimonials'))
const FAQ              = lazy(() => import('./FAQ'))
const FinalCTA         = lazy(() => import('./FinalCTA'))
const Footer           = lazy(() => import('./Footer'))

export default function Landing() {
  const [authMode, setAuthMode] = useState('signin')
  const [authOpen, setAuthOpen] = useState(false)
  const lenisRef = useRef(null)
  const contentRef = useRef(null)
  // Touch / coarse-pointer devices (phones, tablets) get reduced motion: every
  // framer-motion animation below renders its static final state, the looping
  // showcases stop, and Testimonials swaps its 3D carousel for the static grid —
  // all from this one flag. Desktop keeps 'user' (honours the OS setting only).
  const [isMobile] = useState(() => window.matchMedia('(hover: none), (pointer: coarse)').matches)

  function openAuth(mode) {
    setAuthMode(mode)
    setAuthOpen(true)
  }

  // The app is light-themed (body background is light), but the landing is dark. While
  // the landing is mounted, paint <html>/<body> dark so overscroll, lazy-mount spacers,
  // and any gaps never flash the white body — and clip horizontal overflow so the
  // Testimonials carousel track (wider than the viewport) can't shift the page sideways.
  // Everything is restored on unmount, so the signed-in app keeps its light theme.
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prev = {
      htmlBg: html.style.background, bodyBg: body.style.background,
      htmlOverflowX: html.style.overflowX, bodyOverflowX: body.style.overflowX,
    }
    html.style.background = '#020617'
    body.style.background = '#020617'
    // Use `clip`, NOT `hidden`, to trim the Testimonials carousel's horizontal
    // overflow. `overflow-x: hidden` silently promotes overflow-y to `auto`, which
    // turns <body> into the scroll container — but Lenis drives the document
    // element, so the wheel gets hijacked and the page can't scroll past the hero.
    // `overflow-x: clip` clips horizontally without creating a scroll container, so
    // the document stays the scroller and Lenis works. (Restored on unmount below.)
    html.style.overflowX = 'clip'
    body.style.overflowX = 'clip'
    return () => {
      html.style.background = prev.htmlBg
      body.style.background = prev.bodyBg
      html.style.overflowX = prev.htmlOverflowX
      body.style.overflowX = prev.bodyOverflowX
    }
  }, [])

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Skip Lenis on touch / coarse-pointer devices (phones, tablets). Its continuous
    // rAF loop + scroll syncing is a major cause of mobile jank, and native touch
    // scrolling is already smooth there. Anchor links fall back to native smooth
    // scroll via scrollToHash. Desktop keeps the smooth-scroll experience.
    const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches
    if (prefersReducedMotion || isTouch) return

    const lenis = new Lenis({ duration: 1.1, smoothWheel: true })
    lenisRef.current = lenis

    function raf(time) {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }
    let rafId = requestAnimationFrame(raf)

    // Below-the-fold sections mount lazily (LazyMount), so the page keeps growing
    // taller after Lenis initialises. Lenis's own ResizeObserver watches the
    // document element's box, which stays viewport-height, so it never learns the
    // page got taller and clamps wheel/trackpad scrolling at the hero. Watch the
    // content wrapper (which actually grows) and tell Lenis to recompute its limit.
    let ro
    if (contentRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => lenis.resize())
      ro.observe(contentRef.current)
    }

    return () => {
      ro?.disconnect()
      cancelAnimationFrame(rafId)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  useEffect(() => {
    const lenis = lenisRef.current
    if (!lenis) return
    if (authOpen) lenis.stop()
    else lenis.start()
  }, [authOpen])

  return (
    <MotionConfig reducedMotion={isMobile ? 'always' : 'user'}>
    <div ref={contentRef} className="min-h-screen bg-slate-950">
      {/* Nav + Hero mount immediately (above the fold). Everything below mounts only
          as it nears the viewport, so the page is interactive during load instead of
          blocking on a synchronous mount of every framer-motion section at once. */}
      <LandingNav openAuth={openAuth} lenisRef={lenisRef} />
      <Hero openAuth={openAuth} />
      <LazyMount><Suspense fallback={null}><WhatIsWardRounds /></Suspense></LazyMount>
      <LazyMount><Suspense fallback={null}><HowItWorks /></Suspense></LazyMount>
      <LazyMount><Suspense fallback={null}><FeatureBlocks /></Suspense></LazyMount>
      <LazyMount><Suspense fallback={null}><ExportShowcase /></Suspense></LazyMount>
      <LazyMount><Suspense fallback={null}><AnalyticsShowcase /></Suspense></LazyMount>
      <LazyMount><Suspense fallback={null}><Testimonials /></Suspense></LazyMount>
      <LazyMount><Suspense fallback={null}><FAQ openAuth={openAuth} /></Suspense></LazyMount>
      <LazyMount><Suspense fallback={null}><FinalCTA openAuth={openAuth} /></Suspense></LazyMount>
      <LazyMount minHeight={240}><Suspense fallback={null}><Footer openAuth={openAuth} lenisRef={lenisRef} /></Suspense></LazyMount>
      <AuthModal open={authOpen} mode={authMode} onModeChange={setAuthMode} onClose={() => setAuthOpen(false)} />
    </div>
    </MotionConfig>
  )
}
