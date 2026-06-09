import { useState, useEffect } from 'react'
import { X, FileText, Plus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { addNote, fetchNotes } from '../../lib/api'

export default function AddNotesModal({ admission, onClose, onSaved }) {
  const { user } = useAuth()
  const [notes, setNotes] = useState([])
  const [text, setText] = useState('')
  const [signature, setSignature] = useState(user?.full_name || '')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  const patient = admission?.patients

  useEffect(() => {
    fetchNotes(admission.id).then(setNotes).catch(console.error).finally(() => setFetching(false))
  }, [admission.id])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    try {
      await addNote(admission.id, text, user.id, signature)
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg glass-card max-h-[85vh] flex flex-col">
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
  )
}
