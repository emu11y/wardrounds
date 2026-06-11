import { useState, useEffect, useCallback } from 'react'
import { Search, ChevronDown, ChevronUp, UserPlus, Clock, MapPin, RotateCcw, Receipt, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchPatients, fetchAdmissionsForPatient, createAdmission, fetchBillingRecords, fetchAdmissionServices } from '../lib/api'
import { getStatusBadgeStyle } from '../lib/statusBadges'
import TopHeader from '../components/TopHeader'
import InvoiceModal from './modals/InvoiceModal'
import * as XLSX from 'xlsx'

function calcAge(dob) {
  if (!dob) return null
  const d = new Date(dob)
  const age = new Date().getFullYear() - d.getFullYear()
  const m = new Date().getMonth() - d.getMonth()
  return m < 0 || (m === 0 && new Date().getDate() < d.getDate()) ? age - 1 : age
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Patients() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [admissionsMap, setAdmissionsMap] = useState({})
  const [loadingAdmissions, setLoadingAdmissions] = useState({})
  const [expandedAdmissionId, setExpandedAdmissionId] = useState(null)
  const [billingMap, setBillingMap] = useState({})
  const [servicesMap, setServicesMap] = useState({})
  const [loadingBilling, setLoadingBilling] = useState({})
  const [invoiceAdmission, setInvoiceAdmission] = useState(null)
  const [timeFilter, setTimeFilter] = useState(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const load = useCallback(async () => {
    if (!user?.team_id) return
    try {
      const data = await fetchPatients(user.team_id)
      setPatients(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [user?.team_id])

  useEffect(() => { load() }, [load])

  async function toggleExpand(patientId) {
    if (expandedId === patientId) {
      setExpandedId(null)
      return
    }
    setExpandedId(patientId)
    if (!admissionsMap[patientId]) {
      setLoadingAdmissions(prev => ({ ...prev, [patientId]: true }))
      try {
        const data = await fetchAdmissionsForPatient(patientId)
        setAdmissionsMap(prev => ({ ...prev, [patientId]: data }))
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingAdmissions(prev => ({ ...prev, [patientId]: false }))
      }
    }
  }

  async function toggleAdmissionExpand(admissionId) {
    if (expandedAdmissionId === admissionId) {
      setExpandedAdmissionId(null)
      return
    }
    setExpandedAdmissionId(admissionId)
    if (!billingMap[admissionId]) {
      setLoadingBilling(prev => ({ ...prev, [admissionId]: true }))
      try {
        const [records, services] = await Promise.all([
          fetchBillingRecords(admissionId),
          fetchAdmissionServices(admissionId)
        ])
        setBillingMap(prev => ({ ...prev, [admissionId]: records || [] }))
        setServicesMap(prev => ({ ...prev, [admissionId]: services || [] }))
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingBilling(prev => ({ ...prev, [admissionId]: false }))
      }
    }
  }

  async function handleReadmit(patient) {
    if (!confirm(`Re-admit ${patient.first_name} ${patient.last_name}?`)) return
    try {
      await createAdmission({
        patient_id: patient.id,
        team_id: user.team_id,
        hospital_id: patient.hospital_id || null,
        admission_date: new Date().toISOString(),
        status: 'admitted',
      })
      navigate('/')
    } catch (e) {
      alert(e.message)
    }
  }

  function getTimeFilterCutoff(filter) {
    if (!filter) return null
    const now = new Date()
    const map = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }
    const days = map[filter]
    if (!days) return null
    const d = new Date(now)
    d.setDate(d.getDate() - days)
    return d
  }

  function handleExport() {
    const rows = filtered.map(p => ({
      'First Name': p.first_name,
      'Last Name': p.last_name,
      'Age': calcAge(p.date_of_birth) ?? '',
      'Date of Birth': p.date_of_birth ? formatDate(p.date_of_birth) : '',
      'Insurance': p.insurance_name || '',
      'Added': formatDate(p.created_at),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Patients')
    const dateStr = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `wardrounds-patients-${dateStr}.xlsx`)
  }

  const handleResetFilters = () => {
    setTimeFilter(null)
    setStatusFilter('all')
    setQuery('')
    setDateFrom('')
    setDateTo('')
  }

  const filtered = patients.filter(p => {
    const name = `${p.first_name} ${p.last_name}`.toLowerCase()
    if (!name.includes(query.toLowerCase())) return false

    if (statusFilter !== 'all') {
      const hasMatch = (p.admissions || []).some(a => a.status === statusFilter)
      if (!hasMatch) return false
    }

    const cutoff = getTimeFilterCutoff(timeFilter)
    if (cutoff && new Date(p.created_at) < cutoff) return false

    if (dateFrom && new Date(p.created_at) < new Date(dateFrom)) return false
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      if (new Date(p.created_at) > to) return false
    }

    return true
  })

  return (
    <div className="flex flex-col min-h-full">
      <TopHeader title="Patients" />

      <div className="p-4 space-y-4">
        {/* Search + status filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ios-gray-1" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search patients…"
              className="ios-input pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="ios-input w-auto pl-3 pr-8"
          >
            <option value="all">All</option>
            <option value="admitted">Admitted</option>
            <option value="discharged">Discharged</option>
          </select>
        </div>

        {/* Time filter tabs */}
        <div className="glass-card p-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {[null, '1W', '1M', '3M', '6M', '1Y'].map(f => (
              <button
                key={f ?? 'all'}
                onClick={() => { setTimeFilter(f); setDateFrom(''); setDateTo('') }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  timeFilter === f && !dateFrom && !dateTo
                    ? 'bg-ios-blue text-white'
                    : 'bg-black/[0.06] text-gray-600 hover:bg-black/10'
                }`}
              >
                {f ?? 'All Time'}
              </button>
            ))}
            <button
              onClick={handleResetFilters}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors ml-auto"
            >
              ↺ Reset
            </button>
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setTimeFilter(null) }}
              className="ios-input flex-1 text-xs py-1.5"
            />
            <span className="text-xs text-ios-gray-1">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setTimeFilter(null) }}
              className="ios-input flex-1 text-xs py-1.5"
            />
          </div>
        </div>

        {/* Count + export */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-ios-gray-1">
            {filtered.length} patient{filtered.length !== 1 ? 's' : ''}
            {(timeFilter || dateFrom || dateTo) ? ' in selected period' : ''}
          </p>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-ios-green hover:opacity-90 transition-opacity shadow-sm disabled:opacity-40"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Export
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2">
            {[1,2,3,4].map(i => (
              <div key={i} className="glass-card animate-pulse h-16" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 text-ios-gray-1">
            <Search size={36} strokeWidth={1.2} className="opacity-30" />
            <p className="text-sm">{query ? 'No patients found' : 'No patients yet'}</p>
            <button onClick={() => navigate('/admit')} className="ios-blue-btn text-sm py-2 px-4">
              <span className="flex items-center gap-1.5"><UserPlus size={15} />Admit Patient</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(patient => {
              const isOpen = expandedId === patient.id
              const admissions = admissionsMap[patient.id] || []
              const isLoadingA = loadingAdmissions[patient.id]
              const latest = admissions[0]
              const age = calcAge(patient.date_of_birth)
              const recentAdmission = [...(patient.admissions || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
              const patientHospitalId = recentAdmission?.patient_hospital_id || null

              return (
                <div key={patient.id} className="glass-card overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 text-left"
                    onClick={() => toggleExpand(patient.id)}
                  >
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-ios-teal to-ios-blue flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">
                        {patient.first_name[0]}{patient.last_name[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{patient.first_name} {patient.last_name}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        {age !== null && <span className="text-xs text-gray-500">{age} yrs</span>}
                        {age !== null && patient.date_of_birth && <span className="text-gray-300 text-xs">·</span>}
                        {patient.date_of_birth && <span className="text-xs text-gray-500">{formatDate(patient.date_of_birth)}</span>}
                        {patientHospitalId && <span className="text-gray-300 text-xs">·</span>}
                        {patientHospitalId && <span className="text-xs font-medium text-blue-500">#{patientHospitalId}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {latest && (() => {
                        const s = getStatusBadgeStyle(latest.status)
                        return (
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${s.className}`}>
                            {s.icon} {s.text}
                          </span>
                        )
                      })()}
                      {isOpen ? <ChevronUp size={16} className="text-ios-gray-1" /> : <ChevronDown size={16} className="text-ios-gray-1" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="mt-4 border-t border-white/20 pt-3 space-y-3">
                      {isLoadingA ? (
                        <div className="space-y-2">
                          {[1,2].map(i => <div key={i} className="h-10 bg-ios-gray-5 rounded-xl animate-pulse" />)}
                        </div>
                      ) : admissions.length === 0 ? (
                        <p className="text-sm text-ios-gray-1 text-center py-2">No admission history</p>
                      ) : (
                        admissions.map(adm => {
                          const color = adm.hospitals?.color || '#3B82F6'
                          const isAdmExpanded = expandedAdmissionId === adm.id
                          const billing = billingMap[adm.id] || []
                          const services = servicesMap[adm.id] || []
                          const wardTotal = billing.reduce((s, r) => s + Number(r.amount || 0), 0)
                          const servicesTotal = services.reduce((s, r) => s + Number(r.price || 0), 0)
                          const grandTotal = wardTotal + servicesTotal
                          const isActive = adm.status === 'admitted'
                          const s = getStatusBadgeStyle(adm.status)

                          const wardColor = adm.ward === 'ICU' ? '#ef4444' : adm.ward === 'HDU' ? '#f97316' : '#22c55e'

                          // Build itemised billing groups
                          const hospitalSvcMap = {}
                          ;(adm.hospitals?.hospital_services || []).forEach(hs => {
                            hospitalSvcMap[hs.id] = { name: hs.service_name, rate: Number(hs.price_per_day) }
                          })
                          const billingGroups = {}
                          billing.forEach(r => {
                            const key = r.service_id ?? '__unknown__'
                            if (!billingGroups[key]) billingGroups[key] = []
                            billingGroups[key].push(r)
                          })
                          const billingLines = Object.entries(billingGroups).map(([key, recs]) => {
                            const svcInfo = key !== '__unknown__' ? hospitalSvcMap[key] : null
                            return {
                              name: svcInfo?.name ?? adm.ward ?? 'Ward Service',
                              rate: svcInfo?.rate ?? Number(recs[0]?.amount ?? 0),
                              days: recs.length,
                              total: recs.reduce((sum, r) => sum + Number(r.amount), 0),
                            }
                          })

                          return (
                            <div
                              key={adm.id}
                              className="rounded-2xl overflow-hidden border"
                              style={{ borderColor: color + '40', backgroundColor: color + '08' }}
                            >
                              {/* Admission header — two-row layout, no truncation */}
                              <button
                                className="w-full flex flex-col gap-1 p-3 text-left"
                                onClick={() => toggleAdmissionExpand(adm.id)}
                              >
                                {/* Row 1: ward badge · hospital · date */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {adm.ward && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold text-white flex-shrink-0"
                                      style={{ backgroundColor: wardColor }}>
                                      {adm.ward}
                                    </span>
                                  )}
                                  <span className="text-[12px] font-semibold text-gray-800">
                                    {adm.hospitals?.name || 'Unknown Hospital'}
                                  </span>
                                  <span className="text-[10px] text-gray-500">
                                    · {formatDate(adm.team_start_date || adm.admission_date)}
                                    {adm.discharge_date ? ` → ${formatDate(adm.discharge_date)}` : isActive ? ' → Present' : ''}
                                  </span>
                                </div>
                                {/* Row 2: status · total · chevron */}
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${s.className}`}>
                                    {s.text}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {grandTotal > 0 && (
                                      <span className="text-[11px] font-bold text-gray-700">
                                        KES {Math.round(grandTotal).toLocaleString()}
                                      </span>
                                    )}
                                    <ChevronDown
                                      size={13}
                                      className={`text-ios-gray-1 transition-transform duration-200 ${isAdmExpanded ? 'rotate-180' : ''}`}
                                    />
                                  </div>
                                </div>
                              </button>

                              {/* Expanded billing + actions */}
                              {isAdmExpanded && (
                                <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: color + '30' }}>
                                  {loadingBilling[adm.id] ? (
                                    <div className="h-8 bg-ios-gray-5 rounded animate-pulse mt-2" />
                                  ) : (
                                    <div className="mt-2 rounded-xl p-3" style={{ backgroundColor: color + '10' }}>
                                      <p className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1 mb-2">
                                        Billing Breakdown
                                      </p>
                                      {billingLines.length === 0 && services.length === 0 ? (
                                        <p className="text-[11px] text-ios-gray-2">No billing records</p>
                                      ) : (
                                        <>
                                          {billingLines.map((line, i) => (
                                            <div key={i} className="flex items-center justify-between py-1">
                                              <div className="flex items-center gap-2 min-w-0">
                                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                                <span className="text-xs font-semibold text-gray-800">{line.name}</span>
                                                <span className="text-xs text-gray-400">
                                                  {line.days}d @ KES {Math.round(line.rate).toLocaleString()}/day
                                                </span>
                                              </div>
                                              <span className="text-xs font-bold text-ios-blue ml-2 flex-shrink-0">
                                                KES {Math.round(line.total).toLocaleString()}
                                              </span>
                                            </div>
                                          ))}
                                          {services.map(svc => (
                                            <div key={svc.id} className="flex items-center justify-between py-1">
                                              <div className="flex items-center gap-2 min-w-0">
                                                <span className="w-2 h-2 rounded-full flex-shrink-0 bg-purple-400" />
                                                <span className="text-xs font-semibold text-gray-800">{svc.service_name}</span>
                                                <span className="text-xs text-gray-400">(one-off)</span>
                                              </div>
                                              <span className="text-xs font-bold text-ios-blue ml-2 flex-shrink-0">
                                                KES {Math.round(Number(svc.price)).toLocaleString()}
                                              </span>
                                            </div>
                                          ))}
                                          <div className="border-t mt-2 pt-2 flex justify-between items-center" style={{ borderColor: color + '40' }}>
                                            <span className="text-xs font-semibold text-gray-600">Total</span>
                                            <span className="text-sm font-bold" style={{ color }}>
                                              KES {Math.round(grandTotal).toLocaleString()}
                                            </span>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  )}

                                  {/* Action buttons */}
                                  <div className="flex gap-2 pt-1">
                                    <button
                                      onClick={() => setInvoiceAdmission(adm)}
                                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold text-ios-blue bg-blue-50 hover:bg-blue-100 transition-colors"
                                    >
                                      <Receipt size={12} /> Invoice
                                    </button>
                                    {(adm.status === 'discharged' || adm.status === 'archived') && (
                                      <button
                                        onClick={() => handleReadmit(patient)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-semibold text-ios-green bg-green-50 hover:bg-green-100 transition-colors"
                                      >
                                        <RotateCcw size={12} /> Re-admit
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {invoiceAdmission && (
        <InvoiceModal
          admission={invoiceAdmission}
          onClose={() => setInvoiceAdmission(null)}
        />
      )}
    </div>
  )
}
