import { Fragment, useRef } from 'react'
import { motion, animate, useMotionValue, useTransform, useInView, useReducedMotion } from 'framer-motion'
import { Building2, Pencil, Plus, Users } from 'lucide-react'
import PhoneFrame from './mock/PhoneFrame'
import PatientCard from './mock/PatientCard'
import MacBookFrame from './mock/MacBookFrame'
import DashboardMock from './mock/DashboardMock'
import MockSectionPanel from './mock/MockSectionPanel'
import { useLoopedSequence, useReveal, wait } from './useLoopedSequence'
import { formatKES } from './format'

const TIMELINE_ACCENT = '#007AFF'
const TIMELINE_SEGMENT_TOTALS = [60000, 30000, 32000] // ICU 3d×20,000 · HDU 2d×15,000 · General 4d×8,000

const BILLING_ACCENT = '#007AFF'
const BILLING_LINES = [
  { type: 'ward', name: 'General Ward', days: 13, rate: 8000, total: 104000 },
  { type: 'service', name: 'Continuous Glucose Monitoring', dateLabel: '23 Jun, 09:40', total: 21000 },
  { type: 'service', name: '2D ECHO', dateLabel: '24 Jun, 14:15', total: 8000 },
]
const BILLING_TOTAL = BILLING_LINES.reduce((sum, line) => sum + line.total, 0)

const INVOICE_META = {
  number: 'INV-2026-0142',
  date: '5 Jul 2026',
  practice: 'Yusuf Medical Practice',
  practiceLocation: 'Nairobi, Kenya',
  hospital: 'M.P. Shah Hospital',
  patient: 'Abraham Bayusuf',
  patientNo: '#24963483',
}

const SETTINGS_ACCENT = '#007AFF'
const RATES = [
  { label: 'ICU', amount: 20000 },
  { label: 'HDU', amount: 15000 },
  { label: 'General Ward', amount: 8000 },
]

const TEAM = [
  { initials: 'AM', name: 'Dr. A. Mwangi', position: 'Consultant Physician', role: 'admin' },
  { initials: 'NA', name: 'N. Achieng', position: 'Ward Nurse', role: 'member' },
]
const NEW_MEMBER = { initials: 'JK', name: 'Dr. J. Kariuki', position: 'Resident', role: 'member' }

export function FeatureBlock({ eyebrow, title, body, reverse, children, variant = 'plain' }) {
  const reduceMotion = useReducedMotion()

  const inner = (
    <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
      <div className={reverse ? 'lg:order-2' : 'lg:order-1'}>
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: '#007AFF' }}>
          {eyebrow}
        </span>
        <h3 className="mt-3 text-3xl font-bold text-white sm:text-4xl">{title}</h3>
        <p className="mt-4 max-w-md text-base text-slate-400">{body}</p>
      </div>

      <div className={reverse ? 'lg:order-1' : 'lg:order-2'}>
        <motion.div
          animate={reduceMotion ? undefined : { y: [-6, 6, -6] }}
          transition={reduceMotion ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  )

  if (variant === 'panel') {
    return (
      <section className="bg-slate-950 px-6 py-24 sm:py-32">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#131c30] px-6 py-12 shadow-2xl shadow-black/40 sm:px-12 lg:px-16 flex items-center">
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
            style={{ background: 'linear-gradient(to top, rgba(0,122,255,0.12), transparent)' }}
            aria-hidden="true"
          />
          <div className="relative w-full">
            {inner}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="flex min-h-[90vh] items-center bg-slate-950 px-6 py-16">
      {inner}
    </section>
  )
}

