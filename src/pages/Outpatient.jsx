import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X, Stethoscope, Calendar, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import {
  fetchOutpatientVisitsFiltered, fetchOpenOutpatientVisits, fetchPatientInteractions,
  fetchHospitals, fetchTeamMembers, fetchMembersWithPositions, closeVisit, bookAppointment,
  addVisitNote, fetchAllPatientVisitNotes, fetchTeamServices,
  addVisitService, deleteVisitService, ALL_TIME_SLOTS, fmtSlot, updatePatientContact,
  fetchTeamProfile, fetchUserName,
} from '../lib/api'
import { sendAppointmentConfirmationSafe } from '../lib/email'
import { sendAppointmentWhatsAppSafe } from '../lib/whatsapp'
import LogVisitModal from '../components/LogVisitModal'
import TopHeader from '../components/TopHeader'
import ModalShell from '../components/ModalShell'
import Toast from '../components/Toast'
import { calcAge, formatDate, todayStr, darken, formatKES } from '../lib/utils'
import { getOutpatientStatusStyle } from '../lib/statusBadges'

function groupVisitsByPatient(visits) {
  const map = new Map()
  for (const v of visits) {
    const existing = map.get(v.patient_id)
    if (!existing) { map.set(v.patient_id, v); continue }
    const newer = (v.visit_date + (v.visit_time || '')) > (existing.visit_date + (existing.visit_time || ''))
    if (newer) map.set(v.patient_id, v)
  }
  return Array.from(map.values())
}

function countSeen(visits, doctorId, hospitalId) {
  return visits.filter(v =>
    (v.status === 'seen' || v.status === 'closed') &&
    (doctorId   ? v.doctor_id === doctorId  : true) &&
    (hospitalId ? v.hospital_id        === hospitalId : true)
  ).length
}

// ─── Booking Modal ────────────────────────────────────────────────────────────

