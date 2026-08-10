import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, Check, Loader2, ChevronDown, ChevronUp, FileDown, FileSpreadsheet, Banknote, SlidersHorizontal } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useAuth } from '../context/AuthContext'
import { fetchAllAdmissions, fetchInvoiceRecords, upsertInvoiceRecord } from '../lib/api'
import {
  wardBillingLines, admissionGrandTotal as systemTotal,
  BILLING_MODES, BILLING_MODE_LABEL as MODE_LABEL,
  billingStatusKey as billKey, BILLING_STATUS_LABEL as BILL_LABEL,
} from '../lib/billing'
import { formatKES, formatDate, calcAge, darken, todayStr } from '../lib/utils'
import { getStatusBadgeStyle } from '../lib/statusBadges'
import { GLASS_CARD } from '../lib/theme'
import { printHtml, escapeHtml } from '../lib/print'
import TopHeader from '../components/TopHeader'
import Toast from '../components/Toast'

// Billing mode / status helpers + system total now live in lib/billing.js
// (shared with Analytics) — imported above under their page-local aliases.

const STATUS_FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'unbilled', label: 'Not billed' },
  { key: 'awaiting', label: 'Awaiting payment' },
  { key: 'paid',     label: 'Paid' },
]

// Admission-status filter options (admissions.status values).
const ADM_STATUS_FILTERS = [
  { key: 'all',        label: 'All statuses' },
  { key: 'admitted',   label: 'Active' },
  { key: 'discharged', label: 'Discharged' },
  { key: 'archived',   label: 'Archived' },
]

// The month an admission belongs to for billing follow-up: discharge month when
// discharged, otherwise admission month. Returns 'YYYY-MM' or null.
function billingMonth(a) {
  const d = a.discharge_date || a.admission_date
  return d ? String(d).slice(0, 7) : null
}

function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const fieldCls = 'w-full px-3 py-2 rounded-xl bg-white/70 border border-white/60 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-ios-blue/40'

