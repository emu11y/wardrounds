import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet, Building2, Activity, Lock, Check, X, Download, FileSpreadsheet,
  Stethoscope, ArrowRight, ArrowUp, Bell, TrendingUp, FileCheck, Plus, Users, Pencil,
  Clock, ChevronDown, CalendarDays, BedDouble, BarChart2, Settings as SettingsIcon,
} from 'lucide-react'
import AuthModal from './AuthModal'
// Framer-free mock primitives shared with the desktop landing (PatientCard and
// MockCardHeader are NOT imported — they use framer-motion; replicated statically below).
import MacBookFrame from './mock/MacBookFrame'
import MockSectionPanel from './mock/MockSectionPanel'
import MockIconTile from './mock/MockIconTile'
import { darken } from './mock/colors'

// Graphical mobile landing — same content as the desktop landing, scaled down.
// Deliberately imports NO framer-motion and NO Lenis (the two things that made the
// animated desktop landing lag on phones). All motion is CSS-only (opacity/transform,
// runs once): a single IntersectionObserver adds .wr-in to .wr-reveal blocks (see
// globals.css). The only infinite animation is the drifting-numbers backdrop —
// transform-only, GPU-composited, mirroring the desktop comparison section.
// Desktop still gets the original animated Landing (see App.jsx routing).

/* ── Shared content (mirrors the desktop sections) ─────────────────────────── */

const FEATURES = [
  { icon: Wallet, title: 'Every shilling accounted for', body: 'Charges logged at the bedside, not reconstructed from memory at month-end.' },
  { icon: Building2, title: 'Every hospital, one record', body: 'Fee-for-service across three hospitals? One authoritative record you own.' },
  { icon: Activity, title: 'Live, not month-end', body: 'Your running total updates the moment a service is logged. No surprises.' },
  { icon: Lock, title: 'Yours alone', body: "Your billing data belongs to you, secured and private — not locked in a hospital's HMS." },
]

const COMPARISON = [
  { label: 'Whose interests it serves', yours: 'Built for you, the doctor', theirs: "Built for the hospital's books" },
  { label: 'Revenue leakage', yours: "Every charge you're owed, captured", theirs: 'Missed fees you never notice' },
  { label: 'Fee disputes', yours: 'Your own record to reconcile against', theirs: 'Their statement, their word' },
  { label: 'Across hospitals', yours: 'One record spanning every site', theirs: 'Fragmented — one system per hospital' },
  { label: 'When you see it', yours: 'Live, at the bedside', theirs: 'Month-end, if reconciled at all' },
  { label: 'Ownership', yours: 'Yours alone, always exportable', theirs: "Locked in a system you don't control" },
]

const KES_FIGURES = [
  'KES 3,000', 'KES 15,000', 'KES 84,000', 'KES 6,500', 'KES 120,000',
  'KES 46,000', 'KES 9,000', 'KES 32,000', 'KES 250,000', 'KES 66,000',
]

const STEPS = [
  { number: '1', title: 'Capture', body: 'Scan a tag or search a patient and log them on the spot.' },
  { number: '2', title: 'Round', body: 'Add notes, services and transfers as you see each patient.' },
  { number: '3', title: 'Record', body: 'WardRounds keeps a dated, itemised account on its own.' },
  { number: '4', title: 'Reconcile', body: "Match your totals to each hospital's — and get paid in full." },
]

// Mirrors mock/PatientCard.jsx ENTRIES — keep in sync with the desktop mock.
const TIMELINE_ENTRIES = [
  { label: 'Admitted to ICU · 12 Jun', sub: '3d · KES 20,000/day', dot: '#ef4444', current: false },
  { label: 'Transferred to HDU · 15 Jun', sub: '2d · KES 15,000/day', dot: '#f97316', current: false },
  { label: 'Transferred to General Ward · 17 Jun', sub: '4d · KES 8,000/day', dot: '#22c55e', current: true },
]

