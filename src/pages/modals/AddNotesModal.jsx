import { useState, useEffect } from 'react'
import { X, FileText, Plus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import ModalShell from '../../components/ModalShell'
import { addNote, fetchNotes } from '../../lib/api'
import { logActivity } from '../../lib/activityLog'

export default function AddNotesModal({ admission, onClose, onSaved }) {
  const { user } = useAuth()
  const [notes, setNotes] = useState([])
  const [text, setText] = useState('')
  const [signature, setSignature] = useState(user?.full_name || '')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  const patient = admission?.patients

  function loadNotes() {
    setFetching(true)
    setFetchError(false)
    fetchNotes(admission.id)
      .then(setNotes)
      .catch(err => { console.error(err); setFetchError(true) })
      .finally(() => setFetching(false))
  }

  useEffect(() => { loadNotes() }, [admission.id])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    try {
      const note = await addNote(admission.id, text, user.id, signature)
      await logActivity({
        user, action: 'add_note', entityType: 'note', entityId: note?.id,
        patientId: patient?.id, patientName: `${patient?.first_name} ${patient?.last_name}`,
      })
      const updated = await fetchNotes(admission.id)
      setNotes(updated)
      setText('')
      onSaved?.()
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-lg">
      <div className="glass-rim rounded-3xl p-2.5 max-h-[85vh] flex flex-col">
        <div className="surface-shell flex-1 min-h-0 p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-ios-blue" />
            <h2 className="font-semibold">Patient Notes</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-black/5 transition-colors">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-ios-gray-1 -mt-2 mb-3">
          {patient?.first_name} {patient?.last_name}
        </p>

        {/* Existing notes */}
        <div className="flex-1 overflow-y-auto scrollbar-none space-y-2 mb-4">
          {fetching ? (
            <div className="space-y-2">
              {[1,2].map(i => <div key={i} className="h-16 bg-ios-gray-5 rounded-2xl animate-pulse" />)}
            </div>
          ) : fetchError ? (
            <div className="text-center py-6 text-sm">
              <p className="text-red-500 mb-2">Failed to load notes</p>
              <button type="button" onClick={loadNotes} className="text-xs font-semibold text-ios-blue underline">
                Retry
              </button>
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-6 text-ios-gray-1 text-sm">No notes yet</div>
          ) : notes.map(note => (
            <div key={note.id} className="bg-white/40 dark:bg-white/5 rounded-2xl p-3">
              <p className="text-sm">{note.note_text}</p>
              <div className="flex items-center justify-between mt-2 text-xs text-ios-gray-1">
                <span>{note.signature || note.users?.full_name || 'Unknown'}</span>
                <span>{new Date(note.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Add note form */}
        <form onSubmit={handleSubmit} className="space-y-3 border-t border-white/20 pt-3">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Clinical note…"
            rows={3}
            className="ios-input resize-none"
          />
          <input
            value={signature}
            onChange={e => setSignature(e.target.value)}
            placeholder="Signature / name"
            className="ios-input text-sm"
          />
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-2xl border border-ios-gray-4 text-sm font-medium">
              Close
            </button>
            <button type="submit" disabled={loading || !text.trim()} className="flex-1 ios-blue-btn py-2.5 text-sm">
              {loading ? 'Saving…' : <span className="flex items-center justify-center gap-1.5"><Plus size={14} />Add Note</span>}
            </button>
          </div>
        </form>
        </div>
      </div>
    </ModalShell>
  )
}
