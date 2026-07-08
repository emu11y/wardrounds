import { useState, useEffect } from 'react'
import { fetchMembersWithPositions } from '../lib/api'

export default function DoctorPicker({ teamId, value, onChange, label = 'Seen by', locked = false }) {
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teamId) return
    let alive = true
    setLoading(true)
    fetchMembersWithPositions(teamId)
      .then(members => { if (alive) setDoctors((members || []).filter(m => m.is_clinical === true)) })
      .catch(() => { if (alive) setDoctors([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [teamId])

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1">{label}</p>
      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <div className="w-3 h-3 border-2 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin" />
          <span className="text-xs text-gray-400">Loading doctors…</span>
        </div>
      ) : doctors.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">No clinical staff configured.</p>
      ) : (
        <div className="space-y-2">
          {(locked ? doctors.filter(d => d.id === value) : doctors).map(d => {
            const isSelected = value === d.id
            return (
              <button
                key={d.id}
                type="button"
                disabled={locked}
                onClick={() => !locked && onChange(d.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all ${isSelected ? 'border-ios-blue bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ring-1 ring-white shadow-sm flex-shrink-0" style={{ backgroundColor: '#007AFF20', color: '#007AFF' }}>
                  {d.full_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-800 truncate">{d.full_name || '—'}</p>
                  {d.position_name && <p className="text-[11px] text-gray-400 truncate">{d.position_name}</p>}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
