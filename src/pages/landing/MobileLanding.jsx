import { useState } from 'react'
import { Wallet, Building2, Activity, Lock } from 'lucide-react'
import AuthModal from './AuthModal'

// Lightweight, flat, fully-static mobile landing page. Deliberately imports NO
// framer-motion, NO Lenis, and uses NO backdrop-blur — the three things that made
// the animated desktop landing lag on phones. Solid backgrounds, native <details>
// accordions (zero JS), and the shared AuthModal for sign-in/up. Desktop still gets
// the original animated Landing (see App.jsx routing).

const FEATURES = [
  { icon: Wallet, title: 'Every shilling accounted for', body: 'Charges logged at the bedside, not reconstructed from memory at month-end.' },
  { icon: Building2, title: 'Every hospital, one record', body: 'Fee-for-service across three hospitals? One authoritative record you own.' },
  { icon: Activity, title: 'Live, not month-end', body: 'Your running total updates the moment a service is logged. No surprises.' },
  { icon: Lock, title: 'Yours alone', body: "Your billing data belongs to you, secured and private — not locked in a hospital's HMS." },
]

const TESTIMONIALS = [
  { quote: "I used to lose track of procedures I'd add verbally and forget to bill. Now nothing slips through — every charge is captured at the bedside.", name: 'Dr. A. Mwangi', role: 'Consultant Physician, Nairobi', initials: 'AM', color: '#007AFF' },
  { quote: "Month-end reconciliation used to take me a full evening. Now I export, match it against the statement, and I'm done in twenty minutes.", name: 'Dr. S. Otieno', role: 'General Surgeon', initials: 'SO', color: '#8B5CF6' },
  { quote: 'I cover four hospitals in a week. WardRounds is the only place I can see all my patients and my numbers in one screen.', name: 'Dr. L. Njeri', role: 'Locum, Multi-hospital', initials: 'LN', color: '#34C759' },
  { quote: 'One tap and my entire month is in Excel, formatted and ready. It used to take my accountant hours to compile.', name: 'Dr. F. Hassan', role: 'Government Consultant', initials: 'FH', color: '#FF9500' },
]

const FAQS = [
  { q: 'What is WardRounds?', a: "WardRounds is a personal billing and practice-management app for doctors in Kenya. It keeps your own authoritative record of every patient, procedure, and shilling across every hospital you work in — independent of any hospital's system." },
  { q: 'How does WardRounds stop revenue leakage?', a: 'Charges are captured at the bedside the moment you deliver care, not reconstructed from memory at month-end. Your running total is live, so nothing you did goes unbilled or unpaid.' },
  { q: 'I work at several hospitals. Does that work?', a: "That's exactly what WardRounds is built for. Fee-for-service physicians, surgeons, and visiting consultants get one unified record across every facility, with per-hospital breakdowns when you need them." },
  { q: 'How does month-end reconciliation work?', a: "Export your month to Excel in one tap and match it against the hospital's statement line by line. What used to take an evening takes minutes — and discrepancies stand out immediately." },
  { q: 'Can my whole team use it?', a: 'Yes. Add your associates, nurses, and secretary with role-based permissions, so everyone logs care as it happens while you stay in control of what each person can see and do.' },
  { q: 'Is my billing data secure?', a: 'Your data is encrypted, private, and yours alone. WardRounds is independent of hospital systems — no administrator, employer, or third party can see your numbers.' },
]

function Pill({ children }) {
  return (
    <p className="text-center font-mono text-xs font-semibold uppercase tracking-[0.15em] text-[#007AFF]">
      {children}
    </p>
  )
}

