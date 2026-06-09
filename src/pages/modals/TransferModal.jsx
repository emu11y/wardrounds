import { useState, useEffect } from 'react'
import { X, ArrowRight, ChevronDown } from 'lucide-react'
import { transferAdmission, fetchHospitals, fetchHospitalServices } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { formatKES } from '../../lib/utils'

export default function TransferModal({ admission, onClose, onSaved }) {
  const { user } = useAuth()
  const [hospitals, setHospitals] = useState([])
  const [services, setServices] = useState([])
  const [ward, setWard] = useState(admission?.ward || '')
  const [hospitalId, setHospitalId] = useState(admission?.hospital_id || '')
  const [loading, setLoading] = useState(false)

  const patient = admission?.patients

  useEffect(() => {
    if (user?.team_id) {
      fetchHospitals(user.team_id).then(setHospitals).catch(console.error)
    }
  }, [user?.team_id])

  useEffect(() => {
    if (!hospitalId) { setServices([]); return }
    fetchHospitalServices(hospitalId).then(setServices).catch(console.error)
  }, [hospitalId])

  function handleHospitalChange(id) {
    setHospitalId(id)
    setWard('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await transferAdmission(admission.id, ward, hospitalId || null)
      onSaved?.()
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md glass-card">
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
          <div className="space-y-1.5">
            <label className="text-sm font-medium">New Hospital <span className="text-ios-gray-2 font-normal">(optional)</span></label>
            <div className="relative">
              <select
                value={hospitalId}
                onChange={e => handleHospitalChange(e.target.value)}
                className="ios-input appearance-none pr-9"
              >
                <option value="">Same hospital</option>
                {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ios-gray-1 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">New Ward</label>
            {services.length > 0 ? (
              <div className="relative">
                <select
                  value={ward}
                  onChange={e => setWard(e.target.value)}
                  className="ios-input appearance-none pr-9"
                  required
                >
                  <option value="">Select ward…</option>
                  {services.map(s => (
                    <option key={s.id} value={s.service_name}>
                      {s.service_name} — {formatKES(s.price_per_day)}/day
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ios-gray-1 pointer-events-none" />
              </div>
            ) : (
              <input
                value={ward}
                onChange={e => setWard(e.target.value)}
                placeholder="e.g. ICU, Ward 4, HDU"
                className="ios-input"
                required
              />
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-2xl border border-ios-gray-4 text-sm font-medium">
              Cancel
            </button>
            <button type="submit" disabled={loading || !ward}
              className="flex-1 py-3 rounded-2xl bg-ios-orange text-white font-semibold text-sm
                         shadow-ios-card hover:bg-orange-500 transition-all active:scale-95 disabled:opacity-50">
              {loading ? 'Transferring…' : 'Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
