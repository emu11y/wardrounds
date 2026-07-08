import { useEffect, useRef } from 'react'
import { animate, useMotionValue, useTransform, useInView, useReducedMotion } from 'framer-motion'
import Bar from './mock/AnimatedBar'
import GlassCard from './GlassCard'
import { formatKES } from './format'

const PATIENTS_DATA = [
  { name: '3rd Park', inpatient: 34, outpatient: 61 },
  { name: 'M.P. Shah', inpatient: 28, outpatient: 44 },
  { name: 'Aga Khan', inpatient: 22, outpatient: 39 },
  { name: 'Avenue', inpatient: 17, outpatient: 25 },
]

const REVENUE_DATA = [
  { name: '3rd Park', amount: 1240000, color: '#34C759' },
  { name: 'M.P. Shah', amount: 862000, color: '#FF9500' },
  { name: 'Aga Khan', amount: 918000, color: '#FF3B30' },
  { name: 'Avenue', amount: 439000, color: '#007AFF' },
]

const INPATIENT_COLOR = '#007AFF'
const OUTPATIENT_COLOR = '#8B5CF6'

function formatCount(value) {
  return `${Math.round(value)}`
}

function useCountingBar(reduceMotion, finalValue, maxValue, format) {
  const value = useMotionValue(reduceMotion ? finalValue : 0)
  const heightPct = useTransform(value, v => `${Math.max((v / maxValue) * 100, 2)}%`)
  const label = useTransform(value, format)
  return { value, heightPct, label }
}

function PatientsChart({ inView, reduceMotion }) {
  const maxValue = Math.max(...PATIENTS_DATA.flatMap(h => [h.inpatient, h.outpatient]))

  const bar0In = useCountingBar(reduceMotion, PATIENTS_DATA[0].inpatient, maxValue, formatCount)
  const bar0Out = useCountingBar(reduceMotion, PATIENTS_DATA[0].outpatient, maxValue, formatCount)
  const bar1In = useCountingBar(reduceMotion, PATIENTS_DATA[1].inpatient, maxValue, formatCount)
  const bar1Out = useCountingBar(reduceMotion, PATIENTS_DATA[1].outpatient, maxValue, formatCount)
  const bar2In = useCountingBar(reduceMotion, PATIENTS_DATA[2].inpatient, maxValue, formatCount)
  const bar2Out = useCountingBar(reduceMotion, PATIENTS_DATA[2].outpatient, maxValue, formatCount)
  const bar3In = useCountingBar(reduceMotion, PATIENTS_DATA[3].inpatient, maxValue, formatCount)
  const bar3Out = useCountingBar(reduceMotion, PATIENTS_DATA[3].outpatient, maxValue, formatCount)

  const groups = [
    { hospital: PATIENTS_DATA[0], inpatient: bar0In, outpatient: bar0Out },
    { hospital: PATIENTS_DATA[1], inpatient: bar1In, outpatient: bar1Out },
    { hospital: PATIENTS_DATA[2], inpatient: bar2In, outpatient: bar2Out },
    { hospital: PATIENTS_DATA[3], inpatient: bar3In, outpatient: bar3Out },
  ]

  useEffect(() => {
    if (!inView || reduceMotion) return
    groups.forEach((g, i) => {
      animate(g.inpatient.value, g.hospital.inpatient, { duration: 0.8, delay: i * 0.12, ease: 'easeOut' })
      animate(g.outpatient.value, g.hospital.outpatient, { duration: 0.8, delay: i * 0.12 + 0.06, ease: 'easeOut' })
    })
    // groups is rebuilt from stable motion values every render; only re-run when trigger flags change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduceMotion])

  return (
    <GlassCard className="p-5">
      <p className="text-sm font-semibold text-white">Patients by Hospital</p>
      <div className="mt-3 flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: INPATIENT_COLOR }} />
          Inpatient
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: OUTPATIENT_COLOR }} />
          Outpatient
        </span>
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        {groups.map(g => (
          <div key={g.hospital.name} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex w-full items-end justify-center gap-1.5">
              <Bar heightPct={g.inpatient.heightPct} color={INPATIENT_COLOR} label={g.inpatient.label} />
              <Bar heightPct={g.outpatient.heightPct} color={OUTPATIENT_COLOR} label={g.outpatient.label} />
            </div>
            <p className="truncate text-[10px] text-slate-500">{g.hospital.name}</p>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

function RevenueChart({ inView, reduceMotion }) {
  const maxValue = Math.max(...REVENUE_DATA.map(h => h.amount))

  const bar0 = useCountingBar(reduceMotion, REVENUE_DATA[0].amount, maxValue, formatKES)
  const bar1 = useCountingBar(reduceMotion, REVENUE_DATA[1].amount, maxValue, formatKES)
  const bar2 = useCountingBar(reduceMotion, REVENUE_DATA[2].amount, maxValue, formatKES)
  const bar3 = useCountingBar(reduceMotion, REVENUE_DATA[3].amount, maxValue, formatKES)
  const bars = [bar0, bar1, bar2, bar3]

  useEffect(() => {
    if (!inView || reduceMotion) return
    bars.forEach((bar, i) => {
      animate(bar.value, REVENUE_DATA[i].amount, { duration: 0.9, delay: i * 0.12, ease: 'easeOut' })
    })
    // bars is rebuilt from stable motion values every render; only re-run when trigger flags change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduceMotion])

  return (
    <GlassCard className="p-5">
      <p className="text-sm font-semibold text-white">Revenue by Hospital</p>
      <div className="mt-8 flex items-end justify-between gap-4">
        {REVENUE_DATA.map((h, i) => (
          <div key={h.name} className="flex flex-1 flex-col items-center gap-2">
            <Bar heightPct={bars[i].heightPct} color={h.color} label={bars[i].label} />
            <p className="truncate text-[10px] text-slate-500">{h.name}</p>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

export default function AnalyticsShowcase() {
  const ref = useRef(null)
  const reduceMotion = useReducedMotion()
  const inView = useInView(ref, { amount: 0.35, once: true })

  return (
    <section ref={ref} className="bg-slate-950 px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: '#007AFF' }}>
            ANALYTICS
          </span>
          <h3 className="mt-3 text-3xl font-bold text-white sm:text-4xl">See your practice clearly.</h3>
          <p className="mt-4 text-base text-slate-400">Patients and revenue, per hospital, at a glance.</p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <PatientsChart inView={inView} reduceMotion={reduceMotion} />
          <RevenueChart inView={inView} reduceMotion={reduceMotion} />
        </div>
      </div>
    </section>
  )
}
