import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'

const fadeRise = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 90, damping: 16 } },
}

const FAQS = [
  {
    q: 'What is WardRounds?',
    a: "WardRounds is a personal billing and practice-management app for doctors in Kenya. It keeps your own authoritative record of every patient, procedure, and shilling across every hospital you work in — independent of any hospital's system.",
  },
  {
    q: 'How does WardRounds stop revenue leakage?',
    a: "Charges are captured at the bedside the moment you deliver care, not reconstructed from memory at month-end. Your running total is live, so nothing you did goes unbilled or unpaid.",
  },
  {
    q: 'I work at several hospitals. Does that work?',
    a: "That's exactly what WardRounds is built for. Fee-for-service physicians, surgeons, and visiting consultants get one unified record across every facility, with per-hospital breakdowns when you need them.",
  },
  {
    q: 'How does month-end reconciliation work?',
    a: "Export your month to Excel in one tap and match it against the hospital's statement line by line. What used to take an evening takes minutes — and discrepancies stand out immediately.",
  },
  {
    q: 'Can my whole team use it?',
    a: "Yes. Add your associates, nurses, and secretary with role-based permissions, so everyone logs care as it happens while you stay in control of what each person can see and do.",
  },
  {
    q: 'Is my billing data secure?',
    a: "Your data is encrypted, private, and yours alone. WardRounds is independent of hospital systems — no administrator, employer, or third party can see your numbers.",
  },
  {
    q: 'Does it work on my phone at the bedside?',
    a: "WardRounds is built mobile-first. Log a procedure in seconds between patients, on the ward, from any device.",
  },
  {
    q: 'How do I get started?',
    a: "Create your free account, add your hospitals, and admit your first patient. You'll see your first live running total within minutes.",
  },
]

export default function FAQ({ openAuth }) {
  const [open, setOpen] = useState(0)

  return (
    <section id="faq" className="relative overflow-hidden bg-slate-950 px-6 py-24 sm:py-32 scroll-mt-24">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)',
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-32 h-[30rem] w-[30rem] rounded-full blur-[120px]"
        style={{ backgroundColor: 'rgba(0, 122, 255, 0.10)' }}
      />

      <div className="relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1.4fr]">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          variants={{ show: { transition: { staggerChildren: 0.12 } } }}
          className="lg:sticky lg:top-32 lg:self-start"
        >
          <motion.span
            variants={fadeRise}
            className="font-mono text-xs font-semibold uppercase tracking-[0.15em]"
            style={{ color: '#007AFF' }}
          >
            FAQ
          </motion.span>

          <motion.h2
            variants={fadeRise}
            className="mt-4 text-4xl sm:text-5xl font-bold tracking-tight text-white"
          >
            Questions,{' '}
            <span className="bg-gradient-to-r from-[#007AFF] to-[#8B5CF6] bg-clip-text text-transparent">
              answered.
            </span>
          </motion.h2>

          <motion.p variants={fadeRise} className="mt-5 text-lg text-slate-400">
            Everything doctors ask us before they start. Something else on your mind? Start free
            and see for yourself in minutes.
          </motion.p>

          <motion.button
            variants={fadeRise}
            onClick={() => openAuth('signup')}
            className="mt-8 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:opacity-90"
          >
            Start Free
          </motion.button>
        </motion.div>

        <div className="space-y-3">
          {FAQS.map(({ q, a }, i) => (
            <div
              key={q}
              className={`rounded-2xl border backdrop-blur-sm transition-colors ${
                open === i ? 'border-white/20 bg-white/[0.07]' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
              }`}
            >
              <button
                onClick={() => setOpen(open === i ? -1 : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
              >
                <span className="text-sm sm:text-base font-semibold text-white">{q}</span>
                <motion.span
                  animate={{ rotate: open === i ? 45 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5"
                >
                  <Plus size={14} className="text-slate-300" />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 text-sm leading-relaxed text-slate-400">{a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQS.map(f => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }),
        }}
      />
    </section>
  )
}
