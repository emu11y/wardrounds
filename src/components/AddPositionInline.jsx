import { useState } from 'react'
import { createTeamPosition } from '../lib/api'

export default function AddPositionInline({ teamId, existingNames = [], onCreated, onCancel }) {
  const [name, setName] = useState('')
  const [isClinical, setIsClinical] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) { setError('Position name is required.'); return }
    if (existingNames.some(n => n.toLowerCase() === trimmed.toLowerCase())) { setError('That position already exists.'); return }
    if (isClinical === null) { setError('Choose whether this is a clinical role.'); return }
    setSaving(true); setError(null)
    try {
      const pos = await createTeamPosition(teamId, trimmed, isClinical)
      onCreated(pos)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 p-3 rounded-2xl bg-blue-50/60 border border-blue-100 space-y-2">
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Position name (e.g. Physiotherapist)"
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
      />
      <div className="flex gap-2">
        {[[true, 'Clinical'], [false, 'Non-clinical']].map(([val, label]) => (
          <button
            key={label}
            type="button"
            onClick={() => setIsClinical(val)}
            style={isClinical === val ? { backgroundColor: '#007AFF' } : undefined}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${isClinical === val ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-gray-400">Clinical roles appear in doctor pickers and get an Appointments schedule.</p>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Cancel</button>
        <button type="button" onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-full text-xs font-semibold bg-[#007AFF] text-white disabled:opacity-50 transition-opacity">
          {saving ? 'Adding…' : 'Add Position'}
        </button>
      </div>
    </div>
  )
}
