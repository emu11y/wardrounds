import ModalShell from './ModalShell'

// Shared glass confirm dialog (never window.confirm). tone: 'blue' | 'red' | 'green' | 'amber'.
// New code uses this; the older inline copies in PatientCard / Patients / Settings are
// candidates to migrate onto it (see MASTER_HANDOFF §9 tech debt).
const TONE = {
  blue:  'bg-ios-blue hover:opacity-90',
  red:   'bg-red-500 hover:bg-red-600',
  green: 'bg-green-500 hover:bg-green-600',
  amber: 'bg-amber-500 hover:bg-amber-600',
}

export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', tone = 'blue', busy = false, onConfirm, onCancel }) {
  return (
    <ModalShell onClose={onCancel} maxWidth="max-w-sm">
      <div className="glass-rim rounded-3xl p-2.5">
        <div className="surface-shell p-6">
          <h3 className="text-base font-bold text-gray-900 mb-2">{title}</h3>
          {message && <p className="text-sm text-gray-600 mb-6 leading-relaxed">{message}</p>}
          <div className="flex gap-3">
            <button onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-full text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">
              Cancel
            </button>
            <button onClick={onConfirm} disabled={busy}
              className={`flex-1 px-4 py-2.5 rounded-full text-sm font-semibold text-white transition disabled:opacity-60 ${TONE[tone] || TONE.blue}`}>
              {busy ? 'Working…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}
