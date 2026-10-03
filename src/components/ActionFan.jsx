import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// ─────────────────────────────────────────────────────────────────────────────
// ActionFan — the single "••• Actions" control used on every expandable card
// (Inpatient PatientCard, Outpatient visit cards, …).
//
// Tapping the trigger fans large circular buttons out in a SEMICIRCLE to the
// right of the trigger. The fan is portalled to <body> with fixed positioning
// (getBoundingClientRect) so it escapes card overflow clipping, and the arc
// adapts to the space available (header above, mobile pill nav below, screen
// edge to the right).
//
// Props
//   open, onOpenChange(bool)  — controlled open state (card owns it so it can
//                               close the fan when the card collapses)
//   actions: [{ key, title, icon: LucideIcon, tone, onClick, disabled }]
//     tone: 'blue' | 'gray' | 'green' | 'red'
//   disabled                  — disables every action (e.g. while processing)
//
// Picking an action closes the fan, then runs its onClick.
// ─────────────────────────────────────────────────────────────────────────────

const TONES = {
  blue:  'bg-blue-50/95 hover:bg-blue-100 text-blue-600 border-blue-200',
  gray:  'bg-white/95 hover:bg-gray-100 text-gray-700 border-gray-200',
  green: 'bg-green-50/95 hover:bg-green-100 text-green-600 border-green-200',
  red:   'bg-red-50/95 hover:bg-red-100 text-red-500 border-red-200',
}

const SIZE = 56          // button diameter (px) — comfortably above the 44px touch minimum
const GAP = 10           // min space between neighbouring buttons along the arc
const EDGE = 12          // keep-clear margin from the viewport edge
const TOP_CLEAR = 76     // sticky TopHeader
const BOTTOM_CLEAR = 92  // mobile pill nav + safe area
const MIN_R = 72         // never closer than this to the trigger
const ANIM_MS = 220

const rad = d => (d * Math.PI) / 180
const deg = r => (r * 180) / Math.PI
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Radius such that neighbouring buttons (n of them across `rangeDeg`) don't touch.
function radiusFor(n, rangeDeg) {
  if (n <= 1) return MIN_R
  const step = rad(rangeDeg / (n - 1))
  return Math.max(MIN_R, (SIZE + GAP) / (2 * Math.sin(step / 2)))
}

// Work out the arc centre, radius and angle range for n buttons next to `rect`.
// Angles: -90° = straight up, 0° = straight right, +90° = straight down.
// Buttons keep a fixed spacing along the arc, so a few actions form a tight curve
// centred to the right and six or more fill the full semicircle. If the arc would
// run under the header or the bottom nav it is rotated toward the roomy side, and
// only squeezed (radius grown) when it can't fit at all.
const BASE_R = 96
const stepFor = r => deg(2 * Math.asin(Math.min(1, (SIZE + GAP) / (2 * r))))

export function computeFanLayout(n, rect, vw, vh) {
  let cx = rect.right + 6
  const cy = rect.top + rect.height / 2
  const spaceAbove = cy - TOP_CLEAR - SIZE / 2
  const spaceBelow = vh - BOTTOM_CLEAR - cy - SIZE / 2

  let r = Math.max(BASE_R, radiusFor(n, 180))
  let range = n <= 1 ? 0 : Math.min(180, (n - 1) * stepFor(r))
  let start = -range / 2, end = range / 2

  // Max angles that stay on-screen vertically at radius r.
  const limits = rr => ({
    up: -deg(Math.asin(clamp(spaceAbove / rr, 0, 1))),
    down: deg(Math.asin(clamp(spaceBelow / rr, 0, 1))),
  })
  for (let i = 0; i < 4; i++) {
    const { up, down } = limits(r)
    if (end > down) { const d = end - down; start -= d; end -= d }       // rotate up
    if (start < up) { const d = up - start; start += d; end += d }       // rotate down
    if (start >= up - 0.01 && end <= down + 0.01) break
    // Still doesn't fit: narrow to the available window and grow r to keep spacing.
    start = Math.max(start, up); end = Math.min(end, down)
    if (end - start < 30) { // pathological (tiny viewport) — lean to the roomy side
      if (spaceAbove >= spaceBelow) { end = Math.max(end, 0); start = end - 90 } else { start = Math.min(start, 0); end = start + 90 }
    }
    r = radiusFor(n, end - start)
  }

  // Keep the rightmost button on-screen: pull the centre left (down to the
  // trigger's middle), then shrink the radius as a last resort.
  const reach = r * Math.max(Math.cos(rad(clamp(0, start, end))), 0)
  const maxReach = vw - EDGE - SIZE / 2
  if (cx + reach > maxReach) cx = Math.max(rect.left + rect.width / 2, maxReach - reach)
  if (cx + r > maxReach && cx + reach > maxReach) r = Math.max(MIN_R, maxReach - cx)

  const positions = Array.from({ length: n }, (_, i) => {
    const a = rad(n === 1 ? (start + end) / 2 : start + ((end - start) * i) / (n - 1))
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })
  return { cx, cy, positions }
}

