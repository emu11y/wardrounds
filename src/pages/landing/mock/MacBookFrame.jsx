export default function MacBookFrame({ children }) {
  return (
    <div className="relative mx-auto w-full max-w-[640px]">
      <div className="pointer-events-none absolute -inset-10 rounded-[3rem] bg-gradient-to-br from-[#007AFF]/20 to-[#8B5CF6]/10 blur-3xl" />

      {/* Screen + bezel */}
      <div className="relative rounded-t-2xl rounded-b-md border border-white/10 bg-slate-900 p-3 pt-4 shadow-2xl shadow-black/60">
        <div className="absolute left-1/2 top-2 z-20 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-slate-700" />
        <div className="relative min-h-[200px] overflow-hidden rounded-md border border-white/10 bg-slate-950">
          {children}
        </div>
      </div>

      {/* Base / hinge hint */}
      <div className="relative h-3 rounded-b-2xl bg-gradient-to-b from-slate-700 to-slate-900 shadow-lg shadow-black/40">
        <div className="absolute left-1/2 top-0 h-1.5 w-20 -translate-x-1/2 rounded-b-lg bg-slate-950/50" />
      </div>
    </div>
  )
}
