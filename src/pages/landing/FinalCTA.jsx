import { motion } from 'framer-motion'
import { Stethoscope, ArrowRight } from 'lucide-react'

const PERSONAS = [
  { label: 'Physicians', img: '/persona-physician.jpg', size: 'sm', flip: false },
  { label: 'Surgeons', img: '/persona-surgeon.jpg', size: 'lg', flip: false },
  { label: 'Nurses', img: '/persona-nurse.jpg', size: 'sm', flip: true },
]

export default function FinalCTA({ openAuth }) {
  return (
    <section
      id="doctors"
      className="relative scroll-mt-24 overflow-hidden bg-slate-950 px-6 py-32"
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/hospital-bg.jpg')" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-slate-950/75" aria-hidden="true" />
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{ background: 'linear-gradient(135deg, rgba(0,122,255,0.40) 0%, rgba(10,25,64,0.35) 45%, rgba(139,92,246,0.22) 100%)' }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-transparent to-slate-950" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center text-center">
        <motion.span
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="inline-flex items-center gap-2 rounded-full border border-[#007AFF]/30 bg-[#007AFF]/10 px-3.5 py-1.5 text-xs font-medium tracking-wide text-[#4DA3FF] backdrop-blur-sm"
        >
          <Stethoscope className="h-4 w-4" />
          Built for everyone on the ward
        </motion.span>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mt-8 text-4xl font-bold tracking-tight text-white sm:text-5xl"
        >
          Take control of your practice.
          <br />
          <span className="bg-gradient-to-r from-[#007AFF] to-[#8B5CF6] bg-clip-text text-transparent">
            Take control of your income.
          </span>
        </motion.h2>

        <div className="mt-14 flex w-full max-w-4xl items-end justify-center gap-4 sm:gap-6">
          {PERSONAS.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.12 }}
              className={`relative ${p.size === 'lg' ? 'w-[34%] z-10' : 'w-[26%]'}`}
            >
              <div className="glass-rim rounded-[22px] p-2 shadow-2xl shadow-black/50">
                <div
                  className={`aspect-[884/1250] w-full overflow-hidden rounded-2xl bg-slate-800 bg-cover bg-center ${p.flip ? '-scale-x-100' : ''}`}
                  style={{ backgroundImage: `url(${p.img})` }}
                  role="img"
                  aria-label={p.label}
                />
              </div>
              <span className="pointer-events-none absolute inset-x-0 bottom-5 mx-auto w-fit rounded-full bg-slate-950/70 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                {p.label}
              </span>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mt-14 flex flex-col items-center"
        >
          <p className="max-w-xl text-base leading-relaxed text-slate-300">
            One authoritative billing record that matches the hospital's — so nothing you earn on the ward slips through.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => openAuth('signup')}
              style={{ backgroundColor: '#007AFF' }}
              className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/30"
            >
              Give WardRounds a try
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => openAuth('signin')}
              className="rounded-full border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10"
            >
              Sign In
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
