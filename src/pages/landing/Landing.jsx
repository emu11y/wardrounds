import { lazy, Suspense, useEffect, useRef, useState } from 'react'
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
    html.style.overflowX = 'hidden'
    body.style.overflowX = 'hidden'
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

    return () => {
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
    <div className="min-h-screen bg-slate-950">
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
  )
}