export default function MobileLanding() {
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('signin')

  function openAuth(mode) {
    setAuthMode(mode)
    setAuthOpen(true)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Floating glass header (static — no animation) */}
      <header className="fixed inset-x-0 top-3 z-50 px-4">
        <nav className="mx-auto flex max-w-xl items-center justify-between gap-2 rounded-full border border-white/10 bg-slate-900/70 py-2 pl-3 pr-2 shadow-lg shadow-black/30 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-2">
            <img src="/wardrounds-icon.png" className="h-7 w-7 flex-shrink-0 object-contain" alt="WardRounds" />
            <span className="truncate text-base font-bold tracking-tight">WardRounds</span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              onClick={() => openAuth('signin')}
              className="rounded-full px-3 py-1.5 text-sm font-semibold text-slate-200 active:text-white"
            >
              Sign In
            </button>
            <button
              onClick={() => openAuth('signup')}
              className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-slate-900 active:opacity-90"
            >
              Sign Up
            </button>
          </div>
        </nav>
      </header>

      {/* Hero (pt clears the floating header) */}
      <section className="px-5 pt-28 pb-16 text-center">
        <h1 className="text-4xl font-bold leading-tight tracking-tight">
          Never lose another{' '}
          <span className="text-[#007AFF]">ward round</span>.
        </h1>
        <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-slate-400">
          The financial operating system for modern medical practice. Track every patient, visit,
          procedure and payment across every hospital you work in.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={() => openAuth('signup')}
            className="rounded-full bg-[#007AFF] px-6 py-3.5 text-sm font-semibold text-white active:bg-[#0066DD]"
          >
            Start Free
          </button>
          <button
            onClick={() => openAuth('signin')}
            className="rounded-full border border-slate-700 px-6 py-3.5 text-sm font-semibold text-slate-200 active:bg-slate-800"
          >
            Sign In
          </button>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-slate-800 bg-slate-900/50 px-5 py-14">
        <Pill>Built for doctors</Pill>
        <h2 className="mx-auto mt-3 max-w-sm text-center text-2xl font-bold tracking-tight">
          You do the rounds. WardRounds does the math.
        </h2>
        <div className="mt-8 space-y-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#007AFF]/15">
                <Icon size={18} className="text-[#007AFF]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-5 py-14">
        <Pill>Doctors</Pill>
        <h2 className="mt-3 text-center text-2xl font-bold tracking-tight">Trusted at the bedside.</h2>
        <div className="mt-8 space-y-4">
          {TESTIMONIALS.map(t => (
            <div key={t.name} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-sm leading-relaxed text-slate-300">"{t.quote}"</p>
              <div className="mt-4 flex items-center gap-3">
                <span
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: t.color }}
                >
                  {t.initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{t.name}</p>
                  <p className="truncate text-xs text-slate-400">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ — native <details>, zero JS */}
      <section className="border-t border-slate-800 bg-slate-900/50 px-5 py-14">
        <Pill>FAQ</Pill>
        <h2 className="mt-3 text-center text-2xl font-bold tracking-tight">Questions, answered.</h2>
        <div className="mt-8 space-y-3">
          {FAQS.map(({ q, a }) => (
            <details
              key={q}
              className="group rounded-2xl border border-slate-800 bg-slate-900 px-5 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-semibold text-white">
                {q}
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-slate-700 text-[#007AFF] transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-slate-400">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 py-16 text-center">
        <h2 className="text-2xl font-bold tracking-tight">Take control of your practice.</h2>
        <p className="mx-auto mt-3 max-w-sm text-slate-400">
          Start free — add your hospitals, admit your first patient, and see your live running total
          within minutes.
        </p>
        <button
          onClick={() => openAuth('signup')}
          className="mt-7 w-full rounded-full bg-[#007AFF] px-6 py-3.5 text-sm font-semibold text-white active:bg-[#0066DD]"
        >
          Start Free
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-5 py-10">
        <div className="flex items-center gap-2">
          <img src="/wardrounds-icon.png" className="h-8 w-8 object-contain" alt="WardRounds" />
          <span className="text-lg font-bold tracking-tight text-white">WardRounds</span>
        </div>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
          Your personal billing and practice record — every patient, procedure, and shilling across
          every hospital you work in, captured at the bedside and yours alone.
        </p>
        <p className="mt-6 text-xs text-slate-500">
          © {new Date().getFullYear()} WardRounds. Built for doctors, not hospitals.
        </p>
      </footer>

      <AuthModal open={authOpen} mode={authMode} onModeChange={setAuthMode} onClose={() => setAuthOpen(false)} />
    </div>
  )
}
