import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, X } from 'lucide-react'
import Backdrop from './Backdrop'

// ─────────────────────────────────────────────────────────────────────────────
// SlideOverPanel — a side rail that is INLINE on desktop (lg+) and becomes a
// right-hand slide-in drawer on mobile/tablet, opened by an edge tab with an
// icon. Used for the CalendarRail on Outpatient + Appointments; reusable for any
// future side panel.
//
//   <SlideOverPanel title="Calendar" icon={CalendarDays} widthClass="lg:w-64">
//     {close => <CalendarRail … onSelectDate={d => { openDay(d); close() }} />}
//   </SlideOverPanel>
//
// children may be a node or a function receiving close(), so picking something
// inside the drawer can dismiss it. Only ONE copy of the children is mounted.
// ─────────────────────────────────────────────────────────────────────────────

const DESKTOP_QUERY = '(min-width: 1024px)'   // Tailwind `lg`

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY)
    const onChange = e => setIsDesktop(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isDesktop
}

export default function SlideOverPanel({ title, icon: Icon = CalendarDays, widthClass = 'lg:w-64', children }) {
  const isDesktop = useIsDesktop()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const content = typeof children === 'function' ? children(close) : children

  // Esc closes; lock background scroll while open.
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    const scroller = document.getElementById('main-scroll')
    const prev = scroller?.style.overflowY
    if (scroller) scroller.style.overflowY = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      if (scroller) scroller.style.overflowY = prev || ''
    }
  }, [open])

  // Going to desktop width while open: just show it inline.
  useEffect(() => { if (isDesktop) setOpen(false) }, [isDesktop])

  if (isDesktop) return <div className={`w-full ${widthClass} flex-shrink-0`}>{content}</div>

  return (
    <>
      {/* Edge tab — sits on the right edge, clear of the bottom pill nav */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open ${title}`}
        aria-expanded={open}
        className={`fixed right-0 top-[42%] z-40 flex items-center justify-center w-12 h-14 rounded-l-2xl
          bg-white/90 backdrop-blur-xl border border-r-0 border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.15)]
          text-ios-blue active:scale-95 transition-all duration-300 ${open ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}`}
      >
        <Icon size={22} />
      </button>

      {createPortal(
        <>
          <Backdrop
            onClick={close}
            zIndex="z-[79]"
            className={`transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            aria-hidden={!open}
            className={`fixed top-0 right-0 bottom-0 z-[80] w-[88vw] max-w-sm flex flex-col
              bg-[#f5f6f8]/95 backdrop-blur-xl border-l border-white/60
              transition-[transform,box-shadow,visibility] duration-300 ease-out motion-reduce:transition-none
              ${open ? 'translate-x-0 visible shadow-[-16px_0_50px_rgba(0,0,0,0.15)]' : 'translate-x-full invisible shadow-none'}`}
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0">
              <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
                <Icon size={18} className="text-ios-blue" /> {title}
              </h2>
              <button onClick={close} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors">
                <X size={15} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6" data-lenis-prevent>
              {content}
            </div>
          </aside>
        </>,
        document.body
      )}
    </>
  )
}