// Accent-tinted glass sub-card, mirroring the Outpatient expanded sections
// (rounded-3xl, white/50 border, accent+'20' tint, accent-coloured title).
function SubCard({ accentColor, title, right, children }) {
  return (
    <section
      className="rounded-3xl border border-white/50"
      style={{ backgroundColor: accentColor + '20', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      <div className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold tracking-wide" style={{ color: accentColor }}>{title}</p>
          {right}
        </div>
      </div>
      <div className="px-4 pb-4 border-t border-white/30">{children}</div>
    </section>
  )
}

// One admission = one card, following the Outpatient visit-card design: gradient
// header (hospital accent), collapsed summary only; the expanded body is a work
// area of sub-cards — Charges, Billing details, Follow-up note — with one Save.
function BillingCard({ admission, canMarkPaid, expanded, onToggle, onSaved, notify }) {
  const rec = admission.invoice_record
  const sysTotal = useMemo(() => systemTotal(admission), [admission])
  const services = admission.admission_services || []
  const wardLines = useMemo(() => wardBillingLines(admission), [admission])

  const initial = () => ({
    billed: !!rec?.billed,
    paid: !!rec?.paid,
    billing_mode: rec?.billing_mode || '',
    invoice_number: rec?.invoice_number || '',
    amount: rec?.amount != null ? String(rec.amount) : '',
    notes: rec?.notes || '',
  })
  const [draft, setDraft] = useState(initial)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setDraft(initial()) }, [rec?.id, rec?.billed, rec?.paid, rec?.billing_mode, rec?.invoice_number, rec?.amount, rec?.notes])

  const dirty =
    draft.billed !== !!rec?.billed ||
    draft.paid !== !!rec?.paid ||
    draft.billing_mode !== (rec?.billing_mode || '') ||
    draft.invoice_number !== (rec?.invoice_number || '') ||
    draft.amount !== (rec?.amount != null ? String(rec.amount) : '') ||
    draft.notes !== (rec?.notes || '')

  const set = (patch) => setDraft(d => ({ ...d, ...patch }))

  async function save() {
    setSaving(true)
    try {
      const updated = await upsertInvoiceRecord(admission.id, admission.team_id, {
        billed: draft.billed, paid: draft.paid, billing_mode: draft.billing_mode,
        invoice_number: draft.invoice_number, amount: draft.amount, notes: draft.notes,
      })
      onSaved(admission.id, updated)
      notify({ type: 'success', message: 'Billing updated' })
    } catch (err) {
      console.error('save billing:', err)
      notify({ type: 'error', message: 'Could not save: ' + (err.message || 'unknown error') })
    } finally { setSaving(false) }
  }

  const patient = admission.patients
  const name = [patient?.first_name, patient?.last_name].filter(Boolean).join(' ') || 'Unknown patient'
  const initials = [patient?.first_name?.[0], patient?.last_name?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  const age = calcAge(patient?.date_of_birth)
  const accentColor = admission.hospitals?.color || '#3B82F6'
  const st = getStatusBadgeStyle(admission.status)
  const bk = billKey(draft)

  return (
    <div
      className="rounded-3xl overflow-hidden ring-2 ring-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
      style={{ backgroundColor: accentColor + '08' }}
    >
      {/* ── HEADER (collapsed summary) ── */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => onToggle(admission.id)}
        style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${darken(accentColor)} 100%)` }}
      >
        {/* ROW 1: avatar | name + IP | status + chevron */}
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/25 backdrop-blur flex items-center justify-center">
            <span className="text-white font-semibold text-sm">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white break-words leading-tight uppercase">{name}</p>
            {admission.patient_hospital_id && (
              <p className="text-white/60 text-xs mt-0.5">#{admission.patient_hospital_id}</p>
            )}
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="flex items-center justify-end gap-1.5">
              <p className="text-white/70 text-xs">{st.text}</p>
              <span className="text-white/70">
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </span>
            </div>
          </div>
        </div>

        {/* ROW 2: age · hospital | bill-status pill + discharge date + total */}
        <div className="mt-2 flex items-center justify-between text-white/80 text-xs">
          <div className="flex items-center gap-1">
            {age !== null && <span>{age} yrs</span>}
            {age !== null && admission.hospitals?.name && <span className="mx-0.5">·</span>}
            {admission.hospitals?.name && <span>{admission.hospitals.name}</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-white/20 backdrop-blur text-white text-[10px] font-semibold">
              {BILL_LABEL[bk]}
            </span>
            {admission.status === 'discharged' && admission.discharge_date && (
              <span>{formatDate(admission.discharge_date)}</span>
            )}
            <span className="font-bold tabular-nums">{formatKES(sysTotal)}</span>
          </div>
        </div>
      </div>

      {/* ── EXPANDED WORK AREA ── */}
      <div className={`transition-all duration-300 overflow-hidden ${expanded ? 'max-h-[3000px]' : 'max-h-0'}`}>
        <div className="p-4 space-y-3" style={{ backgroundColor: accentColor + '08' }}>

          {/* PATIENT DETAILS sub-card */}
          <SubCard accentColor={accentColor} title="PATIENT DETAILS">
            <div className="pt-3 grid grid-cols-2 gap-x-4 gap-y-2.5">
              {[
                ['UHID / IP No.', admission.patient_hospital_id || '—'],
                ['Full name', name],
                ['Date of birth', patient?.date_of_birth ? `${formatDate(patient.date_of_birth)}${age !== null ? ` · ${age} yrs` : ''}` : '—'],
                ['Phone', patient?.phone || '—'],
                ['Email', patient?.email || '—'],
                ['Insurance', patient?.insurance_name || '—'],
                ['Hospital', admission.hospitals?.name || '—'],
                ['Ward', admission.ward || '—'],
                ['Admitted', admission.admission_date ? formatDate(admission.admission_date) : '—'],
                ['Discharged', admission.discharge_date ? formatDate(admission.discharge_date) : '—'],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
                  <p className="text-[13px] font-medium text-gray-800 break-words">{value}</p>
                </div>
              ))}
            </div>
          </SubCard>

          {/* CHARGES sub-card */}
          <SubCard
            accentColor={accentColor}
            title={`CHARGES${services.length ? ` (${wardLines.length + services.length})` : ''}`}
            right={<span className="text-[13px] font-bold tabular-nums text-gray-900">{formatKES(sysTotal)}</span>}
          >
            {wardLines.length === 0 && services.length === 0 ? (
              <p className="text-[11px] text-gray-400 pt-2 pb-1">No charges recorded</p>
            ) : (
              <div>
                {wardLines.map((l, i) => (
                  <div key={`w${i}`} className="flex items-center gap-2 justify-between py-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
                    <span className="text-[12px] font-semibold text-gray-800 flex-1">
                      {l.ward} · {l.days} day{l.days === 1 ? '' : 's'}
                    </span>
                    <span className="text-[12px] font-bold text-ios-blue tabular-nums">{formatKES(l.total)}</span>
                  </div>
                ))}
                {services.map(s => (
                  <div key={s.id} className="flex items-center gap-2 justify-between py-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0 bg-purple-400" />
                    <span className="text-[12px] font-semibold text-gray-800 flex-1">{s.service_name}</span>
                    <span className="text-[12px] font-bold text-ios-blue tabular-nums">{formatKES(s.price)}</span>
                  </div>
                ))}
                <div className="pt-2 mt-1 border-t border-white/30">
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-xs font-semibold text-gray-700">System total</span>
                    <span className="font-bold text-sm tabular-nums" style={{ color: accentColor }}>{formatKES(sysTotal)}</span>
                  </div>
                </div>
              </div>
            )}
          </SubCard>

          {/* BILLING DETAILS sub-card (the work area) */}
          <SubCard accentColor={accentColor} title="BILLING DETAILS">
            <div className="pt-3 space-y-3">
              {/* Billed / Paid toggles */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => set({ billed: !draft.billed, paid: draft.billed ? false : draft.paid })}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                    draft.billed ? 'bg-blue-500 text-white border-blue-500' : 'bg-white/70 text-gray-600 border-white/60 hover:bg-white'
                  }`}
                >
                  <Check size={13} className={draft.billed ? 'opacity-100' : 'opacity-40'} />
                  Billed
                </button>
                <button
                  type="button"
                  disabled={!canMarkPaid}
                  onClick={() => canMarkPaid && set({ paid: !draft.paid, billed: draft.paid ? draft.billed : true })}
                  title={canMarkPaid ? undefined : 'You are not authorised to mark bills as paid'}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                    draft.paid ? 'bg-green-500 text-white border-green-500' : 'bg-white/70 text-gray-600 border-white/60 hover:bg-white'
                  } ${!canMarkPaid ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Banknote size={13} className={draft.paid ? 'opacity-100' : 'opacity-40'} />
                  Paid
                </button>
              </div>

              {/* Mode + Invoice # + Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Mode of billing</span>
                  <select value={draft.billing_mode} onChange={e => set({ billing_mode: e.target.value })} className={`${fieldCls} mt-1`}>
                    <option value="">— select —</option>
                    {BILLING_MODES.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Invoice number</span>
                  <input type="text" value={draft.invoice_number} onChange={e => set({ invoice_number: e.target.value })}
                    placeholder="e.g. HOSP-10234" className={`${fieldCls} mt-1`} />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Amount billed (KES)</span>
                  <div className="mt-1 flex items-center gap-2">
                    <input type="number" inputMode="decimal" value={draft.amount} onChange={e => set({ amount: e.target.value })}
                      placeholder={String(Math.round(sysTotal))} className={`${fieldCls} tabular-nums`} />
                    {!draft.amount && sysTotal > 0 && (
                      <button type="button" onClick={() => set({ amount: String(Math.round(sysTotal)) })}
                        className="flex-shrink-0 text-[11px] font-semibold text-ios-blue whitespace-nowrap hover:underline">
                        Use total
                      </button>
                    )}
                  </div>
                </label>
              </div>
            </div>
          </SubCard>

          {/* FOLLOW-UP NOTE sub-card */}
          <SubCard accentColor={accentColor} title="FOLLOW-UP NOTE">
            <textarea
              rows={3}
              value={draft.notes}
              onChange={e => set({ notes: e.target.value })}
              placeholder="e.g. Insurance pre-auth pending; called patient 8 Aug"
              className={`${fieldCls} mt-3 resize-none`}
            />
          </SubCard>

          {/* Save bar */}
          <div className="flex items-center justify-end gap-2">
            {dirty && <span className="text-[11px] text-gray-400">Unsaved changes</span>}
            <button
              onClick={save}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-ios-blue text-white text-xs font-semibold shadow-sm hover:bg-ios-blue/90 transition disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Billing() {
  const { user, permissions } = useAuth()
  const canMarkPaid = permissions?.can_mark_paid === true

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [hospitalTab, setHospitalTab] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [admStatusFilter, setAdmStatusFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [dischargedToday, setDischargedToday] = useState(false)

  // Mobile UX: any scroll dismisses the filters popover (it's anchored to the pill,
  // so it would otherwise float detached over the list while scrolling).
  useEffect(() => {
    if (!filtersOpen) return
    const close = () => setFiltersOpen(false)
    const scroller = document.getElementById('main-scroll')
    scroller?.addEventListener('scroll', close, { passive: true })
    window.addEventListener('scroll', close, { passive: true })
    return () => {
      scroller?.removeEventListener('scroll', close)
      window.removeEventListener('scroll', close)
    }
  }, [filtersOpen])

  const load = useCallback(async () => {
    if (!user?.team_id) return
    setLoading(true)
    try {
      // Reuse the existing all-admissions fetch; join invoice_records in JS (no PostgREST
      // embed → no schema-cache relationship dependency).
      const [admissions, records] = await Promise.all([
        fetchAllAdmissions(user.team_id),
        fetchInvoiceRecords(user.team_id),
      ])
      const byAdmission = Object.fromEntries(records.map(r => [r.admission_id, r]))
      setRows(admissions.map(a => ({ ...a, invoice_record: byAdmission[a.id] || null })))
      setError(null)
    } catch (err) {
      console.error('load billing:', err)
      setError(err.message || 'Failed to load')
    } finally { setLoading(false) }
  }, [user?.team_id])

  useEffect(() => { load() }, [load])

  const handleSaved = useCallback((admissionId, updated) => {
    setRows(prev => prev.map(r => r.id === admissionId ? { ...r, invoice_record: updated } : r))
  }, [])
  // Accordion: one card open at a time (matches Outpatient's expand behavior).
  const toggle = useCallback((id) => setExpandedId(prev => (prev === id ? null : id)), [])

  // Hospital tabs derived from the data.
  const hospitals = useMemo(() => {
    const seen = new Map()
    for (const r of rows) {
      const h = r.hospitals
      if (h?.id && !seen.has(h.id)) seen.set(h.id, { id: h.id, name: h.name, color: h.color })
    }
    return Array.from(seen.values())
  }, [rows])

  // Months present in the data (discharge month, else admission month), newest first.
  const months = useMemo(() => {
    const set = new Set()
    for (const r of rows) { const m = billingMonth(r); if (m) set.add(m) }
    return Array.from(set).sort().reverse()
  }, [rows])

  // Everything except the bill-status dimension — shared by counts and visible,
  // so the summary chips and filter badges always agree with the other filters.
  // Discharged-today helper + count (drives the quick "Today" pill).
  const isDischargedToday = useCallback(r =>
    r.status === 'discharged' && String(r.discharge_date || '').slice(0, 10) === todayStr(), [])
  const dischargedTodayCount = useMemo(() => rows.filter(isDischargedToday).length, [rows, isDischargedToday])

  const baseFiltered = useMemo(() => rows.filter(r =>
    (hospitalTab === 'all' || r.hospitals?.id === hospitalTab) &&
    (admStatusFilter === 'all' || r.status === admStatusFilter) &&
    (monthFilter === 'all' || billingMonth(r) === monthFilter) &&
    (!dischargedToday || isDischargedToday(r))
  ), [rows, hospitalTab, admStatusFilter, monthFilter, dischargedToday, isDischargedToday])

  const counts = useMemo(() => {
    let unbilled = 0, awaiting = 0, paid = 0, outstanding = 0
    for (const r of baseFiltered) {
      const k = billKey(r.invoice_record)
      if (k === 'unbilled') unbilled++
      else if (k === 'awaiting') { awaiting++; outstanding += (r.invoice_record?.amount != null ? Number(r.invoice_record.amount) : systemTotal(r)) }
      else paid++
    }
    return { total: baseFiltered.length, unbilled, awaiting, paid, outstanding }
  }, [baseFiltered])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return baseFiltered.filter(r => {
      if (statusFilter !== 'all' && billKey(r.invoice_record) !== statusFilter) return false
      if (!q) return true
      const name = [r.patients?.first_name, r.patients?.last_name].filter(Boolean).join(' ').toLowerCase()
      const inv = (r.invoice_record?.invoice_number || '').toLowerCase()
      return name.includes(q) || inv.includes(q)
    })
  }, [baseFiltered, statusFilter, search])

  // One row-shape for both exports (PDF cells and Excel sheet) — never drifts.
  const exportRows = useCallback(() => visible.map(r => {
    const rec = r.invoice_record
    return {
      'Patient': [r.patients?.first_name, r.patients?.last_name].filter(Boolean).join(' ') || 'Unknown',
      'UHID / IP No.': r.patient_hospital_id || '',
      'Status': getStatusBadgeStyle(r.status).text,
      'Hospital': r.hospitals?.name || '',
      'Ward': r.ward || '',
      'Admitted': r.admission_date ? formatDate(r.admission_date) : '',
      'Discharged': r.discharge_date ? formatDate(r.discharge_date) : '',
      'Services': (r.admission_services || []).map(s => s.service_name).join(', '),
      'System Total (KES)': Math.round(systemTotal(r)),
      'Billed': rec?.billed ? 'Yes' : 'No',
      'Mode': rec?.billing_mode ? MODE_LABEL[rec.billing_mode] : '',
      'Invoice #': rec?.invoice_number || '',
      'Amount (KES)': rec?.amount != null ? Number(rec.amount) : '',
      'Paid': rec?.paid ? 'Yes' : 'No',
      'Notes': rec?.notes || '',
    }
  }), [visible])

  const filterLabels = useCallback(() => ({
    tabName: hospitalTab === 'all' ? 'All hospitals' : (hospitals.find(h => h.id === hospitalTab)?.name || 'Hospital'),
    statusName: STATUS_FILTERS.find(f => f.key === statusFilter)?.label || 'All',
    admName: ADM_STATUS_FILTERS.find(f => f.key === admStatusFilter)?.label || 'All statuses',
    monthName: monthFilter === 'all' ? 'All months' : monthLabel(monthFilter),
  }), [hospitalTab, hospitals, statusFilter, admStatusFilter, monthFilter])

  function exportExcel() {
    const { tabName, statusName, admName, monthName } = filterLabels()
    const ws = XLSX.utils.json_to_sheet(exportRows())
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Billing')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Filter: 'Hospital', Value: tabName },
      { Filter: 'Bill status', Value: statusName },
      { Filter: 'Admission status', Value: admName },
      { Filter: 'Month', Value: monthName },
      { Filter: 'Patients', Value: visible.length },
      { Filter: 'Exported', Value: formatDate(new Date()) },
    ]), 'Filters')
    XLSX.writeFile(wb, `WardRounds_Billing_${tabName.replace(/\s+/g, '_')}_${monthFilter === 'all' ? 'all' : monthFilter}.xlsx`)
  }

  function exportPdf() {
    const { tabName, statusName, admName, monthName } = filterLabels()
    const data = exportRows()
    const head = data.length ? Object.keys(data[0]) : []
    const bodyRows = data.map(row =>
      '<tr>' + head.map(h => `<td>${escapeHtml(h.includes('KES') && row[h] !== '' ? Number(row[h]).toLocaleString() : row[h])}</td>`).join('') + '</tr>'
    ).join('')

    const extraCss =
      'h1{font-size:16px;margin:0 0 2px;} .sub{font-size:11px;color:#666;margin:0 0 10px;}' +
      'table{width:100%;border-collapse:collapse;font-size:10px;}' +
      'th,td{border:1px solid #ddd;padding:5px 6px;text-align:left;vertical-align:top;}' +
      'th{background:#f3f4f6;font-weight:700;text-transform:uppercase;font-size:9px;letter-spacing:.03em;}'
    const body =
      `<h1>WardRounds — Billing follow-up</h1>` +
      `<p class="sub">${escapeHtml(tabName)} · ${escapeHtml(admName)} · ${escapeHtml(statusName)} · ${escapeHtml(monthName)} · ${visible.length} patient(s) · ${escapeHtml(formatDate(new Date()))}</p>` +
      `<table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${bodyRows}</tbody></table>`
    printHtml(body, { title: `WardRounds_Billing_${tabName.replace(/\s+/g, '_')}`, landscape: true, extraCss })
  }

  // How many filters are away from their default — shown as a badge on the pill.
  const activeFilterCount =
    (hospitalTab !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0) +
    (admStatusFilter !== 'all' ? 1 : 0) + (monthFilter !== 'all' ? 1 : 0) +
    (dischargedToday ? 1 : 0)

  const clearFilters = () => { setHospitalTab('all'); setStatusFilter('all'); setAdmStatusFilter('all'); setMonthFilter('all'); setDischargedToday(false) }

  const selectCls = 'w-full px-3 py-2 rounded-xl bg-white/70 border border-white/60 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-ios-blue/40'

  return (
    <div className="flex flex-col min-h-full">
      <TopHeader title="Billing" />
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="p-4 space-y-4 pb-24 sm:pb-4">
        {/* Heading + exports */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Billing</h1>
            <p className="text-sm text-gray-500">Discharge billing &amp; payment follow-up</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportExcel} disabled={visible.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 backdrop-blur-xl border border-white/60 shadow-sm text-sm font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50">
              <FileSpreadsheet size={15} /> Export Excel
            </button>
            <button onClick={exportPdf} disabled={visible.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 backdrop-blur-xl border border-white/60 shadow-sm text-sm font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50">
              <FileDown size={15} /> Export PDF
            </button>
          </div>
        </div>

        {/* Summary chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className={`${GLASS_CARD} p-3`}><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Patients</p><p className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">{counts.total}</p></div>
          <div className={`${GLASS_CARD} p-3`}><p className="text-[11px] font-semibold uppercase tracking-wide text-amber-500">Not billed</p><p className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">{counts.unbilled}</p></div>
          <div className={`${GLASS_CARD} p-3`}><p className="text-[11px] font-semibold uppercase tracking-wide text-blue-500">Awaiting payment</p><p className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">{counts.awaiting}</p></div>
          <div className={`${GLASS_CARD} p-3`}><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Outstanding</p><p className="text-lg font-bold text-gray-900 mt-0.5 tabular-nums">{formatKES(counts.outstanding)}</p></div>
        </div>

        {/* Search + single Filters pill (all four dimensions live in the popover) */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search patient or invoice #"
              className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-white/70 border border-white/60 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-ios-blue/40" />
          </div>
          {/* Quick filter: patients discharged today */}
          <button
            onClick={() => setDischargedToday(v => !v)}
            title="Show patients discharged today"
            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border text-sm font-semibold shadow-sm transition ${
              dischargedToday ? 'bg-ios-blue text-white border-ios-blue' : 'bg-white/70 text-gray-700 border-white/60 hover:bg-white'}`}
          >
            Today
            <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
              dischargedToday ? 'bg-white/25 text-white' : 'bg-black/[0.06] text-gray-500'}`}>
              {dischargedTodayCount}
            </span>
          </button>
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setFiltersOpen(o => !o)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-sm font-semibold shadow-sm transition ${
                filtersOpen || activeFilterCount > 0
                  ? 'bg-ios-blue text-white border-ios-blue'
                  : 'bg-white/70 text-gray-700 border-white/60 hover:bg-white'}`}
            >
              <SlidersHorizontal size={15} />
              Filters
              {activeFilterCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-white/25 text-white text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {filtersOpen && (
              <>
                {/* click-away layer */}
                <div className="fixed inset-0 z-40" onClick={() => setFiltersOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 w-[calc(100vw-3rem)] max-w-xs bg-white/90 backdrop-blur-xl border border-white/60 rounded-2xl shadow-2xl p-4 space-y-3">
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Hospital</span>
                    <select value={hospitalTab} onChange={e => setHospitalTab(e.target.value)} className={`${selectCls} mt-1`}>
                      <option value="all">All hospitals</option>
                      {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Billing status</span>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${selectCls} mt-1`}>
                      {STATUS_FILTERS.map(f => {
                        const n = f.key === 'unbilled' ? counts.unbilled : f.key === 'awaiting' ? counts.awaiting : f.key === 'paid' ? counts.paid : counts.total
                        return <option key={f.key} value={f.key}>{f.label} ({n})</option>
                      })}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Admission status</span>
                    <select value={admStatusFilter} onChange={e => setAdmStatusFilter(e.target.value)} className={`${selectCls} mt-1`}>
                      {ADM_STATUS_FILTERS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Month</span>
                    <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className={`${selectCls} mt-1`}>
                      <option value="all">All months</option>
                      {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                    </select>
                  </label>
                  <div className="flex items-center justify-between pt-1">
                    <button onClick={clearFilters} disabled={activeFilterCount === 0}
                      className="text-xs font-semibold text-gray-400 hover:text-gray-600 disabled:opacity-40">
                      Clear all
                    </button>
                    <button onClick={() => setFiltersOpen(false)}
                      className="px-4 py-1.5 rounded-full bg-ios-blue text-white text-xs font-semibold">
                      Done
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Cards */}
        {loading ? (
          <div className="py-16 flex items-center justify-center text-gray-400 text-sm gap-2"><Loader2 size={16} className="animate-spin" /> Loading patients…</div>
        ) : error ? (
          <div className={`${GLASS_CARD} p-6 text-center`}>
            <p className="text-sm text-red-600 font-medium">Couldn't load billing</p>
            <p className="text-xs text-gray-500 mt-1">{error}</p>
            <button onClick={load} className="mt-3 px-4 py-1.5 rounded-full bg-ios-blue text-white text-xs font-semibold">Retry</button>
          </div>
        ) : visible.length === 0 ? (
          <div className={`${GLASS_CARD} p-10 text-center`}>
            <p className="text-sm font-semibold text-gray-700">{rows.length === 0 ? 'No patients yet' : 'Nothing matches these filters'}</p>
            <p className="text-xs text-gray-400 mt-1">{rows.length === 0 ? 'Admitted and discharged patients appear here for billing follow-up.' : 'Try a different hospital tab, status, month, or clear your search.'}</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {visible.map(a => (
              <BillingCard key={a.id} admission={a} canMarkPaid={canMarkPaid}
                expanded={expandedId === a.id} onToggle={toggle} onSaved={handleSaved} notify={setToast} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
