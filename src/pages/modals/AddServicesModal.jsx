import { useState, useEffect } from 'react'
import { X, Stethoscope, Plus, ChevronDown } from 'lucide-react'
import { fetchHospitalServices, addServiceRendered, fetchServicesRendered } from '../../lib/api'
import { formatKES } from '../../lib/utils'

export default function AddServicesModal({ admission, onClose, onSaved }) {
  const [services, setServices] = useState([])
  const [rendered, setRendered] = useState([])
  const [form, setForm] = useState({ service_id: '', quantity: 1, rendered_date: new Date().toISOString().slice(0, 10) })
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  const patient = admission?.patients
  const hospitalId = admission?.hospital_id

  useEffect(() => {
    if (!hospitalId) { setFetching(false); return }
    Promise.all([
      fetchHospitalServices(hospitalId),
      fetchServicesRendered(admission.id),
    ]).then(([svc, rnd]) => {
      setServices(svc || [])
      setRendered(rnd || [])
      if (svc?.length) setForm(f => ({ ...f, service_id: svc[0].id }))
    }).catch(console.error).finally(() => setFetching(false))
  }, [hospitalId, admission.id])

  const selectedService = services.find(s => s.id === form.service_id)
  const total = selectedService ? Number(selectedService.price_per_day) * form.quantity : 0

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.service_id) return
    setLoading(true)
    try {
      await addServiceRendered({
        admission_id: admission.id,
        service_id: form.service_id,
        rendered_date: form.rendered_date,
        quantity: form.quantity,
        price_applied: Number(selectedService.price_per_day),
      })
      const updated = await fetchServicesRendered(admission.id)
      setRendered(updated)
      setForm(f => ({ ...f, quantity: 1, rendered_date: new Date().toISOString().slice(0, 10) }))
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
      <div className="relative z-10 w-full max-w-lg glass-card max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Stethoscope size={18} className="text-ios-blue" />
            <h2 className="font-semibold">Add Services</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-black/5 transition-colors">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-ios-gray-1 -mt-2 mb-3">
          {patient?.first_name} {patient?.last_name}
        </p>

        {/* Rendered list */}
        <div className="flex-1 overflow-y-auto scrollbar-none space-y-2 mb-4">
          {fetching ? (
            <div className="h-20 bg-ios-gray-5 rounded-2xl animate-pulse" />
          ) : rendered.length === 0 ? (
            <div className="text-center py-4 text-ios-gray-1 text-sm">No services recorded yet</div>
          ) : rendered.map(r => (
            <div key={r.id} className="bg-white/40 dark:bg-white/5 rounded-2xl p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{r.hospital_services?.service_name}</p>
                <p className="text-xs text-ios-gray-1">
                  {r.quantity} × {formatKES(r.price_applied)} · {new Date(r.rendered_date).toLocaleDateString('en-GB')}
                </p>
              </div>
              <span className="font-semibold text-sm">{formatKES(r.quantity * r.price_applied)}</span>
            </div>
          ))}
        </div>

        {/* Add form */}
        {!hospitalId ? (
          <p className="text-sm text-ios-gray-1 text-center py-4 border-t border-white/20">
            No hospital assigned — set one to add services
          </p>
        ) : services.length === 0 ? (
          <p className="text-sm text-ios-gray-1 text-center py-4 border-t border-white/20">
            No services configured for this hospital. Add them in Settings.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 border-t border-white/20 pt-3">
            <div className="relative">
              <select value={form.service_id} onChange={e => setForm(f => ({ ...f, service_id: e.target.value }))}
                className="ios-input appearance-none pr-9">
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.service_name} — {formatKES(s.price_per_day)}/day
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ios-gray-1 pointer-events-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-ios-gray-1">Days / Qty</label>
                <input type="number" min="1" value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                  className="ios-input" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-ios-gray-1">Date</label>
                <input type="date" value={form.rendered_date}
                  onChange={e => setForm(f => ({ ...f, rendered_date: e.target.value }))}
                  className="ios-input" />
              </div>
            </div>

            {selectedService && (
              <div className="flex items-center justify-between px-3 py-2 bg-ios-blue/5 rounded-2xl">
                <span className="text-sm text-ios-gray-1">Total</span>
                <span className="font-bold text-ios-blue">{formatKES(total)}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-2xl border border-ios-gray-4 text-sm font-medium">
                Close
              </button>
              <button type="submit" disabled={loading} className="flex-1 ios-blue-btn py-2.5 text-sm">
                {loading ? 'Saving…' : <span className="flex items-center justify-center gap-1.5"><Plus size={14} />Add</span>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
