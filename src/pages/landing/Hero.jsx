import { motion } from 'framer-motion'
import FloatingNotifications from './FloatingNotifications'
import StatCard from './mock/StatCard'
import BarChart from './mock/BarChart'

const fadeRise = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 90, damping: 16 } },
}

const BARS = [40, 65, 50, 80, 60, 95, 70]

export default function Hero({ openAuth }) {
  return (
    <section className="relative min-h-screen overflow-hidden bg-slate-950 pt-32 pb-20">
      {/* Ambient glows — radial gradients instead of filter:blur(120px), which is
          extremely expensive to paint on mobile GPUs. Same soft-glow look, ~zero cost. */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 h-[36rem] w-[36rem] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(0,122,255,0.15) 0%, rgba(0,122,255,0) 70%)' }}
      />
      <div
        className="pointer-events-none absolute top-20 -right-40 h-[36rem] w-[36rem] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, rgba(139,92,246,0) 70%)' }}
      />

      <motion.div
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.15 } } }}
        className="relative mx-auto flex max-w-4xl flex-col items-center px-6 text-center"
      >
        <motion.h1
          variants={fadeRise}
          className="text-5xl sm:text-7xl font-bold tracking-tight text-white"
        >
          Never Lose Another{' '}
          <span className="bg-gradient-to-r from-[#007AFF] to-[#8B5CF6] bg-clip-text text-transparent">
            Ward Round
          </span>
          .
        </motion.h1>

        <motion.p
          variants={fadeRise}
          className="mt-6 max-w-2xl text-lg text-slate-400"
        >
          The financial operating system for modern medical practice. Track every patient,
          every visit, every procedure and every payment across every hospital you work in.
        </motion.p>

        <motion.div variants={fadeRise} className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => openAuth('signup')}
            style={{ backgroundColor: '#007AFF' }}
            className="rounded-full px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/30"
          >
            Start Free
          </button>
          <button className="rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10">
            Watch Demo
          </button>
        </motion.div>

        {/* Floating dashboard mock */}
        <motion.div
          variants={fadeRise}
          className="relative mt-20 w-full max-w-3xl"
        >
          {/* Static (no infinite float): moving a backdrop-blur element re-computes the
              blur every frame — a continuous GPU cost above the fold on mobile. */}
          <div className="relative rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <FloatingNotifications />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { label: 'Total Admissions', value: '20' },
                { label: 'IP Revenue', value: 'KES 3,459,000' },
                { label: 'Combined', value: 'KES 3,541,000' },
              ].map(stat => (
                <StatCard key={stat.label} label={stat.label} value={stat.value} />
              ))}
            </div>

            <BarChart bars={BARS} className="mt-6" />
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}
