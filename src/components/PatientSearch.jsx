import { useState, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { searchPatients } from '../lib/api'

export default function PatientSearch({ teamId, onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const timer = useRef(null)

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    setError(null)
    clearTimeout(timer.current)
    if (val.length < 2) { setResults([]); return }
    setSearching(true)
    timer.current = setTimeout(async () => {
      try {
        const data = await searchPatients(teamId, val)
        setResults(data || [])
      } catch (err) {
        console.error(err)
        setError('Search failed — please try again.')
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  function clear() {
    setQuery('')
    setResults([])
    setError(null)
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ios-gray-1" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search by name…"
          className="ios-input pl-10 pr-9"
          autoFocus
        />
        {query && (
          <button onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-ios-gray-1">
            <X size={16} />
          </button>
        )}
      </div>

      {searching && (
        <div className="flex justify-center py-3">
          <div className="w-5 h-5 border-2 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin" />
        </div>
      )}

      {error && !searching && (
        <p className="text-sm text-red-500 text-center py-2">{error}</p>
      )}

      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map(p => (
            <button
              key={p.id}
              onClick={() => { onSelect(p); clear() }}
              className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/40 dark:bg-white/5 hover:bg-ios-blue/10 transition-all text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-ios-blue/10 flex items-center justify-center text-ios-blue font-bold text-sm flex-shrink-0">
                {p.first_name[0]}{p.last_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{p.first_name} {p.last_name}</p>
                <p className="text-xs text-ios-gray-1 truncate">
                  {p.date_of_birth ? `DOB: ${p.date_of_birth}` : ''}
                  {p.date_of_birth && p.insurance_name ? ' · ' : ''}
                  {p.insurance_name || ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {query.length >= 2 && !searching && !error && results.length === 0 && (
        <p className="text-sm text-ios-gray-1 text-center py-3">
          No patients found for "{query}"
        </p>
      )}
    </div>
  )
}
