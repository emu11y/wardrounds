import { useState } from 'react'
import { PAYER_TYPES } from '../../lib/earnings'
import { modalFieldCls as fieldCls, labelCls } from '../billing/BillingDetailsEditor'

// Shared add/edit form for a payer — used inline in the Shift modal ("+ New payer")
// and in the Payers manager. Hospital payers pick from the team's hospitals (name is
// never duplicated); every other type needs a name.
export const EMPTY_PAYER = { payer_type: 'agency', hospital_id: '', name: '', phone: '', email: '', notes: '' }

export default function PayerForm({ initial = EMPTY_PAYER, hospitals = [], takenHospitalIds = [], saving = false, onSave, onCancel, submitLabel = 'Save payer' }) {
  const [form, setForm] = useState({ ...EMPTY_PAYER, ...initial })
  const set = patch => setForm(f => ({ ...f, ...patch }))
  const availableHospitals = hospitals.filter(h => !takenHospitalIds.includes(h.id) || h.id === initial.hospital_id)
  const valid = form.payer_type === 'hospital' ? !!form.hospital_id : form.name.trim().length > 0

  return (
    <div className="space-y-3">
      <label className="block">
        <span className={labelCls}>Who pays?</span>
        <select value={form.payer_type} onChange={e => set({ payer_type: e.target.value })} className={`${fieldCls} mt-1`}>
          {PAYER_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </label>

      {form.payer_type === 'hospital' ? (
        <label className="block">
          <span className={labelCls}>Hospital</span>
          <select value={form.hospital_id} onChange={e => set({ hospital_id: e.target.value })} className={`${fieldCls} mt-1`}>
            <option value="">— select hospital —</option>
            {availableHospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </label>
      ) : (
        <label className="block">
          <span className={labelCls}>Name</span>
          <input value={form.name} onChange={e => set({ name: e.target.value })} className={`${fieldCls} mt-1`}
            placeholder={form.payer_type === 'agency' ? 'e.g. MedStaff Locums' : form.payer_type === 'insurer' ? 'e.g. Jubilee Insurance' : 'Name'} />
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Phone</span>
          <input value={form.phone || ''} onChange={e => set({ phone: e.target.value })} inputMode="tel" className={`${fieldCls} mt-1`} />
        </label>
        <label className="block">
          <span className={labelCls}>Email</span>
          <input value={form.email || ''} onChange={e => set({ email: e.target.value })} inputMode="email" className={`${fieldCls} mt-1`} />
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-full text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700">
            Cancel
          </button>
        )}
        <button type="button" disabled={!valid || saving} onClick={() => onSave(form)}
          className="px-5 py-2 rounded-full text-xs font-semibold bg-ios-blue text-white disabled:opacity-50">
          {saving ? 'Saving…' : submitLabel}
        </button>
      </div>
    </div>
  )
}
