import { useState, useEffect } from 'react'
import {
  FileText, Trash2,
  ChevronDown, ChevronUp,
  Clock, Building2, CalendarDays, Pencil,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import RevenueValue from './RevenueValue'
import { dischargePatient, deleteAdmission, fetchAdmissionServices, deleteAdmissionService } from '../lib/api'
import { logActivity } from '../lib/activityLog'
import { buildWardLines, wardColor } from '../lib/billing'
import { calcAge, darken, formatKES } from '../lib/utils'

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtNoteDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtServiceDateTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Africa/Nairobi',
  })
}

function daysBetween(from, to) {
  return Math.max(1, Math.ceil((new Date(to) - new Date(from)) / 86400000))
}

function calculateDaysBetween(startDateStr) {
  if (!startDateStr) return 0
  const start = new Date(startDateStr)
  const end = new Date()
  start.setUTCHours(0, 0, 0, 0)
  end.setUTCHours(0, 0, 0, 0)
  const diffTime = Math.abs(end - start)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  return Math.max(1, diffDays)
}

// ── component ─────────────────────────────────────────────────────────────────

export default function PatientCard({ admission, isExpanded, isNew, onToggleExpand, onRefresh, onAddNotes, onAddServices, onTransfer, onInvoice, onEditTimeline }) {
  const { user, permissions } = useAuth()
  const [deletingSvcId, setDeletingSvcId] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [confirmModal, setConfirmModal] = useState(null)

  const { patients: patient, hospitals: hospital } = admission

  const notes = [...(admission.patient_notes || [])].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  )

  const [admissionServices, setAdmissionServices] = useState([])
  const [notesExpanded, setNotesExpanded] = useState(false)
  const [stayExpanded, setStayExpanded] = useState(false)

  const loadServices = () =>
    fetchAdmissionServices(admission.id)
      .then(data => setAdmissionServices(
        [...(data || [])].sort((a, b) => new Date(a.added_at) - new Date(b.added_at))
      ))
      .catch(err => { console.error(err); setActionError('Failed to load billing details — try expanding the card again.') })

  useEffect(() => { loadServices() }, [admission.id])

  useEffect(() => {
    if (!isExpanded) {
      setStayExpanded(false)
      setNotesExpanded(false)
      setActionsOpen(false)
    }
  }, [isExpanded])

  const admissionServicesTotal = admissionServices.reduce((s, svc) => s + Number(svc.price), 0)

  const wardLines = buildWardLines(admission)

  const age     = calcAge(patient?.date_of_birth)
  const days    = calculateDaysBetween(admission.team_start_date || admission.admission_date)
  const shortId = admission.id.slice(0, 8).toUpperCase()
  const initials = [patient?.first_name, patient?.last_name]
    .filter(Boolean).map(n => n[0].toUpperCase()).join('') || '?'

  const billingBreakdown = (() => {
    const items = []

    // Ward rows derive from timeline_events segments (single source of truth).
    // Each stay segment is its own row — mirrors the Stay Timeline exactly, and an
    // ICU→General→ICU readmit correctly shows two separate ICU rows.
    wardLines.filter(line => !line.isCorrection).forEach(line => {
      items.push({ type: 'ward', name: line.ward, days: line.days, rate: line.rate, total: line.total })
    })

    // Non-ward service charges (admission_services table)
    admissionServices.forEach(svc => {
      items.push({
        type: 'service',
        id: svc.id,
        name: svc.service_name,
        total: Number(svc.price || 0),
        billingType: svc.billing_type || 'one-off',
        serviceAt: svc.service_at || svc.added_at || null,
      })
    })

    return items
  })()

  // Calculate totals from billingBreakdown (not from database wardTotal)
  const wardTotal = billingBreakdown.filter(item => item.type === 'ward').reduce((s, item) => s + item.total, 0)
  const grandTotal = billingBreakdown.reduce((s, item) => s + item.total, 0)

  const isActive = admission.status === 'admitted'

  const handleDischarge = () => {
    setConfirmModal({
      title: 'Discharge Patient',
      message: `Discharge ${patient?.first_name} ${patient?.last_name}? This will stop billing and close their admission. Their records will remain accessible in the Patients page.`,
      danger: false,
      onConfirm: async () => {
        setConfirmModal(null)
        setIsProcessing(true)
        setActionError(null)
        const result = await dischargePatient(admission.id)
        setIsProcessing(false)
        if (result.success) {
          await logActivity({
            user, action: 'discharge', entityType: 'admission', entityId: admission.id,
            patientId: patient?.id, patientName: `${patient?.first_name} ${patient?.last_name}`,
          })
          onRefresh?.()
        }
        else { setActionError('Failed to discharge patient. Please try again.') }
      },
    })
  }

  async function handleDeleteService(svcId) {
    setConfirmModal({
      title: 'Remove Service Charge',
      message: 'Remove this service charge? This cannot be undone.',
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null)
        setDeletingSvcId(svcId)
        setActionError(null)
        try {
          await deleteAdmissionService(svcId)
          await logActivity({
            user, action: 'delete_service', entityType: 'service', entityId: svcId,
            patientId: patient?.id, patientName: `${patient?.first_name} ${patient?.last_name}`,
          })
          loadServices()
        } catch (e) {
          setActionError(e.message || 'Failed to remove service charge.')
        } finally {
          setDeletingSvcId(null)
        }
      },
    })
  }

  const handleDeletePatient = () => {
    setConfirmModal({
      title: 'Delete Record',
      message: `Delete ${patient?.first_name} ${patient?.last_name}? This will archive their record. Use this only for test or erroneous entries.`,
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null)
        setIsProcessing(true)
        setActionError(null)
        const result = await deleteAdmission(admission.id)
        setIsProcessing(false)
        if (result.success) {
          await logActivity({
            user, action: 'archive', entityType: 'patient', entityId: patient?.id,
            patientId: patient?.id, patientName: `${patient?.first_name} ${patient?.last_name}`,
          })
          onRefresh?.()
        }
        else { setActionError('Failed to delete record. Please try again.') }
      },
    })
  }

  const accentColor = hospital?.color || '#007AFF'

  return (
    <>
      {/* ── OUTER CARD ─────────────────────────────────────────────────────── */}
      <div
        className="rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.08)] ring-2 ring-white/60 cursor-pointer"
        style={{ backgroundColor: accentColor + '08' }}
        onClick={() => onToggleExpand?.(admission.id)}
      >
        {/* ── HEADER ───────────────────────────────────────────────────────── */}
        <div
          className="pt-3 pb-2 px-4"
          style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${darken(accentColor, 45)} 100%)` }}
        >
          {/* ROW 1: avatar | name | total + chevron */}
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/25 backdrop-blur flex items-center justify-center">
              <span className="text-white font-semibold text-sm">{initials}</span>
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white break-words leading-tight uppercase">
                {patient?.first_name} {patient?.last_name}
              </p>
              {isNew && (
                <span className="inline-block mt-1.5 px-2 py-0.5 bg-white/25 text-white text-[9px] font-bold rounded-full tracking-wide">
                  NEW
                </span>
              )}
            </div>

            {/* Total + inline chevron */}
            <div className="flex-shrink-0 text-right">
              <div className="flex items-center justify-end gap-1.5">
                <p className="text-white/70 text-xs">Total (Live)</p>
                <button
                  onClick={e => { e.stopPropagation(); onToggleExpand?.(admission.id) }}
                  className="text-white/70 hover:text-white transition-colors p-0.5"
                >
                  {isExpanded
                    ? <ChevronUp size={14} />
                    : <ChevronDown size={14} />}
                </button>
              </div>
              <RevenueValue tone="light" className="text-sm font-semibold">
                <p className="text-lg font-bold text-white tabular-nums">
                  {formatKES(grandTotal)}
                </p>
              </RevenueValue>
            </div>
          </div>

          {/* ROW 2: hospital ID left, age/DOB right — spans full card width */}
          <div className="mt-1.5 pb-2 flex items-center justify-between text-white/80 text-xs">
            <span>#{admission.patient_hospital_id || shortId}</span>
            {patient?.date_of_birth && (
              <div className="flex items-center gap-1">
                <CalendarDays size={11} className="text-white/70 flex-shrink-0" />
                <span>
                  {age !== null ? `${age} yrs · ` : ''}
                  {new Date(patient.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── EXPANDED CONTENT ─────────────────────────────────────────────── */}
        <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[3000px]' : 'max-h-0'}`}>
          <div className="p-4 space-y-3">

            {/* 1. HOSPITAL ROW */}
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: accentColor + '20' }}
              >
                <Building2 size={20} style={{ color: accentColor }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 text-sm">{admission.ward || 'Ward'}</p>
                <p className="text-gray-500 text-xs">{hospital?.name || 'Hospital'}</p>
                {patient?.insurance_name && (
                  <p className="text-xs text-gray-400 mt-0.5">{patient.insurance_name}</p>
                )}
              </div>
            </div>

            {/* 2. STAY TIMELINE */}
            <section
              className="rounded-3xl border border-white/50"
              style={{ backgroundColor: accentColor + '20', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
            >
              <div className="flex items-center gap-2 w-full p-4">
                <button
                  onClick={e => { e.stopPropagation(); setStayExpanded(prev => !prev) }}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  <Clock size={13} style={{ color: accentColor }} className="flex-shrink-0" />
                  <span className="text-xs font-bold tracking-wide flex-1" style={{ color: accentColor }}>
                    STAY TIMELINE
                  </span>
                </button>
                {wardLines.length > 0 && (
                  <button
                    onClick={e => { e.stopPropagation(); onEditTimeline?.(admission) }}
                    title="Edit stay timeline"
                    className="p-1 rounded-full hover:bg-black/5 transition-colors flex-shrink-0"
                  >
                    <Pencil size={13} style={{ color: accentColor }} />
                  </button>
                )}
                <button
                  onClick={e => { e.stopPropagation(); setStayExpanded(prev => !prev) }}
                  className="p-1 flex-shrink-0"
                >
                  <ChevronDown
                    size={13}
                    className={`transition-transform duration-200 ${stayExpanded ? 'rotate-180' : ''}`}
                    style={{ color: accentColor }}
                  />
                </button>
              </div>

              {stayExpanded && (
                <div className="px-4 pb-4 border-t border-white/30">
                  {wardLines.length > 0 ? (
                    <>
                      {wardLines.map((line, i) => (
                        <div key={`wardline-${i}`} className="flex gap-3 pt-3">
                          <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                            <div
                              className="w-2.5 h-2.5 rounded-full border-[1.5px] border-white"
                              style={{ backgroundColor: line.isCorrection ? '#9ca3af' : wardColor(line.ward) }}
                            />
                            {(i < wardLines.length - 1 || isActive) && (
                              <div className="w-px flex-1 bg-ios-gray-4 mt-1" style={{ minHeight: '2rem' }} />
                            )}
                          </div>
                          <div className={`flex-1 ${(i < wardLines.length - 1 || isActive) ? 'pb-2' : ''}`}>
                            {line.isCorrection ? (
                              <>
                                <p className="text-[12px] font-medium text-ios-gray-2 italic leading-tight">
                                  Initially recorded as {line.ward}
                                </p>
                                <p className="text-[11px] text-ios-gray-2 mt-0.5">
                                  Corrected{line.correctedTo ? ` to ${line.correctedTo}` : ''} same day · not billed
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-100 leading-tight">
                                  {line.label}
                                </p>
                                {line.rate > 0 ? (
                                  <p className="text-[11px] text-ios-gray-1 mt-0.5">
                                    {line.days}d · {formatKES(line.rate)}/day
                                    {line.isCurrent && isActive && (
                                      <span className="ml-1.5 text-ios-green font-medium">(current)</span>
                                    )}
                                  </p>
                                ) : (
                                  <p className="text-[11px] text-ios-gray-2 mt-0.5">Rate not configured</p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                      {isActive && (
                        <div className="flex gap-3 pt-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-ios-green animate-pulse flex-shrink-0 mt-0.5" />
                          <p className="text-[12px] font-semibold text-ios-green">
                            Active · {days} day{days !== 1 ? 's' : ''} total
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-[11px] text-ios-gray-2 pt-3">No stay data yet</p>
                  )}
                </div>
              )}
            </section>

            {/* 3. BILLING BREAKDOWN */}
            <section
              className="rounded-3xl border border-white/50"
              style={{ backgroundColor: accentColor + '20', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-bold tracking-wide text-gray-700">BILLING BREAKDOWN</p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500"/>
                    <RevenueValue>
                      <p className="font-bold text-gray-900 text-sm">
                        {formatKES(grandTotal)}
                      </p>
                    </RevenueValue>
                  </div>
                </div>

                {billingBreakdown.length === 0 ? (
                  <p className="text-[11px] text-ios-gray-2 py-1">No billing records yet</p>
                ) : (
                  <div>
                    {billingBreakdown.map((row, i) => (
                      <div key={row.type === 'ward' ? `ward-${i}` : `svc-${row.id}`}>
                        {i > 0 && <div className="border-t border-white/40 my-1" />}
                        <div className="flex items-center gap-3 py-2">
                          <div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center flex-shrink-0">
                            {row.type === 'ward'
                              ? <Building2 size={16} style={{ color: wardColor(row.name) }} />
                              : <FileText size={16} className="text-purple-500" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-gray-900">{row.name}</p>
                            {row.type === 'ward' ? (
                              <p className="text-[11px] text-gray-500">
                                {row.days}d @ {formatKES(row.rate)}/day
                              </p>
                            ) : (
                              <>
                                {row.serviceAt && (
                                  <p className="text-[11px] text-gray-500">{fmtServiceDateTime(row.serviceAt)}</p>
                                )}
                                {row.billingType && (
                                  <p className="text-[11px] text-gray-400">({row.billingType})</p>
                                )}
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <RevenueValue className="text-[12px]">
                              <span className="text-[12px] font-bold text-[#007AFF] tabular-nums">
                                {formatKES(row.total)}
                              </span>
                            </RevenueValue>
                            {row.type === 'service' && isActive && permissions?.can_edit_billing === true && (
                              <button
                                onClick={e => { e.stopPropagation(); handleDeleteService(row.id) }}
                                disabled={deletingSvcId === row.id}
                                className="text-ios-red hover:opacity-70 transition-opacity disabled:opacity-40"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-white/40 mt-2 pt-3 flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-900">
                    Total{isActive ? ' (live)' : ''}
                  </span>
                  <RevenueValue variant="block">
                    <span
                      className="rounded-xl px-3 py-1.5 text-sm font-bold tabular-nums"
                      style={{ backgroundColor: accentColor + '30', color: darken(accentColor, 20) }}
                    >
                      {formatKES(grandTotal)}
                    </span>
                  </RevenueValue>
                </div>
              </div>
            </section>

            {/* 4. NOTES */}
            {notes.length > 0 && (
              <section
                className="rounded-3xl border border-white/50"
                style={{ backgroundColor: accentColor + '20', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
              >
                <button
                  onClick={e => { e.stopPropagation(); setNotesExpanded(prev => !prev) }}
                  className="flex items-center gap-2 w-full text-left p-4"
                >
                  <span className="text-xs font-bold tracking-wide text-gray-700 flex-1">
                    NOTES ({notes.length})
                  </span>
                  <ChevronDown
                    size={13}
                    className={`text-gray-500 transition-transform duration-200 ${notesExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {notesExpanded && (
                  <div className="px-4 pb-4 border-t border-white/30">
                    <div className="pt-3 space-y-0">
                      {notes.map((note, i) => (
                        <div key={note.id} className="flex gap-2.5">
                          <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                            <div className="w-2 h-2 rounded-full border-[1.5px] border-ios-blue bg-white dark:bg-ios-blue flex-shrink-0" />
                            {i < notes.length - 1 && (
                              <div className="w-px flex-1 bg-ios-gray-4 my-1" style={{ minHeight: '1.5rem' }} />
                            )}
                          </div>
                          <div className={`flex-1 ${i < notes.length - 1 ? 'pb-3' : ''}`}>
                            <p className="text-[11px] font-semibold text-ios-gray-1 leading-tight">
                              {note.signature || note.users?.full_name || 'Unknown'}
                              <span className="font-normal"> — {fmtNoteDate(note.created_at)}</span>
                            </p>
                            <p className="text-[13px] mt-1 leading-snug text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
                              "{note.note_text}"
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* 5. ACTIONS + COLLAPSE */}
            <div className="flex items-center pt-1 pb-1 gap-2">
              {isActive && (
                <button
                  onClick={e => { e.stopPropagation(); setActionsOpen(prev => !prev) }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-500 bg-gray-100/80 hover:bg-gray-200/80 border border-gray-200/60 transition-all duration-200"
                >
                  <span className="tracking-widest text-gray-400">•••</span>
                  <span>Actions</span>
                  <span className={`text-[9px] transition-transform duration-300 inline-block ${actionsOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>
              )}
              <button
                onClick={e => { e.stopPropagation(); onToggleExpand?.(admission.id) }}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-500 bg-gray-100/80 hover:bg-gray-200/80 border border-gray-200/60 transition-all duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <polyline points="18 15 12 9 6 15"/>
                </svg>
                Collapse
              </button>
            </div>

            {/* No overflow-hidden — lets hover:scale-110 breathe. pointer-events-none when closed. */}
            {isActive && (
              <div className={`transition-all duration-300 ease-out ${actionsOpen ? 'max-h-24 opacity-100 mt-3 pointer-events-auto' : 'max-h-0 opacity-0 mt-0 pointer-events-none'}`}>
                <div className="overflow-visible pb-2">
                  <div className="flex items-center gap-2 sm:gap-2.5 flex-nowrap overflow-x-auto scrollbar-none pb-1">
                    {[
                      ...(permissions?.can_transfer === true ? [{
                        onClick: () => onTransfer?.(admission),
                        title: 'Transfer ward',
                        colorClass: 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-100',
                        disabled: isProcessing,
                        icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>,
                      }] : []),
                      ...(permissions?.can_view_revenue === true ? [{
                        onClick: () => onInvoice?.(admission),
                        title: 'View invoice',
                        colorClass: 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-100',
                        disabled: isProcessing,
                        icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
                      }] : []),
                      {
                        onClick: () => onAddNotes?.(admission),
                        title: 'Add note',
                        colorClass: 'bg-gray-100 hover:bg-gray-200 text-gray-600 border-gray-200',
                        disabled: isProcessing,
                        icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
                      },
                      ...(permissions?.can_edit_billing === true ? [{
                        onClick: () => onAddServices?.(admission, loadServices),
                        title: 'Add service',
                        colorClass: 'bg-gray-100 hover:bg-gray-200 text-gray-600 border-gray-200',
                        disabled: isProcessing,
                        icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>,
                      }] : []),
                      ...(permissions?.can_discharge === true ? [{
                        onClick: handleDischarge,
                        title: 'Discharge patient',
                        colorClass: 'bg-green-50 hover:bg-green-100 text-green-600 border-green-100',
                        disabled: isProcessing,
                        icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
                      }] : []),
                      {
                        onClick: handleDeletePatient,
                        title: 'Delete record',
                        colorClass: 'bg-red-50 hover:bg-red-100 text-red-500 border-red-100',
                        disabled: isProcessing,
                        icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
                      },
                    ].map((btn, i) => (
                      <button
                        key={i}
                        onClick={e => { e.stopPropagation(); btn.onClick() }}
                        title={btn.title}
                        disabled={btn.disabled}
                        style={{ transitionDelay: actionsOpen ? `${i * 35}ms` : '0ms' }}
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex-shrink-0 flex items-center justify-center border transition-all duration-[250ms] ease-out hover:scale-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
                          ${actionsOpen ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-3 scale-75 opacity-0'}
                          ${btn.colorClass}`}
                      >
                        {btn.icon}
                      </button>
                    ))}
                  </div>
                </div>
                {actionError && (
                  <p className="text-xs text-red-500 mt-2">{actionError}</p>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── CONFIRM MODAL ────────────────────────────────────────────────────── */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.25)' }}
        >
          <div className="glass-rim rounded-3xl p-2.5 max-w-sm w-full mx-4">
            <div className="surface-shell p-6">
            <h3 className="text-base font-bold text-gray-900 mb-2">{confirmModal.title}</h3>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors text-white ${
                  confirmModal.danger ? 'bg-red-500 hover:bg-red-600'
                  : confirmModal.amber ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {confirmModal.confirmLabel || (confirmModal.danger ? 'Delete' : 'Discharge')}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
