import { useRef } from 'react'
import { motion, animate, useMotionValue, useInView, useReducedMotion } from 'framer-motion'
import { Check, Download, FileSpreadsheet, BedDouble, LayoutDashboard, UserPlus, Stethoscope, Users, ChevronDown } from 'lucide-react'
import { FeatureBlock } from './FeatureBlocks'
import MacBookFrame from './mock/MacBookFrame'
import { useLoopedSequence, wait } from './useLoopedSequence'

const EXPORT_ACCENT = '#007AFF'

const NAV_ITEMS = [
  { label: 'Inpatient', icon: BedDouble },
  { label: 'Inpatient Dashboard', icon: LayoutDashboard },
  { label: 'Admit Patient', icon: UserPlus },
  { label: 'Outpatient', icon: Stethoscope },
  { label: 'Patients', icon: Users, active: true },
]

// Sorted by last-name initial, mirroring Patients.jsx's grouping (letter = last_name[0]).
const EXPORT_ROWS = [
  { initials: 'FH', name: 'Fatuma Hassan', letter: 'H', age: 34, dob: '12 Mar 1991', hospital: 'Aga Khan', ward: 'General Ward', days: 4, amount: 'KES 32,000' },
  { initials: 'DK', name: 'David Kimani', letter: 'K', age: 58, dob: '2 Nov 1967', hospital: '3rd Park', ward: 'HDU', days: 2, amount: 'KES 30,000' },
  { initials: 'MN', name: 'Mary Njeri', letter: 'N', age: 29, dob: '19 Jul 1996', hospital: 'M.P. Shah', ward: 'General Ward', days: 5, amount: 'KES 40,000' },
  { initials: 'PO', name: 'Peter Otieno', letter: 'O', age: 45, dob: '8 Jan 1980', hospital: '3rd Park', ward: 'HDU', days: 2, amount: 'KES 30,000' },
  { initials: 'GW', name: 'Grace Wanjiru', letter: 'W', age: 41, dob: '6 Jun 1985', hospital: 'M.P. Shah', ward: 'ICU', days: 3, amount: 'KES 60,000' },
]

const GRID_HEADERS = ['Patient', 'Hospital', 'Ward', 'Days', 'Amount']

function useFlyRow(reduceMotion) {
  const opacity = useMotionValue(reduceMotion ? 0 : 1)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(reduceMotion ? 0.5 : 1)
  return { opacity, x, y, scale }
}

function useGridRow(reduceMotion) {
  const opacity = useMotionValue(reduceMotion ? 1 : 0)
  const y = useMotionValue(reduceMotion ? 0 : 8)
  return { opacity, y }
}

