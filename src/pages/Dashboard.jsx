import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, BedDouble } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchActiveAdmissions, fetchTeamDetails, countDischargesOn } from '../lib/api'
import { nairobiDateStr } from '../lib/utils'
import WardBoard from '../components/WardBoard'
import { supabase } from '../lib/supabaseClient'
import TopHeader from '../components/TopHeader'
import PatientCard from '../components/PatientCard'
import Toast from '../components/Toast'
import AddNotesModal from './modals/AddNotesModal'
import AddServicesModal from './modals/AddServicesModal'
import TransferModal from './modals/TransferModal'
import InvoiceModal from './modals/InvoiceModal'
import TimelineEditorModal from './modals/TimelineEditorModal'

function useColumnCount() {
  function get() {
    if (typeof window === 'undefined') return 1
    if (window.innerWidth >= 1280) return 3
    if (window.innerWidth >= 640) return 2
    return 1
  }
  const [cols, setCols] = useState(get)
  useEffect(() => {
    const fn = () => setCols(get())
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return cols
}

export default function Dashboard() {
  const { user, permissions } = useAuth()
  const navigate = useNavigate()
  const numCols = useColumnCount()
  const [admissions, setAdmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Modal state
  const [notesAdmission, setNotesAdmission] = useState(null)
  const [servicesAdmission, setServicesAdmission] = useState(null)
  const [transferAdmission, setTransferAdmission] = useState(null)
  const [timelineAdmission, setTimelineAdmission] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [selectedHospitalId, setSelectedHospitalId] = useState(null)
  const lsKey = user?.team_id ? `wr_visited_${user.team_id}` : null
  const [visitedHospitals, setVisitedHospitals] = useState(() => {
    if (!lsKey) return new Set()
    try { return new Set(JSON.parse(localStorage.getItem(lsKey) || '[]')) } catch { return new Set() }
  })
  const [invoiceAdmission, setInvoiceAdmission] = useState(null)
  const [teamDetails, setTeamDetails] = useState(null)
  const [dischargedToday, setDischargedToday] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [toast, setToast] = useState(null)
  function showToast(message, type = 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    if (!user?.team_id) return
    try {
      const [data, discharged] = await Promise.all([
        fetchActiveAdmissions(user.team_id),
        countDischargesOn(user.team_id, nairobiDateStr()).catch(() => 0), // board figure only — never blocks the list
      ])
      setAdmissions(data || [])
      setDischargedToday(discharged)
    } catch (e) {
      console.error(e)
      showToast('Failed to load patients — pull to refresh or try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user?.team_id])

  useEffect(() => { load() }, [load])

  // Realtime subscription
  useEffect(() => {
    if (!user?.team_id) return
    const channel = supabase
      .channel('admissions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admissions' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user?.team_id, load])

  // Refresh billing records every 60 s so ward totals stay current
  useEffect(() => {
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  useEffect(() => {
    if (!lsKey) return
    localStorage.setItem(lsKey, JSON.stringify([...visitedHospitals]))
  }, [visitedHospitals, lsKey])

  useEffect(() => {
    if (!user?.team_id) return
    const fetchDetails = () =>
      fetchTeamDetails(user.team_id).then(setTeamDetails).catch(err => { console.error(err); showToast('Failed to load practice details.') })
    fetchDetails()
    window.addEventListener('focus', fetchDetails)
    return () => window.removeEventListener('focus', fetchDetails)
  }, [user?.team_id])

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  function handleRefresh() {
    setRefreshing(true)
    load()
  }

  const hospitals = Array.from(
    new Map(
      admissions
        .filter(a => a.hospitals && a.hospitals.status !== 'inactive')
        .map(a => [a.hospitals.id, { id: a.hospitals.id, name: a.hospitals.name, color: a.hospitals.color, status: a.hospitals.status }])
    ).values()
  )

  const filteredAdmissions = selectedHospitalId
    ? admissions.filter(a => a.hospitals?.id === selectedHospitalId)
    : admissions

  const todayStr = new Date().toDateString()
  const todayCountByHospital = {}
  for (const a of admissions) {
    if (new Date(a.created_at).toDateString() === todayStr) {
      const hid = a.hospitals?.id
      if (hid) todayCountByHospital[hid] = (todayCountByHospital[hid] || 0) + 1
    }
  }

  // Ward-board figures (whole practice + per hospital), derived from the same list.
  const today = nairobiDateStr()
  const admittedToday = admissions.filter(a => String(a.admission_date || '').slice(0, 10) === today).length
  const boardHospitals = hospitals.map(h => {
    const here = admissions.filter(a => a.hospitals?.id === h.id)
    const wardCounts = {}
    for (const a of here) if (a.ward) wardCounts[a.ward] = (wardCounts[a.ward] || 0) + 1
    const newCount = todayCountByHospital[h.id] || 0
    return {
      ...h,
      count: here.length,
      wards: Object.keys(wardCounts).sort((x, y) => wardCounts[y] - wardCounts[x]),
      newCount,
      showBadge: newCount > 0 && !visitedHospitals.has(h.id),
    }
  })
  const selectHospital = id => {
    setSelectedHospitalId(id)
    setVisitedHospitals(prev => new Set([...prev, ...(id ? [id] : hospitals.map(h => h.id))]))
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopHeader title="Dashboard" />
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="p-4 space-y-4">
        {/* Ward board — practice summary + hospital filter in one */}
        <WardBoard
          practiceName={teamDetails?.practice_name || 'WardRounds'}
          now={currentTime}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          total={admissions.length}
          admittedToday={admittedToday}
          dischargedToday={dischargedToday}
          hospitals={boardHospitals}
          selectedId={selectedHospitalId}
          onSelect={selectHospital}
        />

        {/* Header row */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Current Patients</h2>
          <div className="flex items-center gap-2">
            {permissions?.view_admit !== false && (
              <button onClick={() => navigate('/admit')} className="ios-blue-btn py-2 px-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <UserPlus size={15} />
                  Admit
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Patient cards */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="border border-gray-200 rounded-2xl bg-white/70 p-5 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-11 h-11 bg-ios-gray-5 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-ios-gray-5 rounded w-1/2" />
                    <div className="h-3 bg-ios-gray-5 rounded w-1/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : admissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-20 h-20 rounded-3xl bg-ios-gray-5 flex items-center justify-center">
              <BedDouble size={36} className="text-ios-gray-2" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-gray-700 dark:text-gray-200">No patients admitted</h3>
              <p className="text-sm text-ios-gray-1 mt-1">Admit a patient to get started</p>
            </div>
            <button onClick={() => navigate('/admit')} className="ios-blue-btn">
              <span className="flex items-center gap-2">
                <UserPlus size={16} />
                Admit First Patient
              </span>
            </button>
          </div>
        ) : filteredAdmissions.length === 0 ? (
          <div className="border border-gray-200 rounded-2xl bg-white/70 p-10 text-center">
            <p className="text-sm text-ios-gray-1">
              {selectedHospitalId
                ? `No patients at ${hospitals.find(h => h.id === selectedHospitalId)?.name || 'this hospital'}`
                : 'No active patients'}
            </p>
          </div>
        ) : (
          <div className="flex gap-4 items-start">
            {Array.from({ length: numCols }, (_, col) => (
              <div key={col} className="flex-1 flex flex-col gap-4 min-w-0">
                {filteredAdmissions
                  .filter((_, i) => i % numCols === col)
                  .map(admission => (
                    <PatientCard
                      key={admission.id}
                      admission={admission}
                      isExpanded={expandedId === admission.id}
                      isNew={new Date(admission.created_at).toDateString() === todayStr}
                      onToggleExpand={() => {
                        const isExpanding = expandedId !== admission.id
                        setExpandedId(isExpanding ? admission.id : null)
                      }}
                      onRefresh={load}
                      onAddNotes={setNotesAdmission}
                      onAddServices={(adm, cb) => setServicesAdmission({ admission: adm, onServiceAdded: cb })}
                      onTransfer={setTransferAdmission}
                      onInvoice={setInvoiceAdmission}
                      onEditTimeline={setTimelineAdmission}
                    />
                  ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {notesAdmission && (
        <AddNotesModal
          admission={notesAdmission}
          onClose={() => setNotesAdmission(null)}
          onSaved={() => { setNotesAdmission(null); load() }}
        />
      )}
      {servicesAdmission && (
        <AddServicesModal
          admission={servicesAdmission.admission}
          onServiceAdded={servicesAdmission.onServiceAdded}
          onClose={() => setServicesAdmission(null)}
          onSaved={() => setServicesAdmission(null)}
        />
      )}
      {transferAdmission && (
        <TransferModal
          admission={transferAdmission}
          onClose={() => setTransferAdmission(null)}
          onSaved={() => { setTransferAdmission(null); load() }}
        />
      )}
      {invoiceAdmission && (
        <InvoiceModal
          admission={invoiceAdmission}
          onClose={() => setInvoiceAdmission(null)}
        />
      )}
      {timelineAdmission && (
        <TimelineEditorModal
          admission={timelineAdmission}
          onClose={() => setTimelineAdmission(null)}
          onSaved={() => { setTimelineAdmission(null); load() }}
        />
      )}
    </div>
  )
}

