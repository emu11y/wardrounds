import { motion } from 'framer-motion'
import { Wallet, Building2, Activity, Lock, Check, X } from 'lucide-react'
import MacBookFrame from './mock/MacBookFrame'
import PhoneFrame from './mock/PhoneFrame'
import MockPatientCard from './mock/PatientCard'
import DashboardMock, { REVEALED, REVEALS_DONE } from './mock/DashboardMock'

const fadeRise = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 90, damping: 16 } },
}

function DashboardScene() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-10 rounded-[3rem] bg-gradient-to-br from-[#007AFF]/15 to-[#8B5CF6]/10 blur-3xl" />

      <MacBookFrame>
        <DashboardMock />
      </MacBookFrame>

      <div className="absolute -bottom-10 -right-2 z-10 w-[150px] sm:-right-6 sm:w-[170px]">
        <div style={{ zoom: 0.52 }}>
          <PhoneFrame>
            <div className="h-full bg-ios-gray-6 p-2 pt-10">
              <MockPatientCard
                accentColor="#8B5CF6"
                wardLabel="HDU"
                formattedTotal="KES 46,000"
                reveals={REVEALS_DONE}
                footerReveal={REVEALED}
                initials="AH"
                name="Amina Hassan"
                patientNumber="#31904472"
                ageDob="41 yrs · 6 Jun 1985"
                hospitalName="Nairobi Hospital"
              />
            </div>
          </PhoneFrame>
        </div>
      </div>
    </div>
  )
}

const FEATURES = [
  {
    icon: Wallet,
    title: 'Every shilling accounted for',
    body: 'Charges logged at the bedside, not reconstructed from memory at month-end.',
  },
  {
    icon: Building2,
    title: 'Every hospital, one record',
    body: 'Fee-for-service across three hospitals? One authoritative record you own.',
  },
  {
    icon: Activity,
    title: 'Live, not month-end',
    body: 'Your running total updates the moment a service is logged. No surprises.',
  },
  {
    icon: Lock,
    title: 'Yours alone',
    body: "Your billing data belongs to you, secured and private — not locked in a hospital's HMS.",
  },
]

const KES_FIGURES = [
  'KES 3,000', 'KES 15,000', 'KES 84,000', 'KES 6,500', 'KES 120,000',
  'KES 46,000', 'KES 9,000', 'KES 32,000', 'KES 250,000', 'KES 1,200',
  'KES 66,000', 'KES 18,500', 'KES 7,000', 'KES 133,000', 'KES 4,800',
]

