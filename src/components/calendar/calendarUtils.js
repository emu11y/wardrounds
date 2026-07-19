// Pure date/slot math for the calendar views. No React, no fetching.
// Slot model: fixed 30-min slots from lib/api's ALL_TIME_SLOTS (06:00–21:00).
import { ALL_TIME_SLOTS, fmtSlot } from '../../lib/api'

// "09:00" → "09:30" (end of a 30-min slot, exclusive)
export function endOfSlot(slot) {
  const [h, m] = slot.split(':').map(Number)
  const t = h * 60 + m + 30
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

// "9:00 AM – 10:30 AM"
export function fmtSlotRange(startSlot, endExclusive) {
  return `${fmtSlot(startSlot)} – ${fmtSlot(endExclusive)}`
}

// "08:00" → "8 AM" (hour gutter label)
export function hourLabel(slot) {
  const h = Number(slot.split(':')[0])
  return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
}

// Local "HH:MM" for a Date (used for the now-line and adhoc snapping)
export function toHM(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Build the ordered row model for the day timeline.
//   slotMap        slot "HH:MM" → visit row (from the page, unchanged)
//   adhocBookings  adhoc rows (visit_time timestamp; rendered inline, read-only)
//   expandedGroups Set of group ids the user has expanded
// Row types: 'visit' | 'blocked' | 'blockedGroup' | 'gap' | 'gapGroup' | 'adhoc'
// Every row has a `start` ("HH:MM") used for hour labels, adhoc + now insertion.
export function buildDayRows({ slotMap, adhocBookings = [], expandedGroups = new Set() }) {
  const rows = []
  let i = 0
  while (i < ALL_TIME_SLOTS.length) {
    const slot = ALL_TIME_SLOTS[i]
    const v = slotMap[slot]

    if (!v) {
      const free = [slot]
      let j = i + 1
      while (j < ALL_TIME_SLOTS.length && !slotMap[ALL_TIME_SLOTS[j]]) {
        free.push(ALL_TIME_SLOTS[j]); j++
      }
      const id = `gap-${slot}`
      if (free.length > 1 && !expandedGroups.has(id)) {
        rows.push({ type: 'gapGroup', id, slots: free, start: slot, end: endOfSlot(free[free.length - 1]) })
      } else {
        for (const s of free) rows.push({ type: 'gap', id: `gap1-${s}`, slot: s, start: s })
      }
      i = j
    } else if (v.status === 'blocked') {
      // Merge consecutive blocked slots sharing the same reason (notes)
      const group = [v]
      let j = i + 1
      while (j < ALL_TIME_SLOTS.length) {
        const nv = slotMap[ALL_TIME_SLOTS[j]]
        if (nv && nv.status === 'blocked' && (nv.notes || '') === (v.notes || '')) {
          group.push(nv); j++
        } else break
      }
      const id = `blk-${slot}`
      if (group.length > 1 && !expandedGroups.has(id)) {
        rows.push({
          type: 'blockedGroup', id, visits: group, start: slot,
          end: endOfSlot(ALL_TIME_SLOTS[j - 1]), notes: v.notes,
        })
      } else {
        group.forEach((bv, k) => {
          const s = ALL_TIME_SLOTS[i + k]
          rows.push({ type: 'blocked', id: `blk1-${s}`, visit: bv, slot: s, start: s })
        })
      }
      i = j
    } else {
      rows.push({ type: 'visit', id: `v-${v.id}`, visit: v, slot, start: slot, end: endOfSlot(slot) })
      i++
    }
  }

  // Interleave adhoc bookings at their real time (snapped into row order)
  const adhoc = adhocBookings
    .filter(b => b.visit_time)
    .map(b => ({ type: 'adhoc', id: `adhoc-${b.id}`, booking: b, start: toHM(new Date(b.visit_time)) }))
    .sort((a, b) => a.start.localeCompare(b.start))
  for (const a of adhoc) {
    let idx = rows.findIndex(r => r.start > a.start)
    if (idx === -1) idx = rows.length
    rows.splice(idx, 0, a)
  }
  return rows
}

// Insert hour-label rows and (if nowHM is given) the current-time marker.
export function decorateRows(rows, nowHM = null) {
  const out = []
  let lastHour = null
  for (const r of rows) {
    const h = r.start.split(':')[0]
    if (h !== lastHour) {
      out.push({ type: 'hour', id: `hour-${h}`, start: `${h}:00`, label: hourLabel(r.start) })
      lastHour = h
    }
    out.push(r)
  }
  if (nowHM) {
    let idx = out.findIndex(r => r.start > nowHM)
    if (idx === -1) idx = out.length
    out.splice(idx, 0, { type: 'now', id: 'now', start: nowHM })
  }
  return out
}
