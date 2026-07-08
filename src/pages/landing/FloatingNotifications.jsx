import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, TrendingUp, FileCheck, ArrowRightLeft, FileWarning, CreditCard } from 'lucide-react'

const NOTIFICATIONS = [
  { text: 'New Admission · +KES 8,000', icon: Bell },
  { text: 'Ward Round Complete · +KES 2,000', icon: TrendingUp },
  { text: 'Procedure Added · +KES 15,000', icon: FileCheck },
  { text: 'Patient moved to HDU', icon: ArrowRightLeft },
  { text: 'Statement Imported · 2 discrepancies', icon: FileWarning },
  { text: 'Invoice Paid · KES 450,000', icon: CreditCard },
]

const LIFETIME_MS = 5000
const SPAWN_INTERVAL_MS = 1900

function randomOffset() {
  return Math.round((Math.random() - 0.5) * 60)
}

export default function FloatingNotifications() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [active, setActive] = useState([])
  const cursorRef = useRef(0)
  const idRef = useRef(0)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mq.matches)
    const onChange = () => setPrefersReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (prefersReducedMotion) return

    const interval = setInterval(() => {
      const notif = NOTIFICATIONS[cursorRef.current % NOTIFICATIONS.length]
      cursorRef.current += 1
      const id = idRef.current++
      setActive(prev => [...prev, { id, ...notif, x: randomOffset() }])
      setTimeout(() => {
        setActive(prev => prev.filter(n => n.id !== id))
      }, LIFETIME_MS)
    }, SPAWN_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [prefersReducedMotion])

  if (prefersReducedMotion) {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {NOTIFICATIONS.slice(0, 3).map((n, i) => (
          <div
            key={n.text}
            className="absolute flex items-center gap-2 rounded-full border border-white/15 bg-white/5 backdrop-blur-xl px-3.5 py-2 text-xs font-medium text-slate-200 shadow-lg"
            style={{ left: `${15 + i * 28}%`, top: `${10 + i * 22}%` }}
          >
            <n.icon className="h-3.5 w-3.5 text-[#007AFF] flex-shrink-0" />
            <span className="whitespace-nowrap">{n.text}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <AnimatePresence>
        {active.map(n => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: 30, x: n.x }}
            animate={{ opacity: [0, 1, 1, 0], y: -180 }}
            exit={{ opacity: 0 }}
            transition={{ duration: LIFETIME_MS / 1000, ease: 'easeOut', opacity: { times: [0, 0.15, 0.8, 1], duration: LIFETIME_MS / 1000 } }}
            className="absolute left-1/2 bottom-1/3 flex items-center gap-2 rounded-full border border-white/15 bg-white/5 backdrop-blur-xl px-3.5 py-2 text-xs font-medium text-slate-200 shadow-lg"
          >
            <n.icon className="h-3.5 w-3.5 text-[#007AFF] flex-shrink-0" />
            <span className="whitespace-nowrap">{n.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
