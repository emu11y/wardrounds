import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, Loader2, ChevronDown, ChevronUp, FileDown, FileSpreadsheet, Plus, Users2, Moon, Sun, SquarePen, Copy, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchShifts, fetchPayers, fetchHospitals, fetchInvoiceRecords, upsertInvoiceRecord, deleteShift } from '../lib/api'
import {
  shiftBreakdown, shiftBreakdownLines, shiftDateLabel, shiftTimeLabel, shiftMonth, effectiveAmount,
  payerName, SHIFT_TYPES, SHIFT_TYPE_LABEL,
} from '../lib/earnings'
import { billingStatusKey as billKey, BILLING_STATUS_LABEL as BILL_LABEL } from '../lib/billing'
import { formatKES, darken } from '../lib/utils'
import { GLASS_CARD } from '../lib/theme'
import { exportRowsToExcel, exportRowsToPdf } from '../lib/exportTable'
import TopHeader from '../components/TopHeader'
import Toast from '../components/Toast'
import ActionFan from '../components/ActionFan'
import ConfirmDialog from '../components/ConfirmDialog'
import SummaryChip from '../components/SummaryChip'
import FilterPopover, { FilterSelect } from '../components/FilterPopover'
import { SubCard, useBillingDraft, BillingDetailsFields, FollowUpNote, SaveBar } from '../components/billing/BillingDetailsEditor'
import ShiftModal from '../components/shifts/ShiftModal'
import PayersModal from '../components/shifts/PayersModal'

// ─────────────────────────────────────────────────────────────────────────────
// Shift Monitor — for clinicians paid per shift (locum / sessional / on-call).
// Each shift is a card (Outpatient/Billing card design): gradient header, pay
// breakdown, and the SAME billed/paid/invoice workflow as the Billing page
// (invoice_records rows owned by a shift). All pay maths lives in lib/earnings.js.
// Clinicians see their own shifts; admins see the whole team (RLS-enforced).
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_ACCENT = '#5856D6'   // iOS indigo when a shift isn't tied to a hospital

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unbilled', label: 'Not billed' },
  { key: 'awaiting', label: 'Awaiting payment' },
  { key: 'paid', label: 'Paid' },
]

