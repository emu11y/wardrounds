import { useState, useEffect, useMemo } from 'react'
import { Maximize2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import TopHeader from '../components/TopHeader'
import ModalShell from '../components/ModalShell'
import {
  fetchAllAdmissions,
  fetchOutpatientVisitsFiltered,
  fetchHospitals,
  fetchTeamMembers,
} from '../lib/api'
import { computeTeamRevenueForRange } from '../lib/billing'
import { GLASS_CARD } from '../lib/theme'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import _ from 'lodash'
import * as XLSX from 'xlsx'

// ── Constants ─────────────────────────────────────────────────────────────────
const TZ = 'Africa/Nairobi'
const CARD = `${GLASS_CARD} shadow-sm`
const TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: 'none',
  background: 'rgba(255,255,255,0.95)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
}
const AXIS_TICK = { fontSize: 11, fill: '#64748b' }
const PRESETS = ['This Month', 'Last Month', 'This Quarter', 'Last Quarter', 'This Year', 'All Time']
const TABS = ['All', 'Inpatient', 'Outpatient']

// ── Pure helpers ──────────────────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0')
const fmtKES = v => `KES ${Number(v || 0).toLocaleString()}`

// Standard pill-tab treatment (matches Settings.jsx's tabCls/tabStyle pattern).
const tabCls = (active, padding = 'px-3 py-1.5') => active
  ? `text-white text-xs font-semibold ${padding} rounded-full border border-transparent transition-all whitespace-nowrap`
  : `text-slate-500 text-xs font-medium ${padding} rounded-full border border-slate-200 bg-white/60 backdrop-blur-sm transition-all whitespace-nowrap`
const tabStyle = active => active ? { background: '#007AFF' } : undefined

function nairobiParts() {
  const s = new Date().toLocaleDateString('en-CA', { timeZone: TZ })
  const [y, m] = s.split('-').map(Number)
  return { year: y, month: m, today: s }
}

