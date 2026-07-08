import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react'

// Shared glassmorphic toast — reused anywhere a page needs a transient
// success/error/info prompt. Sits at top-20/z-[100] so it always clears the
// sticky TopHeader (z-[61]) instead of being hidden behind it.
const ICONS = {
  success: { Icon: CheckCircle, className: 'text-green-500' },
  error: { Icon: XCircle, className: 'text-red-500' },
  info: { Icon: AlertTriangle, className: 'text-ios-orange' },
}

export default function Toast({ toast, onDismiss }) {
  if (!toast) return null
  const { Icon, className } = ICONS[toast.type] || ICONS.success

  return (
    <div className="fixed top-20 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[100] flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-white/90 backdrop-blur-xl border border-white/60 shadow-2xl text-sm font-medium text-gray-800 sm:max-w-md">
      <Icon size={18} className={`flex-shrink-0 ${className}`} />
      <span className="flex-1">{toast.message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
          <X size={14} />
        </button>
      )}
    </div>
  )
}
