// "When is this patient booked?" — reuses the existing PatientSearch, then
// lists the patient's upcoming visits; clicking one jumps the calendar there.
import { useState } from 'react'
import { X } from 'lucide-react'
import { fetchUpcomingPatientVisits, fmtSlot, slotKeyFromVisit } from '../../lib/api'
import { todayStr, formatDate } from '../../lib/utils'
import { VISIT_STATUS_STYLES, visitStatusKey } from '../../lib/theme'
import PatientSearch from '../PatientSearch'

export default function PatientBookingSearch({ teamId, onPickDate }) {
  const [patient, setPatient] = useState(null)
  const [visits, setVisits] = useState(null)
  const [error, setError] = useState(null)

  async function pick(p) {
    setPatient(p)
    setVisits(null)
    setError(null)
    try {
      setVisits(await fetchUpcomingPatientVisits(teamId, p.id, todayStr()))
    } catch (err) {
      console.error(err)
      setError('Could not load bookings — please try again.')
    }
  }

  function clear() {
    setPatient(null)
    setVisits(null)
    setError(null)
  }

  if (!patient) return <PatientSearch teamId={teamId} onSelect={pick} />

  return (
    <div className="rounded-2xl border border-gray-200 bg-white/80 p-3">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-semibold text-gray-800">
          {patient.first_name} {patient.last_name} — upcoming bookings
        </p>
        <button onClick={clear} aria-label="Clear patient search" className="w-6 h-6 flex items-center justify-center rounded-full bg-black/[0.06] hover:bg-black/10 transition-colors">
          <X size={12} />
        </button>
      </div>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
      {visits === null && !error && <p className="text-[11px] text-gray-400">Loading…</p>}
      {visits?.length === 0 && <p className="text-[11px] text-gray-400">No upcoming bookings for this patient</p>}
      {visits?.length > 0 && (
        <div className="flex flex-col gap-1">
          {visits.map(v => {
            const key = v.is_adhoc ? 'adhoc' : visitStatusKey(v)
            const st = VISIT_STATUS_STYLES[key]
            const slot = slotKeyFromVisit(v)
            return (
              <button
                key={v.id}
                onClick={() => onPickDate(v.visit_date)}
                className="flex items-center gap-2 text-left px-2 py-1.5 rounded-xl hover:bg-black/[0.04] transition-colors"
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`} />
                <span className="text-[11px] text-gray-700">
                  {formatDate(v.visit_date)}{slot ? ` · ${fmtSlot(slot)}` : ''}
                  {v.hospitals?.name ? ` · ${v.hospitals.name}` : ''}
                </span>
                <span className={`ml-auto text-[10px] flex-shrink-0 ${st.sub}`}>{st.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
