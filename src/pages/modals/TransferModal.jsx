import { useState, useEffect } from 'react'
import { X, ArrowRight, ChevronDown } from 'lucide-react'
import { transferPatient, fetchHospitalWards } from '../../lib/api'
import { formatKES } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'
import ModalShell from '../../components/ModalShell'
import { logActivity } from '../../lib/activityLog'

export default function TransferModal({ admission, onClose, onSaved }) {
  const { user } = useAuth()
  const [wards, setWards] = useState([])
  const [ward, setWard] = useState('')
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [wardsFetching, setWardsFetching] = useState(false)
  const [wardsError, setWardsError] = useState(false)

  const patient = admission?.patients
  const hospitalName = admission?.hospitals?.name

  function loadWards() {
    if (!admission?.hospital_id) return
    setWardsFetching(true)
    setWardsError(false)
    fetchHospitalWards(admission.hospital_id)
      .then(setWards)
      .catch(err => { console.error(err); setWardsError(true) })
      .finally(() => setWardsFetching(false))
  }

  useEffect(() => { loadWards() }, [admission?.hospital_id])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!ward) { setError('Please select a ward'); return }
    setLoading(true)
    setError(null)
    try {
      const fromWard = admission?.ward
      await transferPatient(admission.id, ward, transferDate)
      await logActivity({
        user, action: 'transfer', entityType: 'admission', entityId: admission.id,
        patientId: patient?.id, patientName: `${patient?.first_name} ${patient?.last_name}`,
        details: { from_ward: fromWard, to_ward: ward, transfer_date: transferDate },
      })
      onSaved?.()
    } catch (err) {
      console.error('Transfer error:', err)
      setError(err.message || 'Transfer failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-md">
      <div className="glass-rim rounded-3xl p-2.5">
        <div className="surface-shell p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ArrowRight size={18} className="text-ios-orange" />
            <h2 className="font-semibold">Transfer Patient</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-black/5 transition-colors">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-ios-gray-1 -mt-2 mb-4">
          {patient?.first_name} {patient?.last_name}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Hospital (locked — in-hospital transfers only) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Hospital</label>
            <div className="ios-input bg-gray-50 text-ios-gray-1">{hospitalName || '—'}</div>
          </div>

          {/* Current Ward (read-only) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Current Ward</label>
            <div className="ios-input bg-gray-50 text-ios-gray-1">{admission?.ward || '—'}</div>
          </div>

          {/* New Ward */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">New Ward</label>
            {wardsFetching ? (
              <div className="ios-input bg-gray-50 text-ios-gray-1">Loading wards…</div>
            ) : wardsError ? (
              <div className="ios-input bg-red-50 text-red-600 flex items-center justify-between">
                <span>Failed to load wards</span>
                <button type="button" onClick={loadWards} className="text-xs font-semibold underline flex-shrink-0 ml-2">
                  Retry
                </button>
              </div>
            ) : wards.length > 0 ? (
              <div className="relative">
                <select
                  value={ward}
                  onChange={e => setWard(e.target.value)}
                  className="ios-input appearance-none pr-9"
                  required
                >
                  <option value="">Select ward…</option>
                  {wards.map(s => (
                    <option key={s.id} value={s.service_name}>
                      {s.service_name} — {formatKES(s.price_per_day)}/day
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ios-gray-1 pointer-events-none" />
              </div>
            ) : (
              <div className="ios-input bg-gray-50 text-ios-gray-1">No wards configured for this hospital</div>
            )}
          </div>

          {/* Transfer Date */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Transfer Date</label>
            <input
              type="date"
              value={transferDate}
              onChange={e => setTransferDate(e.target.value)}
              className="ios-input"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-2xl border border-ios-gray-4 text-sm font-medium">
              Cancel
            </button>
            <button type="submit" disabled={loading || !ward}
              className="flex-1 py-3 rounded-2xl font-semibold text-white text-sm transition-all active:scale-95 disabled:opacity-50"
              style={{ background: 'var(--ios-blue, #007AFF)' }}>
              {loading ? 'Transferring…' : 'Transfer'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </ModalShell>
  )
}
