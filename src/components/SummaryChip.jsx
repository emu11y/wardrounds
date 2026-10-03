import { GLASS_CARD } from '../lib/theme'

// Small glass stat tile used in page summary rows (Billing, Shifts, …).
// tone colours the label: gray | amber | blue | green
const TONE = { gray: 'text-gray-400', amber: 'text-amber-500', blue: 'text-blue-500', green: 'text-green-600' }

export default function SummaryChip({ label, value, tone = 'gray', small = false }) {
  return (
    <div className={`${GLASS_CARD} p-3`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${TONE[tone] || TONE.gray}`}>{label}</p>
      <p className={`${small ? 'text-lg' : 'text-xl'} font-bold text-gray-900 mt-0.5 tabular-nums`}>{value}</p>
    </div>
  )
}
