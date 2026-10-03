import { useMemo, useState } from 'react'
import { X, Moon, Plus } from 'lucide-react'
import ModalShell from '../ModalShell'
import Switch from '../Switch'
import Segmented from '../Segmented'
import PayerForm from './PayerForm'
import { modalFieldCls as fieldCls, labelCls } from '../billing/BillingDetailsEditor'
import { createShift, updateShift, createPayer } from '../../lib/api'
import {
  SHIFT_TYPES, RATE_UNITS, PER_PATIENT_MODES, payerName,
  shiftBreakdown, shiftBreakdownLines, toNairobiParts, fromNairobiParts, prefillFromLastShift,
} from '../../lib/earnings'
import { formatKES, todayStr } from '../../lib/utils'

// Add / edit one shift. Pay is fully flexible per shift: a base rate (per shift or
// per hour) plus optional overtime and optional per-patient pay — the live total
// at the bottom comes from lib/earnings.js, the same maths the cards and exports use.

const NumberField = ({ label, value, onChange, step = 'any', suffix }) => (
  <label className="block">
    <span className={labelCls}>{label}</span>
    <div className="relative mt-1">
      <input type="number" inputMode="decimal" min="0" step={step} value={value ?? ''}
        onChange={e => onChange(e.target.value)} className={`${fieldCls} tabular-nums ${suffix ? 'pr-12' : ''}`} />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>}
    </div>
  </label>
)

// shift = edit that shift · template = "Repeat": copy a shift's settings onto today.
// defaults = the clinician's per_shift pay model from onboarding (used until they've logged a shift).
function initialForm(shift, shifts, template, defaults) {
  const src = shift || template
  if (src) {
    const s = toNairobiParts(src.starts_at), e = toNairobiParts(src.ends_at)
    const base = { ...src, payer_id: src.payer_id || '', hospital_id: src.hospital_id || '', _date: shift ? s.date : todayStr(), _startTime: s.time, _endTime: e.time }
    if (!shift) { delete base.id; base.patient_count = ''; base.notes = ''; base.overtime_hours = '' }
    return base
  }
  const pre = prefillFromLastShift(shifts, null)
  const fromSetup = !shifts.length && defaults
    ? { rate_unit: defaults.shift_rate_unit || 'shift', base_rate: defaults.shift_rate ?? '' }
    : {}
  return {
    hospital_id: shifts[0]?.hospital_id || '',
    shift_type: 'day', rate_unit: 'shift', base_rate: '',
    overtime_enabled: false, overtime_hours: '', overtime_rate: '',
    per_patient_enabled: false, per_patient_mode: 'fixed', per_patient_amount: '', per_patient_percent: '', patient_count: '',
    notes: '', _date: todayStr(), _startTime: '08:00', _endTime: '17:00',
    ...fromSetup, ...pre, payer_id: pre.payer_id || '',
  }
}

