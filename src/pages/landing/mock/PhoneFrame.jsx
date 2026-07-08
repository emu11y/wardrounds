export default function PhoneFrame({ children }) {
  return (
    <div className="relative mx-auto w-full max-w-[350px]">
      <div className="pointer-events-none absolute -inset-8 rounded-[4rem] bg-gradient-to-br from-[#007AFF]/20 to-[#8B5CF6]/10 blur-3xl" />
      <div className="relative rounded-[3rem] border border-white/10 bg-slate-900 p-2.5 shadow-2xl shadow-black/60">
        <div className="relative min-h-[380px] overflow-hidden rounded-[2.4rem] border border-white/10 bg-slate-950">
          <div className="absolute left-1/2 top-2.5 z-20 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />
          {children}
        </div>
      </div>
    </div>
  )
}
