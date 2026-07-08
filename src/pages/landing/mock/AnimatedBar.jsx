import { motion } from 'framer-motion'

export default function Bar({ heightPct, color, label }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      <motion.p className="text-[9px] font-semibold tabular-nums text-slate-300">{label}</motion.p>
      <div className="flex h-28 w-full items-end">
        <motion.div style={{ height: heightPct, backgroundColor: color }} className="w-full rounded-t-md" />
      </div>
    </div>
  )
}
