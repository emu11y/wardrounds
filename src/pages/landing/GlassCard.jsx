import { forwardRef } from 'react'

const GlassCard = forwardRef(function GlassCard({ className = '', children, ...rest }, ref) {
  return (
    <div ref={ref} className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl ${className}`} {...rest}>
      {children}
    </div>
  )
})

export default GlassCard
