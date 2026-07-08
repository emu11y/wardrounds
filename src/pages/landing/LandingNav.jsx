import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { scrollToHash } from './scrollToHash'

export const LINKS = [
  { label: 'About', href: '#about' },
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Doctors', href: '#doctors' },
  { label: 'FAQ', href: '#faq' },
]

export default function LandingNav({ openAuth, lenisRef }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 40)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function goTo(e, href) {
    e.preventDefault()
    setMenuOpen(false)
    scrollToHash(lenisRef, href)
  }

  return (
    <header className="fixed inset-x-0 top-4 z-50 px-4">
      <nav
        className={`mx-auto flex w-full max-w-3xl items-center justify-between rounded-full border border-white/10 py-2 pl-3 pr-2 backdrop-blur-xl transition-colors duration-300 ${
          scrolled ? 'bg-slate-900/85' : 'bg-slate-900/60'
        } shadow-lg shadow-black/25`}
      >
        <span className="flex items-center">
          <img src="/wardrounds-icon.png" className="h-7 w-7 object-contain flex-shrink-0" alt="WardRounds" />
          <span className="ml-2 text-base font-bold tracking-tight text-white">WardRounds</span>
          <span className="mx-3 hidden h-5 w-px bg-white/15 md:block" />
        </span>

        <div className="hidden md:flex items-center gap-6">
          {LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => goTo(e, link.href)}
              className="text-sm font-medium text-slate-300 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          <button onClick={() => openAuth('signin')} className="px-2 text-sm font-semibold text-slate-300 transition-colors hover:text-white">
            Sign In
          </button>
          <button
            onClick={() => openAuth('signup')}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-opacity hover:opacity-90"
          >
            Start Free
          </button>
        </div>

        <button
          onClick={() => setMenuOpen(o => !o)}
          className="md:hidden p-1.5 text-slate-200"
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="md:hidden mx-auto mt-2 max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-lg shadow-black/25"
          >
            <div className="flex flex-col gap-1 px-6 py-4">
              {LINKS.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => goTo(e, link.href)}
                  className="rounded-lg px-2 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-4">
                <button
                  onClick={() => { setMenuOpen(false); openAuth('signin') }}
                  className="rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200"
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setMenuOpen(false); openAuth('signup') }}
                  className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-900"
                >
                  Start Free
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
