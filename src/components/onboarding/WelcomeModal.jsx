import { useNavigate } from 'react-router-dom'

const STEPS = [
  { id: 'practice', label: 'Fill in your practice details' },
  { id: 'hospital', label: 'Add your first hospital' },
  { id: 'ward',     label: 'Add a ward with daily rate' },
  { id: 'services', label: 'Add your clinical services' },
  { id: 'team',     label: 'Invite a team member' },
]

export default function WelcomeModal({ userName, onStart, onSkip }) {
  const navigate = useNavigate()

  function handleStart() {
    onStart()
    navigate('/settings')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
    >
      <div className="bg-white/90 backdrop-blur-2xl border border-white/60 rounded-3xl shadow-2xl w-full max-w-md p-8">

        {/* Header */}
        <div className="text-center mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg, #007AFF, #0055CC)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-7 h-7">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            Welcome{userName ? `, ${userName.split(' ')[0]}` : ''}! 🎉
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Let's set up WardRounds for your practice. It only takes a few minutes.
          </p>
        </div>

        {/* Step list */}
        <div className="space-y-3 mb-8">
          {/* Step 0 — already done */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-100">
            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3 h-3">
                <path d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <span className="text-sm font-medium text-green-800">Create your practice account</span>
          </div>

          {STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className="w-6 h-6 rounded-full border-2 border-gray-300 flex items-center justify-center flex-shrink-0">
                <span className="text-xs text-gray-400 font-semibold">{idx + 2}</span>
              </div>
              <span className="text-sm text-gray-700">{step.label}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <button
          onClick={handleStart}
          className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm transition-all duration-200 hover:opacity-90 active:scale-95 mb-3"
          style={{ background: 'linear-gradient(135deg, #007AFF, #0055CC)' }}
        >
          Start Setup →
        </button>
        <button
          onClick={onSkip}
          className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
