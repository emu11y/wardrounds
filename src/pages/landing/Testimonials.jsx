import { useEffect, useRef, useState } from 'react'
import { useReducedMotion, useMotionValue, animate, motion } from 'framer-motion'
import GlassCard from './GlassCard'

const TESTIMONIALS = [
  {
    quote:
      "I used to lose track of procedures I'd add verbally and forget to bill. Now nothing slips through — every charge is captured at the bedside.",
    name: 'Dr. A. Mwangi',
    role: 'Consultant Physician, Nairobi',
    initials: 'AM',
    color: '#007AFF',
  },
  {
    quote:
      "Month-end reconciliation used to take me a full evening. Now I export, match it against the statement, and I'm done in twenty minutes.",
    name: 'Dr. S. Otieno',
    role: 'General Surgeon',
    initials: 'SO',
    color: '#8B5CF6',
  },
  {
    quote:
      'I cover four hospitals in a week. WardRounds is the only place I can see all my patients and my numbers in one screen.',
    name: 'Dr. L. Njeri',
    role: 'Locum, Multi-hospital',
    initials: 'LN',
    color: '#34C759',
  },
  {
    quote:
      "My whole team — nurses included — logs charges as they happen. I'm not chasing anyone for numbers anymore.",
    name: 'Dr. J. Kamau',
    role: 'Paediatrician, Private Practice',
    initials: 'JK',
    color: '#FF9500',
  },
  {
    quote:
      'One tap and my entire month is in Excel, formatted and ready. It used to take my accountant hours to compile.',
    name: 'Dr. F. Hassan',
    role: 'Government Consultant',
    initials: 'FH',
    color: '#FF3B30',
  },
]

const getDims = (mobile) => {
  const cardW = mobile ? 250 : 320
  const gap = mobile ? 12 : 24
  const step = cardW + gap
  return { cardW, gap, step, setW: TESTIMONIALS.length * step }
}
const HOLD_MS = 2600
const SLIDE_S = 0.9
const SPAN = 2
const MAX_ROT = 48
const MIN_SCALE = 0.68
const MAX_SCALE = 1.06
const DEPTH = 90
const TUCK = 44
const VEIL_MAX = 0.55

function TestimonialCard({ testimonial, ariaHidden, spotlight, width = 320 }) {
  return (
    <div
      data-wr-card={spotlight ? '' : undefined}
      className="relative flex-shrink-0"
      style={{ width }}
    >
      <div data-wr-inner className="relative h-full will-change-transform">
        <GlassCard aria-hidden={ariaHidden || undefined} className="h-full p-6">
          <p className="text-sm leading-relaxed text-slate-300">"{testimonial.quote}"</p>
          <div className="mt-5 flex items-center gap-3">
            <span
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: testimonial.color }}
            >
              {testimonial.initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{testimonial.name}</p>
              <p className="truncate text-xs text-slate-400">{testimonial.role}</p>
            </div>
          </div>
        </GlassCard>
        {spotlight && (
          <div
            data-wr-veil
            className="pointer-events-none absolute inset-0 rounded-2xl bg-[#0a1226]"
            style={{ opacity: 0.6 }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  )
}

function Carousel() {
  const trackRef = useRef(null)
  const viewportRef = useRef(null)
  const hoveredRef = useRef(false)
  const x = useMotionValue(0)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 640px)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const onChange = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const { cardW, step, setW } = getDims(isMobile)

    const getCenterX = () => {
      const el = viewportRef.current
      if (!el) return window.innerWidth / 2
      const r = el.getBoundingClientRect()
      return r.left + r.width / 2
    }

    const seatCenter = () => {
      const first = document.querySelector('[data-wr-card]')
      if (!first) return
      const rect = first.getBoundingClientRect()
      const offset = getCenterX() - (rect.left + cardW / 2)
      x.set((offset % setW) - setW)
    }

    seatCenter()

    let cancelled = false
    let raf

    function tick() {
      const centerX = getCenterX()
      track.querySelectorAll('[data-wr-card]').forEach(el => {
        const inner = el.querySelector('[data-wr-inner]') || el
        const rect = el.getBoundingClientRect()
        const veil = el.querySelector('[data-wr-veil]')
        if (isMobile) {
          const signed = (rect.left + rect.width / 2 - centerX) / step
          const ad = Math.min(1, Math.abs(signed) / SPAN)
          const prox = 1 - ad
          const eased = prox * prox * (3 - 2 * prox)
          const dir = signed === 0 ? 0 : signed > 0 ? 1 : -1
          const scale = MIN_SCALE + (MAX_SCALE - MIN_SCALE) * eased
          const rotY = -dir * ad * MAX_ROT
          const tz = -ad * DEPTH
          const tx = -dir * ad * TUCK
          inner.style.transform = `perspective(1000px) translateX(${tx}px) translateZ(${tz}px) rotateY(${rotY}deg) scale(${scale})`
          el.style.zIndex = String(Math.round(prox * 100))
          if (veil) veil.style.opacity = String(VEIL_MAX * (1 - eased))
        } else {
          const d = Math.min(1, Math.abs(rect.left + rect.width / 2 - centerX) / (step / 2))
          const t = 1 - d
          const eased = t * t * (3 - 2 * t)
          inner.style.transform = `scale(${1 + 0.1 * eased})`
          el.style.zIndex = String(1 + Math.round(eased * 10))
          if (veil) veil.style.opacity = String(0.6 * (1 - eased))
        }
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    async function loop() {
      while (!cancelled) {
        await new Promise(r => setTimeout(r, HOLD_MS))
        if (cancelled) return
        if (hoveredRef.current) continue
        await animate(x, x.get() - step, { duration: SLIDE_S, ease: [0.45, 0, 0.15, 1] }).finished
        if (x.get() <= -2 * setW) x.set(x.get() + setW)
      }
    }
    loop()

    window.addEventListener('resize', seatCenter)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', seatCenter)
    }
  }, [x, isMobile])

  const { cardW, gap } = getDims(isMobile)

  return (
    <div
      ref={viewportRef}
      className="relative overflow-hidden py-8"
      onMouseEnter={() => { hoveredRef.current = true }}
      onMouseLeave={() => { hoveredRef.current = false }}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-16 bg-gradient-to-r from-slate-950 to-transparent sm:w-32" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-16 bg-gradient-to-l from-slate-950 to-transparent sm:w-32" />
      <motion.div ref={trackRef} style={{ x, columnGap: gap }} className="flex w-max">
        {[0, 1, 2].map(set =>
          TESTIMONIALS.map(t => (
            <TestimonialCard
              key={`${t.name}-${set}`}
              testimonial={t}
              ariaHidden={set > 0}
              spotlight
              width={cardW}
            />
          ))
        )}
      </motion.div>
    </div>
  )
}

function StaticGrid() {
  return (
    <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {TESTIMONIALS.map(t => (
        <TestimonialCard key={t.name} testimonial={t} />
      ))}
    </div>
  )
}

export default function Testimonials() {
  const reduceMotion = useReducedMotion()

  return (
    <section className="overflow-hidden bg-slate-950 px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: '#007AFF' }}>
          DOCTORS
        </span>
        <h3 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Trusted at the bedside.</h3>
      </div>

      <div className="mt-14">{reduceMotion ? <StaticGrid /> : <Carousel />}</div>
    </section>
  )
}
