import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const TOUR_STEPS = [
  {
    id: 'practice',
    targetId: 'settings-practice-form',
    title: 'Step 1 of 5 — Practice Details',
    body: 'Fill in your clinic name, doctor name, and contact info. This appears on all invoices.',
    position: 'bottom',
    route: '/settings',
  },
  {
    id: 'hospital',
    targetId: 'settings-add-hospital-btn',
    title: 'Step 2 of 5 — Add a Hospital',
    body: 'Click "+ Add Hospital" to register the facility where you admit patients.',
    position: 'left',
    route: '/settings',
  },
  {
    id: 'ward',
    targetId: 'settings-wards-section',
    title: 'Step 3 of 5 — Add a Ward',
    body: 'After adding a hospital, add wards with their daily billing rates (KES/day).',
    position: 'top',
    route: '/settings',
  },
  {
    id: 'services',
    targetId: 'settings-services-section',
    title: 'Step 4 of 5 — Add Services',
    body: 'Add clinical services you charge for — consultations, procedures, labs, and more.',
    position: 'top',
    route: '/settings',
  },
  {
    id: 'team',
    targetId: 'settings-invite-btn',
    title: 'Step 5 of 5 — Invite Your Team',
    body: 'Invite nurses, associate doctors, accountants, and cashiers to join your practice.',
    position: 'left',
    route: '/settings',
  },
]

export default function TooltipTour({ onComplete }) {
  const [step, setStep] = useState(0)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const tooltipRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()
  const current = TOUR_STEPS[step]

  // Navigate to the correct route for this step
  useEffect(() => {
    if (location.pathname !== current.route) {
      navigate(current.route)
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // Position tooltip relative to target element
  useEffect(() => {
    function position() {
      const target = document.getElementById(current.targetId)
      const tooltip = tooltipRef.current
      if (!target || !tooltip) return

      const tr = target.getBoundingClientRect()
      const tt = tooltip.getBoundingClientRect()
      const gap = 12

      let top, left
      switch (current.position) {
        case 'bottom':
          top  = tr.bottom + gap
          left = tr.left + tr.width / 2 - tt.width / 2
          break
        case 'top':
          top  = tr.top - tt.height - gap
          left = tr.left + tr.width / 2 - tt.width / 2
          break
        case 'left':
          top  = tr.top + tr.height / 2 - tt.height / 2
          left = tr.left - tt.width - gap
          break
        case 'right':
          top  = tr.top + tr.height / 2 - tt.height / 2
          left = tr.right + gap
          break
        default:
          top  = tr.bottom + gap
          left = tr.left
      }

      // Clamp to viewport
      left = Math.max(8, Math.min(left, window.innerWidth  - tt.width  - 8))
      top  = Math.max(8, Math.min(top,  window.innerHeight - tt.height - 8))

      setPos({ top, left })
    }

    // Retry positioning — target may not be mounted yet after route change
    const t1 = setTimeout(position, 100)
    const t2 = setTimeout(position, 400)
    window.addEventListener('resize', position)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      window.removeEventListener('resize', position)
    }
  }, [step, current])

  function handleNext() {
    if (step < TOUR_STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      onComplete()
    }
  }

  return (
    <>
      {/* Semi-transparent backdrop */}
      <div className="fixed inset-0 z-40 pointer-events-none" style={{ background: 'rgba(0,0,0,0.25)' }} />

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className="fixed z-50 w-72 bg-white/95 backdrop-blur-xl border border-white/60 rounded-2xl shadow-2xl p-5"
        style={{ top: pos.top, left: pos.left }}
      >
        {/* Step badge + skip */}
        <div className="flex items-center justify-between mb-3">
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
            style={{ background: '#007AFF' }}
          >
            {current.title.split('—')[0].trim()}
          </span>
          <button
            onClick={onComplete}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Skip tour
          </button>
        </div>

        {/* Content */}
        <h4 className="font-semibold text-gray-900 text-sm mb-1">
          {current.title.split('—')[1]?.trim()}
        </h4>
        <p className="text-xs text-gray-500 leading-relaxed mb-4">{current.body}</p>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mb-4">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: i === step ? 20 : 6, background: i === step ? '#007AFF' : '#E5E7EB' }}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleNext}
            className="flex-1 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: '#007AFF' }}
          >
            {step < TOUR_STEPS.length - 1 ? 'Next →' : 'Finish ✓'}
          </button>
          <button
            onClick={onComplete}
            className="px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition-colors border border-gray-200"
          >
            Skip
          </button>
        </div>
      </div>
    </>
  )
}
