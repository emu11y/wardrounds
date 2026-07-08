import { motion, useReducedMotion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import GlassCard from './GlassCard'

const STEPS = [
  { number: '1', title: 'Capture', body: 'Scan a tag or search a patient and log them on the spot.' },
  { number: '2', title: 'Round', body: 'Add notes, services and transfers as you see each patient.' },
  { number: '3', title: 'Record', body: 'WardRounds keeps a dated, itemised account on its own.' },
  { number: '4', title: 'Reconcile', body: "Match your totals to each hospital's — and get paid in full." },
]

const BADGE_CLASS =
  'flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#007AFF] to-[#0051D5] text-lg font-bold text-white shadow-lg shadow-[#007AFF]/40'

function StepBadge({ index, reduceMotion }) {
  if (reduceMotion) {
    return <div className={BADGE_CLASS}>{STEPS[index].number}</div>
  }

  return (
    <motion.div
      initial={{ scale: 0.6 }}
      whileInView={{ scale: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ type: 'spring', stiffness: 300, damping: 14, delay: index * 0.12 + 0.15 }}
      className={BADGE_CLASS}
    >
      {STEPS[index].number}
    </motion.div>
  )
}

function StepCard({ index, reduceMotion }) {
  const step = STEPS[index]

  const card = (
    <GlassCard className="flex h-full flex-col items-center p-6 text-center">
      <StepBadge index={index} reduceMotion={reduceMotion} />
      <h4 className="mt-4 text-base font-semibold text-white">{step.title}</h4>
      <p className="mt-2 text-sm text-slate-400">{step.body}</p>
    </GlassCard>
  )

  if (reduceMotion) {
    return card
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay: index * 0.12, ease: 'easeOut' }}
      className="h-full"
    >
      {card}
    </motion.div>
  )
}

function Connector() {
  return (
    <div className="hidden items-center justify-center lg:flex">
      <ChevronRight className="h-5 w-5 text-white/20" />
    </div>
  )
}

export default function HowItWorks() {
  const reduceMotion = useReducedMotion()

  return (
    <section id="how-it-works" className="scroll-mt-24 bg-slate-950 px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: '#007AFF' }}>
            HOW IT WORKS
          </span>
          <h3 className="mt-3 text-3xl font-bold text-white sm:text-4xl">From bedside to settled, in four steps.</h3>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-[1fr_2rem_1fr_2rem_1fr_2rem_1fr] lg:items-stretch lg:gap-4">
          <StepCard index={0} reduceMotion={reduceMotion} />
          <Connector />
          <StepCard index={1} reduceMotion={reduceMotion} />
          <Connector />
          <StepCard index={2} reduceMotion={reduceMotion} />
          <Connector />
          <StepCard index={3} reduceMotion={reduceMotion} />
        </div>
      </div>
    </section>
  )
}