function getPresetRange(preset) {
  const { year, month, today } = nairobiParts()
  switch (preset) {
    case 'This Month':
      return { from: `${year}-${pad(month)}-01`, to: today }
    case 'Last Month': {
      const [y, m] = month === 1 ? [year - 1, 12] : [year, month - 1]
      const last = new Date(year, month - 1, 0).getDate()
      return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` }
    }
    case 'This Quarter': {
      const qStart = (Math.ceil(month / 3) - 1) * 3 + 1
      return { from: `${year}-${pad(qStart)}-01`, to: today }
    }
    case 'Last Quarter': {
      const q = Math.ceil(month / 3)
      const pq = q === 1 ? 4 : q - 1
      const py = q === 1 ? year - 1 : year
      const pqStart = (pq - 1) * 3 + 1
      const pqEnd = pq * 3
      const last = new Date(py, pqEnd, 0).getDate()
      return { from: `${py}-${pad(pqStart)}-01`, to: `${py}-${pad(pqEnd)}-${pad(last)}` }
    }
    case 'All Time':
      return { from: '2020-01-01', to: today }
    default: // 'This Year'
      return { from: `${year}-01-01`, to: today }
  }
}

function buildMonthBuckets(from, to) {
  const buckets = []
  const start = new Date(from + 'T00:00:00+03:00')
  const end = new Date(to + 'T00:00:00+03:00')
  start.setDate(1)
  while (start <= end) {
    buckets.push(
      start.toLocaleDateString('en-KE', { month: 'short', year: '2-digit', timeZone: TZ })
    )
    start.setMonth(start.getMonth() + 1)
  }
  return buckets
}

function median(arr) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

function losFor(a) {
  const start = new Date(a.admission_date)
  const end = a.discharge_date ? new Date(a.discharge_date) : new Date()
  return Math.max(1, Math.round((end - start) / 86400000))
}

// ── Small UI components ───────────────────────────────────────────────────────
function StatCard({ label, value, color = '#007AFF' }) {
  return (
    <div className={`${CARD} p-3 sm:p-4`}>
      {/* break-words, not truncate: these are often KES figures — silently clipping
          digits with an ellipsis (e.g. "KES 4,329,...") hides real financial data. */}
      <div className="text-lg sm:text-2xl font-bold mb-1 break-words" style={{ color }}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

function ExpandedChartModal({ title, renderChart, onClose }) {
  const [expandedHeight] = useState(() => Math.min(420, Math.round(window.innerHeight * 0.5)))
  return (
    <ModalShell onClose={onClose} maxWidth="max-w-3xl">
      <div className={`${CARD} overflow-hidden`}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-base font-semibold text-slate-700">{title}</h3>
          <button onClick={onClose} className={tabCls(true)} style={tabStyle(true)}>
            Close
          </button>
        </div>
        <div className="px-5 pb-5">
          {typeof renderChart === 'function' ? renderChart(expandedHeight) : null}
        </div>
      </div>
    </ModalShell>
  )
}

function ChartCard({ title, isEmpty, renderChart }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <>
      <div
        className={`${CARD} p-5 ${!isEmpty ? 'cursor-pointer' : ''}`}
        onClick={!isEmpty ? () => setExpanded(true) : undefined}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
          {!isEmpty && <Maximize2 className="h-4 w-4 text-slate-400" />}
        </div>
        {isEmpty
          ? <div className="h-[260px] flex items-center justify-center text-sm text-slate-400">No data for this period</div>
          : typeof renderChart === 'function' ? renderChart(260) : null}
      </div>
      {expanded && (
        <ExpandedChartModal title={title} renderChart={renderChart} onClose={() => setExpanded(false)} />
      )}
    </>
  )
}

function PieWithLegend({ data, size = 200 }) {
  const total = _.sumBy(data, 'value')
  if (!total) return (
    <div className="min-h-[260px] flex items-center justify-center text-sm text-slate-400">
      No data for this period
    </div>
  )
  const radius = Math.round(size * 0.4)
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 min-h-[260px]">
      <PieChart width={size} height={size}>
        <Pie data={data} cx={size / 2} cy={size / 2} outerRadius={radius} dataKey="value" paddingAngle={3}>
          {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
      </PieChart>
      <div className="space-y-4">
        {data.map(d => (
          <div key={d.name} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
            <div>
              <div className="text-xs text-slate-500">{d.name}</div>
              <div className="text-sm font-semibold text-slate-800">
                {d.value}{' '}
                <span className="text-xs text-slate-400">
                  ({Math.round(d.value / total * 100)}%)
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="w-10 h-10 rounded-full border-4 border-[#007AFF]/20 border-t-[#007AFF] animate-spin" />
      <p className="text-sm text-slate-400 mt-3">Loading analytics…</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Analytics() {
  const { user } = useAuth()

  const init = getPresetRange('This Year')
  const [dateFrom, setDateFrom] = useState(init.from)
  const [dateTo, setDateTo] = useState(init.to)
  const [preset, setPreset] = useState('This Year')
  const [activeTab, setActiveTab] = useState('All')

  const [allAdmissions, setAllAdmissions] = useState([])
  const [allVisits, setAllVisits] = useState([])
  const [hospitals, setHospitals] = useState([])
  const [revenue, setRevenue] = useState({ wardRevenue: 0, serviceRevenue: 0, totalRevenue: 0 })
  const [teamMembers, setTeamMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadErrors, setLoadErrors] = useState([])

  function applyPreset(p) {
    const r = getPresetRange(p)
    setPreset(p)
    setDateFrom(r.from)
    setDateTo(r.to)
  }

  useEffect(() => {
    if (!user?.team_id || !dateFrom || !dateTo) return
    setLoading(true)
    setLoadErrors([])
    Promise.allSettled([
      fetchAllAdmissions(user.team_id),
      fetchOutpatientVisitsFiltered(user.team_id, null, null, dateFrom, dateTo),
      fetchHospitals(user.team_id),
      fetchTeamMembers(user.team_id),
    ]).then(([admResult, visResult, hospResult, membersResult]) => {
      const errors = []

      if (admResult.status === 'fulfilled') {
        const adm = admResult.value || []
        setAllAdmissions(adm.filter(a => a.admission_date >= dateFrom && a.admission_date <= dateTo))
        setRevenue(computeTeamRevenueForRange(adm, dateFrom, dateTo))
      } else {
        console.error(admResult.reason)
        errors.push('Admissions')
      }

      if (visResult.status === 'fulfilled') {
        setAllVisits(visResult.value || [])
      } else {
        console.error(visResult.reason)
        errors.push('Outpatient visits')
      }

      if (hospResult.status === 'fulfilled') {
        setHospitals(hospResult.value || [])
      } else {
        console.error(hospResult.reason)
        errors.push('Hospitals')
      }

      if (membersResult.status === 'fulfilled') {
        setTeamMembers(membersResult.value || [])
      } else {
        console.error(membersResult.reason)
        errors.push('Team members')
      }

      setLoadErrors(errors)
    }).finally(() => setLoading(false))
  }, [user?.team_id, dateFrom, dateTo])

  // ── Aggregations ─────────────────────────────────────────────────────────────

  const doctorMap = useMemo(() => _.keyBy(teamMembers, 'id'), [teamMembers])

  const losValues = useMemo(() => allAdmissions.map(losFor), [allAdmissions])

  const admissionsByMonth = useMemo(() => {
    const buckets = buildMonthBuckets(dateFrom, dateTo)
    const grouped = _.groupBy(allAdmissions, a =>
      new Date(a.admission_date).toLocaleDateString('en-KE', { month: 'short', year: '2-digit', timeZone: TZ })
    )
    return buckets.map(b => ({ month: b, Admissions: (grouped[b] || []).length }))
  }, [allAdmissions, dateFrom, dateTo])

  const visitsByMonth = useMemo(() => {
    const buckets = buildMonthBuckets(dateFrom, dateTo)
    const grouped = _.groupBy(allVisits, v =>
      new Date(v.visit_date).toLocaleDateString('en-KE', { month: 'short', year: '2-digit', timeZone: TZ })
    )
    return buckets.map(b => ({ month: b, 'Outpatient Visits': (grouped[b] || []).length }))
  }, [allVisits, dateFrom, dateTo])

  const combinedByMonth = useMemo(() =>
    buildMonthBuckets(dateFrom, dateTo).map(b => ({
      month: b,
      Admissions: admissionsByMonth.find(x => x.month === b)?.Admissions || 0,
      'Outpatient Visits': visitsByMonth.find(x => x.month === b)?.['Outpatient Visits'] || 0,
    }))
  , [admissionsByMonth, visitsByMonth, dateFrom, dateTo])

  const hospitalActivityData = useMemo(() =>
    hospitals.map(h => ({
      name: h.name,
      Admissions: allAdmissions.filter(a => a.hospital_id === h.id).length,
      'Outpatient Visits': allVisits.filter(v => v.hospital_id === h.id).length,
    }))
  , [hospitals, allAdmissions, allVisits])

  const visitsByHospital = useMemo(() =>
    hospitals.map(h => ({
      name: h.name,
      Visits: allVisits.filter(v => v.hospital_id === h.id).length,
    }))
  , [hospitals, allVisits])

  const losByHospital = useMemo(() =>
    hospitals.map(h => {
      const los = allAdmissions.filter(a => a.hospital_id === h.id).map(losFor)
      return {
        name: h.name,
        'Avg LOS': los.length ? Math.round(_.mean(los) * 10) / 10 : 0,
        'Median LOS': median(los),
      }
    })
  , [hospitals, allAdmissions])

  const losDistribution = useMemo(() => [
    { label: '1 day', min: 1, max: 1 },
    { label: '2–3 days', min: 2, max: 3 },
    { label: '4–7 days', min: 4, max: 7 },
    { label: '8–14 days', min: 8, max: 14 },
    { label: '15+ days', min: 15, max: Infinity },
  ].map(b => ({
    label: b.label,
    count: losValues.filter(d => d >= b.min && d <= b.max).length,
  })), [losValues])

  const outpatientRevenueByHospital = useMemo(() =>
    hospitals.map(h => ({
      name: h.name,
      Revenue: _.sumBy(
        allVisits.filter(v => v.hospital_id === h.id),
        v => _.sumBy(v.visit_services || [], s => Number(s.price || 0))
      ),
    }))
  , [hospitals, allVisits])

  const visitsByDoctor = useMemo(() => {
    const grouped = _.groupBy(allVisits, 'created_by_user_id')
    return Object.entries(grouped).map(([uid, visits]) => ({
      name: doctorMap[uid]?.full_name || 'Unknown',
      Visits: visits.length,
      Revenue: _.sumBy(visits, v => _.sumBy(v.visit_services || [], s => Number(s.price || 0))),
    })).sort((a, b) => b.Visits - a.Visits)
  }, [allVisits, doctorMap])

  const serviceStats = useMemo(() => {
    const allSvcs = allVisits.flatMap(v => v.visit_services || [])
    const grouped = _.groupBy(allSvcs, 'service_name')
    return Object.entries(grouped).map(([name, items]) => ({
      name: name.length > 20 ? name.slice(0, 20) + '…' : name,
      Count: items.length,
      Revenue: _.sumBy(items, s => Number(s.price || 0)),
    })).sort((a, b) => b.Revenue - a.Revenue).slice(0, 10)
  }, [allVisits])

  const returnVsNew = useMemo(() => {
    const counts = _.countBy(allVisits, 'patient_id')
    return [
      { name: 'New Patients', value: Object.values(counts).filter(c => c === 1).length, color: '#007AFF' },
      { name: 'Return Patients', value: Object.values(counts).filter(c => c > 1).length, color: '#34C759' },
    ]
  }, [allVisits])

  const rebookedStats = useMemo(() => {
    const counts = _.countBy(allVisits, 'patient_id')
    return [
      { name: 'Has Follow-up', value: Object.values(counts).filter(c => c > 1).length, color: '#34C759' },
      { name: 'No Follow-up', value: Object.values(counts).filter(c => c === 1).length, color: '#FF9500' },
    ]
  }, [allVisits])

  // Summary stats
  const totalInpatientRevenue = revenue.totalRevenue
  const totalOutpatientRevenue = useMemo(
    () => _.sumBy(allVisits, v => _.sumBy(v.visit_services || [], s => Number(s.price || 0))), [allVisits])
  const uniqueInpatientPatients = useMemo(
    () => _.uniqBy(allAdmissions, 'patient_id').length, [allAdmissions])
  const uniqueOutpatientPatients = useMemo(
    () => _.uniqBy(allVisits, 'patient_id').length, [allVisits])
  const currentlyAdmitted = useMemo(
    () => allAdmissions.filter(a => a.status === 'admitted').length, [allAdmissions])
  const avgLOS = useMemo(
    () => losValues.length ? Math.round(_.mean(losValues) * 10) / 10 : 0, [losValues])
  const medianLOS = useMemo(() => median(losValues), [losValues])
  const allUniquePatients = useMemo(() => {
    const ids = new Set([
      ...allAdmissions.map(a => a.patient_id),
      ...allVisits.map(v => v.patient_id),
    ])
    return ids.size
  }, [allAdmissions, allVisits])
  const topDoctor = useMemo(() => visitsByDoctor[0]?.name || '—', [visitsByDoctor])
  const uniqueVisitPatients = useMemo(
    () => Object.keys(_.countBy(allVisits, 'patient_id')).length, [allVisits])
  const returnPatientsPct = useMemo(() =>
    uniqueVisitPatients > 0
      ? Math.round((returnVsNew[1]?.value || 0) / uniqueVisitPatients * 100)
      : 0
  , [returnVsNew, uniqueVisitPatients])
  const hasFollowupPct = useMemo(() =>
    uniqueVisitPatients > 0
      ? Math.round((rebookedStats[0]?.value || 0) / uniqueVisitPatients * 100)
      : 0
  , [rebookedStats, uniqueVisitPatients])

  // ── Export ────────────────────────────────────────────────────────────────────
  function exportToExcel() {
    const wb = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { Metric: 'Total Admissions', Value: allAdmissions.length },
      { Metric: 'Currently Admitted', Value: currentlyAdmitted },
      { Metric: 'Unique Inpatient Patients', Value: uniqueInpatientPatients },
      { Metric: 'Avg LOS (days)', Value: avgLOS },
      { Metric: 'Median LOS (days)', Value: medianLOS },
      { Metric: 'Total Inpatient Revenue (KES)', Value: totalInpatientRevenue },
      { Metric: 'Total Outpatient Visits', Value: allVisits.length },
      { Metric: 'Unique Outpatient Patients', Value: uniqueOutpatientPatients },
      { Metric: 'Total Outpatient Revenue (KES)', Value: totalOutpatientRevenue },
      { Metric: 'Combined Revenue (KES)', Value: totalInpatientRevenue + totalOutpatientRevenue },
    ]), 'Summary')

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      allAdmissions.map(a => ({
        Patient: `${a.patients?.first_name || ''} ${a.patients?.last_name || ''}`.trim(),
        Hospital: a.hospitals?.name || '',
        Ward: a.ward || '',
        'Admission Date': a.admission_date,
        'Discharge Date': a.discharge_date || '',
        'LOS (days)': losFor(a),
        Status: a.status,
      }))
    ), 'Admissions')

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      allVisits.map(v => ({
        Patient: `${v.patients?.first_name || ''} ${v.patients?.last_name || ''}`.trim(),
        Hospital: v.hospitals?.name || '',
        Doctor: doctorMap[v.created_by_user_id]?.full_name || '',
        'Visit Date': v.visit_date,
        'Services Count': (v.visit_services || []).length,
        'Revenue (KES)': _.sumBy(v.visit_services || [], s => Number(s.price || 0)),
      }))
    ), 'Outpatient Visits')

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      serviceStats.map(s => ({ Service: s.name, Count: s.Count, 'Revenue (KES)': s.Revenue }))
    ), 'Services')

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      hospitals.map(h => {
        const act = hospitalActivityData.find(x => x.name === h.name) || {}
        const rev = outpatientRevenueByHospital.find(x => x.name === h.name) || {}
        return {
          Hospital: h.name,
          Admissions: act.Admissions || 0,
          'Outpatient Visits': act['Outpatient Visits'] || 0,
          'OP Revenue (KES)': rev.Revenue || 0,
        }
      })
    ), 'By Hospital')

    XLSX.writeFile(wb, `WardRounds_Analytics_${dateFrom}_to_${dateTo}.xlsx`)
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full">
      <TopHeader title="Analytics" />

      <div className="p-4 space-y-4">

        {/* ── Partial-load warning ──────────────────────────────────────────── */}
        {loadErrors.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-2xl bg-white/90 backdrop-blur-xl border border-amber-200/60 text-sm text-amber-700">
            <span className="flex-shrink-0">⚠️</span>
            <span>Couldn't load: {loadErrors.join(', ')}. Showing whatever data is available.</span>
          </div>
        )}

        {/* ── Date filter + Export ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 flex-wrap">
            <div className="flex gap-1.5 flex-wrap flex-1">
              {PRESETS.map(p => (
                <button
                  key={p}
                  onClick={() => applyPreset(p)}
                  className={tabCls(preset === p)}
                  style={tabStyle(preset === p)}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-medium text-white whitespace-nowrap shadow-sm"
              style={{ background: '#007AFF' }}
            >
              ↓ Export Excel
            </button>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPreset('') }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm bg-white/80 text-slate-700"
            />
            <span className="text-slate-400 text-sm">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPreset('') }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm bg-white/80 text-slate-700"
            />
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <div className="flex gap-2">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={tabCls(activeTab === tab, 'px-5 py-2')}
              style={tabStyle(activeTab === tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Loading ───────────────────────────────────────────────────────── */}
        {loading && <LoadingSpinner />}

        {/* ── ALL TAB ───────────────────────────────────────────────────────── */}
        {!loading && activeTab === 'All' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard label="Total Admissions" value={allAdmissions.length} color="#007AFF" />
              <StatCard label="Outpatient Visits" value={allVisits.length} color="#34C759" />
              <StatCard label="Unique Patients" value={allUniquePatients} color="#007AFF" />
              <StatCard label="IP Revenue" value={fmtKES(totalInpatientRevenue)} color="#FF9500" />
              <StatCard label="OP Revenue" value={fmtKES(totalOutpatientRevenue)} color="#FF9500" />
              <StatCard label="Combined Revenue" value={fmtKES(totalInpatientRevenue + totalOutpatientRevenue)} color="#FF9500" />
            </div>

            <ChartCard
              title="Activity by Hospital"
              isEmpty={!hospitalActivityData.length || hospitalActivityData.every(d => !d.Admissions && !d['Outpatient Visits'])}
              renderChart={(h) => (
                <ResponsiveContainer width="100%" height={h}>
                  <BarChart data={hospitalActivityData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={AXIS_TICK} />
                    <YAxis tick={AXIS_TICK} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend />
                    <Bar dataKey="Admissions" fill="#007AFF" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Outpatient Visits" fill="#34C759" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            />

            <ChartCard
              title="Activity Over Time"
              isEmpty={combinedByMonth.every(d => !d.Admissions && !d['Outpatient Visits'])}
              renderChart={(h) => (
                <ResponsiveContainer width="100%" height={h}>
                  <LineChart data={combinedByMonth} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={AXIS_TICK} />
                    <YAxis tick={AXIS_TICK} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend />
                    <Line type="monotone" dataKey="Admissions" stroke="#007AFF" strokeWidth={2.5} dot={{ r: 3, fill: '#007AFF' }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="Outpatient Visits" stroke="#34C759" strokeWidth={2.5} dot={{ r: 3, fill: '#34C759' }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            />

            <ChartCard
              title="Outpatient Revenue by Hospital"
              isEmpty={!outpatientRevenueByHospital.length || outpatientRevenueByHospital.every(d => !d.Revenue)}
              renderChart={(h) => (
                <ResponsiveContainer width="100%" height={h}>
                  <BarChart data={outpatientRevenueByHospital} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={AXIS_TICK} />
                    <YAxis tick={AXIS_TICK} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [fmtKES(v), 'Revenue']} />
                    <Bar dataKey="Revenue" fill="#FF9500" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            />
          </div>
        )}

        {/* ── INPATIENT TAB ─────────────────────────────────────────────────── */}
        {!loading && activeTab === 'Inpatient' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard label="Total Admissions" value={allAdmissions.length} color="#007AFF" />
              <StatCard label="Currently Admitted" value={currentlyAdmitted} color="#007AFF" />
              <StatCard label="Unique Patients" value={uniqueInpatientPatients} color="#007AFF" />
              <StatCard label="Avg LOS" value={`${avgLOS}d`} color="#AF52DE" />
              <StatCard label="Median LOS" value={`${medianLOS}d`} color="#AF52DE" />
              <StatCard label="IP Revenue" value={fmtKES(totalInpatientRevenue)} color="#FF9500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard
                title="Admissions by Hospital"
                isEmpty={!hospitalActivityData.length || hospitalActivityData.every(d => !d.Admissions)}
                renderChart={(h) => (
                  <ResponsiveContainer width="100%" height={h}>
                    <BarChart data={hospitalActivityData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={AXIS_TICK} />
                      <YAxis tick={AXIS_TICK} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="Admissions" fill="#007AFF" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              />

              <ChartCard
                title="Admissions Over Time"
                isEmpty={admissionsByMonth.every(d => !d.Admissions)}
                renderChart={(h) => (
                  <ResponsiveContainer width="100%" height={h}>
                    <LineChart data={admissionsByMonth} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={AXIS_TICK} />
                      <YAxis tick={AXIS_TICK} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Line type="monotone" dataKey="Admissions" stroke="#007AFF" strokeWidth={2.5} dot={{ r: 3, fill: '#007AFF' }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              />

              <ChartCard
                title="Length of Stay Distribution"
                isEmpty={!losValues.length}
                renderChart={(h) => (
                  <ResponsiveContainer width="100%" height={h}>
                    <BarChart data={losDistribution} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={AXIS_TICK} />
                      <YAxis tick={AXIS_TICK} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="count" name="Admissions" fill="#AF52DE" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              />

              <ChartCard
                title="LOS by Hospital"
                isEmpty={!hospitals.length || losByHospital.every(d => !d['Avg LOS'])}
                renderChart={(h) => (
                  <ResponsiveContainer width="100%" height={h}>
                    <BarChart data={losByHospital} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={AXIS_TICK} />
                      <YAxis tick={AXIS_TICK} unit="d" />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${v} days`, '']} />
                      <Legend />
                      <Bar dataKey="Avg LOS" fill="#007AFF" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Median LOS" fill="#AF52DE" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              />
            </div>
          </div>
        )}

        {/* ── OUTPATIENT TAB ────────────────────────────────────────────────── */}
        {!loading && activeTab === 'Outpatient' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard label="Total Visits" value={allVisits.length} color="#34C759" />
              <StatCard label="Unique Patients" value={uniqueOutpatientPatients} color="#34C759" />
              <StatCard label="OP Revenue" value={fmtKES(totalOutpatientRevenue)} color="#FF9500" />
              <StatCard label="Return Patients" value={`${returnPatientsPct}%`} color="#34C759" />
              <StatCard label="Has Follow-up" value={`${hasFollowupPct}%`} color="#34C759" />
              <StatCard label="Top Doctor" value={topDoctor} color="#007AFF" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard
                title="Visits by Hospital"
                isEmpty={!visitsByHospital.length || visitsByHospital.every(d => !d.Visits)}
                renderChart={(h) => (
                  <ResponsiveContainer width="100%" height={h}>
                    <BarChart data={visitsByHospital} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={AXIS_TICK} />
                      <YAxis tick={AXIS_TICK} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="Visits" fill="#34C759" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              />

              <ChartCard
                title="Visits by Doctor"
                isEmpty={!visitsByDoctor.length}
                renderChart={(h) => (
                  <ResponsiveContainer width="100%" height={h}>
                    <BarChart
                      data={visitsByDoctor.slice(0, 10)}
                      layout="vertical"
                      margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tick={AXIS_TICK} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={AXIS_TICK} width={110} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="Visits" fill="#007AFF" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              />

              <ChartCard
                title="Top Services by Revenue"
                isEmpty={!serviceStats.length}
                renderChart={(h) => (
                  <ResponsiveContainer width="100%" height={h}>
                    <BarChart
                      data={serviceStats}
                      layout="vertical"
                      margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tick={AXIS_TICK} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={AXIS_TICK} width={130} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [fmtKES(v), 'Revenue']} />
                      <Bar dataKey="Revenue" fill="#AF52DE" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              />

              <ChartCard
                title="Visit Trend Over Time"
                isEmpty={visitsByMonth.every(d => !d['Outpatient Visits'])}
                renderChart={(h) => (
                  <ResponsiveContainer width="100%" height={h}>
                    <LineChart data={visitsByMonth} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" tick={AXIS_TICK} />
                      <YAxis tick={AXIS_TICK} allowDecimals={false} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Line type="monotone" dataKey="Outpatient Visits" stroke="#34C759" strokeWidth={2.5} dot={{ r: 3, fill: '#34C759' }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              />

              <ChartCard
                title="New vs Return Patients"
                isEmpty={false}
                renderChart={(h) => <PieWithLegend data={returnVsNew} size={h >= 300 ? 280 : 200} />}
              />

              <ChartCard
                title="Follow-up Rate"
                isEmpty={false}
                renderChart={(h) => <PieWithLegend data={rebookedStats} size={h >= 300 ? 280 : 200} />}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
