import { useEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import LandingNav from './LandingNav'
import Hero from './Hero'
import WhatIsWardRounds from './WhatIsWardRounds'
import HowItWorks from './HowItWorks'
import FeatureBlocks from './FeatureBlocks'
import ExportShowcase from './ExportShowcase'
import AnalyticsShowcase from './AnalyticsShowcase'
import Testimonials from './Testimonials'
import FAQ from './FAQ'
import FinalCTA from './FinalCTA'
import Footer from './Footer'
import AuthModal from './AuthModal'
import LazyMount from './LazyMount'

export default function Landing() {
  const [authMode, setAuthMode] = useState('signin')
  const [authOpen, setAuthOpen] = useState(false)
  const lenisRef = useRef(null)

  function openAuth(mode) {
    setAuthMode(mode)
    setAuthOpen(true)
  }

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
      <LazyMount><WhatIsWardRounds /></LazyMount>
      <LazyMount><HowItWorks /></LazyMount>
      <LazyMount><FeatureBlocks /></LazyMount>
      <LazyMount><ExportShowcase /></LazyMount>
      <LazyMount><AnalyticsShowcase /></LazyMount>
      <LazyMount><Testimonials /></LazyMount>
      <LazyMount><FAQ openAuth={openAuth} /></LazyMount>
      <LazyMount><FinalCTA openAuth={openAuth} /></LazyMount>
      <LazyMount minHeight={240}><Footer openAuth={openAuth} lenisRef={lenisRef} /></LazyMount>
      <AuthModal open={authOpen} mode={authMode} onModeChange={setAuthMode} onClose={() => setAuthOpen(false)} />
    </div>
  )
}
