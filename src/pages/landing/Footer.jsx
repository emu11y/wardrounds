import { LINKS } from './LandingNav'
import { scrollToHash } from './scrollToHash'
import { ArrowUp } from 'lucide-react'

export default function Footer({ openAuth, lenisRef }) {
  return (
    <footer className="relative border-t border-white/10 bg-slate-950 px-6 pt-16 pb-8">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.6fr_1fr_1fr_1.3fr]">
        <div>
          <span className="flex items-center gap-2">
            <img src="/wardrounds-icon.png" className="h-10 w-10 object-contain flex-shrink-0" alt="WardRounds" />
            <span className="text-2xl font-bold tracking-tight text-white">WardRounds</span>
          </span>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
            Your personal billing record, at the bedside. Every patient, every procedure, every
            shilling — across every hospital you work in.
          </p>
          <p className="mt-4 text-xs text-slate-500">Built in Nairobi, Kenya 🇰🇪</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Explore</p>
          <div className="mt-5 space-y-3">
            {LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => { e.preventDefault(); scrollToHash(lenisRef, link.href) }}
                className="block text-sm text-slate-400 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Get Started</p>
          <div className="mt-5 space-y-3">
            <button
              onClick={() => openAuth('signin')}
              className="block text-sm text-slate-400 transition-colors hover:text-white text-left"
            >
              Sign In
            </button>
            <button
              onClick={() => openAuth('signup')}
              className="block text-sm text-slate-400 transition-colors hover:text-white text-left"
            >
              Start Free
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">The fine print</p>
          <p className="mt-5 text-sm leading-relaxed text-slate-500">
            WardRounds is a personal billing and practice-management record. It is not an EMR and
            stores no medical records — your patients' clinical data stays where it belongs.
          </p>
        </div>
      </div>

      <div className="mx-auto mt-14 flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
        <p className="text-xs text-slate-500">© 2026 WardRounds. All rights reserved.</p>
        <button
          onClick={() => {
            const lenis = lenisRef?.current
            if (lenis) lenis.scrollTo(0, { duration: 1.2 })
            else window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-white"
        >
          Back to top <ArrowUp size={13} />
        </button>
      </div>
    </footer>
  )
}