export default function ActionFan({ open, onOpenChange, actions, disabled = false }) {
  const triggerRef = useRef(null)
  const [mounted, setMounted] = useState(false)   // portal in the DOM
  const [shown, setShown] = useState(false)       // buttons at their arc positions
  const [layout, setLayout] = useState(null)

  const close = () => onOpenChange?.(false)

  // Measure + mount on open; animate out then unmount on close.
  useLayoutEffect(() => {
    if (open) {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      setLayout(computeFanLayout(actions.length, rect, window.innerWidth, window.innerHeight))
      setMounted(true)
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(id)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), ANIM_MS)
    return () => clearTimeout(t)
  }, [open, actions.length])

  // Close on scroll / resize / Escape while open (position would go stale).
  useEffect(() => {
    if (!open) return
    const scroller = document.querySelector('#main-scroll')
    const onKey = e => { if (e.key === 'Escape') close() }
    scroller?.addEventListener('scroll', close, { passive: true })
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    return () => {
      scroller?.removeEventListener('scroll', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const stop = e => e.stopPropagation()

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={e => { e.stopPropagation(); onOpenChange?.(!open) }}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-200
          ${open ? 'bg-ios-blue text-white border-ios-blue shadow-lg' : 'text-gray-600 bg-gray-100/80 hover:bg-gray-200/80 border-gray-200/60'}`}
      >
        <span className={`tracking-widest ${open ? 'text-white/80' : 'text-gray-400'}`}>•••</span>
        <span>Actions</span>
      </button>

      {mounted && layout && createPortal(
        <div className="fixed inset-0 z-[65]" onClick={e => { stop(e); close() }} onPointerDown={stop}>
          {/* dim layer */}
          <div className={`absolute inset-0 bg-black/10 transition-opacity duration-200 motion-reduce:transition-none ${shown ? 'opacity-100' : 'opacity-0'}`} />

          <div role="menu" aria-label="Actions">
            {actions.map((a, i) => {
              const Icon = a.icon
              const p = layout.positions[i]
              const dx = shown ? p.x - layout.cx : 0
              const dy = shown ? p.y - layout.cy : 0
              const isDisabled = disabled || a.disabled
              return (
                <button
                  key={a.key || a.title}
                  type="button"
                  role="menuitem"
                  title={a.title}
                  aria-label={a.title}
                  disabled={isDisabled}
                  onClick={e => { stop(e); close(); a.onClick?.() }}
                  style={{
                    left: layout.cx - SIZE / 2,
                    top: layout.cy - SIZE / 2,
                    width: SIZE,
                    height: SIZE,
                    transform: `translate(${dx}px, ${dy}px) scale(${shown ? 1 : 0.4})`,
                    opacity: shown ? 1 : 0,
                    transitionDelay: shown ? `${i * 30}ms` : '0ms',
                  }}
                  className={`absolute rounded-full flex items-center justify-center border shadow-lg backdrop-blur-xl
                    transition-[transform,opacity] duration-[220ms] ease-out motion-reduce:transition-none
                    active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
                    ${TONES[a.tone] || TONES.gray}`}
                >
                  <Icon className="w-6 h-6" strokeWidth={2} />
                </button>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
