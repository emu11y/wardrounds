import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, RefreshCw, BedDouble } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchActiveAdmissions } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import TopHeader from '../components/TopHeader'
import PatientCard from '../components/PatientCard'
import AddNotesModal from './modals/AddNotesModal'
import AddServicesModal from './modals/AddServicesModal'
import TransferModal from './modals/TransferModal'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [admissions, setAdmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Modal state
  const [notesAdmission, setNotesAdmission] = useState(null)
  const [servicesAdmission, setServicesAdmission] = useState(null)
  const [transferAdmission, setTransferAdmission] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [selectedHospitalId, setSelectedHospitalId] = useState(null)

  const load = useCallback(async () => {
    if (!user?.team_id) return
    try {
      const data = await fetchActiveAdmissions(user.team_id)
      setAdmissions(data || [])
    } catch (e) {
      console.error(e)
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

  function handleRefresh() {
    setRefreshing(true)
    load()
  }

  const hospitals = Array.from(
    new Map(
      admissions
        .filter(a => a.hospitals)
        .map(a => [a.hospitals.id, { id: a.hospitals.id, name: a.hospitals.name, color: a.hospitals.color }])
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
  const todayTotal = Object.values(todayCountByHospital).reduce((s, n) => s + n, 0)

  return (
    <div className="flex flex-col min-h-full">
      <TopHeader title="Dashboard" />

      <div className="p-4 space-y-4">
        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Admitted" value={admissions.filter(a => a.status === 'admitted').length} color="green" />
          <StatCard label="Transferred" value={admissions.filter(a => a.status === 'transferred').length} color="orange" />
          <StatCard label="Today" value={admissions.filter(a => {
            const d = new Date(a.admission_date)
            const now = new Date()
            return d.toDateString() === now.toDateString()
          }).length} color="blue" />
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Current Patients</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-xl hover:bg-black/5 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => navigate('/admit')} className="ios-blue-btn py-2 px-4 text-sm">
              <span className="flex items-center gap-1.5">
                <UserPlus size={15} />
                Admit
              </span>
            </button>
          </div>
        </div>

        {/* Hospital Filter Tabs */}
        {hospitals.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {/* All Hospitals tab */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setSelectedHospitalId(null)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition whitespace-nowrap ${
                  selectedHospitalId === null
                    ? 'bg-ios-blue text-white'
                    : 'bg-black/[0.06] dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-black/10'
                }`}
              >
                All Hospitals
              </button>
              {todayTotal > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 pointer-events-none">
                  {todayTotal}
                </span>
              )}
            </div>

            {/* Per-hospital tabs */}
            {hospitals.map(h => {
              const isActive = selectedHospitalId === h.id
              const color = h.color || '#3B82F6'
              const count = todayCountByHospital[h.id] || 0
              return (
                <div key={h.id} className="relative flex-shrink-0">
                  <button
                    onClick={() => setSelectedHospitalId(h.id)}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition whitespace-nowrap ${
                      isActive
                        ? 'text-white'
                        : 'bg-black/[0.06] dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-black/10'
                    }`}
                    style={isActive ? { backgroundColor: color } : {}}
                  >
                    {!isActive && (
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                    )}
                    {h.name}
                  </button>
                  {count > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 pointer-events-none">
                      {count}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Patient cards */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-card animate-pulse">
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
        ) : (
          <div className="columns-1 sm:columns-2 xl:columns-3 gap-3 [&>*]:mb-3 [&>*]:break-inside-avoid">
            {filteredAdmissions.map(admission => (
              <PatientCard
                key={admission.id}
                admission={admission}
                isExpanded={expandedId === admission.id}
                onToggleExpand={() => setExpandedId(prev => prev === admission.id ? null : admission.id)}
                onRefresh={load}
                onAddNotes={setNotesAdmission}
                onAddServices={setServicesAdmission}
                onTransfer={setTransferAdmission}
                onInvoice={(a) => alert(`Invoice for ${a.patients?.first_name} — coming in Phase 2`)}
              />
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
          admission={servicesAdmission}
          onClose={() => setServicesAdmission(null)}
          onSaved={() => { setServicesAdmission(null); load() }}
        />
      )}
      {transferAdmission && (
        <TransferModal
          admission={transferAdmission}
          onClose={() => setTransferAdmission(null)}
          onSaved={() => { setTransferAdmission(null); load() }}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, color }) {
  const colors = {
    green: 'text-ios-green',
    orange: 'text-ios-orange',
    blue: 'text-ios-blue',
  }
  return (
    <div className="glass-card py-3 px-3 text-center">
      <p className={`text-2xl font-bold ${colors[color]}`}>{value}</p>
      <p className="text-xs text-ios-gray-1 mt-0.5">{label}</p>
    </div>
  )
}