export default function ShiftModal({ shift = null, template = null, defaults = null, shifts = [], hospitals = [], payers = [], actingUser, onClose, onSaved, onPayerCreated }) {
  const [form, setForm] = useState(() => initialForm(shift, shifts, template, defaults))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [addingPayer, setAddingPayer] = useState(false)
  const [savingPayer, setSavingPayer] = useState(false)
  const set = patch => setForm(f => ({ ...f, ...patch }))

  // Changing hospital on a NEW shift re-applies that hospital's last pay settings.
  const pickHospital = hospital_id => {
    if (shift) return set({ hospital_id })
    const pre = prefillFromLastShift(shifts, hospital_id)
    const hospitalPayer = payers.find(p => p.payer_type === 'hospital' && p.hospital_id === hospital_id)
    set({ hospital_id, ...pre, payer_id: pre.payer_id || hospitalPayer?.id || form.payer_id })
  }

  const times = fromNairobiParts(form._date, form._startTime, form._endTime)
  const preview = useMemo(() => (times ? { ...form, ...times } : form), [form, times])
  const breakdown = shiftBreakdown(preview)
  const lines = shiftBreakdownLines(preview, formatKES)

  const takenHospitalIds = payers.filter(p => p.payer_type === 'hospital').map(p => p.hospital_id)

  async function savePayer(p) {
    setSavingPayer(true)
    try {
      const row = await createPayer(actingUser.team_id, p, actingUser)
      const hospital = hospitals.find(h => h.id === row.hospital_id)
      onPayerCreated?.({ ...row, hospitals: hospital ? { id: hospital.id, name: hospital.name, color: hospital.color } : null })
      set({ payer_id: row.id })
      setAddingPayer(false)
    } catch (err) {
      setError('Could not add payer: ' + (err.message || 'unknown error'))
    } finally { setSavingPayer(false) }
  }

  async function save() {
    if (!times) return setError('Please set the date, start and end time.')
    setSaving(true); setError(null)
    const input = {
      ...form, ...times,
      hospital_id: form.hospital_id || null,
      payer_id: form.payer_id || null,
      base_rate: form.base_rate || 0,
    }
    try {
      if (shift) await updateShift(shift.id, input, actingUser)
      else await createShift(actingUser.team_id, input, actingUser)
      onSaved?.(shift ? 'Shift updated' : 'Shift logged')
    } catch (err) {
      console.error('save shift:', err)
      setError('Could not save: ' + (err.message || 'unknown error'))
      setSaving(false)
    }
  }

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-lg">
      <div className="glass-rim w-full rounded-3xl p-2.5 max-h-[90vh] flex flex-col">
        <div className="surface-shell flex-1 min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
            <h2 className="font-bold text-base">{shift ? 'Edit shift' : 'Log a shift'}</h2>
            <button onClick={onClose} aria-label="Close" className="w-7 h-7 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-5 pb-4 space-y-5">
            {/* WHERE + WHEN */}
            <section className="space-y-3">
              <label className="block">
                <span className={labelCls}>Hospital / facility</span>
                <select value={form.hospital_id} onChange={e => pickHospital(e.target.value)} className={`${fieldCls} mt-1`}>
                  <option value="">— not at one of my hospitals —</option>
                  {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </label>

              <div>
                <span className={labelCls}>Shift type</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {SHIFT_TYPES.map(t => (
                    <button key={t.key} type="button" onClick={() => set({ shift_type: t.key })}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                        form.shift_type === t.key ? 'bg-ios-blue text-white border-ios-blue' : 'bg-white/70 text-gray-600 border-gray-200 hover:bg-white'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <label className="block col-span-2 sm:col-span-1">
                  <span className={labelCls}>Date</span>
                  <input type="date" value={form._date} onChange={e => set({ _date: e.target.value })} className={`${fieldCls} mt-1`} />
                </label>
                <label className="block">
                  <span className={labelCls}>Start</span>
                  <input type="time" value={form._startTime} onChange={e => set({ _startTime: e.target.value })} className={`${fieldCls} mt-1`} />
                </label>
                <label className="block">
                  <span className={labelCls}>End</span>
                  <input type="time" value={form._endTime} onChange={e => set({ _endTime: e.target.value })} className={`${fieldCls} mt-1`} />
                </label>
              </div>
              {times && (
                <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
                  {times.overnight && <Moon size={12} className="text-indigo-500" />}
                  {breakdown.hours} hours{times.overnight ? ' · ends the next day' : ''}
                </p>
              )}
            </section>

            {/* WHO PAYS */}
            <section className="space-y-2">
              <div className="flex items-end gap-2">
                <label className="block flex-1">
                  <span className={labelCls}>Who pays</span>
                  <select value={form.payer_id} onChange={e => set({ payer_id: e.target.value })} className={`${fieldCls} mt-1`}>
                    <option value="">— not set —</option>
                    {payers.map(p => <option key={p.id} value={p.id}>{payerName(p)}</option>)}
                  </select>
                </label>
                {!addingPayer && (
                  <button type="button" onClick={() => setAddingPayer(true)}
                    className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs font-semibold text-ios-blue bg-blue-50 hover:bg-blue-100">
                    <Plus size={13} /> New payer
                  </button>
                )}
              </div>
              {addingPayer && (
                <div className="rounded-2xl bg-blue-50/60 border border-blue-100 p-3">
                  <PayerForm
                    initial={form.hospital_id && !takenHospitalIds.includes(form.hospital_id)
                      ? { payer_type: 'hospital', hospital_id: form.hospital_id } : undefined}
                    hospitals={hospitals} takenHospitalIds={takenHospitalIds}
                    saving={savingPayer} onSave={savePayer} onCancel={() => setAddingPayer(false)} submitLabel="Add payer" />
                </div>
              )}
            </section>

            {/* PAY */}
            <section className="space-y-3">
              <span className={labelCls}>Base pay</span>
              <Segmented options={RATE_UNITS} value={form.rate_unit} onChange={rate_unit => set({ rate_unit })} />
              <NumberField label={form.rate_unit === 'hour' ? 'Rate per hour' : 'Rate for the shift'} value={form.base_rate}
                onChange={base_rate => set({ base_rate })} suffix="KES" />

              {/* Overtime */}
              <div className="rounded-2xl border border-gray-200/70 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Overtime</p>
                    <p className="text-[11px] text-gray-500">Extra hours paid at an overtime rate</p>
                  </div>
                  <Switch checked={form.overtime_enabled} onChange={v => set({ overtime_enabled: v })} label="Overtime" />
                </div>
                {form.overtime_enabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <NumberField label="Overtime hours" value={form.overtime_hours} onChange={overtime_hours => set({ overtime_hours })} suffix="h" />
                    <NumberField label="Rate per hour" value={form.overtime_rate} onChange={overtime_rate => set({ overtime_rate })} suffix="KES" />
                  </div>
                )}
              </div>

              {/* Per patient */}
              <div className="rounded-2xl border border-gray-200/70 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Per-patient pay</p>
                    <p className="text-[11px] text-gray-500">A fixed amount or a percentage for each patient seen</p>
                  </div>
                  <Switch checked={form.per_patient_enabled} onChange={v => set({ per_patient_enabled: v })} label="Per-patient pay" />
                </div>
                {form.per_patient_enabled && (
                  <>
                    <Segmented options={PER_PATIENT_MODES.map(m => ({ ...m, label: m.key === 'fixed' ? 'Fixed amount' : 'Percentage' }))}
                      value={form.per_patient_mode} onChange={per_patient_mode => set({ per_patient_mode })} />
                    <div className={`grid gap-3 ${form.per_patient_mode === 'percent' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      <NumberField label="Patients seen" value={form.patient_count} step="1" onChange={patient_count => set({ patient_count })} />
                      <NumberField label={form.per_patient_mode === 'percent' ? 'Fee per patient' : 'Per patient'} value={form.per_patient_amount}
                        onChange={per_patient_amount => set({ per_patient_amount })} suffix="KES" />
                      {form.per_patient_mode === 'percent' && (
                        <NumberField label="Your share" value={form.per_patient_percent} onChange={per_patient_percent => set({ per_patient_percent })} suffix="%" />
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* NOTES */}
            <label className="block">
              <span className={labelCls}>Notes</span>
              <textarea rows={2} value={form.notes || ''} onChange={e => set({ notes: e.target.value })}
                placeholder="e.g. Covered Dr. K's night; ICU cover" className={`${fieldCls} mt-1 resize-none`} />
            </label>

            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          {/* Live total + save */}
          <div className="flex-shrink-0 border-t border-gray-100 px-5 py-3 bg-white/80">
            <div className="space-y-0.5 mb-2">
              {lines.map(l => (
                <div key={l.key} className="flex justify-between text-[11px] text-gray-500">
                  <span>{l.label}</span><span className="tabular-nums">{formatKES(l.amount)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Shift total</p>
                <p className="text-lg font-bold text-gray-900 tabular-nums">{formatKES(breakdown.total)}</p>
              </div>
              <button onClick={save} disabled={saving || !times}
                className="px-6 py-2.5 rounded-full bg-ios-blue text-white text-sm font-semibold shadow-sm disabled:opacity-50">
                {saving ? 'Saving…' : shift ? 'Save changes' : 'Log shift'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}