// Mirrors mock/DashboardMock.jsx STAT_CHIPS.
const STAT_CHIPS = [
  { name: 'ALL HOSPITALS', count: 20, bg: 'rgba(0,122,255,0.12)', border: 'rgba(0,122,255,0.3)' },
  { name: 'NAIROBI HOSP.', count: 12, bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' },
  { name: 'AGA KHAN', count: 8, bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' },
]

const SIDEBAR_ICONS = [
  { icon: BedDouble, active: true },
  { icon: Stethoscope, active: false },
  { icon: Users, active: false },
  { icon: BarChart2, active: false },
  { icon: SettingsIcon, active: false },
]

const INVOICE_LINES = [
  { name: 'General Ward', detail: '13 days · 8,000/day', total: 'KES 104,000' },
  { name: 'Continuous Glucose Monitoring', detail: '23 Jun, 09:40', total: 'KES 21,000' },
  { name: '2D ECHO', detail: '24 Jun, 14:15', total: 'KES 8,000' },
]

const RATES = [
  { label: 'ICU', amount: 'KES 20,000/day' },
  { label: 'HDU', amount: 'KES 15,000/day' },
  { label: 'General Ward', amount: 'KES 8,000/day' },
]

const TEAM = [
  { initials: 'AM', name: 'Dr. A. Mwangi', position: 'Consultant Physician', admin: true },
  { initials: 'NA', name: 'N. Achieng', position: 'Ward Nurse', admin: false },
  { initials: 'JK', name: 'Dr. J. Kariuki', position: 'Resident', admin: false },
]

const EXPORT_ROWS = [
  { name: 'Fatuma Hassan', hospital: 'Aga Khan', ward: 'General', amount: '32,000' },
  { name: 'David Kimani', hospital: '3rd Park', ward: 'HDU', amount: '30,000' },
  { name: 'Mary Njeri', hospital: 'M.P. Shah', ward: 'General', amount: '40,000' },
  { name: 'Grace Wanjiru', hospital: 'M.P. Shah', ward: 'ICU', amount: '60,000' },
]

const PATIENTS_DATA = [
  { name: '3rd Park', inpatient: 34, outpatient: 61 },
  { name: 'M.P. Shah', inpatient: 28, outpatient: 44 },
  { name: 'Aga Khan', inpatient: 22, outpatient: 39 },
  { name: 'Avenue', inpatient: 17, outpatient: 25 },
]
const PATIENTS_MAX = 61

const REVENUE_DATA = [
  { name: '3rd Park', label: '1.24M', pct: 100, color: '#34C759' },
  { name: 'M.P. Shah', label: '862K', pct: 70, color: '#FF9500' },
  { name: 'Aga Khan', label: '918K', pct: 74, color: '#FF3B30' },
  { name: 'Avenue', label: '439K', pct: 35, color: '#007AFF' },
]

const HERO_BARS = [40, 65, 50, 80, 60, 95, 70]

const HERO_NOTIFICATIONS = [
  { text: 'New Admission · +KES 8,000', icon: Bell },
  { text: 'Procedure Added · +KES 15,000', icon: FileCheck },
  { text: 'Ward Round Complete · +KES 2,000', icon: TrendingUp },
]

const TESTIMONIALS = [
  { quote: "I used to lose track of procedures I'd add verbally and forget to bill. Now nothing slips through — every charge is captured at the bedside.", name: 'Dr. A. Mwangi', role: 'Consultant Physician, Nairobi', initials: 'AM', color: '#007AFF' },
  { quote: "Month-end reconciliation used to take me a full evening. Now I export, match it against the statement, and I'm done in twenty minutes.", name: 'Dr. S. Otieno', role: 'General Surgeon', initials: 'SO', color: '#8B5CF6' },
  { quote: 'I cover four hospitals in a week. WardRounds is the only place I can see all my patients and my numbers in one screen.', name: 'Dr. L. Njeri', role: 'Locum, Multi-hospital', initials: 'LN', color: '#34C759' },
  { quote: "My whole team — nurses included — logs charges as they happen. I'm not chasing anyone for numbers anymore.", name: 'Dr. J. Kamau', role: 'Paediatrician, Private Practice', initials: 'JK', color: '#FF9500' },
  { quote: 'One tap and my entire month is in Excel, formatted and ready. It used to take my accountant hours to compile.', name: 'Dr. F. Hassan', role: 'Government Consultant', initials: 'FH', color: '#FF3B30' },
]

const FAQS = [
  { q: 'What is WardRounds?', a: "WardRounds is a personal billing and practice-management app for doctors in Kenya. It keeps your own authoritative record of every patient, procedure, and shilling across every hospital you work in — independent of any hospital's system." },
  { q: 'How does WardRounds stop revenue leakage?', a: 'Charges are captured at the bedside the moment you deliver care, not reconstructed from memory at month-end. Your running total is live, so nothing you did goes unbilled or unpaid.' },
  { q: 'I work at several hospitals. Does that work?', a: "That's exactly what WardRounds is built for. Fee-for-service physicians, surgeons, and visiting consultants get one unified record across every facility, with per-hospital breakdowns when you need them." },
  { q: 'How does month-end reconciliation work?', a: "Export your month to Excel in one tap and match it against the hospital's statement line by line. What used to take an evening takes minutes — and discrepancies stand out immediately." },
  { q: 'Can my whole team use it?', a: 'Yes. Add your associates, nurses, and secretary with role-based permissions, so everyone logs care as it happens while you stay in control of what each person can see and do.' },
  { q: 'Is my billing data secure?', a: 'Your data is encrypted, private, and yours alone. WardRounds is independent of hospital systems — no administrator, employer, or third party can see your numbers.' },
  { q: 'Does it work on my phone at the bedside?', a: 'WardRounds is built mobile-first. Log a procedure in seconds between patients, on the ward, from any device.' },
  { q: 'How do I get started?', a: "Create your free account, add your hospitals, and admit your first patient. You'll see your first live running total within minutes." },
]

const PERSONAS = [
  { label: 'Physicians', img: '/persona-physician.jpg', lg: false, flip: false },
  { label: 'Surgeons', img: '/persona-surgeon.jpg', lg: true, flip: false },
  { label: 'Nurses', img: '/persona-nurse.jpg', lg: false, flip: true },
]

/* ── CSS-only reveal (one IntersectionObserver, fires once per block) ──────── */

function Reveal({ as: Tag = 'div', className = '', delay = 0, children }) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      className={`wr-reveal ${inView ? 'wr-in' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  )
}

/* ── Small shared pieces ───────────────────────────────────────────────────── */

function Eyebrow({ children }) {
  return (
    <p className="text-center font-mono text-xs font-semibold uppercase tracking-[0.15em] text-[#007AFF]">
      {children}
    </p>
  )
}

function GradientText({ children }) {
  return (
    <span className="bg-gradient-to-r from-[#007AFF] to-[#8B5CF6] bg-clip-text text-transparent">
      {children}
    </span>
  )
}

function Glow({ className, color = 'rgba(0,122,255,0.14)' }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute rounded-full ${className}`}
      style={{ background: `radial-gradient(circle, ${color} 0%, transparent 70%)` }}
    />
  )
}