function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function ShiftCard({ shift, isMine, canMarkPaid, showClinician, actingUser, expanded, onToggle, onSaved, onEdit, onRepeat, onDelete, notify }) {
  const rec = shift.invoice_record
  const { draft, set, dirty, patch } = useBillingDraft(rec)
  const [saving, setSaving] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  useEffect(() => { if (!expanded) setActionsOpen(false) }, [expanded])

  const b = useMemo(() => shiftBreakdown(shift), [shift])
  const lines = useMemo(() => shiftBreakdownLines(shift, formatKES), [shift])
  const accent = shift.hospitals?.color || DEFAULT_ACCENT
  const night = shift.shift_type === 'night' || shift.shift_type === 'on_call'
  const payer = payerName(shift.payers)
  const day = new Date(shift.starts_at).toLocaleDateString('en-GB', { timeZone: 'Africa/Nairobi', day: 'numeric' })
  const mon = new Date(shift.starts_at).toLocaleDateString('en-GB', { timeZone: 'Africa/Nairobi', month: 'short' }).toUpperCase()

  async function save() {
    setSaving(true)
    try {
      const updated = await upsertInvoiceRecord({ shiftId: shift.id }, shift.team_id, patch, actingUser)
      onSaved(shift.id, updated)
      notify({ type: 'success', message: 'Billing updated' })
    } catch (err) {
      console.error('save shift billing:', err)
      notify({ type: 'error', message: 'Could not save: ' + (err.message || 'unknown error') })
    } finally { setSaving(false) }
  }

  return (
    <div className="rounded-3xl overflow-hidden ring-2 ring-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.08)]" style={{ backgroundColor: accent + '08' }}>
      {/* HEADER */}
      <div className="p-4 cursor-pointer" onClick={() => onToggle(shift.id)}
        style={{ background: `linear-gradient(135deg, ${accent} 0%, ${darken(accent)} 100%)` }}>
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-white/25 backdrop-blur flex flex-col items-center justify-center leading-none">
            <span className="text-white font-bold text-base">{day}</span>
            <span className="text-white/80 text-[9px] font-semibold mt-0.5">{mon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white leading-tight flex items-center gap-1.5">
              {night ? <Moon size={13} className="text-white/80" /> : <Sun size={13} className="text-white/80" />}
              {SHIFT_TYPE_LABEL[shift.shift_type]} shift{shift.hospitals?.name ? ` · ${shift.hospitals.name}` : ''}
            </p>
            <p className="text-white/70 text-xs mt-0.5">{shiftTimeLabel(shift)} · {b.hours} h</p>
          </div>
          <span className="text-white/70 flex-shrink-0">{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-white/80 text-xs">
          <span className="truncate">
            {payer ? `Paid by ${payer}` : 'Payer not set'}
            {showClinician && shift.clinician?.full_name ? ` · ${shift.clinician.full_name}` : ''}
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="px-2 py-0.5 rounded-full bg-white/20 backdrop-blur text-white text-[10px] font-semibold">{BILL_LABEL[billKey(draft)]}</span>
            <span className="font-bold tabular-nums">{formatKES(b.total)}</span>
          </div>
        </div>
      </div>

      {/* EXPANDED WORK AREA */}
      <div className={`transition-all duration-300 overflow-hidden ${expanded ? 'max-h-[3000px]' : 'max-h-0'}`}>
        <div className="p-4 space-y-3" style={{ backgroundColor: accent + '08' }}>
          <SubCard accentColor={accent} title="PAY" right={<span className="text-[13px] font-bold tabular-nums text-gray-900">{formatKES(b.total)}</span>}>
            <div className="pt-2">
              {lines.map(l => (
                <div key={l.key} className="flex items-center gap-2 justify-between py-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />
                  <span className="text-[12px] font-semibold text-gray-800 flex-1">{l.label}</span>
                  <span className="text-[12px] font-bold text-ios-blue tabular-nums">{formatKES(l.amount)}</span>
                </div>
              ))}
              {shift.notes && <p className="text-[12px] text-gray-600 mt-2 whitespace-pre-wrap">“{shift.notes}”</p>}
            </div>
          </SubCard>

          <SubCard accentColor={accent} title="BILLING DETAILS">
            <BillingDetailsFields draft={draft} set={set} canMarkPaid={canMarkPaid} systemTotal={b.total} showMode={false} />
          </SubCard>

          <SubCard accentColor={accent} title="FOLLOW-UP NOTE">
            <FollowUpNote value={draft.notes} onChange={notes => set({ notes })} placeholder="e.g. Agency invoice sent 3 Oct; chase on the 15th" />
          </SubCard>

          <SaveBar dirty={dirty} saving={saving} onSave={save} />

          {/* ACTIONS + COLLAPSE (same control as every other card) */}
          <div className="flex items-center pt-1 gap-2">
            <ActionFan
              open={actionsOpen}
              onOpenChange={setActionsOpen}
              actions={[
                ...(isMine ? [{ key: 'edit', title: 'Edit shift', icon: SquarePen, tone: 'gray', onClick: () => onEdit(shift) }] : []),
                ...(isMine ? [{ key: 'repeat', title: 'Repeat shift (today)', icon: Copy, tone: 'blue', onClick: () => onRepeat(shift) }] : []),
                ...(isMine ? [{ key: 'delete', title: 'Delete shift', icon: Trash2, tone: 'red', onClick: () => onDelete(shift) }] : []),
              ]}
            />
            <button onClick={() => onToggle(shift.id)}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold text-gray-600 bg-gray-100/80 hover:bg-gray-200/80 border border-gray-200/60 transition-all duration-200">
              <ChevronUp size={14} /> Collapse
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Shifts() {
  const { user, permissions, payModels } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [shifts, setShifts] = useState([])
  const [payers, setPayers] = useState([])
  const [hospitals, setHospitals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [modal, setModal] = useState(null)        // { shift?, template? } | null
  const [payersOpen, setPayersOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [hospitalFilter, setHospitalFilter] = useState('all')
  const [payerFilter, setPayerFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [clinicianFilter, setClinicianFilter] = useState('all')

  const loadPayers = useCallback(async () => {
    if (!user?.team_id) return
    setPayers(await fetchPayers(user.team_id, { includeArchived: true }))
  }, [user?.team_id])

  const load = useCallback(async () => {
    if (!user?.team_id) return
    setLoading(true)
    try {
      // Separate queries merged in JS (no embed on invoice_records → no schema-cache dependency).
      const [shiftRows, records, payerRows, hospitalRows] = await Promise.all([
        fetchShifts(user.team_id),
        fetchInvoiceRecords(user.team_id, 'shift'),
        fetchPayers(user.team_id, { includeArchived: true }),
        fetchHospitals(user.team_id),
      ])
      const byShift = Object.fromEntries(records.map(r => [r.shift_id, r]))
      setShifts(shiftRows.map(s => ({ ...s, invoice_record: byShift[s.id] || null })))
      setPayers(payerRows)
      setHospitals(hospitalRows || [])
      setError(null)
    } catch (err) {
      console.error('load shifts:', err)
      setError(err.message || 'Failed to load')
    } finally { setLoading(false) }
  }, [user?.team_id])

  useEffect(() => { load() }, [load])

  const handleSaved = useCallback((shiftId, updated) => {
    setShifts(prev => prev.map(s => s.id === shiftId ? { ...s, invoice_record: updated } : s))
  }, [])
  const toggle = useCallback(id => setExpandedId(prev => (prev === id ? null : id)), [])

  const myShifts = useMemo(() => shifts.filter(s => s.user_id === user?.id), [shifts, user?.id])
  const activePayers = useMemo(() => payers.filter(p => p.status === 'active'), [payers])

  // Filter option lists derived from the data.
  const months = useMemo(() => Array.from(new Set(shifts.map(shiftMonth))).sort().reverse(), [shifts])
  const clinicians = useMemo(() => {
    const m = new Map()
    for (const s of shifts) if (s.clinician?.id) m.set(s.clinician.id, s.clinician.full_name)
    return Array.from(m, ([id, name]) => ({ id, name }))
  }, [shifts])

  const baseFiltered = useMemo(() => shifts.filter(s =>
    (hospitalFilter === 'all' || (hospitalFilter === 'none' ? !s.hospital_id : s.hospital_id === hospitalFilter)) &&
    (payerFilter === 'all' || (payerFilter === 'none' ? !s.payer_id : s.payer_id === payerFilter)) &&
    (typeFilter === 'all' || s.shift_type === typeFilter) &&
    (monthFilter === 'all' || shiftMonth(s) === monthFilter) &&
    (clinicianFilter === 'all' || s.user_id === clinicianFilter)
  ), [shifts, hospitalFilter, payerFilter, typeFilter, monthFilter, clinicianFilter])

  const counts = useMemo(() => {
    let unbilled = 0, awaiting = 0, paid = 0, earned = 0, outstanding = 0, collected = 0, hours = 0
    for (const s of baseFiltered) {
      const b = shiftBreakdown(s)
      earned += b.total; hours += b.hours
      const k = billKey(s.invoice_record)
      if (k === 'unbilled') unbilled++
      else if (k === 'awaiting') { awaiting++; outstanding += effectiveAmount(s.invoice_record, b.total) }
      else { paid++; collected += effectiveAmount(s.invoice_record, b.total) }
    }
    return { total: baseFiltered.length, unbilled, awaiting, paid, earned, outstanding, collected, hours: Math.round(hours * 10) / 10 }
  }, [baseFiltered])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return baseFiltered.filter(s => {
      if (statusFilter !== 'all' && billKey(s.invoice_record) !== statusFilter) return false
      if (!q) return true
      return [s.hospitals?.name, payerName(s.payers), s.notes, s.invoice_record?.invoice_number, s.clinician?.full_name]
        .some(v => (v || '').toLowerCase().includes(q))
    })
  }, [baseFiltered, statusFilter, search])

  // One row-shape for both exports.
  const exportRows = useCallback(() => visible.map(s => {
    const b = shiftBreakdown(s), rec = s.invoice_record
    return {
      'Date': shiftDateLabel(s.starts_at),
      'Time': shiftTimeLabel(s),
      'Hours': b.hours,
      'Type': SHIFT_TYPE_LABEL[s.shift_type],
      'Hospital': s.hospitals?.name || '',
      'Payer': payerName(s.payers),
      ...(isAdmin ? { 'Clinician': s.clinician?.full_name || '' } : {}),
      'Base (KES)': b.base,
      'Overtime (KES)': b.overtime,
      'Per patient (KES)': b.perPatient,
      'Total (KES)': b.total,
      'Billed': rec?.billed ? 'Yes' : 'No',
      'Invoice #': rec?.invoice_number || '',
      'Amount billed (KES)': rec?.amount != null ? Number(rec.amount) : '',
      'Paid': rec?.paid ? 'Yes' : 'No',
      'Notes': [s.notes, rec?.notes].filter(Boolean).join(' · '),
    }
  }), [visible, isAdmin])

  const exportOpts = () => {
    const hospitalName = hospitalFilter === 'all' ? 'All hospitals' : hospitalFilter === 'none' ? 'No hospital' : (hospitals.find(h => h.id === hospitalFilter)?.name || 'Hospital')
    const payerLabel = payerFilter === 'all' ? 'All payers' : payerFilter === 'none' ? 'No payer' : payerName(payers.find(p => p.id === payerFilter))
    const monthName = monthFilter === 'all' ? 'All months' : monthLabel(monthFilter)
    return {
      fileName: `WardRounds_Shifts_${monthFilter === 'all' ? 'all' : monthFilter}`,
      filters: [
        ['Hospital', hospitalName], ['Payer', payerLabel],
        ['Shift type', typeFilter === 'all' ? 'All types' : SHIFT_TYPE_LABEL[typeFilter]],
        ['Bill status', STATUS_FILTERS.find(f => f.key === statusFilter)?.label || 'All'],
        ['Month', monthName],
      ],
    }
  }
  const exportExcel = () => exportRowsToExcel(exportRows(), { sheetName: 'Shifts', ...exportOpts() })
  const exportPdf = () => {
    const rows = exportRows()
    const sum = k => Math.round(rows.reduce((t, r) => t + (Number(r[k]) || 0), 0) * 100) / 100
    exportRowsToPdf(rows, {
      title: 'WardRounds — Shift earnings', unitLabel: 'shift(s)', ...exportOpts(),
      totals: { 'Date': 'TOTAL', 'Hours': sum('Hours'), 'Base (KES)': sum('Base (KES)'), 'Overtime (KES)': sum('Overtime (KES)'), 'Per patient (KES)': sum('Per patient (KES)'), 'Total (KES)': sum('Total (KES)') },
    })
  }

  const activeFilterCount = [hospitalFilter, payerFilter, typeFilter, statusFilter, monthFilter, clinicianFilter].filter(v => v !== 'all').length
  const clearFilters = () => { setHospitalFilter('all'); setPayerFilter('all'); setTypeFilter('all'); setStatusFilter('all'); setMonthFilter('all'); setClinicianFilter('all') }

  async function confirmDeleteShift() {
    setDeleting(true)
    try {
      await deleteShift(confirmDelete.id, user)
      setShifts(prev => prev.filter(s => s.id !== confirmDelete.id))
      setToast({ type: 'success', message: 'Shift deleted' })
      setConfirmDelete(null)
    } catch (err) {
      setToast({ type: 'error', message: 'Could not delete: ' + (err.message || 'unknown error') })
    } finally { setDeleting(false) }
  }

  const pillBtn = 'inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 backdrop-blur-xl border border-white/60 shadow-sm text-sm font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-50'

  return (
    <div className="flex flex-col min-h-full">
      <TopHeader title="Shifts" />
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="p-4 space-y-4 pb-24 sm:pb-4">
        {/* Heading + actions */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Shift Monitor</h1>
            <p className="text-sm text-gray-500">{isAdmin ? 'Team shifts, pay & payment follow-up' : 'Your shifts, pay & payment follow-up'}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setModal({})} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-ios-blue text-white text-sm font-semibold shadow-sm hover:bg-ios-blue/90">
              <Plus size={15} /> Log shift
            </button>
            <button onClick={() => setPayersOpen(true)} className={pillBtn}><Users2 size={15} /> Payers</button>
            <button onClick={exportExcel} disabled={visible.length === 0} className={pillBtn} aria-label="Export Excel" title="Export Excel"><FileSpreadsheet size={15} /><span className="hidden sm:inline">Excel</span></button>
            <button onClick={exportPdf} disabled={visible.length === 0} className={pillBtn} aria-label="Export PDF" title="Export PDF"><FileDown size={15} /><span className="hidden sm:inline">PDF</span></button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <SummaryChip label={`Shifts · ${counts.hours} h`} value={counts.total} />
          <SummaryChip label="Earned" value={formatKES(counts.earned)} tone="green" small />
          <SummaryChip label={`Awaiting (${counts.awaiting})`} value={formatKES(counts.outstanding)} tone="blue" small />
          <SummaryChip label={`Not billed (${counts.unbilled})`} value={counts.unbilled} tone="amber" />
        </div>

        {/* Search + filters */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search hospital, payer, invoice #"
              className="w-full pl-9 pr-3 py-2.5 rounded-2xl bg-white/70 border border-white/60 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-ios-blue/40" />
          </div>
          <FilterPopover open={filtersOpen} onOpenChange={setFiltersOpen} activeCount={activeFilterCount} onClear={clearFilters}>
            <FilterSelect label="Month" value={monthFilter} onChange={setMonthFilter}>
              <option value="all">All months</option>
              {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </FilterSelect>
            <FilterSelect label="Billing status" value={statusFilter} onChange={setStatusFilter}>
              {STATUS_FILTERS.map(f => {
                const n = f.key === 'unbilled' ? counts.unbilled : f.key === 'awaiting' ? counts.awaiting : f.key === 'paid' ? counts.paid : counts.total
                return <option key={f.key} value={f.key}>{f.label} ({n})</option>
              })}
            </FilterSelect>
            <FilterSelect label="Hospital" value={hospitalFilter} onChange={setHospitalFilter}>
              <option value="all">All hospitals</option>
              {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              <option value="none">Not at a hospital</option>
            </FilterSelect>
            <FilterSelect label="Payer" value={payerFilter} onChange={setPayerFilter}>
              <option value="all">All payers</option>
              {payers.map(p => <option key={p.id} value={p.id}>{payerName(p)}{p.status === 'archived' ? ' (archived)' : ''}</option>)}
              <option value="none">Payer not set</option>
            </FilterSelect>
            <FilterSelect label="Shift type" value={typeFilter} onChange={setTypeFilter}>
              <option value="all">All types</option>
              {SHIFT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </FilterSelect>
            {isAdmin && clinicians.length > 1 && (
              <FilterSelect label="Clinician" value={clinicianFilter} onChange={setClinicianFilter}>
                <option value="all">Everyone</option>
                {clinicians.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </FilterSelect>
            )}
          </FilterPopover>
        </div>

        {/* Cards */}
        {loading ? (
          <div className="py-16 flex items-center justify-center text-gray-400 text-sm gap-2"><Loader2 size={16} className="animate-spin" /> Loading shifts…</div>
        ) : error ? (
          <div className={`${GLASS_CARD} p-6 text-center`}>
            <p className="text-sm text-red-600 font-medium">Couldn't load shifts</p>
            <p className="text-xs text-gray-500 mt-1">{error}</p>
            <button onClick={load} className="mt-3 px-4 py-1.5 rounded-full bg-ios-blue text-white text-xs font-semibold">Retry</button>
          </div>
        ) : visible.length === 0 ? (
          <div className={`${GLASS_CARD} p-10 text-center`}>
            <p className="text-sm font-semibold text-gray-700">{shifts.length === 0 ? 'No shifts logged yet' : 'Nothing matches these filters'}</p>
            <p className="text-xs text-gray-400 mt-1">
              {shifts.length === 0 ? 'Log each shift you work — WardRounds totals your pay and tracks who still owes you.' : 'Try another month, payer or status, or clear your search.'}
            </p>
            {shifts.length === 0 && (
              <button onClick={() => setModal({})} className="mt-4 inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-ios-blue text-white text-sm font-semibold">
                <Plus size={15} /> Log your first shift
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {visible.map(s => (
              <ShiftCard key={s.id} shift={s}
                isMine={s.user_id === user?.id || isAdmin}
                canMarkPaid={permissions?.can_mark_paid === true || s.user_id === user?.id}
                showClinician={isAdmin}
                actingUser={user}
                expanded={expandedId === s.id} onToggle={toggle} onSaved={handleSaved}
                onEdit={shift => setModal({ shift })}
                onRepeat={shift => setModal({ template: shift })}
                onDelete={shift => setConfirmDelete(shift)}
                notify={setToast} />
            ))}
          </div>
        )}
      </div>

      {modal && (
        <ShiftModal
          shift={modal.shift || null}
          template={modal.template || null}
          defaults={payModels.find(m => m.pay_model === 'per_shift') || null}
          shifts={myShifts}
          hospitals={hospitals}
          payers={activePayers}
          actingUser={user}
          onClose={() => setModal(null)}
          onPayerCreated={p => setPayers(prev => [...prev, p])}
          onSaved={message => { setModal(null); setToast({ type: 'success', message }); load() }}
        />
      )}

      {payersOpen && (
        <PayersModal payers={payers} hospitals={hospitals} actingUser={user}
          onClose={() => setPayersOpen(false)} onChanged={async () => { await loadPayers(); load() }} />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this shift?"
          message={`${SHIFT_TYPE_LABEL[confirmDelete.shift_type]} shift on ${shiftDateLabel(confirmDelete.starts_at)} (${formatKES(shiftBreakdown(confirmDelete).total)}). It will be removed from your totals and exports.`}
          confirmLabel="Delete shift" tone="red" busy={deleting}
          onConfirm={confirmDeleteShift} onCancel={() => setConfirmDelete(null)} />
      )}
    </div>
  )
}
