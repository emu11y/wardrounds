import { useState } from 'react'
import { X, Plus, Archive, RotateCcw, Pencil } from 'lucide-react'
import ModalShell from '../ModalShell'
import PayerForm from './PayerForm'
import { createPayer, updatePayer } from '../../lib/api'
import { payerName, PAYER_TYPE_LABEL } from '../../lib/earnings'

// Manage who pays (hospitals, agencies, insurers, patients, other). Payers are
// archived, never deleted, so past shifts keep their payer.
export default function PayersModal({ payers, hospitals, actingUser, onClose, onChanged }) {
  const [mode, setMode] = useState(null)        // null | 'new' | payer id being edited
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showArchived, setShowArchived] = useState(false)

  const takenHospitalIds = payers.filter(p => p.payer_type === 'hospital' && p.status === 'active').map(p => p.hospital_id)
  const list = payers.filter(p => showArchived || p.status === 'active')

  async function run(fn) {
    setSaving(true); setError(null)
    try { await fn(); setMode(null); await onChanged?.() }
    catch (err) { setError(err.message || 'Something went wrong') }
    finally { setSaving(false) }
  }

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-md">
      <div className="glass-rim w-full rounded-3xl p-2.5 max-h-[85vh] flex flex-col">
        <div className="surface-shell flex-1 min-h-0">
          <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
            <h2 className="font-bold text-base">Payers</h2>
            <button onClick={onClose} aria-label="Close" className="w-7 h-7 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20">
              <X size={14} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-5 pb-5 space-y-3">
            <p className="text-xs text-gray-500">Who pays you for shifts — a hospital, a locum agency, an insurer, the patient directly, or anyone else.</p>

            {mode === 'new' ? (
              <div className="rounded-2xl bg-blue-50/60 border border-blue-100 p-3">
                <PayerForm hospitals={hospitals} takenHospitalIds={takenHospitalIds} saving={saving}
                  onSave={p => run(() => createPayer(actingUser.team_id, p, actingUser))} onCancel={() => setMode(null)} submitLabel="Add payer" />
              </div>
            ) : (
              <button onClick={() => setMode('new')}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-semibold text-ios-blue bg-blue-50 hover:bg-blue-100">
                <Plus size={15} /> Add payer
              </button>
            )}

            {error && <p className="text-xs text-red-500">{error}</p>}

            {list.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No payers yet</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white/70">
                {list.map(p => (
                  <li key={p.id} className="p-3">
                    {mode === p.id ? (
                      <PayerForm initial={{ ...p, hospital_id: p.hospital_id || '', name: p.name || '' }} hospitals={hospitals}
                        takenHospitalIds={takenHospitalIds} saving={saving}
                        onSave={f => run(() => updatePayer(p.id, f, actingUser))} onCancel={() => setMode(null)} />
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${p.status === 'archived' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{payerName(p)}</p>
                          <p className="text-[11px] text-gray-500">{PAYER_TYPE_LABEL[p.payer_type]}{p.phone ? ` · ${p.phone}` : ''}</p>
                        </div>
                        {p.status === 'active' ? (
                          <>
                            <button onClick={() => setMode(p.id)} aria-label="Edit payer" className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600"><Pencil size={15} /></button>
                            <button onClick={() => run(() => updatePayer(p.id, { status: 'archived' }, actingUser))} aria-label="Archive payer" className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600"><Archive size={15} /></button>
                          </>
                        ) : (
                          <button onClick={() => run(() => updatePayer(p.id, { status: 'active' }, actingUser))} aria-label="Restore payer" className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600"><RotateCcw size={15} /></button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {payers.some(p => p.status === 'archived') && (
              <button onClick={() => setShowArchived(v => !v)} className="text-xs font-semibold text-gray-400 hover:text-gray-600">
                {showArchived ? 'Hide archived' : 'Show archived'}
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  )
}
