import { useState, useEffect, useRef } from 'react'
import { X, Trash2, AlertTriangle } from 'lucide-react'
import { fetchHospitalWards, createTimelineEvent, updateTimelineEvent, deleteTimelineEvent, correctWrongfulWard, parseEventTimestamp } from '../../lib/api'
import { formatKES } from '../../lib/utils'
import { useAuth } from '../../context/AuthContext'
import ModalShell from '../../components/ModalShell'

// Same admission-first-then-chronological sort as billing.js's buildWardLines.
function sortWardEvents(events) {
  return [...(events || [])]
    .filter(ev => ev.event_type === 'admitted' || ev.event_type === 'transferred')
    .sort((a, b) => {
      if (a.event_type === 'admitted' && b.event_type !== 'admitted') return -1
      if (b.event_type === 'admitted' && a.event_type !== 'admitted') return 1
      return parseEventTimestamp(a.timestamp) - parseEventTimestamp(b.timestamp)
    })
}

function toRow(ev) {
  const ts = parseEventTimestamp(ev.timestamp)
  return {
    id: ev.id,
    event_type: ev.event_type,
    ward: ev.ward,
    dateStr: ts ? ts.toISOString().slice(0, 10) : '',
  }
}

// Parses as UTC midnight so the displayed calendar day never shifts with the browser's locale.
function fmtDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