function Sidebar() {
  return (
    <div className="w-28 flex-shrink-0 flex flex-col rounded-2xl border border-white/30 bg-white/70 backdrop-blur-xl shadow-glass">
      <div className="flex items-center gap-1.5 p-2 border-b border-gray-100">
        <div className="w-4 h-4 rounded-md flex-shrink-0" style={{ backgroundColor: EXPORT_ACCENT }} />
        <p className="text-[9px] font-bold text-gray-900 leading-tight truncate">WardRounds</p>
      </div>

      <div className="flex-1 p-1.5 space-y-0.5">
        {NAV_ITEMS.map(item => (
          <div
            key={item.label}
            className={`flex items-center gap-1.5 px-1.5 py-1.5 rounded-lg text-[8px] font-medium ${item.active ? 'text-white shadow-ios-card' : 'text-gray-600'}`}
            style={item.active ? { backgroundColor: EXPORT_ACCENT } : undefined}
          >
            <item.icon size={10} className="flex-shrink-0" />
            <span className="truncate">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="p-1.5 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0"
            style={{ backgroundColor: EXPORT_ACCENT + '20', color: EXPORT_ACCENT }}
          >
            AM
          </div>
          <div className="min-w-0">
            <p className="text-[8px] font-semibold text-gray-900 truncate">Dr. A. Mwangi</p>
            <p className="text-[7px] text-gray-500 truncate">Admin</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function PatientRow({ row, mv }) {
  return (
    <motion.div
      style={{ opacity: mv.opacity, x: mv.x, y: mv.y, scale: mv.scale }}
      className="rounded-2xl overflow-hidden ring-1 ring-gray-200"
    >
      <div
        className="px-2 py-1.5"
        style={{ background: 'linear-gradient(135deg, #F2F2F7 0%, #E5E5EA 100%)' }}
      >
        <div className="flex items-start gap-1.5">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-600 font-semibold text-[8px]">{row.initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-gray-900 leading-tight uppercase truncate">{row.name}</p>
            <div className="mt-0.5 flex items-center gap-1 text-[8px] text-gray-500">
              <span>{row.age} yrs</span>
              <span className="text-gray-300">·</span>
              <span>{row.dob}</span>
            </div>
            <p className="mt-0.5 text-[8px] text-gray-400 italic">No mobile</p>
          </div>
          <div className="flex-shrink-0 self-center">
            <ChevronDown size={11} className="text-gray-400" />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function GridRow({ row, mv, tint }) {
  return (
    <motion.div
      style={{ opacity: mv.opacity, y: mv.y }}
      className={`grid grid-cols-5 text-[8px] text-gray-700 ${tint ? 'bg-gray-50' : 'bg-white'}`}
    >
      <div className="truncate border-r border-gray-100 px-1.5 py-1">{row.name}</div>
      <div className="truncate border-r border-gray-100 px-1.5 py-1">{row.hospital}</div>
      <div className="truncate border-r border-gray-100 px-1.5 py-1">{row.ward}</div>
      <div className="truncate border-r border-gray-100 px-1.5 py-1 tabular-nums">{row.days}</div>
      <div className="truncate px-1.5 py-1 tabular-nums">{row.amount}</div>
    </motion.div>
  )
}

function ExportVisual() {
  const ref = useRef(null)
  const reduceMotion = useReducedMotion()
  const inView = useInView(ref, { amount: 0.4, once: true })

  const listOpacity = useMotionValue(reduceMotion ? 0 : 1)
  const listRows = EXPORT_ROWS.map(() => useFlyRow(reduceMotion))

  const gridOpacity = useMotionValue(reduceMotion ? 1 : 0)
  const gridScale = useMotionValue(reduceMotion ? 1 : 0.9)
  const gridRows = EXPORT_ROWS.map(() => useGridRow(reduceMotion))

  const chipOpacity = useMotionValue(reduceMotion ? 1 : 0)
  const chipScale = useMotionValue(reduceMotion ? 1 : 0.8)
  const checkScale = useMotionValue(reduceMotion ? 1 : 0)

  async function playSequence(isCancelled) {
    await wait(400)
    if (isCancelled()) return

    await Promise.all([animate(gridOpacity, 1, { duration: 0.45, ease: 'easeOut' }), animate(gridScale, 1, { duration: 0.45, ease: 'easeOut' })])
    if (isCancelled()) return
    await wait(200)

    for (let i = 0; i < EXPORT_ROWS.length; i++) {
      if (isCancelled()) return
      await Promise.all([
        animate(listRows[i].opacity, 0, { duration: 0.55, ease: 'easeIn' }),
        animate(listRows[i].x, [0, 30, 70], { duration: 0.55, ease: 'easeIn' }),
        animate(listRows[i].y, [0, -30, -20], { duration: 0.55, ease: 'easeIn' }),
        animate(listRows[i].scale, 0.5, { duration: 0.55, ease: 'easeIn' }),
        animate(gridRows[i].opacity, 1, { duration: 0.5, ease: 'easeOut' }),
        animate(gridRows[i].y, 0, { duration: 0.5, ease: 'easeOut' }),
      ])
      if (isCancelled()) return
      await wait(175)
    }

    if (isCancelled()) return
    await Promise.all([
      animate(gridOpacity, 0, { duration: 0.5 }),
      animate(gridScale, 0.3, { duration: 0.5 }),
      animate(listOpacity, 0, { duration: 0.5 }),
    ])
    if (isCancelled()) return
    await Promise.all([animate(chipOpacity, 1, { duration: 0.4 }), animate(chipScale, 1, { type: 'spring', stiffness: 260, damping: 16 })])
    if (isCancelled()) return
    await animate(checkScale, 1, { type: 'spring', stiffness: 280, damping: 15 })
  }

  function reset() {
    listOpacity.set(1)
    listRows.forEach(row => {
      row.opacity.set(1)
      row.x.set(0)
      row.y.set(0)
      row.scale.set(1)
    })
    gridOpacity.set(0)
    gridScale.set(0.9)
    gridRows.forEach(row => {
      row.opacity.set(0)
      row.y.set(8)
    })
    chipOpacity.set(0)
    chipScale.set(0.8)
    checkScale.set(0)
  }

  async function fadeOut() {
    // Dissolve only the export layers (list, grid, chip); the app chrome — sidebar,
    // header, Export button — stays solid so the loop never shows a dark empty screen.
    await Promise.all([
      animate(listOpacity, 0, { duration: 0.4, ease: 'easeIn' }),
      animate(gridOpacity, 0, { duration: 0.4, ease: 'easeIn' }),
      animate(chipOpacity, 0, { duration: 0.4, ease: 'easeIn' }),
    ])
  }

  useLoopedSequence({ active: inView, reduceMotion, playSequence, reset, fadeOut })

  return (
    <div ref={ref}>
      <MacBookFrame>
        <div className="h-full overflow-hidden bg-ios-gray-6 p-3 flex gap-3">
          <Sidebar />

          <div className="flex-1 min-w-0 flex flex-col">
            <div className="mb-2">
              <p className="text-xs font-bold text-gray-900 leading-tight">Patients</p>
              <p className="text-[9px] text-gray-500 leading-tight">Dr. A. Mwangi</p>
            </div>

            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] text-gray-500">{EXPORT_ROWS.length} patients</p>
              <div
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-semibold text-white flex-shrink-0"
                style={{ backgroundColor: EXPORT_ACCENT }}
              >
                <Download size={9} />
                Export
              </div>
            </div>

            <div className="relative flex-1">
              <motion.div style={{ opacity: listOpacity }} className="space-y-1.5">
                {EXPORT_ROWS.map((row, i) => (
                  <div key={row.name}>
                    {(i === 0 || row.letter !== EXPORT_ROWS[i - 1].letter) && (
                      <p className="px-1 pb-1 text-[8px] font-bold text-gray-400 uppercase tracking-widest">{row.letter}</p>
                    )}
                    <PatientRow row={row} mv={listRows[i]} />
                  </div>
                ))}
              </motion.div>

              <motion.div
                style={{ opacity: gridOpacity, scale: gridScale }}
                className="absolute inset-x-0 top-0 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
              >
                <div
                  className="grid grid-cols-5 text-[7px] font-semibold uppercase tracking-wide text-white"
                  style={{ backgroundColor: EXPORT_ACCENT }}
                >
                  {GRID_HEADERS.map(h => (
                    <div key={h} className="truncate border-r border-white/20 px-1.5 py-1 last:border-r-0">
                      {h}
                    </div>
                  ))}
                </div>
                {EXPORT_ROWS.map((row, i) => (
                  <GridRow key={row.name} row={row} mv={gridRows[i]} tint={i % 2 === 0} />
                ))}
              </motion.div>

              <motion.div
                style={{ opacity: chipOpacity, scale: chipScale }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="relative flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500">
                    <FileSpreadsheet className="h-5 w-5 text-white" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-gray-900">Ward_Rounds_June.xlsx</p>
                    <p className="text-[10px] text-emerald-600">Exported</p>
                  </div>
                  <motion.div
                    style={{ scale: checkScale }}
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 shadow-lg"
                  >
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </MacBookFrame>
    </div>
  )
}

export default function ExportShowcase() {
  return (
    <FeatureBlock
      eyebrow="EXPORT · RECONCILE"
      title="Your ledger, in Excel."
      body="One click exports every patient, every charge — ready to reconcile against the hospital statement."
      reverse={false}
    >
      <ExportVisual />
    </FeatureBlock>
  )
}
