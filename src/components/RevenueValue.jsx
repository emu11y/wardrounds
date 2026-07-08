import { Lock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// Single shared gate for ALL revenue amounts in the app. Fail-closed:
// renders children only when the resolved permission is explicitly true.
export default function RevenueValue({ children, variant = 'inline', tone = 'default', className = '' }) {
  const { permissions } = useAuth()
  if (permissions?.can_view_revenue === true) return children
  const toneCls = tone === 'light' ? 'text-white/70' : 'text-gray-400'
  if (variant === 'block') {
    return (
      <span className={`inline-flex items-center gap-1 text-xs italic ${toneCls} ${className}`}>
        <Lock size={11} className="flex-shrink-0" />
        Revenue details restricted
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${toneCls} ${className}`}>
      <Lock size={11} className="flex-shrink-0" />
      KES ••••
    </span>
  )
}
