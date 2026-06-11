import { useState, useEffect } from 'react'
import {
  FileText, Plus, ArrowRight, Receipt, LogOut, Trash2,
  ChevronDown, ChevronUp, Shield, CheckCircle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { dischargePatient, deleteAdmission, pauseBilling, resumeBilling, fetchBillingRecords, fillDailyBillingGaps, fetchAdmissionServices, deleteAdmissionService } from '../lib/api'

// ── helpers ──────────────────────────────────────────────────────────────────

function calcAge(dob) {
  if (!dob) return null
  const d = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtShort(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtNoteDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
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


const WARD_COLORS = { 'ICU': '#ef4444', 'HDU': '#f97316', 'General Ward': '#22c55e' }
function wardColor(name) { return WARD_COLORS[name] || '#3b82f6' }

function buildWardLines(admission) {
  const hospitalServices = admission.hospitals?.hospital_services || []

  const wardEvents = [...(admission.timeline_events || [])]
    .filter(ev => ev.event_type === 'admitted' || ev.event_type === 'transferred')
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  return wardEvents.map((ev, i) => {
    const ward = ev.ward || admission.ward
    let from = new Date(ev.timestamp)
    let to = wardEvents[i + 1]?.timestamp ? new Date(wardEvents[i + 1].timestamp) : new Date()

    // TASK 3: Skip paused periods
    if (admission.billing_paused) {
      const pausedDate = new Date(admission.billing_paused_at)
      const nextDayAfterPause = new Date(pausedDate)
      nextDayAfterPause.setDate(nextDayAfterPause.getDate() + 1)
      nextDayAfterPause.setHours(0, 0, 0, 0)

      // Skip entire period if it starts on or after pause cutoff
      if (from >= nextDayAfterPause) {
        return null
      }
      // Truncate period if it spans the pause cutoff
      if (to > nextDayAfterPause) {
        to = new Date(pausedDate)
      }
    }

    const days = (() => {
      const f = new Date(from)
      const t = new Date(to)
      f.setUTCHours(0, 0, 0, 0)
      t.setUTCHours(0, 0, 0, 0)
      const isLast = i === wardEvents.length - 1
      // Last (current) segment: inclusive today (+1). Past segments: exclusive end (end = next segment's start).
      return isLast
        ? Math.max(1, Math.floor((t - f) / 86400000) + 1)
        : Math.max(1, Math.floor((t - f) / 86400000))
    })()
    const svc = hospitalServices.find(s => s.service_name === ward)
    const rate = Number(svc?.price_per_day ?? 0)
    return {
      ward,
      label: ev.event_type === 'admitted' ? `Admitted to ${ward} · ${fmtShort(from)}` : `Transferred to ${ward} · ${fmtShort(from)}`,
      date: new Date(from),
      days,
      rate,
      total: days * rate,
      isCurrent: i === wardEvents.length - 1,
    }
  }).filter(Boolean)
}

// ── component ─────────────────────────────────────────────────────────────────

export default function PatientCard({ admission, isExpanded, isNew, onToggleExpand, onRefresh, onAddNotes, onAddServices, onTransfer, onInvoice }) {
  const { user } = useAuth()
  const [deletingSvcId, setDeletingSvcId] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [actionsOpen, setActionsOpen] = useState(false)

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
      .catch(console.error)

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

  const [billingRecords, setBillingRecords] = useState([])
  useEffect(() => {
    if (!admission?.id) return;
    const load = async () => {
      try {
        const records = await fetchBillingRecords(admission.id)
        const base = records || []
        setBillingRecords(base)
        // Gap fill is best-effort; don't block display if it fails
        try {
          const filled = await fillDailyBillingGaps(admission, base)
          if (filled.length !== base.length) setBillingRecords(filled)
        } catch (e) {
          console.warn('fillDailyBillingGaps:', e.message)
        }
      } catch (error) {
        console.error('Error fetching billing records:', error)
        setBillingRecords([])
      }
    }
    load()
  }, [admission.id])

  const age     = calcAge(patient?.date_of_birth)
  const days    = calculateDaysBetween(admission.team_start_date || admission.admission_date)
  const shortId = admission.id.slice(0, 8).toUpperCase()

  const billingBreakdown = (() => {
    const items = []

    // Build service_id → { name, rate } map from embedded hospital services
    const hospitalServices = admission.hospitals?.hospital_services || []
    const serviceMap = {}
    hospitalServices.forEach(s => { serviceMap[s.id] = { name: s.service_name, rate: Number(s.price_per_day) } })

    // Group billing records by service_id; null service_id falls back to admission.ward
    const groups = {}
    billingRecords.forEach(r => {
      const key = r.service_id ?? '__unknown__'
      if (!groups[key]) groups[key] = []
      groups[key].push(r)
    })

    Object.entries(groups).forEach(([key, recs]) => {
      const svc = key !== '__unknown__' ? serviceMap[key] : null
      const name = svc?.name ?? admission.ward
      const rate = svc?.rate ?? 0
      const total = recs.reduce((s, r) => s + Number(r.amount), 0)
      items.push({ type: 'ward', name, days: recs.length, rate, total })
    })

    // Non-ward service charges (admission_services table)
    admissionServices.forEach(svc => {
      items.push({
        type: 'service',
        id: svc.id,
        name: svc.service_name,
        total: Number(svc.price || 0),
        billingType: svc.billing_type || 'one-off',
      })
    })

    return items
  })()

  // Calculate totals from billingBreakdown (not from database wardTotal)
  const wardTotal = billingBreakdown.filter(item => item.type === 'ward').reduce((s, item) => s + item.total, 0)
  const grandTotal = billingBreakdown.reduce((s, item) => s + item.total, 0)

  const isActive = admission.status === 'admitted'

  const handleDischarge = async () => {
    const confirmed = window.confirm(
      `Discharge ${patient?.first_name} ${patient?.last_name}? This will stop billing and close their admission. Their records will remain accessible in the Patients page.`
    )
    if (!confirmed) return
    if (isProcessing) return
    setIsProcessing(true)
    setActionError(null)
    const result = await dischargePatient(admission.id)
    setIsProcessing(false)
    if (result.success) { onRefresh?.() }
    else { setActionError('Failed to discharge patient. Please try again.') }
  }

  async function handleDeleteService(svcId) {
    if (!confirm('Remove this service charge?')) return
    setDeletingSvcId(svcId)
    try { await deleteAdmissionService(svcId); loadServices() }
    catch (e) { alert(e.message) }
    finally { setDeletingSvcId(null) }
  }

  const handlePauseBilling = async () => {
    if (isProcessing) return
    setIsProcessing(true)
    setActionError(null)

    const result = await pauseBilling(admission.id)
    if (result.success) {
      console.log('✅ Billing paused for', patient.first_name, patient.last_name)
      onRefresh?.()
    } else {
      setActionError('Failed to pause billing')
      console.error('pauseBilling error:', result.error)
    }
    setIsProcessing(false)
  }

  const handleResumeBilling = async () => {
    if (isProcessing) return
    setIsProcessing(true)
    setActionError(null)

    const result = await resumeBilling(admission.id)
    if (result.success) {
      console.log('✅ Billing resumed for', patient.first_name, patient.last_name)
      onRefresh?.()
    } else {
      setActionError('Failed to resume billing')
      console.error('resumeBilling error:', result.error)
    }
    setIsProcessing(false)
  }

  const handleDeletePatient = async () => {
    const confirmed = window.confirm(
      `Archive patient "${patient.first_name} ${patient.last_name}"?\n\nThis removes them from active list but preserves records.`
    )
    if (!confirmed) return

    if (isProcessing) return
    setIsProcessing(true)
    setActionError(null)

    const result = await deleteAdmission(admission.id)
    if (result.success) {
      console.log('✅ Patient archived:', patient.first_name, patient.last_name)
      onRefresh?.()
    } else {
      setActionError('Failed to delete patient')
      console.error('deleteAdmission error:', result.error)
    }
    setIsProcessing(false)
  }

  const accentColor = hospital?.color || '#3B82F6'

  return (
    <div
      className="glass-card hover:shadow-glass-md transition-shadow duration-200"
    >

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div
        className="-mx-4 -mt-4 px-4 pt-4 pb-3 mb-3 rounded-t-2xl"
        style={{ backgroundColor: accentColor + '18' }}
      >
      <div className="flex items-start justify-between gap-3">

        {/* Left: identity */}
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="w-1 h-10 rounded-full flex-shrink-0 self-stretch"
            style={{ backgroundColor: accentColor }}
          />
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ios-blue to-ios-purple flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">{patient?.first_name?.[0]}{patient?.last_name?.[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-gray-900 dark:text-gray-50 truncate">{patient?.first_name} {patient?.last_name}</p>
            <p className="text-[11px] text-ios-gray-1 mt-0.5">
              #{admission.patient_hospital_id || shortId}
            </p>
          </div>
        </div>

        {/* Right: total + badge */}
        <div className="text-right flex-shrink-0">
          <p className="text-[18px] font-bold tabular-nums text-gray-900 dark:text-gray-50">KES {Math.round(grandTotal).toLocaleString()}</p>
          <div className="flex items-center gap-1 justify-end mt-1">
            {isNew && <span className="px-2 py-0.5 bg-ios-blue text-white text-[9px] font-bold rounded-full">New</span>}
            <button
              onClick={() => onToggleExpand?.(admission.id)}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Ward + insurance row */}
      <div className="flex items-center justify-between gap-2 mb-3 px-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-2 py-1 text-[10px] font-bold rounded-lg text-white" style={{ backgroundColor: wardColor(admission.ward) }}>
            {admission.ward || 'Ward'}
          </span>
          <span className="text-[11px] text-ios-gray-1 truncate">{hospital?.name || 'Hospital'}</span>
        </div>
        {patient?.insurance_name && (
          <span className="text-[11px] text-ios-gray-2 flex-shrink-0">{patient.insurance_name}</span>
        )}
      </div>

      {/* ── EXPANDED CONTENT ────────────────────────────────────────────────── */}
      <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[2000px]' : 'max-h-0'}`}>
        <div className="space-y-4 pt-2 pb-3">

          {/* STAY TIMELINE ──────────────────────────────────────────────────── */}
          <section
            className="rounded-2xl border"
            style={{ backgroundColor: accentColor + '08', borderColor: accentColor + '40' }}
          >
            <button
              onClick={() => setStayExpanded(prev => !prev)}
              className="flex items-center gap-1.5 w-full text-left p-3"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1 flex-1">
                Stay Timeline
              </span>
              <ChevronDown
                size={13}
                className={`text-ios-gray-1 transition-transform duration-200 ${stayExpanded ? 'rotate-180' : ''}`}
              />
            </button>
            {stayExpanded && (
              <div className="px-3 pb-3 border-t" style={{ borderColor: accentColor + '30' }}>
                {wardLines.length > 0 ? (
                  <>
                    {wardLines.map((line, i) => (
                      <div key={`wardline-${i}`} className="flex gap-3 pt-3">
                        <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                          <div
                            className="w-2.5 h-2.5 rounded-full border-[1.5px] border-white"
                            style={{ backgroundColor: wardColor(line.ward) }}
                          />
                          {(i < wardLines.length - 1 || isActive) && (
                            <div className="w-px flex-1 bg-ios-gray-4 mt-1" style={{ minHeight: '2rem' }} />
                          )}
                        </div>
                        <div className={`flex-1 ${(i < wardLines.length - 1 || isActive) ? 'pb-2' : ''}`}>
                          <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-100 leading-tight">
                            {line.label}
                          </p>
                          {line.rate > 0 ? (
                            <p className="text-[11px] text-ios-gray-1 mt-0.5">
                              {line.days}d · KES {Math.round(line.rate).toLocaleString()}/day
                              {line.isCurrent && isActive && (
                                <span className="ml-1.5 text-ios-green font-medium">(current)</span>
                              )}
                            </p>
                          ) : (
                            <p className="text-[11px] text-ios-gray-2 mt-0.5">Rate not configured</p>
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

          {/* BILLING BREAKDOWN ───────────────────────────────────────────────── */}
          <section
            className="rounded-2xl p-3 border"
            style={{ backgroundColor: accentColor + '08', borderColor: accentColor + '40' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1">
                  Billing Breakdown
                </p>
                {admission.billing_paused && (
                  <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded">
                    PAUSED
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-ios-green animate-pulse" />}
                <span className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-gray-50">
                  KES {Math.round(grandTotal).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="bg-white/70 dark:bg-white/10 backdrop-blur-sm rounded-xl p-4 space-y-1.5">
              {billingBreakdown.length === 0 ? (
                <p className="text-[11px] text-ios-gray-2 py-1">No billing records yet</p>
              ) : billingBreakdown.map((row, i) => row.type === 'ward' ? (
                <div
                  key={`ward-${i}`}
                  className="flex items-center gap-2 justify-between py-1.5 rounded-lg"
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: wardColor(row.name) }} />
                  <div className="min-w-0 flex-1">
                    <span className="text-[12px] font-bold text-gray-800 dark:text-gray-100">{row.name}</span>
                    <span className="text-[11px] text-ios-gray-1 ml-1.5">
                      {row.days}d @ KES {Math.round(row.rate).toLocaleString()}/day
                    </span>
                  </div>
                  <span className="text-[12px] font-bold text-ios-blue tabular-nums ml-2 flex-shrink-0">
                    KES {Math.round(row.total).toLocaleString()}
                  </span>
                </div>
              ) : (
                <div
                  key={`svc-${row.id}`}
                  className="flex items-center gap-2 justify-between py-1.5 rounded-lg"
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0 bg-purple-400" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[12px] font-semibold text-gray-800 dark:text-gray-100">{row.name}</span>
                    {row.billingType && (
                      <span className="text-[10px] text-ios-gray-2 ml-1.5">({row.billingType})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[12px] font-bold text-ios-blue tabular-nums">
                      KES {Math.round(row.total).toLocaleString()}
                    </span>
                    {isActive && (
                      <button
                        onClick={() => handleDeleteService(row.id)}
                        disabled={deletingSvcId === row.id}
                        className="text-ios-red hover:opacity-70 transition-opacity disabled:opacity-40"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div
                className="my-2"
                style={{ borderTop: `1px solid ${accentColor}40` }}
              />
              <div className="flex justify-between items-center pt-1">
                <span className="text-sm font-semibold text-gray-700">
                  Total{isActive ? ' (live)' : ''}
                </span>
                <span className="font-bold text-base tabular-nums" style={{ color: accentColor }}>
                  KES {Math.round(grandTotal).toLocaleString()}
                </span>
              </div>
            </div>
          </section>

          {/* NOTES ─────────────────────────────────────────────────────────── */}
          {notes.length > 0 && (
            <section
              className="rounded-2xl border"
              style={{ backgroundColor: accentColor + '08', borderColor: accentColor + '40' }}
            >
              <button
                onClick={() => setNotesExpanded(prev => !prev)}
                className="flex items-center gap-1.5 w-full text-left p-3"
              >
                <span className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1 flex-1">
                  Notes ({notes.length})
                </span>
                <ChevronDown
                  size={13}
                  className={`text-ios-gray-1 transition-transform duration-200 ${notesExpanded ? 'rotate-180' : ''}`}
                />
              </button>

              {notesExpanded && (
                <div className="px-3 pb-3 border-t" style={{ borderColor: accentColor + '30' }}>
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

        </div>
      </div>

      {/* ── ACTIONS TOGGLE ──────────────────────────────────────────────────── */}
      {isActive && (
        <div className="mt-3 flex flex-col gap-2">
          <div>
            <button
              onClick={() => setActionsOpen(prev => !prev)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 bg-gray-100/80 hover:bg-gray-200/80 border border-gray-200/60 transition-all duration-200"
            >
              <span className="text-sm">⋯</span>
              <span>Actions</span>
              <span className={`transition-transform duration-200 text-[10px] ml-1 inline-block ${actionsOpen ? 'rotate-180' : ''}`}>▾</span>
            </button>
          </div>

          <div className={`transition-all duration-300 overflow-hidden ${actionsOpen ? 'max-h-[100px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => onTransfer?.(admission)} disabled={isProcessing}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 transition-colors disabled:opacity-50">
                → Transfer
              </button>
              <button onClick={() => onInvoice?.(admission)} disabled={isProcessing}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 transition-colors disabled:opacity-50">
                ☰ Invoice
              </button>
              <button onClick={() => onAddNotes?.(admission)} disabled={isProcessing}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200 transition-colors disabled:opacity-50">
                ✎ Note
              </button>
              <button onClick={() => onAddServices?.(admission, loadServices)} disabled={isProcessing}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200 transition-colors disabled:opacity-50">
                + Service
              </button>
              <button onClick={admission.billing_paused ? handleResumeBilling : handlePauseBilling} disabled={isProcessing}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-100 transition-colors disabled:opacity-50">
                {admission.billing_paused ? '▶ Resume' : '⏸ Pause'}
              </button>
              <button onClick={handleDischarge} disabled={isProcessing}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-green-50 hover:bg-green-100 text-green-600 border border-green-100 transition-colors disabled:opacity-50">
                ✓ Discharge
              </button>
              <button onClick={handleDeletePatient} disabled={isProcessing}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 transition-colors disabled:opacity-50">
                🗑 Delete
              </button>
            </div>
            {actionError && (
              <p className="text-xs text-red-500 mt-1">{actionError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