function PhoneShell({ children }) {
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <Glow className="-inset-8" color="rgba(0,122,255,0.18)" />
      <div className="relative rounded-[2.6rem] border border-white/10 bg-slate-900 p-2 shadow-2xl shadow-black/60">
        <div className="relative overflow-hidden rounded-[2.1rem] border border-white/10 bg-[#F2F2F7]">
          <div className="absolute left-1/2 top-2 z-20 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
          {children}
        </div>
      </div>
    </div>
  )
}

/* ── Section mocks (static + CSS reveal; no JS animation loops) ────────────── */

function HeroDashboardMock() {
  return (
    <div className="relative rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-left shadow-2xl shadow-black/40">
      {/* Static notification pills — the desktop hero floats these; here they perch */}
      <div className="pointer-events-none absolute -top-3 right-3 flex flex-col items-end gap-2">
        {HERO_NOTIFICATIONS.slice(0, 2).map(({ text, icon: Icon }, i) => (
          <Reveal
            key={text}
            delay={500 + i * 200}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-slate-800 px-3 py-1.5 text-[10px] font-medium text-slate-200 shadow-lg shadow-black/40"
          >
            <Icon size={11} className="flex-shrink-0 text-[#007AFF]" />
            <span className="whitespace-nowrap">{text}</span>
          </Reveal>
        ))}
      </div>

      <div className="space-y-2">
        {[
          { label: 'Total Admissions', value: '20' },
          { label: 'IP Revenue', value: 'KES 3,459,000' },
          { label: 'Combined', value: 'KES 3,541,000' },
        ].map(stat => (
          <div key={stat.label} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{stat.label}</span>
            <span className="text-sm font-semibold tabular-nums text-white">{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex h-20 items-end gap-1.5 rounded-xl border border-white/10 bg-white/5 p-3">
        {HERO_BARS.map((h, i) => (
          <div
            key={i}
            className="wr-bar flex-1 rounded-t-sm bg-gradient-to-t from-[#007AFF] to-[#8B5CF6]"
            style={{ height: `${h}%`, opacity: 0.5 + h / 200, animationDelay: `${300 + i * 70}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

function NumbersBackdrop() {
  const columns = [
    { duration: 14, offset: 0 },
    { duration: 19, offset: 6 },
    { duration: 24, offset: 11 },
  ]
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="flex h-full justify-between px-4 opacity-40">
        {columns.map((col, i) => (
          <div
            key={i}
            className="flex flex-col gap-8"
            style={{ animation: `wr-drift-up ${col.duration}s linear infinite`, animationDelay: `-${col.offset}s` }}
          >
            {[...KES_FIGURES, ...KES_FIGURES].map((fig, j) => (
              <span key={j} className="font-mono text-base font-semibold tabular-nums text-[#007AFF]">
                {fig}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// Static replica of mock/MockCardHeader.jsx (which uses framer-motion) — keep the
// markup byte-parallel with the original so the mocks stay true to the real app.
function AppCardHeader({ accentColor = '#007AFF', initials, name, patientNumber, ageDob, formattedTotal }) {
  return (
    <div
      className="pt-3 pb-2 px-4"
      style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${darken(accentColor, 45)} 100%)` }}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/25 flex items-center justify-center">
          <span className="text-white font-semibold text-sm">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate leading-tight uppercase">{name}</p>
          <p className="text-white/70 text-xs mt-0.5">{patientNumber}</p>
        </div>
      </div>
      <div className="mt-1.5 flex justify-end">
        <div className="text-right">
          <p className="text-white/70 text-xs">Total (Live)</p>
          <p className="text-lg font-bold text-white tabular-nums">{formattedTotal}</p>
        </div>
      </div>
      <div className="mt-1.5 pb-2 flex items-center justify-end text-white/80 text-xs">
        <div className="flex items-center gap-1">
          <CalendarDays size={11} className="text-white/70 flex-shrink-0" />
          <span>{ageDob}</span>
        </div>
      </div>
    </div>
  )
}

// Static replica of mock/PatientCard.jsx — the real app's patient card, settled.
function TimelineMock() {
  const accent = '#007AFF'
  return (
    <PhoneShell>
      <div className="bg-ios-gray-6 p-3 pt-10">
        <div
          className="rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-2 ring-white/60"
          style={{ backgroundColor: accent + '08' }}
        >
          <AppCardHeader
            accentColor={accent}
            initials="AB"
            name="Abraham Bayusuf"
            patientNumber="#24963483"
            ageDob="41 yrs · 6 Jun 1985"
            formattedTotal="KES 122,000"
          />

          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <MockIconTile accentColor={accent} icon={Building2} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 text-sm truncate">General Ward</p>
                <p className="text-gray-500 text-xs truncate">M.P. Shah Hospital</p>
              </div>
            </div>

            <MockSectionPanel accentColor={accent}>
              <div className="flex items-center gap-2 w-full p-4">
                <Clock size={13} style={{ color: accent }} className="flex-shrink-0" />
                <span className="text-xs font-bold tracking-wide flex-1" style={{ color: accent }}>
                  STAY TIMELINE
                </span>
                <Pencil size={13} style={{ color: accent }} />
                <ChevronDown size={13} className="rotate-180" style={{ color: accent }} />
              </div>

              <div className="px-4 pb-4 border-t border-white/30">
                {TIMELINE_ENTRIES.map((entry, i) => (
                  <Reveal key={entry.label} delay={i * 140} className="flex gap-3 pt-3">
                    <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                      <div className="w-2.5 h-2.5 rounded-full border-[1.5px] border-white" style={{ backgroundColor: entry.dot }} />
                      <div className="w-px flex-1 bg-ios-gray-4 mt-1" style={{ minHeight: '2rem' }} />
                    </div>
                    <div className="flex-1 pb-2">
                      <p className="text-[12px] font-semibold text-gray-800 leading-tight">{entry.label}</p>
                      <p className="text-[11px] text-ios-gray-1 mt-0.5">
                        {entry.sub}
                        {entry.current && <span className="ml-1.5 text-ios-green font-medium">(current)</span>}
                      </p>
                    </div>
                  </Reveal>
                ))}
                <Reveal delay={480} className="flex gap-3 pt-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-ios-green animate-pulse flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] font-semibold text-ios-green">Active · 9 days total</p>
                </Reveal>
              </div>
            </MockSectionPanel>
          </div>
        </div>
      </div>
    </PhoneShell>
  )
}

// Compact static replica of mock/DashboardMock.jsx — the desktop app, scaled down.
function MiniDashboardMock() {
  return (
    <MacBookFrame>
      <div className="flex bg-ios-gray-6">
        {/* Icon-only glass sidebar (compact form of the app's sidebar) */}
        <div className="flex w-10 flex-shrink-0 flex-col items-center gap-1.5 border-r border-white/30 bg-white/70 p-1.5">
          <div
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[9px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #007AFF, #5856D6)' }}
          >
            W
          </div>
          {SIDEBAR_ICONS.map(({ icon: Icon, active }, i) => (
            <div
              key={i}
              className={`flex h-6 w-6 items-center justify-center rounded-lg ${active ? 'bg-[#007AFF] text-white' : 'text-gray-500'}`}
            >
              <Icon size={13} />
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1 space-y-2 p-2">
          {/* Hospital Overview band — mirrors the app's dashboard header */}
          <div className="rounded-2xl bg-gradient-to-r from-[#1a237e] to-[#1565c0] p-2.5">
            <div className="flex items-center gap-2">
              <div
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[9px] font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #007AFF, #5856D6)' }}
              >
                W
              </div>
              <div>
                <p className="text-[10px] font-bold text-white">WardRounds</p>
                <p className="text-[8px] text-blue-200">Hospital Overview</p>
              </div>
            </div>
            <div className="mt-2 flex gap-1.5">
              {STAT_CHIPS.map(chip => (
                <div
                  key={chip.name}
                  className="relative min-w-0 flex-1 overflow-hidden rounded-xl border p-1.5"
                  style={{ backgroundColor: chip.bg, borderColor: chip.border }}
                >
                  <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-white/35 via-white/8 to-transparent" />
                  <p className="relative truncate text-[7px] font-bold uppercase tracking-wide text-white">{chip.name}</p>
                  <p className="relative mt-0.5 text-xs font-bold text-white">
                    {chip.count} <span className="text-[7px] font-normal text-white/70">patients</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Patient grid — compact cards (header + ward row) */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { accent: '#007AFF', initials: 'WK', name: 'Wanjiku Kamau', number: '#11482956', total: 'KES 84,000', ageDob: '34 yrs · 12 Mar 1992', ward: 'ICU', hospital: 'M.P. Shah Hospital' },
              { accent: '#F59E0B', initials: 'DO', name: 'David Ochieng', number: '#20871134', total: 'KES 32,000', ageDob: '58 yrs · 3 Nov 1967', ward: 'General Ward', hospital: 'Aga Khan Hospital' },
            ].map(p => (
              <div
                key={p.name}
                className="rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-2 ring-white/60"
                style={{ backgroundColor: p.accent + '08', zoom: 0.62 }}
              >
                <AppCardHeader
                  accentColor={p.accent}
                  initials={p.initials}
                  name={p.name}
                  patientNumber={p.number}
                  ageDob={p.ageDob}
                  formattedTotal={p.total}
                />
                <div className="p-3">
                  <div className="flex items-center gap-2.5">
                    <MockIconTile accentColor={p.accent} icon={Building2} size={14} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-xs truncate">{p.ward}</p>
                      <p className="text-gray-500 text-[10px] truncate">{p.hospital}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MacBookFrame>
  )
}

function InvoiceMock() {
  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <Glow className="-inset-8" color="rgba(139,92,246,0.16)" />
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-2xl shadow-black/50">
        <div className="flex items-center gap-2.5 bg-[#007AFF] px-4 py-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/90">
            <img src="/wardrounds-icon.png" alt="" className="h-5 w-5 object-contain" />
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[8px] uppercase tracking-widest text-white/70">Invoice</p>
              <p className="truncate text-xs font-bold text-white">Yusuf Medical Practice</p>
            </div>
            <div className="flex-shrink-0 text-right font-mono text-[9px] text-white/80">
              <p className="font-semibold">INV-2026-0142</p>
              <p className="text-white/60">5 Jul 2026</p>
            </div>
          </div>
        </div>

        <div className="flex gap-8 border-b border-gray-100 px-4 py-2.5">
          <div>
            <p className="text-[7px] font-bold uppercase tracking-widest text-gray-400">Issued by</p>
            <p className="mt-0.5 text-[10px] font-semibold text-gray-800">Yusuf Medical Practice</p>
          </div>
          <div>
            <p className="text-[7px] font-bold uppercase tracking-widest text-gray-400">Issued through</p>
            <p className="mt-0.5 text-[10px] font-semibold text-gray-800">M.P. Shah Hospital</p>
          </div>
        </div>

        <div className="px-4 pb-4 pt-2">
          {INVOICE_LINES.map((line, i) => (
            <Reveal key={line.name} delay={i * 140} className="flex items-center justify-between gap-3 border-b border-gray-100 py-2">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-gray-800">{line.name}</p>
                <p className="text-[9px] text-gray-400">{line.detail}</p>
              </div>
              <span className="flex-shrink-0 text-[11px] font-semibold tabular-nums text-gray-800">{line.total}</span>
            </Reveal>
          ))}
          <Reveal delay={460} className="flex items-center justify-between pt-2.5">
            <span className="text-[11px] font-bold text-gray-700">Total</span>
            <span className="text-xs font-bold tabular-nums text-[#007AFF]">KES 133,000</span>
          </Reveal>
        </div>
      </div>
    </div>
  )
}

// Mirrors the desktop SettingsScene (mock/MockSectionPanel glass panels on ios-gray).
function SettingsMock() {
  const accent = '#007AFF'
  return (
    <PhoneShell>
      <div className="space-y-2.5 bg-ios-gray-6 p-3 pt-10">
        <MockSectionPanel accentColor={accent}>
          <div className="flex items-center gap-2 p-3.5">
            <Building2 size={13} style={{ color: accent }} className="flex-shrink-0" />
            <span className="text-xs font-bold tracking-wide flex-1" style={{ color: accent }}>HOSPITALS</span>
          </div>
          <div className="px-3.5 pb-3.5 pt-1 border-t border-white/30">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: accent }} />
              <p className="truncate text-sm font-bold text-gray-900">M.P. Shah Hospital</p>
            </div>
            {RATES.map((rate, i) => (
              <Reveal key={rate.label} delay={i * 120} className="mb-1 flex items-center gap-2 rounded-xl border border-gray-100 bg-white/60 px-3 py-2">
                <span className="flex-1 truncate text-xs text-gray-800">{rate.label}</span>
                <span className="flex-shrink-0 text-xs font-medium tabular-nums text-gray-700">{rate.amount}</span>
                <Pencil size={11} className="flex-shrink-0 text-gray-300" />
              </Reveal>
            ))}
          </div>
        </MockSectionPanel>

        <MockSectionPanel accentColor={accent}>
          <div className="flex items-center gap-2 p-3.5">
            <Users size={13} style={{ color: accent }} className="flex-shrink-0" />
            <span className="text-xs font-bold tracking-wide flex-1" style={{ color: accent }}>TEAM</span>
            <Reveal delay={600} className="flex flex-shrink-0 items-center gap-1 rounded-full bg-[#007AFF] px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm">
              <Plus size={10} />
              Add
            </Reveal>
          </div>
          <div className="space-y-2 border-t border-white/30 px-3.5 pb-3.5 pt-2">
            {TEAM.map((member, i) => (
              <Reveal key={member.name} delay={200 + i * 140} className="flex items-center gap-3">
                <span
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-white shadow-sm"
                  style={{ backgroundColor: accent + '20', color: accent }}
                >
                  {member.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-gray-900">{member.name}</p>
                  <p className="truncate text-[10px] text-gray-500">{member.position}</p>
                </div>
                <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${member.admin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {member.admin ? 'Administrator' : 'Member'}
                </span>
              </Reveal>
            ))}
          </div>
        </MockSectionPanel>
      </div>
    </PhoneShell>
  )
}

// Mirrors the desktop ExportVisual — the app's Patients page in a laptop frame,
// light ios-gray chrome with the glass sidebar, plus the exported-file chip.
function ExportMock() {
  return (
    <MacBookFrame>
      <div className="flex gap-2 bg-ios-gray-6 p-2.5">
        {/* Icon-only glass sidebar */}
        <div className="flex w-9 flex-shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-white/30 bg-white/70 p-1.5 shadow-ios-card">
          <div
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[9px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #007AFF, #5856D6)' }}
          >
            W
          </div>
          {SIDEBAR_ICONS.map(({ icon: Icon }, i) => (
            <div
              key={i}
              className={`flex h-6 w-6 items-center justify-center rounded-lg ${i === 2 ? 'bg-[#007AFF] text-white' : 'text-gray-500'}`}
            >
              <Icon size={13} />
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5">
            <p className="text-xs font-bold leading-tight text-gray-900">Patients</p>
            <p className="text-[9px] leading-tight text-gray-500">Dr. A. Mwangi</p>
          </div>

          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[9px] text-gray-500">{EXPORT_ROWS.length} patients</p>
            <span className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-[#007AFF] px-2 py-1 text-[9px] font-semibold text-white">
              <Download size={9} />
              Export
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="grid grid-cols-[1.4fr_1fr_0.9fr_0.9fr] bg-[#007AFF] text-[7px] font-semibold uppercase tracking-wide text-white">
              {['Patient', 'Hospital', 'Ward', 'Amount'].map(h => (
                <div key={h} className="truncate border-r border-white/20 px-1.5 py-1 last:border-r-0">{h}</div>
              ))}
            </div>
            {EXPORT_ROWS.map((row, i) => (
              <Reveal
                key={row.name}
                delay={i * 110}
                className={`grid grid-cols-[1.4fr_1fr_0.9fr_0.9fr] text-[8px] text-gray-700 ${i % 2 ? 'bg-gray-50' : 'bg-white'}`}
              >
                <div className="truncate border-r border-gray-100 px-1.5 py-1.5">{row.name}</div>
                <div className="truncate border-r border-gray-100 px-1.5 py-1.5">{row.hospital}</div>
                <div className="truncate border-r border-gray-100 px-1.5 py-1.5">{row.ward}</div>
                <div className="truncate px-1.5 py-1.5 tabular-nums">{row.amount}</div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={520} className="relative ml-auto mt-2 flex w-fit items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 shadow-sm">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500">
              <FileSpreadsheet size={12} className="text-white" strokeWidth={2} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[9px] font-semibold text-gray-900">Ward_Rounds_June.xlsx</span>
              <span className="block text-[8px] text-emerald-600">Exported</span>
            </span>
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
              <Check size={9} className="text-white" strokeWidth={3} />
            </span>
          </Reveal>
        </div>
      </div>
    </MacBookFrame>
  )
}

function AnalyticsMocks() {
  return (
    <div className="space-y-4">
      <Reveal className="rounded-2xl border border-white/10 bg-slate-900 p-5">
        <p className="text-sm font-semibold text-white">Patients by Hospital</p>
        <div className="mt-2 flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="h-2 w-2 rounded-full bg-[#007AFF]" />
            Inpatient
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <span className="h-2 w-2 rounded-full bg-[#8B5CF6]" />
            Outpatient
          </span>
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          {PATIENTS_DATA.map((h, i) => (
            <div key={h.name} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-24 w-full items-end justify-center gap-1">
                <div
                  className="wr-bar w-full rounded-t-sm bg-[#007AFF]"
                  style={{ height: `${(h.inpatient / PATIENTS_MAX) * 100}%`, animationDelay: `${i * 100}ms` }}
                />
                <div
                  className="wr-bar w-full rounded-t-sm bg-[#8B5CF6]"
                  style={{ height: `${(h.outpatient / PATIENTS_MAX) * 100}%`, animationDelay: `${i * 100 + 60}ms` }}
                />
              </div>
              <p className="truncate text-[9px] text-slate-500">{h.name}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal className="rounded-2xl border border-white/10 bg-slate-900 p-5">
        <p className="text-sm font-semibold text-white">Revenue by Hospital</p>
        <div className="mt-4 flex items-end justify-between gap-3">
          {REVENUE_DATA.map((h, i) => (
            <div key={h.name} className="flex flex-1 flex-col items-center gap-1.5">
              <p className="text-[9px] font-semibold tabular-nums text-slate-300">{h.label}</p>
              <div className="flex h-24 w-full items-end">
                <div
                  className="wr-bar w-full rounded-t-sm"
                  style={{ height: `${h.pct}%`, backgroundColor: h.color, animationDelay: `${i * 100}ms` }}
                />
              </div>
              <p className="truncate text-[9px] text-slate-500">{h.name}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  )
}

/* ── Feature block wrapper (eyebrow + title + body + graphic) ──────────────── */

function MobileFeature({ eyebrow, title, body, children }) {
  return (
    <section className="px-5 py-14">
      <Reveal>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 className="mx-auto mt-3 max-w-sm text-center text-2xl font-bold tracking-tight">{title}</h3>
        <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed text-slate-400">{body}</p>
      </Reveal>
      <div className="mt-8">{children}</div>
    </section>
  )
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function MobileLanding() {
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('signin')

  function openAuth(mode) {
    setAuthMode(mode)
    setAuthOpen(true)
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-slate-950 text-white">
      {/* Floating glass header. Sits below the install bar when it's showing. */}
      <header
        className="fixed inset-x-0 z-50 px-4"
        style={{ top: 'calc(0.75rem + var(--install-banner-h, 0px))' }}
      >
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

      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden px-5 pb-16 text-center"
        style={{ paddingTop: 'calc(7rem + var(--install-banner-h, 0px))' }}
      >
        <Glow className="-left-32 -top-24 h-96 w-96" />
        <Glow className="-right-32 top-40 h-96 w-96" color="rgba(139,92,246,0.10)" />

        <Reveal className="relative">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Never lose another <GradientText>ward round</GradientText>.
          </h1>
          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-slate-400">
            The financial operating system for modern medical practice. Track every patient, visit,
            procedure and payment across every hospital you work in.
          </p>
        </Reveal>

        <Reveal delay={120} className="relative mt-8 flex flex-col gap-3">
          <button
            onClick={() => openAuth('signup')}
            className="rounded-full bg-[#007AFF] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 active:bg-[#0066DD]"
          >
            Start Free
          </button>
          <button
            onClick={() => openAuth('signin')}
            className="rounded-full border border-slate-700 px-6 py-3.5 text-sm font-semibold text-slate-200 active:bg-slate-800"
          >
            Sign In
          </button>
        </Reveal>

        <Reveal delay={220} className="relative mt-12">
          <HeroDashboardMock />
        </Reveal>
      </section>

      {/* ── About ── */}
      <section id="about" className="border-t border-slate-800 bg-slate-900/50 px-5 py-14">
        <Reveal>
          <Eyebrow>About WardRounds</Eyebrow>
          <h2 className="mx-auto mt-3 max-w-sm text-center text-2xl font-bold tracking-tight">
            You do the rounds. <GradientText>WardRounds does the math.</GradientText>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-center text-sm leading-relaxed text-slate-400">
            WardRounds is your personal billing record — independent of any hospital's system.
            Every patient you see, every procedure you perform, every shilling you're owed is
            captured at the bedside the moment it happens. At month-end, you reconcile against the
            hospital's statement in minutes, not evenings — and nothing you did goes unpaid.
          </p>
        </Reveal>

        <Reveal delay={120} className="mt-8">
          <MiniDashboardMock />
        </Reveal>

        <div className="mt-8">
          <Reveal className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-base font-semibold text-white">
              Built for doctors. <span className="text-[#8B5CF6]">Not for hospitals.</span>
            </p>
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="mt-5 flex items-start gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#007AFF]/15">
                  <Icon size={18} className="text-[#007AFF]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{body}</p>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── Comparison (drifting numbers backdrop, mirrors desktop) ── */}
      <section className="px-5 py-14">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 px-4 py-12">
          <NumbersBackdrop />
          <div className="pointer-events-none absolute inset-0 bg-slate-950/70" aria-hidden="true" />

          <div className="relative">
            <Reveal>
              <h3 className="text-center text-2xl font-bold tracking-tight">
                Why you should keep <GradientText>your own record</GradientText>
              </h3>
              <p className="mx-auto mt-3 max-w-sm text-center text-sm text-slate-400">
                The hospital's system tracks the hospital's money. Yours should track yours.
              </p>
            </Reveal>

            <div className="mt-8 space-y-4">
              {COMPARISON.map((row, i) => (
                <Reveal key={row.label} delay={Math.min(i * 60, 180)} className="overflow-hidden rounded-2xl border border-white/15 bg-slate-900/95">
                  <p className="border-b border-white/10 px-4 py-3 text-sm font-bold text-white">{row.label}</p>
                  <div className="flex items-start gap-2.5 bg-[#007AFF]/10 px-4 py-3.5">
                    <Check size={15} className="mt-0.5 flex-shrink-0 text-[#4DA3FF]" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#4DA3FF]">Your WardRounds record</p>
                      <p className="mt-0.5 text-sm font-medium text-white">{row.yours}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 border-t border-white/10 px-4 py-3.5">
                    <X size={15} className="mt-0.5 flex-shrink-0 text-slate-600" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">The hospital's system</p>
                      <p className="mt-0.5 text-sm text-slate-500">{row.theirs}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="border-t border-slate-800 bg-slate-900/50 px-5 py-14">
        <Reveal>
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mx-auto mt-3 max-w-sm text-center text-2xl font-bold tracking-tight">
            From bedside to settled, in four steps.
          </h2>
        </Reveal>
        <div className="mt-8 grid grid-cols-2 gap-3">
          {STEPS.map((step, i) => (
            <Reveal key={step.number} delay={i * 100} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#007AFF] to-[#0051D5] text-base font-bold text-white shadow-lg shadow-[#007AFF]/30">
                {step.number}
              </div>
              <h4 className="mt-3 text-sm font-semibold text-white">{step.title}</h4>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{step.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Feature blocks ── */}
      <div id="features">
        <MobileFeature
          eyebrow="Stay timeline"
          title="Every ward, every transfer, captured."
          body="ICU to HDU to General Ward — the timeline builds itself as your patient moves."
        >
          <TimelineMock />
        </MobileFeature>

        <MobileFeature
          eyebrow="Issue & get paid"
          title="Your record, ready to invoice."
          body="One tap turns your ward record into a clean, printable invoice — issued by your practice, through the hospital, with your name on it. Your fee, your paperwork, no chasing."
        >
          <InvoiceMock />
        </MobileFeature>

        <MobileFeature
          eyebrow="Your practice, your rules"
          title="Set your rates. Build your team."
          body="Per-hospital rates for every ward level. Invite your team with role-based access."
        >
          <SettingsMock />
        </MobileFeature>

        <MobileFeature
          eyebrow="Export · Reconcile"
          title="Your ledger, in Excel."
          body="One click exports every patient, every charge — ready to reconcile against the hospital statement."
        >
          <ExportMock />
        </MobileFeature>
      </div>

      {/* ── Analytics ── */}
      <section className="border-t border-slate-800 bg-slate-900/50 px-5 py-14">
        <Reveal>
          <Eyebrow>Analytics</Eyebrow>
          <h2 className="mx-auto mt-3 max-w-sm text-center text-2xl font-bold tracking-tight">
            See your practice clearly.
          </h2>
          <p className="mt-3 text-center text-sm text-slate-400">Patients and revenue, per hospital, at a glance.</p>
        </Reveal>
        <div className="mt-8">
          <AnalyticsMocks />
        </div>
      </section>

      {/* ── Testimonials (native scroll-snap carousel, zero JS) ── */}
      <section className="px-5 py-14">
        <Reveal>
          <Eyebrow>Doctors</Eyebrow>
          <h2 className="mt-3 text-center text-2xl font-bold tracking-tight">Trusted at the bedside.</h2>
        </Reveal>
        <div className="-mx-5 mt-8 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TESTIMONIALS.map(t => (
            <div key={t.name} className="w-[80%] flex-shrink-0 snap-center rounded-2xl border border-slate-800 bg-slate-900 p-5">
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
        <p className="mt-3 text-center text-[10px] uppercase tracking-widest text-slate-600">Swipe →</p>
      </section>

      {/* ── FAQ — native <details>, zero JS ── */}
      <section id="faq" className="border-t border-slate-800 bg-slate-900/50 px-5 py-14">
        <Reveal>
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-3 text-center text-2xl font-bold tracking-tight">
            Questions, <GradientText>answered.</GradientText>
          </h2>
        </Reveal>
        <div className="mt-8 space-y-3">
          {FAQS.map(({ q, a }, i) => (
            <Reveal
              as="details"
              key={q}
              delay={Math.min(i * 50, 150)}
              className="group rounded-2xl border border-slate-800 bg-slate-900 px-5 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-semibold text-white">
                {q}
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-slate-700 text-[#007AFF] transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-slate-400">{a}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section id="doctors" className="relative overflow-hidden px-5 py-16 text-center">
        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{ background: 'linear-gradient(135deg, rgba(0,122,255,0.22) 0%, rgba(10,25,64,0.30) 45%, rgba(139,92,246,0.16) 100%)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-transparent to-slate-950" aria-hidden="true" />

        <div className="relative">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#007AFF]/30 bg-[#007AFF]/10 px-3.5 py-1.5 text-xs font-medium tracking-wide text-[#4DA3FF]">
              <Stethoscope size={14} />
              Built for everyone on the ward
            </span>
            <h2 className="mt-6 text-2xl font-bold tracking-tight">
              Take control of your practice.
              <br />
              <GradientText>Take control of your income.</GradientText>
            </h2>
          </Reveal>

          <div className="mt-10 flex items-end justify-center gap-3">
            {PERSONAS.map((p, i) => (
              <Reveal key={p.label} delay={i * 120} className={`relative ${p.lg ? 'z-10 w-[36%]' : 'w-[29%]'}`}>
                <div className="rounded-[18px] border border-white/15 bg-white/5 p-1.5 shadow-2xl shadow-black/50">
                  <img
                    src={p.img}
                    alt={p.label}
                    loading="lazy"
                    className={`aspect-[884/1250] w-full rounded-xl object-cover ${p.flip ? '-scale-x-100' : ''}`}
                  />
                </div>
                <span className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-slate-950/70 px-2.5 py-0.5 text-[10px] font-medium text-white">
                  {p.label}
                </span>
              </Reveal>
            ))}
          </div>

          <Reveal delay={200}>
            <p className="mx-auto mt-10 max-w-sm text-sm leading-relaxed text-slate-300">
              One authoritative billing record that matches the hospital's — so nothing you earn on
              the ward slips through.
            </p>
            <div className="mt-7 flex flex-col gap-3">
              <button
                onClick={() => openAuth('signup')}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#007AFF] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 active:bg-[#0066DD]"
              >
                Give WardRounds a try
                <ArrowRight size={16} />
              </button>
              <button
                onClick={() => openAuth('signin')}
                className="rounded-full border border-slate-700 px-6 py-3.5 text-sm font-semibold text-slate-200 active:bg-slate-800"
              >
                Sign In
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-800 px-5 pb-8 pt-10">
        <div className="flex items-center gap-2">
          <img src="/wardrounds-icon.png" className="h-8 w-8 object-contain" alt="WardRounds" />
          <span className="text-lg font-bold tracking-tight text-white">WardRounds</span>
        </div>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-400">
          Your personal billing record, at the bedside. Every patient, every procedure, every
          shilling — across every hospital you work in.
        </p>
        <p className="mt-3 text-xs text-slate-500">Built in Nairobi, Kenya 🇰🇪</p>

        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">The fine print</p>
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-slate-500">
            WardRounds is a personal billing and practice-management record. It is not an EMR and
            stores no medical records — your patients' clinical data stays where it belongs.
          </p>
          <Link to="/privacy" className="mt-4 block text-xs font-medium text-slate-400 active:text-white">
            Privacy Policy
          </Link>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-slate-800 pt-5">
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} WardRounds. All rights reserved.</p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-400 active:text-white"
          >
            Back to top <ArrowUp size={13} />
          </button>
        </div>
      </footer>

      <AuthModal open={authOpen} mode={authMode} onModeChange={setAuthMode} onClose={() => setAuthOpen(false)} />
    </div>
  )
}
