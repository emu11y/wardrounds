export default function BarChart({ bars, className = '' }) {
  return (
    <div className={`flex h-28 items-end gap-2 rounded-xl border border-white/10 bg-white/5 p-4 ${className}`}>
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-md bg-gradient-to-t from-[#007AFF] to-[#8B5CF6]"
          style={{ height: `${h}%`, opacity: 0.5 + h / 200 }}
        />
      ))}
    </div>
  )
}