function TimelineScene() {
  const ref = useRef(null)
  const reduceMotion = useReducedMotion()
  const inView = useInView(ref, { amount: 0.4, once: true })

  const finalTotal = TIMELINE_SEGMENT_TOTALS.reduce((sum, n) => sum + n, 0)
  const wardLabel = useMotionValue(reduceMotion ? 'General Ward' : 'ICU')
  const total = useMotionValue(reduceMotion ? finalTotal : 0)
  const formattedTotal = useTransform(total, formatKES)

  const node1 = useReveal(reduceMotion)
  const node2 = useReveal(reduceMotion)
  const node3 = useReveal(reduceMotion)
  const footer = useReveal(reduceMotion)
  const nodes = [node1, node2, node3, footer]
  const firstRunRef = useRef(true) // total + ward count up once, then settle

  async function revealNode(node) {
    await Promise.all([
      animate(node.opacity, 1, { duration: 0.55, ease: 'easeOut' }),
      animate(node.y, 0, { duration: 0.55, ease: 'easeOut' }),
    ])
  }

  async function playSequence(isCancelled) {
    const count = firstRunRef.current // only count the total + move the ward chip on the first pass
    firstRunRef.current = false

    let runningTotal = TIMELINE_SEGMENT_TOTALS[0]
    await Promise.all([
      revealNode(node1),
      count && animate(total, runningTotal, { duration: 0.55, ease: 'easeOut' }),
    ].filter(Boolean))
    if (isCancelled()) return
    await wait(275)

    runningTotal += TIMELINE_SEGMENT_TOTALS[1]
    if (count) wardLabel.set('HDU')
    await Promise.all([
      revealNode(node2),
      count && animate(total, runningTotal, { duration: 0.55, ease: 'easeOut' }),
    ].filter(Boolean))
    if (isCancelled()) return
    await wait(275)

    runningTotal += TIMELINE_SEGMENT_TOTALS[2]
    if (count) wardLabel.set('General Ward')
    await Promise.all([
      revealNode(node3),
      count && animate(total, runningTotal, { duration: 0.55, ease: 'easeOut' }),
    ].filter(Boolean))
    if (isCancelled()) return
    await wait(275)

    await revealNode(footer)
  }

  function reset() {
    // Only the timeline entries rebuild each loop — total + ward stay settled.
    nodes.forEach(n => { n.opacity.set(0); n.y.set(8) })
  }

  async function fadeOut() {
    // Dissolve just the timeline entries; the card scaffold stays solid.
    await Promise.all(nodes.map(n => animate(n.opacity, 0, { duration: 0.4, ease: 'easeIn' })))
  }

  useLoopedSequence({ active: inView, reduceMotion, playSequence, reset, fadeOut })

  return (
    <div ref={ref}>
      <PhoneFrame>
        <div className="h-full overflow-hidden bg-ios-gray-6 p-4 pt-12">
          <PatientCard
            accentColor={TIMELINE_ACCENT}
            wardLabel={wardLabel}
            formattedTotal={formattedTotal}
            reveals={[node1, node2, node3]}
            footerReveal={footer}
          />
        </div>
      </PhoneFrame>
    </div>
  )
}

