import { useEffect, useState } from 'react'
import { Check, Banknote, Loader2 } from 'lucide-react'
import { BILLING_MODES } from '../../lib/billing'

// ─────────────────────────────────────────────────────────────────────────────
// Shared billing-status building blocks — ONE billed / paid / invoice workflow
// for every kind of earning (admissions on the Billing page, shifts on the
// Shifts page, procedures later). Backed by invoice_records (one row per owner).
//
//   useBillingDraft(record)   → { draft, set, dirty, patch }
//   <SubCard>                 accent-tinted glass section (Outpatient card style)
//   <BillingDetailsFields>    Billed / Paid toggles + mode + invoice # + amount
//   <FollowUpNote>            notes textarea
//   <SaveBar>                 dirty hint + Save pill
// ─────────────────────────────────────────────────────────────────────────────

export const fieldCls = 'w-full px-3 py-2 rounded-xl bg-white/70 border border-white/60 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-ios-blue/40'
// Same field on a plain white modal surface (the tinted fieldCls vanishes on white).
export const modalFieldCls = 'field-box w-full focus:outline-none focus:ring-2 focus:ring-ios-blue/40'
export const labelCls = 'text-[11px] font-semibold uppercase tracking-wide text-gray-400'

// Accent-tinted glass sub-card, mirroring the Outpatient expanded sections
// (rounded-3xl, white/50 border, accent+'20' tint, accent-coloured title).
export function SubCard({ accentColor, title, right, children }) {
  return (
    <section
      className="rounded-3xl border border-white/50"
      style={{ backgroundColor: accentColor + '20', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold tracking-wide" style={{ color: accentColor }}>{title}</p>
          {right}
        </div>
      </div>
      <div className="px-4 pb-4 border-t border-white/30">{children}</div>
    </section>
  )
}

const fromRecord = rec => ({
  billed: !!rec?.billed,
  paid: !!rec?.paid,
  billing_mode: rec?.billing_mode || '',
  invoice_number: rec?.invoice_number || '',
  amount: rec?.amount != null ? String(rec.amount) : '',
  notes: rec?.notes || '',
})

// Local editable copy of an invoice_records row; resyncs when the saved row changes.
export function useBillingDraft(rec) {
  const [draft, setDraft] = useState(() => fromRecord(rec))
  useEffect(() => { setDraft(fromRecord(rec)) },
    [rec?.id, rec?.billed, rec?.paid, rec?.billing_mode, rec?.invoice_number, rec?.amount, rec?.notes])

  const saved = fromRecord(rec)
  const dirty = Object.keys(saved).some(k => draft[k] !== saved[k])
  const set = patch => setDraft(d => ({ ...d, ...patch }))
  // The patch shape upsertInvoiceRecord expects.
  const patch = {
    billed: draft.billed, paid: draft.paid, billing_mode: draft.billing_mode,
    invoice_number: draft.invoice_number, amount: draft.amount, notes: draft.notes,
  }
  return { draft, set, dirty, patch }
}

// Billed / Paid pill toggles + (optional) mode + invoice number + amount.
// Paying implies billed; un-billing clears paid. Paid requires canMarkPaid.
export function BillingDetailsFields({ draft, set, canMarkPaid, systemTotal = 0, showMode = true }) {
  return (
    <div className="pt-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => set({ billed: !draft.billed, paid: draft.billed ? false : draft.paid })}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
            draft.billed ? 'bg-blue-500 text-white border-blue-500' : 'bg-white/70 text-gray-600 border-white/60 hover:bg-white'
          }`}
        >
          <Check size={13} className={draft.billed ? 'opacity-100' : 'opacity-40'} />
          Billed
        </button>
        <button
          type="button"
          disabled={!canMarkPaid}
          onClick={() => canMarkPaid && set({ paid: !draft.paid, billed: draft.paid ? draft.billed : true })}
          title={canMarkPaid ? undefined : 'You are not authorised to mark bills as paid'}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
            draft.paid ? 'bg-green-500 text-white border-green-500' : 'bg-white/70 text-gray-600 border-white/60 hover:bg-white'
          } ${!canMarkPaid ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Banknote size={13} className={draft.paid ? 'opacity-100' : 'opacity-40'} />
          Paid
        </button>
      </div>

      <div className={`grid grid-cols-1 gap-3 ${showMode ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {showMode && (
          <label className="block">
            <span className={labelCls}>Mode of billing</span>
            <select value={draft.billing_mode} onChange={e => set({ billing_mode: e.target.value })} className={`${fieldCls} mt-1`}>
              <option value="">— select —</option>
              {BILLING_MODES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </label>
        )}
        <label className="block">
          <span className={labelCls}>Invoice number</span>
          <input type="text" value={draft.invoice_number} onChange={e => set({ invoice_number: e.target.value })}
            placeholder="e.g. HOSP-10234" className={`${fieldCls} mt-1`} />
        </label>
        <label className="block">
          <span className={labelCls}>Amount billed (KES)</span>
          <div className="mt-1 flex items-center gap-2">
            <input type="number" inputMode="decimal" value={draft.amount} onChange={e => set({ amount: e.target.value })}
              placeholder={String(Math.round(systemTotal))} className={`${fieldCls} tabular-nums`} />
            {!draft.amount && systemTotal > 0 && (
              <button type="button" onClick={() => set({ amount: String(Math.round(systemTotal)) })}
                className="flex-shrink-0 text-[11px] font-semibold text-ios-blue whitespace-nowrap hover:underline">
                Use total
              </button>
            )}
          </div>
        </label>
      </div>
    </div>
  )
}

export function FollowUpNote({ value, onChange, placeholder = 'e.g. Insurance pre-auth pending; called patient 8 Aug' }) {
  return (
    <textarea
      rows={3}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${fieldCls} mt-3 resize-none`}
    />
  )
}

export function SaveBar({ dirty, saving, onSave, children }) {
  return (
    <div className="flex items-center justify-end gap-2">
      {children}
      {dirty && <span className="text-[11px] text-gray-400">Unsaved changes</span>}
      <button
        onClick={onSave}
        disabled={!dirty || saving}
        className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-ios-blue text-white text-xs font-semibold shadow-sm hover:bg-ios-blue/90 transition disabled:opacity-50"
      >
        {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
