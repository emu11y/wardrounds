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

  const filtered = patients.filter(p => {
    const name = `${p.first_name} ${p.last_name}`.toLowerCase()
    if (!name.includes(query.toLowerCase())) return false

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
                      <p className="text-xs text-ios-gray-1 truncate">
                        {age !== null ? `${age} yrs · ` : ''}{formatDate(patient.date_of_birth)}
                        {patient.insurance_name ? ` · ${patient.insurance_name}` : ''}
                      </p>
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

                          return (
                            <div
                              key={adm.id}
                              className="rounded-2xl overflow-hidden border"
                              style={{ borderColor: color + '40', backgroundColor: color + '08' }}
                            >
                              {/* Admission header row */}
                              <button
                                className="w-full flex items-center justify-between gap-2 p-3 text-left"
                                onClick={() => toggleAdmissionExpand(adm.id)}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <div
                                    className="w-1 h-8 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: color }}
                                  />
                                  <div className="min-w-0">
                                    <p className="text-[12px] font-semibold text-gray-800 truncate">
                                      {adm.hospitals?.name || 'Unknown Hospital'}
                                    </p>
                                    <p className="text-[10px] text-ios-gray-1">
                                      {formatDate(adm.team_start_date || adm.admission_date)}
                                      {adm.discharge_date ? ` → ${formatDate(adm.discharge_date)}` : isActive ? ' → Present' : ''}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {adm.ward && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                                      style={{ backgroundColor: adm.ward === 'ICU' ? '#ef4444' : adm.ward === 'HDU' ? '#f97316' : '#22c55e' }}>
                                      {adm.ward}
                                    </span>
                                  )}
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${s.className}`}>
                                    {s.text}
                                  </span>
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
                              </button>

                              {/* Expanded billing + actions */}
                              {isAdmExpanded && (
                                <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: color + '30' }}>
                                  {loadingBilling[adm.id] ? (
                                    <div className="h-8 bg-ios-gray-5 rounded animate-pulse mt-2" />
                                  ) : (
                                    <div className="mt-2 rounded-xl p-3 space-y-1.5" style={{ backgroundColor: color + '10' }}>
                                      <p className="text-[10px] font-bold uppercase tracking-widest text-ios-gray-1 mb-2">
                                        Billing Breakdown
                                      </p>
                                      {billing.length === 0 && services.length === 0 ? (
                                        <p className="text-[11px] text-ios-gray-2">No billing records</p>
                                      ) : (
                                        <>
                                          {billing.length > 0 && (
                                            <div className="flex justify-between items-center py-1">
                                              <span className="text-[11px] text-gray-700">Ward charges</span>
                                              <span className="text-[11px] font-bold text-ios-blue">
                                                KES {Math.round(wardTotal).toLocaleString()}
                                              </span>
                                            </div>
                                          )}
                                          {services.map(svc => (
                                            <div key={svc.id} className="flex justify-between items-center py-0.5">
                                              <span className="text-[11px] text-gray-700 truncate flex-1">{svc.service_name}</span>
                                              <span className="text-[11px] font-semibold text-ios-blue ml-2">
                                                KES {Math.round(Number(svc.price)).toLocaleString()}
                                              </span>
                                            </div>
                                          ))}
                                          <div className="flex justify-between items-center pt-1.5 border-t" style={{ borderColor: color + '30' }}>
                                            <span className="text-[11px] font-bold text-gray-800">Total</span>
                                            <span className="text-[12px] font-bold text-gray-900">
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
