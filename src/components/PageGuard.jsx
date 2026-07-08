import { Lock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { GLASS_CARD } from '../lib/theme'

// Route-level page gate. Fail-closed: renders the page only when the resolved
// page key is explicitly true. While permissions load, shows a quiet skeleton
// (never a flash of protected content).
export default function PageGuard({ permKey, children }) {
  const { permissions } = useAuth()
  if (!permissions) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 rounded-2xl bg-black/5 animate-pulse" />
      </div>
    )
  }
  if (permissions[permKey] === true) return children
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="glass-rim rounded-3xl p-2.5">
        <div className={`${GLASS_CARD} px-8 py-10 max-w-sm text-center`}>
          <div className="mx-auto w-12 h-12 rounded-full bg-ios-blue/10 flex items-center justify-center mb-4">
            <Lock size={20} className="text-ios-blue" />
          </div>
          <p className="text-sm font-semibold text-gray-900">You don't have access to this page</p>
          <p className="text-xs text-gray-500 mt-1.5">Contact your team admin if you think this is a mistake.</p>
        </div>
      </div>
    </div>
  )
}
