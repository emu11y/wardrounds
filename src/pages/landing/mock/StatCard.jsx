export default function StatCard({ label, value, className = '' }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 p-4 text-left ${className}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  )
}
