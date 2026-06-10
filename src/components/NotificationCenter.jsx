import { useEffect, useState } from 'react'
import { X, Bell, UserPlus, ArrowRight, LogOut, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
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
  const d = new Date(ts)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString()
}

export default function NotificationCenter({ open, onClose }) {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [readIds, setReadIds] = useState(new Set())

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
      if (data) setEvents(data)
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
        setEvents(prev => [payload.new, ...prev].slice(0, 30))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user?.team_id])

  function handleMarkAllRead() {
    setReadIds(new Set(events.map(e => e.id)))
  }

  function handleClearAll() {
    setEvents([])
    setReadIds(new Set())
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative z-10 w-full max-w-sm h-full glass border-l border-white/20 flex flex-col shadow-glass-md">
        <div className="border-b border-white/20">
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
                  className={`glass-card py-3 px-4 flex gap-3 items-start transition-opacity ${readIds.has(event.id) ? 'opacity-50' : 'opacity-100'}`}
                  onClick={() => setReadIds(prev => new Set([...prev, event.id]))}
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
      </aside>
    </div>
  )
}
