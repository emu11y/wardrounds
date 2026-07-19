// Upcoming blocked dates with reasons, grouped into ranges by calendarUtils.
// Each item is actionable: tap → inline actions — Edit (opens the Block Range
// modal prefilled) or Unblock (two-tap confirm, removes the whole range).
import { useState } from 'react'
import { fmtSlot } from '../../lib/api'
import { todayStr } from '../../lib/utils'
import { fmtDateRange, fmtSlotEnd } from './calendarUtils'

export default function BlockedDatesCard({ ranges, onEdit, onUnblock }) {
  const [openIdx, setOpenIdx] = useState(null)
  const [confirming, setConfirming] = useState(false)

  if (!ranges.length) {
    return <p className="text-[11px] text-gray-400">No upcoming blocked dates</p>
  }
  const today = todayStr()

  function toggle(i) {
    setOpenIdx(openIdx === i ? null : i)
    setConfirming(false)
  }

  return (
    <div className="flex flex-col gap-2">
      {ranges.map((r, i) => (
        <div key={i} className="border-l-2 border-red-400 pl-2">
          <button onClick={() => toggle(i)} className="w-full text-left hover:bg-red-50/60 rounded-r-lg transition-colors">
            <p className="text-[11px] font-semibold text-gray-800 leading-tight">
              {r.from === today && r.to === today ? 'Today' : fmtDateRange(r.from, r.to)}
              {r.partial && r.fromTime && (
                <span className="font-normal text-gray-500">, {fmtSlot(r.fromTime)} – {fmtSlotEnd(r.toTime)}</span>
              )}
            </p>
            <p className="text-[11px] text-gray-500 truncate">{r.notes}</p>
          </button>
          {openIdx === i && (
            <div className="flex items-center gap-1.5 mt-1.5 mb-0.5">
              <button
                onClick={() => { setOpenIdx(null); onEdit(r) }}
                className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-black/[0.06] text-gray-700 hover:bg-black/10 transition-colors"
              >
                Edit block
              </button>
              {confirming ? (
                <button
                  onClick={() => { setOpenIdx(null); setConfirming(false); onUnblock(r) }}
                  className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-red-500 text-white transition-colors"
                >
                  Confirm — unblock {r.ids.length} slot{r.ids.length !== 1 ? 's' : ''}
                </button>
              ) : (
                <button
                  onClick={() => setConfirming(true)}
                  className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                >
                  Unblock
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