export default function TimelineEditorModal({ admission, onClose, onSaved }) {
  const { user } = useAuth()
  const patient = admission?.patients
  const patientName = `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim()
  const isActive = admission?.status === 'admitted'

  const [rows, setRows] = useState([])
  const originalRef = useRef([])
  const [wards, setWards] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [correctingOpen, setCorrectingOpen] = useState(false)
  const [correctWardChoice, setCorrectWardChoice] = useState('')
  const [correctSaving, setCorrectSaving] = useState(false)
  const [correctError, setCorrectError] = useState(null)

  useEffect(() => {
    const sorted = sortWardEvents(admission?.timeline_events).map(toRow)
    setRows(sorted)
    originalRef.current = sorted
  }, [admission?.id])

  useEffect(() => {
    if (!admission?.hospital_id) { setLoading(false); return }
    setLoading(true)
    fetchHospitalWards(admission.hospital_id)
      .then(setWards)
      .catch(() => setError('Failed to load ward list.'))
      .finally(() => setLoading(false))
  }, [admission?.hospital_id])

  function updateRow(id, patch) {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)))
  }

  function removeRow(id) {
    setRows(prev => prev.filter(r => r.id !== id))
  }

  function addWardRow() {
    setError(null)
    setRows(prev => [...prev, {
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      event_type: 'transferred',
      ward: '',
      dateStr: '',
    }])
  }

  // Admission event first, then chronological by date — so the "until" labels and the
  // ordering validation stay correct even when new wards are added out of sequence.
  const displayRows = [...rows].sort((a, b) => {
    if (a.event_type === 'admitted' && b.event_type !== 'admitted') return -1
    if (b.event_type === 'admitted' && a.event_type !== 'admitted') return 1
    return (a.dateStr || '').localeCompare(b.dateStr || '')
  })

  const original = originalRef.current
  const hasDiffs = rows.length !== original.length || rows.some(row => {
    const orig = original.find(o => o.id === row.id)
    return !orig || orig.ward !== row.ward || orig.dateStr !== row.dateStr
  })

  function buildCtx() {
    return { user, patientId: admission.patient_id, patientName }
  }

  async function handleSave() {
    setError(null)

    for (const row of displayRows) {
      if (!row.ward) { setError('Every ward row needs a ward selected.'); return }
      if (!row.dateStr) { setError('Every ward row needs a date.'); return }
    }
    for (let i = 1; i < displayRows.length; i++) {
      if (displayRows[i].dateStr <= displayRows[i - 1].dateStr) {
        setError('Each ward must start after the previous ward’s date.')
        return
      }
    }

    setSaving(true)
    const ctx = buildCtx()
    try {
      const editedIds = new Set(rows.map(r => r.id))

      // Deletes first so the remaining-row invariant recomputes against the post-delete set.
      for (const orig of original) {
        if (orig.event_type === 'transferred' && !editedIds.has(orig.id)) {
          await deleteTimelineEvent(admission.id, orig.id, ctx)
        }
      }

      for (const row of displayRows) {
        const orig = original.find(o => o.id === row.id)
        if (!orig) continue
        const updates = {}
        if (row.ward !== orig.ward) updates.ward = row.ward
        if (row.dateStr !== orig.dateStr) updates.timestamp = new Date(row.dateStr + 'T00:00:00Z').toISOString()
        if (Object.keys(updates).length > 0) {
          await updateTimelineEvent(admission.id, row.id, updates, ctx)
        }
      }

      // New ward segments, created in chronological order so admissions.ward settles
      // on the last one.
      for (const row of displayRows) {
        if (original.find(o => o.id === row.id)) continue
        await createTimelineEvent(admission.id, row.ward, new Date(row.dateStr + 'T00:00:00Z').toISOString(), ctx)
      }

      onSaved?.()
      onClose?.()
    } catch (e) {
      setError(e.message || 'Failed to save timeline changes.')
      setSaving(false)
    }
  }

  async function handleCorrectConfirm() {
    if (!correctWardChoice) { setCorrectError('Select a ward.'); return }
    setCorrectSaving(true)
    setCorrectError(null)
    try {
      await correctWrongfulWard(admission.id, correctWardChoice, buildCtx())
      onSaved?.()
      onClose?.()
    } catch (e) {
      setCorrectError(e.message || 'Failed to correct ward.')
      setCorrectSaving(false)
    }
  }

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-lg">
      <div className="glass-rim w-full rounded-3xl p-2.5 max-h-[92vh] flex flex-col">
        <div className="surface-shell flex-1 min-h-0">

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0">
            <div>
              <h2 className="font-bold text-base">Edit Stay Timeline</h2>
              <p className="text-sm text-ios-gray-1 mt-0.5">{patientName || 'Patient'}</p>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-5 pb-6 space-y-3">
            {loading ? (
              <p className="text-sm text-ios-gray-1 py-6 text-center">Loading…</p>
            ) : (
              <>
                {displayRows.map((row, i) => {
                  const isFirst = i === 0
                  const nextRow = displayRows[i + 1]
                  const untilLabel = nextRow
                    ? fmtDate(nextRow.dateStr)
                    : isActive
                      ? 'present'
                      : fmtDate(admission?.discharge_date ? String(admission.discharge_date).slice(0, 10) : null)

                  return (
                    <div key={row.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-gray-500">
                          {isFirst ? 'Admission date' : 'Transfer date'}
                        </label>
                        {!isFirst && (
                          <button
                            onClick={() => removeRow(row.id)}
                            title="Remove this ward change"
                            className="w-6 h-6 rounded-full flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={row.ward || ''}
                          onChange={e => updateRow(row.id, { ward: e.target.value })}
                          className="ios-input text-sm"
                        >
                          <option value="">Select ward…</option>
                          {wards.map(s => (
                            <option key={s.id} value={s.service_name}>
                              {s.service_name} — {formatKES(s.price_per_day)}/day
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={row.dateStr}
                          onChange={e => updateRow(row.id, { dateStr: e.target.value })}
                          className="ios-input text-sm"
                        />
                      </div>

                      <p className="text-[11px] text-ios-gray-2">until {untilLabel}</p>
                    </div>
                  )
                })}

                <button
                  onClick={addWardRow}
                  className="w-full py-2.5 rounded-2xl border border-dashed border-ios-blue/40 text-ios-blue text-sm font-semibold hover:bg-ios-blue/5 transition-colors"
                >
                  + Add ward
                </button>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                    {error}
                  </div>
                )}

                {isActive && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                    {!correctingOpen ? (
                      <>
                        <button
                          onClick={() => { setCorrectingOpen(true); setCorrectWardChoice(''); setCorrectError(null) }}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors"
                        >
                          Correct wrongful ward
                        </button>
                        <p className="text-[11px] text-amber-700 leading-snug">
                          Use if the current ward was entered in error — records a same-day correction, not billed.
                        </p>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-amber-700">
                          <AlertTriangle size={13} />
                          <span className="text-xs font-semibold">Correct wrongful ward</span>
                        </div>
                        <select
                          value={correctWardChoice}
                          onChange={e => setCorrectWardChoice(e.target.value)}
                          className="ios-input text-sm"
                        >
                          <option value="">Select correct ward…</option>
                          {wards.map(s => (
                            <option key={s.id} value={s.service_name}>
                              {s.service_name} — {formatKES(s.price_per_day)}/day
                            </option>
                          ))}
                        </select>
                        {correctError && (
                          <p className="text-xs text-red-600">{correctError}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setCorrectingOpen(false)}
                            className="flex-1 py-2 rounded-full border border-amber-300 text-xs font-medium text-amber-700"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleCorrectConfirm}
                            disabled={correctSaving || !correctWardChoice}
                            className="flex-1 py-2 rounded-full text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 transition-colors"
                          >
                            {correctSaving ? 'Saving…' : 'Confirm'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 px-5 pb-5 pt-1 flex-shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-full border border-ios-gray-4 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading || !hasDiffs}
              className="flex-1 py-3 rounded-full font-semibold text-white text-sm transition-all active:scale-95 disabled:opacity-50"
              style={{ background: 'var(--ios-blue, #007AFF)' }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>

        </div>
      </div>
    </ModalShell>
  )
}
