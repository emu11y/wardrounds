import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, BedDouble } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchActiveAdmissions, fetchTeamDetails } from '../lib/api'
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
  const [statsCollapsed, setStatsCollapsed] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [toast, setToast] = useState(null)
  function showToast(message, type = 'error') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    if (!user?.team_id) return
    try {
      const data = await fetchActiveAdmissions(user.team_id)
      setAdmissions(data || [])
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
  const todayTotal = Object.values(todayCountByHospital).reduce((s, n) => s + n, 0)

  const hexToRgba = (hex, alpha) => {
    const clean = (hex || '#3B82F6').trim().replace(/^#/, '')
    const full = clean.length === 3
      ? clean.split('').map(c => c + c).join('')
      : clean.length >= 6 ? clean.slice(0, 6) : clean.padEnd(6, '0')
    const r = parseInt(full.slice(0, 2), 16) || 0
    const g = parseInt(full.slice(2, 4), 16) || 0
    const b = parseInt(full.slice(4, 6), 16) || 0
    return `rgba(${r},${g},${b},${alpha})`
  }

  const renderCard = ({ cardColor, name, count, isAll, selected, onClick, cardKey }) => (
    <button
      key={cardKey}
      onClick={onClick}
      className="relative overflow-hidden rounded-2xl border backdrop-blur-xl p-2.5 min-w-[130px] flex-shrink-0 transition-all duration-200 cursor-pointer text-left"
      style={{
        backgroundColor: hexToRgba(cardColor, selected ? 0.25 : 0.1),
        borderColor: hexToRgba(cardColor, selected ? 0.8 : 0.25),
        boxShadow: selected
          ? `0 8px 28px ${hexToRgba(cardColor, 0.33)}, inset 0 1px 0 rgba(255,255,255,0.25)`
          : 'inset 0 1px 0 rgba(255,255,255,0.12)',
        transform: selected ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      {/* Main diagonal shine */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/35 via-white/8 to-transparent" />
      {/* Top edge bright line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-gradient-to-r from-transparent via-white/70 to-transparent" />
      {/* Left edge subtle line */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[1px] rounded-l-2xl bg-gradient-to-b from-white/50 to-transparent" />
      <div className="relative z-10">
        <p className="text-white font-bold text-[10px] uppercase tracking-wide line-clamp-2">{name}</p>
        <div className="flex items-baseline gap-1.5 mt-1">
          <span className="text-xl font-bold text-white">{count}</span>
          <span className="text-xs text-white/70">{count === 1 ? 'patient' : 'patients'}</span>
        </div>
      </div>
      {isAll ? (
        <svg viewBox="0 0 24 24" fill="currentColor" className="pointer-events-none w-12 h-12 opacity-10 text-white absolute -bottom-2 -right-2">
          <path d="M3 3h2v18H3zm4 4h2v14H7zm4-2h2v16h-2zm4 4h2v12h-2zm4-6h2v18h-2z"/>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor" className="pointer-events-none w-12 h-12 opacity-10 text-white absolute -bottom-2 -right-2">
          <path d="M4 4a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v17h-5v-4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v4H4V4zm7 2v2H9v2h2v2h2v-2h2V8h-2V6h-2z"/>
        </svg>
      )}
    </button>
  )

  return (
    <div className="flex flex-col min-h-full">
      <TopHeader title="Dashboard" />
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="p-4 space-y-4">
        {/* Stats Section — collapsible */}
        <div className="rounded-2xl shadow-xl bg-gradient-to-r from-[#1a237e] to-[#1565c0] p-4 mb-4">
          {/* Header row */}
          <div className="w-full">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Left: avatar + name + subtitle */}
              <div className="flex items-center gap-3 min-w-0">
                {teamDetails?.logo_url ? (
                  <img src={teamDetails.logo_url} alt="Logo" className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #007AFF, #5856D6)' }}
                  >
                    {(teamDetails?.practice_name || 'W').charAt(0)}
                  </div>
                )}
                <div className="flex flex-col items-start">
                  <span className="text-white font-bold text-base leading-tight">{teamDetails?.practice_name || 'WardRounds'}</span>
                  <span className="text-blue-200 text-xs leading-tight text-left">Hospital Overview</span>
                </div>
              </div>
              {/* Right: frosted glass pill (chevron now inside) */}
              <div className="relative flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl px-4 py-1.5 shadow-lg overflow-visible flex-nowrap flex-shrink-0 self-stretch sm:self-auto">
                {/* Shine overlays */}
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/35 via-white/8 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] rounded-t-2xl bg-gradient-to-r from-transparent via-white/80 to-transparent" />
                {/* Calendar icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="relative z-10 w-4 h-4 text-white/70 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                {/* Date */}
                <span className="relative z-10 text-xs text-white/80 whitespace-nowrap">{currentTime.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' })}</span>
                {/* Divider */}
                <div className="relative z-10 w-px h-3.5 bg-white/25 flex-shrink-0" />
                {/* Clock icon — bare, no ring */}
                <svg xmlns="http://www.w3.org/2000/svg" className="relative z-10 w-4 h-4 text-white/70 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {/* Time with split AM/PM */}
                {(() => {
                  const ts = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Africa/Nairobi' })
                  const [timePart, meridiem] = ts.split(' ')
                  return (
                    <span className="relative z-10 text-sm font-bold text-white whitespace-nowrap leading-none">
                      {timePart}<span className="text-xs font-normal text-white/70 ml-0.5">{meridiem}</span>
                    </span>
                  )
                })()}
                {/* Refresh button */}
                <button
                  onClick={e => { e.stopPropagation(); handleRefresh() }}
                  className="relative z-10 flex-shrink-0 p-0.5 cursor-pointer"
                  style={{ opacity: refreshing ? 0.4 : 1, pointerEvents: refreshing ? 'none' : undefined }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 text-white/70 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </button>
                {/* Collapse chevron */}
                <button
                  onClick={e => { e.stopPropagation(); setStatsCollapsed(prev => !prev) }}
                  className="relative z-10 flex-shrink-0 p-0.5 cursor-pointer"
                >
                  <svg className={`w-4 h-4 text-white/70 transition-transform duration-200 ${statsCollapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Expanded hospital stat cards */}
          <div className={`transition-all duration-300 overflow-hidden ${statsCollapsed ? 'max-h-0' : 'max-h-[300px] mt-3'}`}>
            <div className="flex gap-3 overflow-x-auto overflow-y-visible py-2 [&::-webkit-scrollbar]:hidden">
              {renderCard({
                cardColor: '#007AFF',
                name: 'ALL HOSPITALS',
                count: admissions.filter(a => a.status === 'admitted').length,
                isAll: true,
                selected: selectedHospitalId === null,
                onClick: () => setSelectedHospitalId(null),
              })}
              {hospitals.map(h => renderCard({
                cardKey: h.id,
                cardColor: h.color || '#3B82F6',
                name: h.name,
                count: admissions.filter(a => a.hospitals?.id === h.id && a.status === 'admitted').length,
                isAll: false,
                selected: selectedHospitalId === h.id,
                onClick: () => {
                  setSelectedHospitalId(prev => prev === h.id ? null : h.id)
                  setVisitedHospitals(prev => new Set([...prev, h.id]))
                },
              }))}
            </div>
          </div>
        </div>

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

        {/* Hospital Filter Tabs */}
        {hospitals.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pt-2 pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* All Hospitals tab */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => {
                  setSelectedHospitalId(null)
                  setVisitedHospitals(new Set(hospitals.map(h => h.id)))
                }}
                className={`px-4 py-1.5 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                  selectedHospitalId === null
                    ? 'bg-ios-blue text-white'
                    : 'bg-black/[0.06] dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-black/10'
                }`}
              >
                All Hospitals
              </button>
              {todayTotal > 0 && hospitals.some(h => (todayCountByHospital[h.id] || 0) > 0 && !visitedHospitals.has(h.id)) && (
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
              const showBadge = count > 0 && !visitedHospitals.has(h.id)
              return (
                <div key={h.id} className="relative flex-shrink-0">
                  <button
                    onClick={() => {
                      setSelectedHospitalId(h.id)
                      setVisitedHospitals(prev => new Set([...prev, h.id]))
                    }}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-medium transition whitespace-nowrap ${
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
                  {showBadge && (
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
                        if (isExpanding) setStatsCollapsed(true)
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