function NumbersBackdrop() {
  // 6 columns, each a seamless upward loop (content duplicated once for the -50% wrap)
  const columns = Array.from({ length: 6 }, (_, c) => ({
    figures: [...KES_FIGURES].sort(() => 0.5 - ((c * 7919) % 100) / 100),
    duration: 11 + c * 3,
    offset: c * 13,
  }))
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="flex h-full justify-between px-6 opacity-[0.5]">
        {columns.map((col, i) => (
          <div
            key={i}
            className="flex flex-col gap-10"
            style={{
              animation: `wr-drift-up ${col.duration}s linear infinite`,
              animationDelay: `-${col.offset}s`,
            }}
          >
            {[...col.figures, ...col.figures].map((fig, j) => (
              <span
                key={j}
                className="font-mono text-lg font-semibold tabular-nums text-[#007AFF] sm:text-xl"
              >
                {fig}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

const COMPARISON = [
  { label: 'Whose interests it serves', yours: 'Built for you, the doctor', theirs: "Built for the hospital's books" },
  { label: 'Revenue leakage', yours: "Every charge you're owed, captured", theirs: 'Missed fees you never notice' },
  { label: 'Fee disputes', yours: 'Your own record to reconcile against', theirs: 'Their statement, their word' },
  { label: 'Across hospitals', yours: 'One record spanning every site', theirs: 'Fragmented — one system per hospital' },
  { label: 'When you see it', yours: 'Live, at the bedside', theirs: 'Month-end, if reconciled at all' },
  { label: 'Ownership', yours: 'Yours alone, always exportable', theirs: "Locked in a system you don't control" },
]

export default function WhatIsWardRounds() {
  return (
    <section id="about" className="relative overflow-hidden bg-slate-950 px-6 py-24 sm:py-32 scroll-mt-24">
      <div
        className="pointer-events-none absolute -top-40 -right-40 h-[30rem] w-[30rem] rounded-full blur-[120px]"
        style={{ backgroundColor: 'rgba(0, 122, 255, 0.10)' }}
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          variants={{ show: { transition: { staggerChildren: 0.12 } } }}
        >
          <motion.span
            variants={fadeRise}
            className="font-mono text-xs font-semibold uppercase tracking-[0.15em]"
            style={{ color: '#007AFF' }}
          >
            About WardRounds
          </motion.span>

          <motion.h2
            variants={fadeRise}
            className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight text-white"
          >
            You do the rounds.{' '}
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-[#007AFF] to-[#8B5CF6] bg-clip-text text-transparent">
              WardRounds does the math.
            </span>
          </motion.h2>

          <motion.p variants={fadeRise} className="mt-6 text-lg leading-relaxed text-slate-400">
            WardRounds is your personal billing record — independent of any hospital's system.
            Every patient you see, every procedure you perform, every shilling you're owed is
            captured at the bedside the moment it happens. At month-end, you reconcile against
            the hospital's statement in minutes, not evenings — and nothing you did goes unpaid.
          </motion.p>

          <motion.div
            variants={fadeRise}
            className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm sm:p-7"
          >
            <p className="text-base font-semibold text-white">
              Built for doctors. <span className="text-[#8B5CF6]">Not for hospitals.</span>
            </p>

            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="mt-5 flex items-start gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#007AFF]/15">
                  <Icon size={18} className="text-[#007AFF]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{body}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <div className="relative mt-4 lg:mt-0">
          <DashboardScene />
        </div>
      </div>

      {/* ── Comparison: Your record vs the hospital's system ──────────────── */}
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px' }}
        variants={{ show: { transition: { staggerChildren: 0.06 } } }}
        className="relative mx-auto mt-24 max-w-6xl overflow-hidden rounded-[2.5rem] border border-white/10 px-5 py-16 sm:mt-32 sm:px-12 sm:py-20"
      >
        {/* Layer 1: drifting numbers */}
        <NumbersBackdrop />
        {/* Layer 2: dark overlay */}
        <div className="pointer-events-none absolute inset-0 bg-slate-950/60" />

        {/* Layer 3: content */}
        <div className="relative">
          <motion.h3
            variants={fadeRise}
            className="text-center text-3xl sm:text-4xl font-bold tracking-tight text-white"
          >
            Why you should keep{' '}
            <span className="bg-gradient-to-r from-[#007AFF] to-[#8B5CF6] bg-clip-text text-transparent">
              your own record
            </span>
          </motion.h3>
          <motion.p variants={fadeRise} className="mx-auto mt-4 max-w-2xl text-center text-lg text-slate-400">
            The hospital's system tracks the hospital's money. Yours should track yours.
          </motion.p>

          {/* Desktop table — glass */}
          <motion.div
            variants={fadeRise}
            className="mx-auto mt-12 hidden max-w-5xl overflow-hidden rounded-3xl border border-white/15 bg-white/[0.07] backdrop-blur-xl md:block"
          >
            <div className="grid grid-cols-[1.1fr_1.2fr_1.2fr]">
              <div className="p-5" />
              <div className="border-l border-white/10 bg-[#007AFF]/15 p-5 text-center">
                <p className="text-sm font-bold text-white">Your WardRounds record</p>
              </div>
              <div className="border-l border-white/10 p-5 text-center">
                <p className="text-sm font-semibold text-slate-400">Relying on the hospital's system</p>
              </div>
            </div>
            {COMPARISON.map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-[1.1fr_1.2fr_1.2fr] border-t border-white/10 ${i % 2 ? 'bg-white/[0.03]' : ''}`}
              >
                <div className="flex items-center p-5 text-sm font-semibold text-slate-200">{row.label}</div>
                <div className="flex items-start gap-2.5 border-l border-white/10 bg-[#007AFF]/[0.08] p-5">
                  <Check size={17} className="mt-0.5 flex-shrink-0 text-[#4DA3FF]" />
                  <span className="text-sm font-medium text-white">{row.yours}</span>
                </div>
                <div className="flex items-start gap-2.5 border-l border-white/10 p-5">
                  <X size={17} className="mt-0.5 flex-shrink-0 text-slate-600" />
                  <span className="text-sm text-slate-500">{row.theirs}</span>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Mobile stacked cards — glass */}
          <div className="mt-10 space-y-4 md:hidden">
            {COMPARISON.map(row => (
              <motion.div
                key={row.label}
                variants={fadeRise}
                className="overflow-hidden rounded-2xl border border-white/15 bg-white/[0.07] backdrop-blur-xl"
              >
                <p className="border-b border-white/10 px-5 py-3 text-sm font-bold text-white">{row.label}</p>
                <div className="flex items-start gap-2.5 bg-[#007AFF]/[0.08] px-5 py-4">
                  <Check size={16} className="mt-0.5 flex-shrink-0 text-[#4DA3FF]" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#4DA3FF]">Your WardRounds record</p>
                    <p className="mt-0.5 text-sm font-medium text-white">{row.yours}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 border-t border-white/10 px-5 py-4">
                  <X size={16} className="mt-0.5 flex-shrink-0 text-slate-600" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">The hospital's system</p>
                    <p className="mt-0.5 text-sm text-slate-500">{row.theirs}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  )
}