function BookingModal({ visit, teamId, userId, hospitals, onClose, onBooked, notify }) {
  const [date, setDate]             = useState(todayStr())
  const [selectedSlot, setSlot]     = useState(null)
  const [selectedHospitalId, setHospitalId] = useState(visit.hospital_id || (hospitals[0]?.id ?? null))
  const [notes, setNotes]           = useState('')
  const [bookingEmail, setBookingEmail] = useState('')
  const [bookedSlots, setBooked]    = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState(null)

  const patient = visit.patients
  const patientName = patient
    ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim()
    : 'Unknown'

  // Fetch already-booked slots for the chosen date + hospital
  useEffect(() => {
    if (!date || !teamId) return
    setLoadingSlots(true)
    supabase
      .from('outpatient_visits')
      .select('visit_time, status')
      .eq('team_id', teamId)
      .eq('visit_date', date)
      .in('status', ['scheduled', 'seen', 'pending'])
      .then(({ data }) => {
        const taken = (data || []).map(v => {
          if (!v.visit_time) return null
          const d = new Date(v.visit_time)
          return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        }).filter(Boolean)
        setBooked(taken)
        setSlot(null)
      })
      .finally(() => setLoadingSlots(false))
  }, [date, teamId])

  function prevDay() {
    const d = new Date(date); d.setDate(d.getDate() - 1)
    const s = d.toISOString().split('T')[0]
    if (s >= todayStr()) setDate(s)
  }
  function nextDay() {
    const d = new Date(date); d.setDate(d.getDate() + 1)
    setDate(d.toISOString().split('T')[0])
  }

  const formattedDate = date
    ? new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  const availableCount = ALL_TIME_SLOTS.filter(s => !bookedSlots.includes(s)).length
  const bookedCount    = bookedSlots.length

  async function handleConfirm() {
    if (!date || !selectedSlot) { setError('Please select a date and time slot.'); return }
    if (!selectedHospitalId)    { setError('Please select a hospital.'); return }
    setError(null)
    setSubmitting(true)
    try {
      // Carry forward the visit's actual assigned doctor — never fall back to whoever is
      // clicking "Book Appointment" (could be front-desk/admin staff, not the treating doctor).
      const appt = await bookAppointment(
        visit.patient_id, selectedHospitalId, teamId, userId, date, selectedSlot, notes,
        visit.doctor_id,
      )
      // Save a newly-entered email (existing patient without one on file)
      if (patient?.id && !patient.email && bookingEmail.trim()) {
        await updatePatientContact(patient.id, { email: bookingEmail.trim() })
          .catch(err => console.error('Booking saved, but email could not be stored', err))
      }
      // Appointment confirmations — non-blocking, both channels fire independently
      // (email + WhatsApp when the team toggle, patient opt-in and phone all allow),
      // each surfacing its outcome so silent failures are visible.
      const emailTo = (patient?.email || bookingEmail || '').trim()
      const waPhone = (patient?.phone || '').trim()
      const waConsent = patient?.whatsapp_opt_in === true
      if (emailTo || (waPhone && waConsent)) {
        const hosp = hospitals.find(h => h.id === selectedHospitalId)
        Promise.all([
          fetchTeamProfile(teamId).catch(() => null),
          visit.doctor_id ? fetchUserName(visit.doctor_id).catch(() => null) : Promise.resolve(null),
        ]).then(([team, doctor]) => {
          const apptFields = {
            dateStr: date,
            timeLabel: fmtSlot(selectedSlot),
            hospitalName: hosp?.name,
            hospitalAddress: hosp?.address,
            doctorName: doctor?.full_name,
            doctorTitle: doctor?.job_title || doctor?.speciality,
            team,
          }
          if (emailTo) {
            sendAppointmentConfirmationSafe({ to: emailTo, patientName, ...apptFields }).then(res => {
              if (res.ok) notify?.(`Confirmation email sent to ${emailTo}`, 'success')
              else if (!res.skipped) notify?.(`Email not sent: ${res.error}`, 'error')
            })
          }
          if (waPhone && waConsent && team?.whatsapp_enabled === true) {
            sendAppointmentWhatsAppSafe({
              phone: waPhone,
              optIn: true,
              kind: 'confirmation',
              patientId: visit.patient_id,
              visitId: appt?.id,
              patientFirstName: patient?.first_name || patientName?.split(' ')[0],
              ...apptFields,
            }).then(res => {
              if (res.ok) notify?.('WhatsApp confirmation sent', 'success')
              else if (!res.skipped) notify?.(`WhatsApp not sent: ${res.error}`, 'error')
            })
          }
        })
      }
      // Grey out the confirmed slot immediately
      setBooked(prev => [...prev, selectedSlot])
      setSlot(null)
      onBooked(appt)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const selectedHospital = hospitals.find(h => h.id === selectedHospitalId)

  return (
    <ModalShell onClose={onClose}>
      <div className="glass-rim w-full max-w-lg rounded-3xl p-2.5 max-h-[90vh] flex flex-col">
        <div className="surface-shell flex-1 min-h-0">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <div>
            <h2 className="font-bold text-base text-gray-900">Book Appointment</h2>
            <p className="text-xs text-gray-500">{patientName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Date picker row */}
        <div className="px-5 pb-3 flex-shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1 mb-2">Date</p>
          <div className="flex items-center gap-2">
            <button
              onClick={prevDay}
              disabled={date <= todayStr()}
              className="w-8 h-8 rounded-xl bg-black/[0.06] flex items-center justify-center hover:bg-black/10 transition-colors disabled:opacity-30"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <input
              type="date"
              value={date}
              min={todayStr()}
              onChange={e => setDate(e.target.value)}
              className="flex-1 px-3 py-2 text-sm rounded-xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
            />
            <button
              onClick={nextDay}
              className="w-8 h-8 rounded-xl bg-black/[0.06] flex items-center justify-center hover:bg-black/10 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
        </div>

        {/* Slot grid */}
        <div className="px-5 pb-3 overflow-y-auto flex-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-800">{formattedDate}</p>
            {!loadingSlots && (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[11px] text-green-600">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  {availableCount} available
                </span>
                <span className="flex items-center gap-1 text-[11px] text-blue-500">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                  {bookedCount} booked
                </span>
              </div>
            )}
          </div>

          {loadingSlots ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <div className="w-4 h-4 border-2 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin" />
              <span className="text-xs text-gray-400">Loading slots…</span>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {ALL_TIME_SLOTS.map(slot => {
                const isBooked   = bookedSlots.includes(slot)
                const isSelected = selectedSlot === slot
                return (
                  <button
                    key={slot}
                    onClick={() => !isBooked && setSlot(isSelected ? null : slot)}
                    disabled={isBooked}
                    className={`rounded-2xl px-2 py-3 text-left transition-all border ${
                      isBooked
                        ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-60'
                        : isSelected
                          ? 'bg-ios-blue border-ios-blue text-white shadow-ios-card'
                          : 'bg-green-50 border-green-100 hover:bg-green-100'
                    }`}
                  >
                    <p className={`text-xs font-bold leading-tight ${isBooked ? 'text-gray-400' : isSelected ? 'text-white' : 'text-green-700'}`}>
                      {fmtSlot(slot)}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${isBooked ? 'text-gray-400' : isSelected ? 'text-white/80' : 'text-green-500'}`}>
                      {isBooked ? 'Booked' : 'Available'}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Hospital picker — appears after slot selected */}
        {selectedSlot && hospitals.length > 1 && (
          <div className="px-5 pb-3 flex-shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1 mb-2">Location</p>
            <div className="flex gap-2 flex-wrap">
              {hospitals.filter(h => h.is_active !== false).map(h => {
                const isActive = selectedHospitalId === h.id
                const color = h.color || '#3B82F6'
                return (
                  <button
                    key={h.id}
                    onClick={() => setHospitalId(h.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border"
                    style={{
                      backgroundColor: isActive ? color : color + '15',
                      borderColor: isActive ? color : color + '40',
                      color: isActive ? '#fff' : color,
                    }}
                  >
                    {h.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Notes + actions */}
        <div className="px-5 pb-5 space-y-3 flex-shrink-0 border-t border-black/[0.05] pt-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-ios-gray-1 mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Reason for follow-up…"
              className="w-full px-3 py-2 text-sm rounded-xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30 resize-none"
            />
          </div>

          {/* Email reminder — add for patients without one, or show the address on file */}
          {patient?.id && !patient.email && (
            <div className="p-3 rounded-2xl bg-blue-50/80 border border-blue-100">
              <p className="text-xs font-medium text-blue-700 mb-2">
                📧 Add email for a confirmation? <span className="font-normal text-blue-400">(optional)</span>
              </p>
              <input
                type="email"
                placeholder="e.g. patient@email.com"
                value={bookingEmail}
                onChange={e => setBookingEmail(e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-xl border border-blue-200 bg-white focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
              />
              <p className="text-[10px] text-blue-400 mt-1">Skip to book without — you can add it later from the Patients list.</p>
            </div>
          )}
          {patient?.id && patient.email && (
            <div className="p-3 rounded-2xl bg-white/80 border border-gray-100">
              <p className="text-xs text-gray-500">
                📧 A confirmation will be sent to <span className="font-semibold text-gray-700">{patient.email}</span>
              </p>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-2xl text-sm font-semibold bg-black/[0.06] text-gray-700 hover:bg-black/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={submitting || !selectedSlot}
              className="flex-1 py-2.5 rounded-2xl text-sm font-semibold bg-ios-blue text-white disabled:opacity-40 transition-opacity shadow-ios-card"
            >
              {submitting
                ? 'Booking…'
                : selectedSlot
                  ? `Confirm ${fmtSlot(selectedSlot)}${selectedHospital ? ` · ${selectedHospital.name}` : ''}`
                  : 'Select a slot'}
            </button>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 justify-center pt-1">
            {[
              { color: 'bg-green-400', label: 'Available' },
              { color: 'bg-ios-blue', label: 'Selected' },
              { color: 'bg-gray-300', label: 'Booked' },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1 text-[10px] text-gray-400">
                <span className={`w-2 h-2 rounded-full ${color}`} />
                {label}
              </span>
            ))}
          </div>
        </div>
        </div>
      </div>
    </ModalShell>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Outpatient() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [visits, setVisits] = useState([])
  const [hospitals, setHospitals] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [selectedDoctor, setSelectedDoctor] = useState(null)  // null = all doctors
  const [selectedHospital, setSelectedHospital] = useState(null)

  // Modals
  const [bookingVisit, setBookingVisit] = useState(null)
  const [showNewVisitModal, setShowNewVisitModal] = useState(false)
  const [toast, setToast] = useState(null)
  function showToast(message, type = 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Expandable cards
  const [expandedVisitId, setExpandedVisitId] = useState(null)
  const [interactionsCache, setInteractionsCache] = useState({})
  const [closeVisitModal, setCloseVisitModal] = useState(null)  // visit object being closed, or null
  const [postCloseVisit, setPostCloseVisit] = useState(null)    // just-closed visit → offer a follow-up booking
  const [closingVisitId, setClosingVisitId] = useState(null)
  const [actionsOpenVisitId, setActionsOpenVisitId] = useState(null)

  const [allPatientNotes, setAllPatientNotes] = useState({})
  const [addingNoteVisitId, setAddingNoteVisitId] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)
  const [servicesCache, setServicesCache] = useState({})
  const [addServiceModal, setAddServiceModal] = useState(null)  // null | { visitId, hospitalId }
  const [serviceSearch, setServiceSearch] = useState('')
  const [teamServices, setTeamServices] = useState([])
  const [addingServiceId, setAddingServiceId] = useState(null)
  const [selectedServices, setSelectedServices] = useState([])

  useEffect(() => {
    if (!user?.team_id) return
    Promise.all([
      fetchHospitals(user.team_id),
      fetchMembersWithPositions(user.team_id),
      fetchTeamServices(user.team_id),
    ]).then(([h, t, s]) => {
      setHospitals(h || [])
      setTeamMembers(t || [])
      setTeamServices(s || [])
    }).catch(err => { console.error(err); showToast('Failed to load hospitals/doctors/services.') })
  }, [user?.team_id])

  const loadVisits = useCallback(async () => {
    if (!user?.team_id) return
    setLoading(true)
    try {
      const today = todayStr()
      // Today's encounters plus any still-open ("seen") visits from a prior day that
      // haven't been closed yet — a visit must not vanish from the queue just because
      // midnight passed before the doctor closed it.
      const [todayData, openData] = await Promise.all([
        fetchOutpatientVisitsFiltered(
          user.team_id,
          null,
          null,
          today,
          today,
          true,
        ),
        fetchOpenOutpatientVisits(user.team_id),
      ])
      const merged = new Map()
      for (const v of todayData || []) merged.set(v.id, v)
      for (const v of openData || []) merged.set(v.id, v)
      setVisits(Array.from(merged.values()))
    } catch (err) {
      console.error(err)
      showToast('Failed to load visits — pull to refresh or try again.')
    } finally {
      setLoading(false)
    }
  }, [user?.team_id])

  useEffect(() => { loadVisits() }, [loadVisits])

  async function handleExpandVisit(visit) {
    if (expandedVisitId === visit.id) {
      setExpandedVisitId(null)
      return
    }
    setExpandedVisitId(visit.id)
    setAddingNoteVisitId(null)

    let visitIds = []
    if (!interactionsCache[visit.patient_id]) {
      try {
        const interactions = await fetchPatientInteractions(visit.patient_id)
        setInteractionsCache(prev => ({ ...prev, [visit.patient_id]: interactions }))
        visitIds = interactions.filter(e => e.kind === 'visit').map(e => e.id)
      } catch (err) {
        console.error(err)
        showToast('Failed to load visit history for this patient.')
        visitIds = [visit.id]
      }
    } else {
      visitIds = interactionsCache[visit.patient_id].filter(e => e.kind === 'visit').map(e => e.id)
    }
    if (visitIds.length === 0) visitIds = [visit.id]

    if (!Object.prototype.hasOwnProperty.call(allPatientNotes, visit.patient_id)) {
      fetchAllPatientVisitNotes(visit.patient_id, visitIds)
        .then(notes => setAllPatientNotes(prev => ({ ...prev, [visit.patient_id]: notes })))
        .catch(() => setAllPatientNotes(prev => ({ ...prev, [visit.patient_id]: [] })))
    }

    if (!Object.prototype.hasOwnProperty.call(servicesCache, visit.id)) {
      setServicesCache(prev => ({ ...prev, [visit.id]: visit.visit_services || [] }))
    }
  }

  async function handleCloseVisit(visitOrId) {
    const visit = typeof visitOrId === 'object' ? visitOrId : { id: visitOrId }
    setClosingVisitId(visit.id)
    try {
      const updated = await closeVisit(visit.id)
      setVisits(prev => prev.map(v => v.id === updated.id ? { ...v, status: 'closed' } : v))
      setCloseVisitModal(null)
      setExpandedVisitId(null)
      // Offer an immediate follow-up booking (which also sends the confirmation email)
      if (visit.hospital_id) setPostCloseVisit({ ...visit, status: 'closed' })
    } catch (err) {
      console.error(err)
      showToast('Failed to close the visit — please try again.')
    } finally {
      setClosingVisitId(null)
    }
  }

  function handleBooked(appt) {
    setBookingVisit(null)
    setVisits(prev => [appt, ...prev])
  }

  async function handleVisitCreated() {
    setInteractionsCache({})
    setAllPatientNotes({})
    setServicesCache({})
    await loadVisits()
  }

  async function handleAddNote(visitId, patientId) {
    if (!noteText.trim()) return
    setSubmittingNote(true)
    try {
      await addVisitNote(visitId, noteText.trim(), user.id)
      setNoteText('')
      setAddingNoteVisitId(null)
      const cached = interactionsCache[patientId] || []
      const visitIds = cached.filter(e => e.kind === 'visit').map(e => e.id)
      const ids = visitIds.length > 0 ? visitIds : [visitId]
      const refreshed = await fetchAllPatientVisitNotes(patientId, ids)
      setAllPatientNotes(prev => ({ ...prev, [patientId]: refreshed }))
    } catch (err) {
      console.error(err)
      showToast('Failed to save the note — please try again.')
    } finally {
      setSubmittingNote(false)
    }
  }

  async function handleAddService(visitId, svc) {
    setAddingServiceId(svc.id)
    try {
      const added = await addVisitService(visitId, svc.service_name, svc.price ?? null)
      setServicesCache(prev => ({ ...prev, [visitId]: [...(prev[visitId] || []), added] }))
      setAddServiceModal(null)
      setServiceSearch('')
    } catch (err) {
      console.error(err)
      showToast('Failed to add the service — please try again.')
    } finally {
      setAddingServiceId(null)
    }
  }

  async function handleDeleteService(visitId, serviceId) {
    try {
      await deleteVisitService(serviceId)
      setServicesCache(prev => ({
        ...prev,
        [visitId]: (prev[visitId] || []).filter(s => s.id !== serviceId),
      }))
    } catch (err) {
      console.error(err)
      showToast('Failed to remove the service — please try again.')
    }
  }

  async function handleAddSelectedServices() {
    if (!addServiceModal || selectedServices.length === 0) return
    setAddingServiceId('multi')
    try {
      const added = await Promise.all(
        selectedServices.map(svc =>
          addVisitService(addServiceModal.visitId, svc.service_name, svc.price ?? null)
        )
      )
      setServicesCache(prev => ({
        ...prev,
        [addServiceModal.visitId]: [...(prev[addServiceModal.visitId] || []), ...added],
      }))
      setAddServiceModal(null)
      setSelectedServices([])
      setServiceSearch('')
    } catch (err) {
      console.error('Failed to add services:', err)
      showToast('Failed to add the selected services — please try again.')
    } finally {
      setAddingServiceId(null)
    }
  }

  // Only show hospital pills that appear in today's visits
  const hospitalPills = hospitals.filter(h => visits.some(v => v.hospital_id === h.id))

  // Client-side filter for the displayed visit list; visits itself stays unfiltered for counts
  const filteredVisits = visits.filter(v =>
    (selectedDoctor   ? v.doctor_id === selectedDoctor   : true) &&
    (selectedHospital ? v.hospital_id        === selectedHospital : true)
  )

  return (
    <div className="flex flex-col min-h-full">
      <TopHeader title="Outpatient" />
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* Page sub-header: date label + New Visit button — always rendered */}
      <div className="px-5 pt-3 pb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">Today</p>
          <p className="text-xs text-ios-gray-1">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button
          onClick={() => setShowNewVisitModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-ios-blue text-white text-sm font-medium shadow-ios-card"
        >
          <Plus size={15} />
          <span className="hidden sm:inline">New Visit</span>
        </button>
      </div>

      {/* Filters panel */}
      <div className="px-5 pb-4 space-y-3">
        {/* Doctor filter */}
        {teamMembers.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1 mb-2">Doctor</p>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedDoctor(null)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  selectedDoctor === null ? 'bg-ios-blue text-white' : 'bg-black/[0.06] text-gray-600 hover:bg-black/10'
                }`}
              >
                All
                {countSeen(visits, null, selectedHospital) > 0 && (
                  <span className={`text-[9px] font-bold rounded-full px-1.5 ${
                    selectedDoctor === null ? 'bg-white/25 text-white' : 'bg-black/10 text-gray-500'
                  }`}>{countSeen(visits, null, selectedHospital)}</span>
                )}
              </button>
              {teamMembers.filter(doc => doc.is_clinical === true).map(doc => {
                const isDocActive = selectedDoctor === doc.id
                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDoctor(isDocActive ? null : doc.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                      isDocActive ? 'bg-ios-blue text-white' : 'bg-black/[0.06] text-gray-600 hover:bg-black/10'
                    }`}
                  >
                    {doc.full_name}
                    {countSeen(visits, doc.id, selectedHospital) > 0 && (
                      <span className={`text-[9px] font-bold rounded-full px-1.5 ${
                        isDocActive ? 'bg-white/25 text-white' : 'bg-black/10 text-gray-500'
                      }`}>{countSeen(visits, doc.id, selectedHospital)}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Hospital filter */}
        {hospitalPills.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1 mb-2">Hospital</p>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedHospital(null)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  !selectedHospital ? 'bg-ios-blue text-white' : 'bg-black/[0.06] text-gray-600 hover:bg-black/10'
                }`}
              >
                All
                {countSeen(visits, selectedDoctor, null) > 0 && (
                  <span className={`text-[9px] font-bold rounded-full px-1.5 ${
                    !selectedHospital ? 'bg-white/25 text-white' : 'bg-black/10 text-gray-500'
                  }`}>{countSeen(visits, selectedDoctor, null)}</span>
                )}
              </button>
              {hospitalPills.map(h => {
                const base = h.color || '#3B82F6'
                const isActive = selectedHospital === h.id
                const cnt = countSeen(visits, selectedDoctor, h.id)
                return (
                  <button
                    key={h.id}
                    onClick={() => setSelectedHospital(isActive ? null : h.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all text-white flex items-center gap-1.5"
                    style={{ backgroundColor: isActive ? base : base + '60' }}
                  >
                    {h.name}
                    {cnt > 0 && (
                      <span className="text-[9px] font-bold rounded-full px-1.5 bg-white/25">{cnt}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Visit list */}
      <div className="flex-1 px-4 pb-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="border border-gray-200 rounded-3xl bg-white/70 h-24 animate-pulse" />)}
          </div>
        ) : filteredVisits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-3xl bg-ios-blue/10 flex items-center justify-center">
              <Stethoscope size={24} className="text-ios-blue" />
            </div>
            <p className="text-sm text-ios-gray-1">No visits today</p>
          </div>
        ) : (() => {
          const hospitalMap = Object.fromEntries(hospitals.map(h => [h.id, h]))
          return groupVisitsByPatient(filteredVisits).map(visit => {
            const patient = visit.patients
            const age = calcAge(patient?.date_of_birth)
            const patientName = patient
              ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unknown'
              : 'Unknown'
            const initials = [patient?.first_name?.[0], patient?.last_name?.[0]]
              .filter(Boolean).map(s => s.toUpperCase()).join('') || '?'
            const accentColor = visit.hospitals?.color || '#007AFF'
            const visitTimeStr = visit.visit_time
              ? new Date(visit.visit_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
              : null
            const isExpanded = expandedVisitId === visit.id
            const isOwn = visit.doctor_id === user?.id || user?.role === 'admin'
            const canAct = isOwn && visit.status !== 'closed' && visit.status !== 'scheduled'
            const isClosing = closingVisitId === visit.id
            const interactions = interactionsCache[visit.patient_id] ?? null

            return (
              <div
                key={visit.id}
                className="rounded-3xl overflow-hidden ring-2 ring-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
                style={{ backgroundColor: accentColor + '08' }}
              >
                {/* ── HEADER ── */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => handleExpandVisit(visit)}
                  style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${darken(accentColor)} 100%)` }}
                >
                  {/* ROW 1: avatar | name | status + chevron */}
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/25 backdrop-blur flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white break-words leading-tight uppercase">{patientName}</p>
                      {visit.patient_hospital_id && (
                        <p className="text-white/60 text-xs mt-0.5">#{visit.patient_hospital_id}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <p className="text-white/70 text-xs capitalize">{visit.status}</p>
                        <span className="text-white/70">
                          {isExpanded
                            ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="18 15 12 9 6 15"/></svg>
                            : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><polyline points="6 9 12 15 18 9"/></svg>
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ROW 2: age + hospital | visit date + time */}
                  <div className="mt-2 flex items-center justify-between text-white/80 text-xs">
                    <div className="flex items-center gap-1">
                      {age !== null && <span>{age} yrs</span>}
                      {age !== null && visit.hospitals?.name && <span className="mx-0.5">·</span>}
                      {visit.hospitals?.name && <span>{visit.hospitals.name}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {visit.visit_date && (
                        <div className="flex items-center gap-1">
                          <Calendar size={11} className="text-white/70 flex-shrink-0" />
                          <span>{formatDate(visit.visit_date)}</span>
                        </div>
                      )}
                      {visitTimeStr && (
                        <div className="flex items-center gap-1">
                          <Clock size={11} className="text-white/70 flex-shrink-0" />
                          <span>{visitTimeStr}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── EXPANDED CONTENT ── */}
                <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[3000px]' : 'max-h-0'}`}>
                  <div className="p-4 space-y-3" style={{ backgroundColor: accentColor + '08' }}>

                    {/* ── VISIT TIMELINE sub-card ── */}
                    <section
                      className="rounded-3xl border border-white/50"
                      style={{ backgroundColor: accentColor + '20', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                    >
                      <div className="p-4">
                        <p className="text-xs font-bold tracking-wide" style={{ color: accentColor }}>VISIT TIMELINE</p>
                      </div>
                      <div className="px-4 pb-4 border-t border-white/30">
                        {interactions === null ? (
                          <div className="flex items-center gap-2 py-2">
                            <div className="w-4 h-4 border-2 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin" />
                            <span className="text-xs text-gray-400">Loading…</span>
                          </div>
                        ) : interactions.length === 0 ? (
                          <p className="text-xs text-gray-400 py-1">No interactions yet</p>
                        ) : (
                          <div>
                            {interactions.map((entry, i) => {
                              const dotColor = entry.hospitalColor || hospitalMap[entry.hospital_id]?.color || '#3B82F6'
                              const entryHospital = entry.hospitalName || hospitalMap[entry.hospital_id]?.name || null
                              const isNow = entry.kind === 'visit' && entry.id === visit.id
                              const isLast = i === interactions.length - 1
                              const entryTime = entry.time
                                ? new Date(entry.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                                : null
                              return (
                                <div key={`${entry.kind}-${entry.id}`} className="flex gap-2.5 pt-2">
                                  <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                                    <div
                                      className="w-2.5 h-2.5 rounded-full border-[1.5px] border-white flex-shrink-0"
                                      style={{ backgroundColor: dotColor }}
                                    />
                                    {!isLast && (
                                      <div className="w-px flex-1 bg-ios-gray-4 mt-1" style={{ minHeight: '1.5rem' }} />
                                    )}
                                  </div>
                                  <div className={`flex-1 min-w-0 ${!isLast ? 'pb-1' : ''}`}>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-semibold text-gray-800">
                                        {entry.kind === 'admission'
                                          ? `🏥 Admitted${entry.ward ? ` · ${entry.ward}` : ''}`
                                          : '🩺 Outpatient visit'}
                                      </span>
                                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${getOutpatientStatusStyle(entry.status)}`}>
                                        {entry.status}
                                      </span>
                                      {isNow && <span className="text-[10px] text-ios-blue font-semibold">← now</span>}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                      {entryHospital && <span className="text-[10px] text-gray-400">{entryHospital}</span>}
                                      <span className="text-[10px] text-gray-400">
                                        {formatDate(entry.date)}
                                        {entry.kind === 'admission' && entry.discharge_date
                                          ? ` → ${formatDate(entry.discharge_date)}`
                                          : entryTime ? ` · ${entryTime}` : ''}
                                      </span>
                                      {entry.serviceCount > 0 && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/[0.06] text-gray-500">
                                          {entry.serviceCount} service{entry.serviceCount !== 1 ? 's' : ''}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </section>

                    {/* ── SERVICES sub-card ── */}
                    {(() => {
                      const visitServices = servicesCache[visit.id] ?? null
                      const svcTotal = (visitServices || []).reduce((s, sv) => s + Number(sv.price || 0), 0)
                      return (
                        <section
                          className="rounded-3xl border border-white/50"
                          style={{ backgroundColor: accentColor + '20', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                        >
                          <div className="p-4">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold tracking-wide" style={{ color: accentColor }}>
                                SERVICES{visitServices?.length ? ` (${visitServices.length})` : ''}
                              </p>
                              {svcTotal > 0 && (
                                <span className="text-[13px] font-bold tabular-nums text-gray-900">
                                  {formatKES(svcTotal)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="px-4 pb-4 border-t border-white/30">
                            {visitServices === null ? (
                              <div className="flex items-center gap-1.5 py-2">
                                <div className="w-3 h-3 border-2 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin" />
                                <span className="text-xs text-gray-400">Loading…</span>
                              </div>
                            ) : (
                              <div>
                                {visitServices.length === 0 && (
                                  <p className="text-[11px] text-gray-400 pt-2 pb-1">No services yet</p>
                                )}
                                {visitServices.map(svc => (
                                  <div key={svc.id} className="flex items-center gap-2 justify-between py-1.5">
                                    <div className="w-2 h-2 rounded-full flex-shrink-0 bg-purple-400" />
                                    <span className="text-[12px] font-semibold text-gray-800 flex-1">{svc.service_name}</span>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {svc.price != null && (
                                        <span className="text-[12px] font-bold text-ios-blue tabular-nums">
                                          {formatKES(svc.price)}
                                        </span>
                                      )}
                                      {canAct && (
                                        <button
                                          onClick={e => { e.stopPropagation(); handleDeleteService(visit.id, svc.id) }}
                                          className="text-ios-gray-1 hover:text-red-500 transition-colors"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {visitServices.length > 0 && (
                                  <div className="pt-2 mt-1 border-t border-white/30">
                                    <div className="flex justify-between items-center pt-1">
                                      <span className="text-xs font-semibold text-gray-700">Total</span>
                                      <span className="font-bold text-sm tabular-nums" style={{ color: accentColor }}>
                                        {formatKES(svcTotal)}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </section>
                      )
                    })()}

                    {/* ── NOTES sub-card ── */}
                    {(() => {
                      const allNotes = Object.prototype.hasOwnProperty.call(allPatientNotes, visit.patient_id)
                        ? allPatientNotes[visit.patient_id]
                        : null
                      const isAddingNote = addingNoteVisitId === visit.id
                      return (
                        <section
                          className="rounded-3xl border border-white/50"
                          style={{ backgroundColor: accentColor + '20', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
                        >
                          <div className="p-4">
                            <p className="text-xs font-bold tracking-wide" style={{ color: accentColor }}>
                              NOTES — ALL VISITS{allNotes?.length ? ` (${allNotes.length})` : ''}
                            </p>
                          </div>
                          <div className="px-4 pb-4 border-t border-white/30">
                            {allNotes === null ? (
                              <div className="flex items-center gap-2 py-2">
                                <div className="w-4 h-4 border-2 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin" />
                                <span className="text-xs text-gray-400">Loading…</span>
                              </div>
                            ) : (
                              <div>
                                {allNotes.map((note, i) => {
                                  const visitInfo = note.outpatient_visits
                                  const visitDate = visitInfo?.visit_date
                                  const visitHospital = visitInfo?.hospitals?.name
                                  const noteDate = new Date(note.created_at)
                                  const noteDateStr = noteDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                  const noteTimeStr = noteDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                                  const isLast = i === allNotes.length - 1
                                  return (
                                    <div key={note.id} className="flex gap-2.5 pt-2">
                                      <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                                        <div
                                          className="w-2.5 h-2.5 rounded-full border-[1.5px] border-white flex-shrink-0"
                                          style={{ backgroundColor: accentColor }}
                                        />
                                        {!isLast && (
                                          <div className="w-px flex-1 bg-ios-gray-4 mt-1" style={{ minHeight: '1.5rem' }} />
                                        )}
                                      </div>
                                      <div className={`flex-1 min-w-0 ${!isLast ? 'pb-1' : ''}`}>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-xs font-semibold text-gray-800">
                                            {noteDateStr} · {noteTimeStr}
                                          </span>
                                        </div>
                                        {(visitDate || visitHospital) && (
                                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            <span className="text-[10px] text-gray-400">
                                              Visit: {visitDate ? formatDate(visitDate) : ''}
                                              {visitHospital ? ` · ${visitHospital}` : ''}
                                            </span>
                                          </div>
                                        )}
                                        <p className="text-[13px] mt-1 leading-snug text-gray-800">"{note.note_text}"</p>
                                      </div>
                                    </div>
                                  )
                                })}
                                {allNotes.length === 0 && !isAddingNote && (
                                  <p className="text-xs text-gray-400 pt-2 pb-1">No notes yet</p>
                                )}
                              </div>
                            )}
                            {isAddingNote && (
                              <div className="mt-2 space-y-2">
                                <textarea
                                  value={noteText}
                                  onChange={e => setNoteText(e.target.value)}
                                  rows={2}
                                  autoFocus
                                  placeholder="Type a note…"
                                  className="w-full px-3 py-2 text-sm rounded-xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30 resize-none"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => { setAddingNoteVisitId(null); setNoteText('') }}
                                    className="flex-1 py-1.5 text-xs font-semibold rounded-xl bg-black/[0.06] text-gray-600"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleAddNote(visit.id, visit.patient_id)}
                                    disabled={submittingNote || !noteText.trim()}
                                    className="flex-1 py-1.5 text-xs font-semibold rounded-xl bg-ios-blue text-white disabled:opacity-50"
                                  >
                                    {submittingNote ? 'Saving…' : 'Save'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </section>
                      )
                    })()}

                    {/* ── ACTIONS + COLLAPSE row — exactly two children ── */}
                    <div className="flex items-center pt-1 pb-1 gap-2">
                      {canAct && (
                        <button
                          onClick={e => { e.stopPropagation(); setActionsOpenVisitId(prev => prev === visit.id ? null : visit.id) }}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-500 bg-gray-100/80 hover:bg-gray-200/80 border border-gray-200/60 transition-all duration-200"
                        >
                          <span className="tracking-widest text-gray-400">•••</span>
                          <span>Actions</span>
                          <span className={`text-[9px] transition-transform duration-300 inline-block ${actionsOpenVisitId === visit.id ? 'rotate-180' : ''}`}>▾</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleExpandVisit(visit)}
                        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-500 bg-gray-100/80 hover:bg-gray-200/80 border border-gray-200/60 transition-all duration-200"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                          <polyline points="18 15 12 9 6 15"/>
                        </svg>
                        Collapse
                      </button>
                    </div>

                    {/* Staggered action buttons */}
                    {canAct && (
                      <div className={`overflow-hidden transition-all duration-300 ease-out ${actionsOpenVisitId === visit.id ? 'max-h-24 opacity-100 mt-0 pointer-events-auto' : 'max-h-0 opacity-0 mt-0 pointer-events-none'}`}>
                        <div className="overflow-visible pb-2">
                          <div className="flex items-center gap-2 flex-nowrap overflow-x-auto scrollbar-none pb-1">
                            {[
                              {
                                onClick: () => { navigate(`/patients?highlight=${visit.patient_id}`); setActionsOpenVisitId(null) },
                                title: 'Patient Record',
                                colorClass: 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-100',
                                icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
                              },
                              {
                                onClick: () => { setAddingNoteVisitId(visit.id); setNoteText(''); setActionsOpenVisitId(null) },
                                title: 'Add note',
                                colorClass: 'bg-gray-100 hover:bg-gray-200 text-gray-600 border-gray-200',
                                icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
                              },
                              {
                                onClick: () => { setAddServiceModal({ visitId: visit.id, hospitalId: visit.hospital_id }); setSelectedServices([]); setActionsOpenVisitId(null) },
                                title: 'Add service',
                                colorClass: 'bg-gray-100 hover:bg-gray-200 text-gray-600 border-gray-200',
                                icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>,
                              },
                              ...(visit.hospital_id ? [{
                                onClick: () => { setBookingVisit(visit); setActionsOpenVisitId(null) },
                                title: 'Book appointment',
                                colorClass: 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-100',
                                icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
                              }] : []),
                              {
                                onClick: () => {
                                  if (!Object.prototype.hasOwnProperty.call(servicesCache, visit.id)) {
                                    setServicesCache(prev => ({ ...prev, [visit.id]: visit.visit_services || [] }))
                                  }
                                  setCloseVisitModal(visit)
                                  setActionsOpenVisitId(null)
                                },
                                title: 'Close visit',
                                colorClass: 'bg-red-50 hover:bg-red-100 text-red-500 border-red-100',
                                icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
                              },
                            ].map((btn, i) => (
                              <button
                                key={i}
                                onClick={btn.onClick}
                                title={btn.title}
                                style={{ transitionDelay: actionsOpenVisitId === visit.id ? `${i * 35}ms` : '0ms' }}
                                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex-shrink-0 flex items-center justify-center border transition-all duration-[250ms] ease-out hover:scale-110 active:scale-95
                                  ${actionsOpenVisitId === visit.id ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-3 scale-75 opacity-0'}
                                  ${btn.colorClass}`}
                              >
                                {btn.icon}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              </div>
            )
          })
        })()}
      </div>

      {/* Booking modal */}
      {bookingVisit && (
        <BookingModal
          visit={bookingVisit}
          teamId={user.team_id}
          userId={user.id}
          hospitals={hospitals}
          onClose={() => setBookingVisit(null)}
          onBooked={handleBooked}
          notify={showToast}
        />
      )}

      {/* Post-close: offer an immediate follow-up booking (also sends the confirmation email) */}
      {postCloseVisit && (() => {
        const p = postCloseVisit.patients
        const name = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Patient' : 'Patient'
        return (
          <ModalShell onClose={() => setPostCloseVisit(null)} maxWidth="max-w-sm">
            <div className="glass-rim rounded-3xl p-2.5">
              <div className="surface-shell p-6 text-center">
                <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-gray-900">Visit Closed</h3>
                <p className="text-xs text-gray-500 mt-1 mb-5">
                  {name}{p?.email ? ` · a confirmation goes to ${p.email}` : ''}
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => { setBookingVisit(postCloseVisit); setPostCloseVisit(null) }}
                    className="w-full py-2.5 rounded-2xl text-sm font-semibold bg-ios-blue text-white shadow-ios-card transition-opacity hover:opacity-90"
                  >
                    Book Follow-up Appointment
                  </button>
                  <button
                    onClick={() => setPostCloseVisit(null)}
                    className="w-full py-2.5 rounded-2xl text-sm font-semibold bg-black/[0.06] text-gray-700 hover:bg-black/10 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </ModalShell>
        )
      })()}

      {/* Log Outpatient Visit modal — scan-first, stamped "now", no date/slot picker.
          (The appointment-booking NewVisitModal lives on the Appointments page.) */}
      <LogVisitModal
        open={showNewVisitModal}
        onClose={() => setShowNewVisitModal(false)}
        hospitals={hospitals}
        teamMembers={teamMembers}
        onVisitCreated={handleVisitCreated}
      />

      {/* Close Visit modal — billing guard: review the bill (and add services if needed) before closing.
          Rendered BEFORE the Add Service modal below so that, when "+ Add Service" is used from
          inside this modal, the Add Service modal mounts later in the DOM and paints on top (both
          share ModalShell's fixed z-index, so stacking order = mount order). */}
      {closeVisitModal && (() => {
        const visit = closeVisitModal
        const visitServices = servicesCache[visit.id] ?? (visit.visit_services || [])
        const total = visitServices.reduce((sum, sv) => sum + Number(sv.price || 0), 0)
        const isClosing = closingVisitId === visit.id
        const patientName = visit.patients ? `${visit.patients.first_name} ${visit.patients.last_name}` : 'Patient'
        return (
          <ModalShell onClose={() => setCloseVisitModal(null)} maxWidth="max-w-sm">
            <div className="glass-rim rounded-3xl p-2.5">
              <div className="surface-shell p-6">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-bold text-gray-900">Close Visit</h3>
                  <button
                    onClick={() => setCloseVisitModal(null)}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-4">{patientName} · review the bill before closing</p>

                <div className="rounded-2xl border border-gray-100 bg-gray-50/60 max-h-56 overflow-y-auto">
                  {visitServices.length === 0 ? (
                    <p className="text-sm text-ios-gray-1 text-center py-6">No services added</p>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {visitServices.map(svc => (
                        <div key={svc.id} className="flex items-center gap-2 justify-between px-3 py-2.5">
                          <span className="text-sm font-medium text-gray-800 flex-1">{svc.service_name}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {svc.price != null && (
                              <span className="text-sm font-semibold text-ios-blue tabular-nums">
                                {formatKES(svc.price)}
                              </span>
                            )}
                            <button
                              onClick={() => handleDeleteService(visit.id, svc.id)}
                              className="text-ios-gray-1 hover:text-red-500 transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between px-1 mt-3">
                  <span className="text-xs font-semibold text-gray-500">Total</span>
                  <span className="text-base font-bold text-gray-900 tabular-nums">{formatKES(total)}</span>
                </div>

                <button
                  onClick={() => { setAddServiceModal({ visitId: visit.id, hospitalId: visit.hospital_id }); setSelectedServices([]) }}
                  className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold text-ios-blue bg-ios-blue/10 hover:bg-ios-blue/15 transition-colors"
                >
                  + Add Service
                </button>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setCloseVisitModal(null)}
                    className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleCloseVisit(visit)}
                    disabled={isClosing}
                    className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-gray-800 text-white hover:bg-gray-900 transition-colors disabled:opacity-50"
                  >
                    {isClosing ? 'Closing…' : 'Confirm & Close'}
                  </button>
                </div>
              </div>
            </div>
          </ModalShell>
        )
      })()}

      {/* Add Service modal — mounted after Close Visit above so it stacks on top when opened from within it */}
      {addServiceModal && (
        <ModalShell onClose={() => { setAddServiceModal(null); setServiceSearch(''); setSelectedServices([]) }}>
          <div className="glass-rim rounded-3xl p-2.5 w-full max-w-sm mx-4">
            <div className="surface-shell p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Add Service</h3>
              <button
                onClick={() => { setAddServiceModal(null); setServiceSearch(''); setSelectedServices([]) }}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <input
              autoFocus
              value={serviceSearch}
              onChange={e => setServiceSearch(e.target.value)}
              placeholder="Search services…"
              className="w-full px-3 py-2 text-sm rounded-xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/30 mb-3"
            />
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {(() => {
                const filtered = teamServices.filter(s =>
                  !serviceSearch || s.service_name.toLowerCase().includes(serviceSearch.toLowerCase())
                )
                if (teamServices.length === 0) {
                  return <p className="text-sm text-ios-gray-1 text-center py-4">No services configured</p>
                }
                if (filtered.length === 0) {
                  return <p className="text-sm text-ios-gray-1 text-center py-4">No matches</p>
                }
                return filtered.map(svc => {
                  const isChecked = !!selectedServices.find(s => s.id === svc.id)
                  return (
                    <button
                      key={svc.id}
                      onClick={() => {
                        setSelectedServices(prev =>
                          prev.find(s => s.id === svc.id)
                            ? prev.filter(s => s.id !== svc.id)
                            : [...prev, svc]
                        )
                      }}
                      disabled={!!addingServiceId}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors disabled:opacity-50 ${
                        isChecked ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                        isChecked ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                      }`}>
                        {isChecked && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="flex-1 text-sm font-medium text-gray-800">{svc.service_name}</span>
                      {svc.price != null && (
                        <span className="text-sm font-semibold text-blue-600 tabular-nums">
                          {formatKES(svc.price)}
                        </span>
                      )}
                    </button>
                  )
                })
              })()}
            </div>
            {selectedServices.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">
                    {selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} selected
                  </span>
                  <span className="text-sm font-bold text-blue-600 tabular-nums">
                    {formatKES(selectedServices.reduce((sum, s) => sum + Number(s.price || 0), 0))}
                  </span>
                </div>
                <button
                  onClick={handleAddSelectedServices}
                  disabled={!!addingServiceId}
                  className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {addingServiceId ? 'Adding…' : `Add ${selectedServices.length} Service${selectedServices.length > 1 ? 's' : ''}`}
                </button>
              </div>
            )}
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  )
}
