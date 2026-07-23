import { useEffect, useState } from 'react'
import Backdrop from './Backdrop'
import { X, Bell, UserPlus, ArrowRight, LogOut, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { parseEventTimestamp } from '../lib/api'
import { useAuth } from '../context/AuthContext'

function eventIcon(type) {
  switch (type) {
    case 'admitted': return <UserPlus size={16} className="text-ios-green" />
    case 'transferred': return <ArrowRight size={16} className="text-ios-orange" />
    case 'discharged': return <LogOut size={16} className="text-ios-gray-1" />
    default: return <AlertCircle size={16} className="text-ios-blue" />
  }
}

function formatTime(ts) {
  // timeline_events.timestamp comes back from Postgres tz-less but holds a UTC
  // instant — parse it through the shared helper so a Nairobi (UTC+3) browser
  // doesn't reinterpret it as local time and overshoot by 3 hours.
  const d = parseEventTimestamp(ts)
  if (!d) return ''
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString('en-GB', { timeZone: 'Africa/Nairobi' })
}

const LS_CLEARED = 'wr_notifications_cleared_ids'
const LS_READ = 'wr_notifications_read_ids'

export default function NotificationCenter({ open, onClose, onUnreadCountChange }) {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [clearedIds, setClearedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(LS_CLEARED) || '[]')) }
    catch { return new Set() }
  })
  const [readIds, setReadIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(LS_READ) || '[]')) }
    catch { return new Set() }
  })

  useEffect(() => {
    if (!user?.team_id) return

    // Fetch recent events
    async function loadEvents() {
      const { data } = await supabase
        .from('timeline_events')
        .select(`
          *,
          admissions!inner(team_id, patients(first_name, last_name))
        `)
        .eq('admissions.team_id', user.team_id)
        .order('timestamp', { ascending: false })
        .limit(30)
      if (data) setEvents(data.filter(e => !clearedIds.has(e.id)))
    }

    loadEvents()

    // Subscribe to realtime events
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'timeline_events',
      }, (payload) => {
        setEvents(prev => [payload.new, ...prev]
          .filter(e => !clearedIds.has(e.id))
          .slice(0, 30))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user?.team_id])

  useEffect(() => {
    const unread = events.filter(e => !readIds.has(e.id)).length
    if (onUnreadCountChange) onUnreadCountChange(unread)
  }, [events, readIds])

  function handleMarkAllRead() {
    const allIds = new Set(events.map(e => e.id))
    setReadIds(allIds)
    localStorage.setItem(LS_READ, JSON.stringify([...allIds]))
    if (onUnreadCountChange) onUnreadCountChange(0)
  }

  function handleClearAll() {
    const newCleared = new Set([...clearedIds, ...events.map(e => e.id)])
    setClearedIds(newCleared)
    localStorage.setItem(LS_CLEARED, JSON.stringify([...newCleared]))
    setReadIds(new Set())
    localStorage.setItem(LS_READ, JSON.stringify([]))
    setEvents([])
    if (onUnreadCountChange) onUnreadCountChange(0)
  }

  return (
    <>
      <Backdrop onClick={onClose} className={`transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} />
      <div className={`glass-rim fixed z-[60] rounded-3xl p-2.5 flex flex-col transition-all duration-300 ease-in-out ${open ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'} inset-x-4 top-[72px] max-h-[75vh] sm:top-[72px] sm:bottom-6 sm:max-h-none sm:right-6 sm:left-auto sm:w-[380px]`}>
        <div className="surface-shell flex-1 min-h-0">
        <div className="border-b border-gray-100">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <Bell size={18} className="text-ios-blue" />
              <h2 className="font-semibold">Notifications</h2>
              {events.length > 0 && (
                <span className="px-1.5 py-0.5 bg-ios-blue text-white text-[10px] font-bold rounded-full">
                  {events.filter(e => !readIds.has(e.id)).length || events.length}
                </span>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-black/5 transition-colors">
              <X size={18} />
            </button>
          </div>

          {events.length > 0 && (
            <div className="flex gap-2 px-4 pb-3">
              <button
                onClick={handleMarkAllRead}
                className="flex-1 py-1.5 text-[11px] font-semibold text-ios-blue bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                Mark All Read
              </button>
              <button
                onClick={handleClearAll}
                className="flex-1 py-1.5 text-[11px] font-semibold text-ios-gray-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-none p-3 space-y-2">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-ios-gray-1">
              <Bell size={32} strokeWidth={1.2} className="mb-2 opacity-40" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            events.map((event) => {
              const patient = event.admissions?.patients
              const name = patient ? `${patient.first_name} ${patient.last_name}` : 'A patient'
              return (
                <div
                  key={event.id}
                  className={`border border-gray-100 rounded-xl py-3 px-4 flex gap-3 items-start transition-opacity cursor-pointer hover:bg-gray-50 ${readIds.has(event.id) ? 'opacity-50' : 'opacity-100'}`}
                  onClick={() => {
                    const newRead = new Set([...readIds, event.id])
                    setReadIds(newRead)
                    localStorage.setItem(LS_READ, JSON.stringify([...newRead]))
                    if (onUnreadCountChange) {
                      const unread = events.filter(e => !newRead.has(e.id)).length
                      onUnreadCountChange(unread)
                    }
                  }}
                >
                  <div className="mt-0.5">{eventIcon(event.event_type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{name}</p>
                    <p className="text-xs text-ios-gray-1 capitalize">
                      {event.event_type}
                      {event.ward ? ` — ${event.ward}` : ''}
                      {event.notes ? ` · ${event.notes}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-ios-gray-2 flex-shrink-0">{formatTime(event.timestamp)}</span>
                </div>
              )
            })
          )}
        </div>
        </div>
      </div>
    </>
  )
}