function InvoiceScene() {
  const ref = useRef(null)
  const reduceMotion = useReducedMotion()
  const inView = useInView(ref, { amount: 0.4, once: true })

  const total = useMotionValue(reduceMotion ? BILLING_TOTAL : 0)
  const formattedTotal = useTransform(total, formatKES)

  const line1 = useReveal(reduceMotion)
  const line2 = useReveal(reduceMotion)
  const line3 = useReveal(reduceMotion)
  const lines = [line1, line2, line3]

  async function playSequence(isCancelled) {
    let runningTotal = 0
    for (let i = 0; i < BILLING_LINES.length; i++) {
      if (isCancelled()) return
      runningTotal += BILLING_LINES[i].total
      await Promise.all([
        animate(lines[i].opacity, 1, { duration: 0.35, ease: 'easeOut' }),
        animate(lines[i].y, 0, { duration: 0.35, ease: 'easeOut' }),
        animate(total, runningTotal, { duration: 0.35, ease: 'easeOut' }),
      ])
      if (isCancelled()) return
      await wait(150)
    }
  }

  function reset() {
    lines.forEach(line => { line.opacity.set(0); line.y.set(8) })
    total.set(0)
  }

  const contentOpacity = useLoopedSequence({ active: inView, reduceMotion, playSequence, reset })

  return (
    <div ref={ref}>
      <MacBookFrame>
        <div className="relative overflow-hidden">
          {/* Dashboard backdrop — steady, blurred + dimmed, bleeding through as the real InvoiceModal sits over the live app */}
          <div className="absolute inset-0 origin-top scale-[1.35] blur-[3px]" aria-hidden="true">
            <DashboardMock />
          </div>
          <div className="absolute inset-0 bg-slate-950/70" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" aria-hidden="true" />

          <motion.div style={{ opacity: contentOpacity }} className="relative z-10 px-6 pt-6 sm:px-12 sm:pt-8">
          {/* Invoice sheet — bottom edge runs past the screen crop, as if it continues */}
          <div className="mx-auto max-w-md overflow-hidden rounded-t-lg bg-white shadow-2xl shadow-black/50">
            {/* Header band */}
            <div className="flex items-center gap-3 px-5 py-4" style={{ backgroundColor: BILLING_ACCENT }}>
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/90 ring-1 ring-white/60 backdrop-blur-xl">
                <img src="/wardrounds-icon.png" alt="" className="h-6 w-6 object-contain" />
              </div>
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[8px] uppercase tracking-widest text-white/70">Invoice</p>
                  <p className="truncate text-sm font-bold leading-tight text-white">{INVOICE_META.practice}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="font-mono text-[9px] font-semibold text-white/80">{INVOICE_META.number}</p>
                  <p className="font-mono text-[9px] text-white/60">{INVOICE_META.date}</p>
                </div>
              </div>
            </div>

            {/* Issued by / Issued through */}
            <div className="flex gap-10 border-b border-gray-100 px-5 py-3">
              <div>
                <p className="text-[7px] font-bold uppercase tracking-widest text-gray-400">Issued by</p>
                <p className="mt-1 text-[10px] font-semibold text-gray-800">{INVOICE_META.practice}</p>
                <p className="text-[9px] text-gray-500">{INVOICE_META.practiceLocation}</p>
              </div>
              <div>
                <p className="text-[7px] font-bold uppercase tracking-widest text-gray-400">Issued through</p>
                <p className="mt-1 text-[10px] font-semibold text-gray-800">{INVOICE_META.hospital}</p>
                <p className="text-[9px] text-gray-500">{INVOICE_META.patient} · {INVOICE_META.patientNo}</p>
              </div>
            </div>

            {/* Line items */}
            <div className="px-5 pb-12 pt-3">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b-2 border-gray-200 text-[8px] font-bold uppercase tracking-widest text-gray-400">
                    <th className="pb-1.5 text-left font-bold">Service</th>
                    <th className="pb-1.5 text-center font-bold">Days</th>
                    <th className="pb-1.5 text-right font-bold">Rate/day</th>
                    <th className="pb-1.5 text-right font-bold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {BILLING_LINES.map((line, i) => (
                    <Fragment key={line.name}>
                      {line.type === 'service' && BILLING_LINES[i - 1]?.type === 'ward' && (
                        <motion.tr style={{ opacity: lines[i].opacity }}>
                          <td colSpan={4} className="pb-1 pt-3 text-[7px] font-bold uppercase tracking-widest text-gray-400">
                            Procedures &amp; Tests
                          </td>
                        </motion.tr>
                      )}
                      <motion.tr style={{ opacity: lines[i].opacity, y: lines[i].y }} className="border-b border-gray-100">
                        <td className="py-2 font-medium text-gray-800">{line.name}</td>
                        <td className="py-2 text-center tabular-nums text-gray-600">
                          {line.type === 'ward' ? line.days : '—'}
                        </td>
                        <td className="py-2 text-right tabular-nums text-gray-600">
                          {line.type === 'ward' ? line.rate.toLocaleString() : '—'}
                        </td>
                        <td className="py-2 text-right font-semibold tabular-nums text-gray-800 whitespace-nowrap">
                          KES {line.total.toLocaleString()}
                        </td>
                      </motion.tr>
                    </Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td colSpan={3} className="pr-3 pt-2.5 text-right font-bold text-gray-700">
                      Total
                    </td>
                    <td className="pt-2.5 text-right">
                      <motion.span
                        className="text-[11px] font-bold tabular-nums whitespace-nowrap"
                        style={{ color: BILLING_ACCENT }}
                      >
                        {formattedTotal}
                      </motion.span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Fade-crop: the invoice dissolves into the screen edge, continuing below */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-slate-950 to-transparent"
            aria-hidden="true"
          />
        </motion.div>
        </div>
      </MacBookFrame>
    </div>
  )
}

