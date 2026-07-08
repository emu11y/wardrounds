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
    if (prefersReducedMotion) return

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
      <LandingNav openAuth={openAuth} lenisRef={lenisRef} />
      <Hero openAuth={openAuth} />
      <WhatIsWardRounds />
      <HowItWorks />
      <FeatureBlocks />
      <ExportShowcase />
      <AnalyticsShowcase />
      <Testimonials />
      <FAQ openAuth={openAuth} />
      <FinalCTA openAuth={openAuth} />
      <Footer openAuth={openAuth} lenisRef={lenisRef} />
      <AuthModal open={authOpen} mode={authMode} onModeChange={setAuthMode} onClose={() => setAuthOpen(false)} />
    </div>
  )
}
