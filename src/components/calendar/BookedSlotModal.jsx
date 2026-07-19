// Shared "booked slot" actions popover — check in, reschedule, remind, cancel.
// Used from the Appointments day grid AND the calendar rail's agenda list
// (Appointments + Outpatient dashboard), so the same actions are available
// wherever a patient's upcoming appointment is shown.
import { useState } from 'react'
import { X } from 'lucide-react'
import ModalShell from '../ModalShell'
import DoctorPicker from '../DoctorPicker'
import { fmtSlot, slotKeyFromVisit } from '../../lib/api'

export default function BookedSlotModal({ visit, teamId, onClose, onCancelBooking, onChangeBooking, onCheckIn, onSendReminder }) {
  const [checkInError, setCheckInError] = useState(null)
  const [checkingIn, setCheckingIn] = useState(false)
  const [doctorId, setDoctorId] = useState('')
  const patient = visit.patients
  const name = patient ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() : 'Unknown'

  async function handleCheckIn() {
    setCheckInError(null)
    setCheckingIn(true)
    try {
      await onCheckIn(visit, doctorId)
    } catch (err) {
      setCheckInError(err.message)
    } finally {
      setCheckingIn(false)
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="glass-rim w-full max-w-sm rounded-3xl p-2.5">
        <div className="surface-shell">
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <div>
            <h2 className="font-bold text-base text-gray-900">{name}</h2>
            <p className="text-xs text-gray-500">
              {fmtSlot(slotKeyFromVisit(visit))}{visit.hospitals?.name ? ` · ${visit.hospitals.name}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="px-5 pb-5 pt-2 space-y-2">
          <DoctorPicker teamId={visit.team_id || teamId} value={doctorId} onChange={setDoctorId} />
          <button
            onClick={handleCheckIn}
            disabled={checkingIn || !doctorId}
            className="w-full py-2.5 rounded-2xl text-sm font-semibold bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            {checkingIn ? 'Checking in…' : 'Check In'}
          </button>
          {checkInError && <p className="text-xs text-red-500">{checkInError}</p>}
          <button
            onClick={() => onChangeBooking(visit)}
            className="w-full py-2.5 rounded-2xl text-sm font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
          >
            Change Booking
          </button>
          <button
            onClick={() => onSendReminder(visit)}
            className="w-full py-2.5 rounded-2xl text-sm font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
          >
            Send Reminder
          </button>
          <button
            onClick={() => onCancelBooking(visit)}
            className="w-full py-2.5 rounded-2xl text-sm font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
          >
            Cancel Booking
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl text-sm font-semibold bg-black/[0.06] text-gray-700 hover:bg-black/10 transition-colors"
          >
            Exit
          </button>
        </div>
        </div>
      </div>
    </ModalShell>
  )
}
