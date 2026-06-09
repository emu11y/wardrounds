import { useState, useEffect } from 'react'
import {
  FileText, Plus, ArrowRight, Receipt, LogOut, Trash2,
  ChevronDown, ChevronUp, Shield, Stethoscope,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { dischargeAdmission, deleteAdmission, fetchBillingRecords } from '../lib/api'
import { formatKES } from '../lib/utils'

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

function fmtServiceDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function daysBetween(from, to) {
  return Math.max(1, Math.ceil((new Date(to) - new Date(from)) / 86400000))
}

function daysSince(d) {
  if (!d) return 0
  return Math.floor((new Date() - new Date(d)) / 86400000)
}

// Returns ward-stay segments and service charges as a flat sorted list
function buildBillingLines(admission) {
  const hospitalServices = admission.hospitals?.hospital_services || []

  const wardEvents = [...(admission.timeline_events || [])]
    .filter(ev => ev.event_type === 'admitted' || ev.event_type === 'transferred')
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  const lines = []

  wardEvents.forEach((ev, i) => {
    const ward = ev.ward || admission.ward
    const from = ev.timestamp
    const to = wardEvents[i + 1]?.timestamp ?? new Date().toISOString()
    const days = daysBetween(from, to)
    const svc = hospitalServices.find(s => s.service_name === ward)
    const rate = Number(svc?.price_per_day ?? 0)
    lines.push({
      type: 'ward',
      ward,
      label: ev.event_type === 'admitted' ? `Admitted · ${fmtShort(from)}` : `Transferred · ${fmtShort(from)}`,
      date: new Date(from),
      days,
      rate,
      total: days * rate,
      isCurrent: i === wardEvents.length - 1,
    })
  })

  for (const s of (admission.services_rendered || [])) {
    lines.push({
      type: 'service',
      label: s.hospital_services?.service_name || 'Service',
      date: new Date(s.rendered_date),
      qty: Number(s.quantity),
      unitPrice: Number(s.price_applied),
      total: Number(s.quantity) * Number(s.price_applied),
      dateStr: fmtServiceDate(s.rendered_date),
    })
  }

  lines.sort((a, b) => a.date - b.date)
  return lines
}

// ── component ─────────────────────────────────────────────────────────────────

export default function PatientCard({ admission, isExpanded, onToggleExpand, onRefresh, onAddNotes, onAddServices, onTransfer, onInvoice }) {
  const { user } = useAuth()
  const [billingOpen, setBillingOpen] = useState(true)
  const [discharging, setDischarging] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { patients: patient, hospitals: hospital } = admission

  const notes = [...(admission.patient_notes || [])].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  )
  const services = [...(admission.services_rendered || [])].sort(
    (a, b) => new Date(a.rendered_date) - new Date(b.rendered_date)
  )

  const billingLines = buildBillingLines(admission)
  const wardLines     = billingLines.filter(l => l.type === 'ward')
  const svcLines     = billingLines.filter(l => l.type === 'service')
  const svcTotal     = svcLines.reduce((s, l) => s + l.total, 0)

  const [billingRecords, setBillingRecords] = useState([])
  useEffect(() => {
    fetchBillingRecords(admission.id)
      .then(data => setBillingRecords(data || []))
      .catch(console.error)
  }, [admission.id])

  const wardTotal  = billingRecords.reduce((s, r) => s + Number(r.amount), 0)
  const grandTotal = wardTotal + svcTotal

  // Current ward's daily accrual rate
  const hospitalServices = hospital?.hospital_services || []
  const currentWardSvc   = hospitalServices.find(s => s.service_name === admission.ward)
  const dailyRate        = Number(currentWardSvc?.price_per_day ?? 0)

  const age  = calcAge(patient?.date_of_birth)
  const days = Math.max(0, daysSince(admission.team_start_date || admission.admission_date))
  const shortId = admission.id.slice(0, 8).toUpperCase()

  const isActive = admission.status === 'admitted'

  async function handleDischarge() {
    if (!confirm(`Discharge ${patient?.first_name} ${patient?.last_name}?`)) return
    setDischarging(true)
    try { await dischargeAdmission(admission.id); onRefresh?.() }
    catch (e) { alert(e.message) }
    finally { setDischarging(false) }
  }

  async function handleDelete() {
    if (!confirm('Delete this admission permanently? This cannot be undone.')) return
    setDeleting(true)
    try { await deleteAdmission(admission.id); onRefresh?.() }
    catch (e) { alert(e.message) }
    finally { setDeleting(false) }
  }

  const accentColor = hospital?.color || '#3B82F6'

  return (
    <div
      className="glass-card hover:shadow-glass-md transition-all duration-200 border-l-4"
      style={{ borderLeftColor: accentColor }}
    >

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mb-3">

        {/* Left: identity */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ios-blue to-purple-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white font-bold text-sm">
              {patient?.first_name?.[0]}{patient?.last_name?.[0]}
            </span>
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-[15px] leading-tight truncate">
              {patient?.first_name} {patient?.last_name}
            </h3>
            <p className="text-[11px] text-ios-gray-1 font-mono mt-0.5">#{shortId}</p>
            {admission.ward && (
              <span className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-md bg-ios-green/12 text-ios-green text-[11px] font-semibold tracking-wide">
                {admission.ward}
              </span>
            )}
          </div>
        </div>

        {/* Right: billing summary + chevron */}
        <div className="flex items-start gap-2 flex-shrink-0">
          <div className="text-right">
            <p className="text-[17px] font-bold tabular-nums text-gray-900 dark:text-gray-50 leading-tight">
              KES {Math.round(grandTotal).toLocaleString()}
            </p>
            <p className="text-[11px] text-ios-gray-1 mt-0.5">{days} day{days !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={onToggleExpand}
            className="mt-0.5 p-1 text-ios-gray-1 hover:text-gray-600 transition-colors"
          >
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* ── STATUS ROW ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[12px]">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            isActive ? 'bg-ios-green animate-pulse' : 'bg-ios-gray-3'
          }`} />
          <span className="font-medium text-gray-700 dark:text-gray-200">
            {admission.ward || 'Unassigned'}
            <span className="text-ios-gray-1 font-normal"> • {isActive ? 'Active' : admission.status}</span>
          </span>
        </div>
        {patient?.insurance_name && (
          <span className="flex items-center gap-1 text-[11px] text-ios-gray-1">
            <Shield size={10} />
            {patient.insurance_name}
          </span>
        )}
      </div>

      {/* ── EXPANDED DETAIL ─────────────────────────────────────────────────── */}
      <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-[2000px]' : 'max-h-0'}`}>
        <div className="border-t border-white/20 pt-4 space-y-5">

          {/* BILLING ─────────────────────────────────────────────────────────── */}
          <section>
            {/* Billing section header with collapse toggle */}
            <button
              onClick={() => setBillingOpen(v => !v)}
              className="w-full flex items-center justify-between mb-3 group"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1">
                Billing
              </span>
              <span className="text-ios-gray-1 group-hover:text-gray-600 transition-colors">
                {billingOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </span>
            </button>

            {billingOpen && (
              <div className="space-y-4">

                {/* Stay timeline */}
                <div>
                  {wardLines.map((line, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 ${
                          line.isCurrent && isActive ? 'bg-ios-green' : 'bg-ios-gray-3'
                        }`} />
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

                  {/* Active terminal dot */}
                  {isActive && (
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-ios-green animate-pulse mt-0.5" />
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold text-ios-green">
                          Active · {days} day{days !== 1 ? 's' : ''} total
                        </p>
                      </div>
                    </div>
                  )}

                  {wardLines.length === 0 && (
                    <p className="text-[11px] text-ios-gray-2">No stay data yet</p>
                  )}
                </div>

                {/* Summary rows */}
                <div className="rounded-xl bg-black/[0.03] dark:bg-white/5 divide-y divide-white/10 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ios-gray-1">Days</span>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-700 dark:text-gray-200">
                      <span className="font-bold">{days}</span>
                      <span className="text-ios-gray-3">|</span>
                      <span>{fmtDate(admission.admission_date)}</span>
                      <span className="text-ios-gray-3">|</span>
                      <span className={`font-semibold ${isActive ? 'text-ios-green' : 'text-ios-gray-1'}`}>
                        {isActive ? 'Active' : admission.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ios-gray-1">
                      Total {isActive ? '(live)' : ''}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-ios-green animate-pulse" />}
                      <span className="text-[14px] font-bold tabular-nums text-gray-900 dark:text-gray-50">
                        KES {Math.round(grandTotal).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-ios-gray-1">Ward</span>
                    <span className="font-semibold tabular-nums">
                      KES {Math.round(wardTotal).toLocaleString()}
                    </span>
                  </div>
                  {dailyRate > 0 && isActive && (
                    <p className="text-[11px] text-ios-green font-medium">
                      +KES {Math.round(dailyRate).toLocaleString()}/day (accruing)
                    </p>
                  )}
                  {svcTotal > 0 && (
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-ios-gray-1">Services</span>
                      <span className="font-semibold tabular-nums">
                        KES {Math.round(svcTotal).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* SERVICES ──────────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Stethoscope size={12} className="text-ios-blue" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1">
                Services {services.length > 0 ? `(${services.length})` : ''}
              </span>
              {services.length > 0 && (
                <span className="text-[11px] text-ios-gray-1">— {formatKES(svcTotal)}</span>
              )}
            </div>

            {services.length > 0 ? (
              <div className="space-y-1.5 mb-2.5">
                {services.map(s => (
                  <div key={s.id} className="flex items-baseline justify-between gap-2">
                    <span className="text-[12px] text-gray-700 dark:text-gray-200">
                      • {s.hospital_services?.service_name}
                      <span className="text-ios-gray-2"> ({fmtServiceDate(s.rendered_date)})</span>
                    </span>
                    <span className="text-[12px] font-semibold flex-shrink-0 tabular-nums">
                      {formatKES(Number(s.price_applied) * Number(s.quantity))}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-white/20">
                  <span className="text-[11px] text-ios-gray-1">Total</span>
                  <span className="text-[12px] font-bold text-ios-blue tabular-nums">{formatKES(svcTotal)}</span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-ios-gray-2 mb-2">No services recorded yet</p>
            )}

            {isActive && (
              <button
                onClick={() => onAddServices?.(admission)}
                className="flex items-center gap-1 text-[11px] font-semibold text-ios-blue hover:opacity-70 transition-opacity"
              >
                <Plus size={12} />Add Service
              </button>
            )}
          </section>

          {/* NOTES ─────────────────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-1.5 mb-2.5">
              <FileText size={12} className="text-ios-blue" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1">
                Notes {notes.length > 0 ? `(${notes.length})` : ''}
              </span>
            </div>

            {notes.length > 0 ? (
              <div className="mb-2.5">
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
                      <p className="text-[13px] mt-1 leading-snug text-gray-800 dark:text-gray-100">
                        "{note.note_text}"
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-ios-gray-2 mb-2">No notes yet</p>
            )}

            {isActive && (
              <button
                onClick={() => onAddNotes?.(admission)}
                className="flex items-center gap-1 text-[11px] font-semibold text-ios-blue hover:opacity-70 transition-opacity"
              >
                <Plus size={12} />Add Note
              </button>
            )}
          </section>

        </div>
      </div>

      {/* ── ACTION BUTTONS ──────────────────────────────────────────────────── */}
      {isActive && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/20">
          <ActionButton icon={ArrowRight} label="Transfer"  color="orange" onClick={() => onTransfer?.(admission)} />
          <ActionButton icon={Receipt}    label="Invoice"   color="purple" onClick={() => onInvoice?.(admission)} />
          <ActionButton icon={LogOut}     label="Discharge" color="green"  loading={discharging} onClick={handleDischarge} />
          {user?.role === 'admin' && (
            <ActionButton icon={Trash2}   label="Delete"    color="red"    loading={deleting} onClick={handleDelete} />
          )}
        </div>
      )}
    </div>
  )
}

function ActionButton({ icon: Icon, label, color, onClick, loading }) {
  const cm = {
    blue:   'text-ios-blue hover:bg-ios-blue/10',
    orange: 'text-ios-orange hover:bg-ios-orange/10',
    green:  'text-ios-green hover:bg-ios-green/10',
    purple: 'text-ios-purple hover:bg-ios-purple/10',
    red:    'text-ios-red hover:bg-ios-red/10',
  }
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium
                  transition-all active:scale-95 disabled:opacity-50 ${cm[color]}`}
    >
      <Icon size={13} />
      {loading ? '…' : label}
    </button>
  )
}