function SettingsScene() {
  const ref = useRef(null)
  const reduceMotion = useReducedMotion()
  const inView = useInView(ref, { amount: 0.4, once: true })

  const rate1 = useReveal(reduceMotion)
  const rate2 = useReveal(reduceMotion)
  const rate3 = useReveal(reduceMotion)
  const rates = [rate1, rate2, rate3]
  const member1 = useReveal(reduceMotion)
  const member2 = useReveal(reduceMotion)
  const members = [member1, member2]
  const addMemberOpacity = useMotionValue(reduceMotion ? 1 : 0)
  const addMemberScale = useMotionValue(reduceMotion ? 1 : 0.9)
  const newMemberOpacity = useMotionValue(reduceMotion ? 1 : 0)
  const newMemberY = useMotionValue(reduceMotion ? 0 : -12)

  async function revealRow(row) {
    await Promise.all([
      animate(row.opacity, 1, { duration: 0.45, ease: 'easeOut' }),
      animate(row.y, 0, { duration: 0.45, ease: 'easeOut' }),
    ])
  }

  async function playSequence(isCancelled) {
    for (let i = 0; i < rates.length; i++) {
      if (isCancelled()) return
      await revealRow(rates[i])
      await wait(200)
    }
    for (let i = 0; i < members.length; i++) {
      if (isCancelled()) return
      await revealRow(members[i])
      await wait(200)
    }
    if (isCancelled()) return
    await Promise.all([
      animate(addMemberOpacity, 1, { duration: 0.4 }),
      animate(addMemberScale, 1, { type: 'spring', stiffness: 260, damping: 16 }),
    ])
    if (isCancelled()) return
    await wait(450)
    await Promise.all([
      animate(newMemberOpacity, 1, { duration: 0.5, ease: 'easeOut' }),
      animate(newMemberY, 0, { duration: 0.5, ease: 'easeOut' }),
    ])
  }

  function reset() {
    rates.forEach(r => { r.opacity.set(0); r.y.set(8) })
    members.forEach(m => { m.opacity.set(0); m.y.set(8) })
    addMemberOpacity.set(0)
    addMemberScale.set(0.9)
    newMemberOpacity.set(0)
    newMemberY.set(-12)
  }

  async function fadeOut() {
    // Dissolve only the populated rows/pill; the panel frames stay solid.
    await Promise.all([
      ...rates.map(r => animate(r.opacity, 0, { duration: 0.4, ease: 'easeIn' })),
      ...members.map(m => animate(m.opacity, 0, { duration: 0.4, ease: 'easeIn' })),
      animate(addMemberOpacity, 0, { duration: 0.4, ease: 'easeIn' }),
      animate(newMemberOpacity, 0, { duration: 0.4, ease: 'easeIn' }),
    ])
  }

  useLoopedSequence({ active: inView, reduceMotion, playSequence, reset, fadeOut })

  return (
    <div ref={ref}>
      <PhoneFrame>
        <div className="h-full overflow-hidden bg-ios-gray-6 p-4 pt-12 space-y-3">
          {/* HOSPITALS */}
          <MockSectionPanel accentColor={SETTINGS_ACCENT}>
            <div className="flex items-center gap-2 p-4">
              <Building2 size={13} style={{ color: SETTINGS_ACCENT }} className="flex-shrink-0" />
              <span className="text-xs font-bold tracking-wide flex-1" style={{ color: SETTINGS_ACCENT }}>HOSPITALS</span>
            </div>
            <div className="px-4 pb-4 pt-1 border-t border-white/30">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: SETTINGS_ACCENT }} />
                <p className="text-sm font-bold text-gray-900 truncate">M.P. Shah Hospital</p>
              </div>
              {RATES.map((rate, i) => (
                <motion.div
                  key={rate.label}
                  style={{ opacity: rates[i].opacity, y: rates[i].y }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/60 border border-gray-100 mb-1"
                >
                  <span className="flex-1 text-sm text-gray-800 truncate">{rate.label}</span>
                  <span className="text-sm font-medium text-gray-700 flex-shrink-0 tabular-nums whitespace-nowrap">
                    KES {rate.amount.toLocaleString()}/day
                  </span>
                  <Pencil size={12} className="text-gray-300 flex-shrink-0" />
                </motion.div>
              ))}
            </div>
          </MockSectionPanel>

          {/* TEAM */}
          <MockSectionPanel accentColor={SETTINGS_ACCENT}>
            <div className="flex items-center gap-2 p-4">
              <Users size={13} style={{ color: SETTINGS_ACCENT }} className="flex-shrink-0" />
              <span className="text-xs font-bold tracking-wide flex-1" style={{ color: SETTINGS_ACCENT }}>TEAM</span>
              <motion.div
                style={{ opacity: addMemberOpacity, scale: addMemberScale, backgroundColor: SETTINGS_ACCENT }}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm flex-shrink-0 whitespace-nowrap"
              >
                <Plus size={10} />
                Add
              </motion.div>
            </div>
            <div className="px-4 pb-4 pt-1 border-t border-white/30 space-y-2">
              {TEAM.map((member, i) => (
                <motion.div key={member.name} style={{ opacity: members[i].opacity, y: members[i].y }} className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold ring-2 ring-white shadow-sm flex-shrink-0"
                    style={{ backgroundColor: SETTINGS_ACCENT + '20', color: SETTINGS_ACCENT }}
                  >
                    {member.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{member.name}</p>
                    <p className="text-xs text-gray-500 truncate">{member.position}</p>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${member.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {member.role === 'admin' ? 'Administrator' : 'Member'}
                  </span>
                </motion.div>
              ))}

              <motion.div style={{ opacity: newMemberOpacity, y: newMemberY }} className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold ring-2 ring-white shadow-sm flex-shrink-0"
                  style={{ backgroundColor: SETTINGS_ACCENT + '20', color: SETTINGS_ACCENT }}
                >
                  {NEW_MEMBER.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{NEW_MEMBER.name}</p>
                  <p className="text-xs text-gray-500 truncate">{NEW_MEMBER.position}</p>
                </div>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 bg-blue-100 text-blue-700">
                  Member
                </span>
              </motion.div>
            </div>
          </MockSectionPanel>
        </div>
      </PhoneFrame>
    </div>
  )
}

export default function FeatureBlocks() {
  return (
    <div id="features" className="scroll-mt-24">
      <FeatureBlock
        eyebrow="STAY TIMELINE"
        title="Every ward, every transfer, captured."
        body="ICU to HDU to General Ward — the timeline builds itself as your patient moves."
        reverse={false}
        variant="panel"
      >
        <div style={{ zoom: 0.8 }}>
          <TimelineScene />
        </div>
      </FeatureBlock>

      <FeatureBlock
        eyebrow="ISSUE & GET PAID"
        title="Your record, ready to invoice."
        body="One tap turns your ward record into a clean, printable invoice — issued by your practice, through the hospital, with your name on it. Hand it over or save it as a PDF. Your fee, your paperwork, no chasing."
        reverse
      >
        <InvoiceScene />
      </FeatureBlock>

      <FeatureBlock
        eyebrow="YOUR PRACTICE, YOUR RULES"
        title="Set your rates. Build your team."
        body="Per-hospital rates for every ward level. Invite your team with role-based access."
        reverse={false}
      >
        <SettingsScene />
      </FeatureBlock>
    </div>
  )
}
