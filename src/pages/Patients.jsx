import { useState, useEffect, useCallback } from 'react'
import { Search, ChevronDown, ChevronUp, UserPlus, Clock, MapPin, Shield, RotateCcw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchPatients, fetchAdmissionsForPatient, createAdmission } from '../lib/api'
import { getStatusBadgeStyle } from '../lib/statusBadges'
import TopHeader from '../components/TopHeader'

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

  const filtered = patients.filter(p => {
    const name = `${p.first_name} ${p.last_name}`.toLowerCase()
    return name.includes(query.toLowerCase())
  })

  return (
    <div className="flex flex-col min-h-full">
      <TopHeader title="Patients" />

      <div className="p-4 space-y-4">
        {/* Search + filter */}
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

        {/* Count */}
        <p className="text-xs text-ios-gray-1">{filtered.length} patient{filtered.length !== 1 ? 's' : ''}</p>

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
                        admissions.map(adm => (
                          <div key={adm.id} className="bg-white/40 dark:bg-white/5 rounded-2xl p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              {(() => {
                                const s = getStatusBadgeStyle(adm.status)
                                return (
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${s.className}`}>
                                    {s.icon} {s.text}
                                  </span>
                                )
                              })()}
                              <span className="text-xs text-ios-gray-1 flex items-center gap-1">
                                <Clock size={10} /> {formatDate(adm.admission_date)}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-ios-gray-1">
                              {adm.hospitals?.name && (
                                <span className="flex items-center gap-1"><MapPin size={10} />{adm.hospitals.name}</span>
                              )}
                              {adm.ward && <span>Ward {adm.ward}</span>}
                              {adm.discharge_date && (
                                <span className="flex items-center gap-1">
                                  Discharged: {formatDate(adm.discharge_date)}
                                </span>
                              )}
                            </div>
                            {adm.patient_notes?.length > 0 && (
                              <p className="text-xs text-ios-gray-1">{adm.patient_notes.length} note{adm.patient_notes.length > 1 ? 's' : ''}</p>
                            )}
                          </div>
                        ))
                      )}

                      {/* Re-admit button for discharged patients */}
                      {latest?.status === 'discharged' && (
                        <button
                          onClick={() => handleReadmit(patient)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm
                                     font-medium text-ios-blue bg-ios-blue/10 hover:bg-ios-blue/20 transition-all"
                        >
                          <RotateCcw size={14} />
                          Re-admit Patient
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
