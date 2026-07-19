// Pure date/slot math for the calendar views. No React, no fetching.
// Slot model: fixed 30-min slots from lib/api's ALL_TIME_SLOTS (06:00–21:00).
import { ALL_TIME_SLOTS, fmtSlot } from '../../lib/api'

// "09:00" → "09:30" (end of a 30-min slot, exclusive)
export function endOfSlot(slot) {
  const [h, m] = slot.split(':').map(Number)
  const t = h * 60 + m + 30
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

// "9:00 AM – 10:30 AM". End is exclusive; "24:00" (end of the 23:30 slot)
// must read as midnight, not noon.
export function fmtSlotEnd(endExclusive) {
  return endExclusive === '24:00' ? '12:00 AM' : fmtSlot(endExclusive)
}

export function fmtSlotRange(startSlot, endExclusive) {
  return `${fmtSlot(startSlot)} – ${fmtSlotEnd(endExclusive)}`
}

// "08:00" → "8 AM" (hour gutter label)
export function hourLabel(slot) {
  const h = Number(slot.split(':')[0])
  return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
}

// Compact slot label for narrow spaces (week-view pills): "06:00" → "6am",
// "09:30" → "9:30am" — minutes dropped when :00, no space before am/pm.
export function fmtSlotCompact(slot) {
  const [h, m] = slot.split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 || 12
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`
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
// windowStart/windowEnd ("HH:MM", inclusive) hide out-of-hours FREE slots only —
// booked/blocked/adhoc events always render regardless of the working-hours window.
export function buildDayRows({ slotMap, adhocBookings = [], expandedGroups = new Set(), windowStart = '00:00', windowEnd = '23:30' }) {
  const inWindow = s => s >= windowStart && s <= windowEnd
  const rows = []
  let i = 0
  while (i < ALL_TIME_SLOTS.length) {
    const slot = ALL_TIME_SLOTS[i]
    const v = slotMap[slot]

    if (!v) {
      if (!inWindow(slot)) { i++; continue }
      const free = [slot]
      let j = i + 1
      while (j < ALL_TIME_SLOTS.length && !slotMap[ALL_TIME_SLOTS[j]] && inWindow(ALL_TIME_SLOTS[j])) {
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
      // Key blocked-group expansion by REASON, not start slot: after unblocking
      // one slot the group's start shifts, and a slot-keyed id would re-collapse
      // the group mid-workflow (felt like unblock "didn't work").
      const id = `blk-${v.notes || ''}`
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

// ─── Date math (noon-anchor trick throughout — never midnight + toISOString) ──

export function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function shiftMonth(dateStr, months) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().split('T')[0]
}

// Monday-start week containing dateStr → array of 7 "YYYY-MM-DD"
export function weekDates(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const dow = (d.getDay() + 6) % 7
  return Array.from({ length: 7 }, (_, i) => shiftDate(dateStr, i - dow))
}

// Month matrix for the month containing dateStr: array of Monday-start weeks,
// each week an array of 7 { date, inMonth } cells.
export function monthMatrix(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  const month = d.getMonth()
  let cursor = weekDates(first)[0]
  const weeks = []
  do {
    weeks.push(Array.from({ length: 7 }, (_, i) => {
      const date = shiftDate(cursor, i)
      return { date, inMonth: new Date(date + 'T12:00:00').getMonth() === month }
    }))
    cursor = shiftDate(cursor, 7)
  } while (new Date(cursor + 'T12:00:00').getMonth() === month)
  return weeks
}

export function monthBounds(dateStr) {
  const weeks = monthMatrix(dateStr)
  return { from: weeks[0][0].date, to: weeks[weeks.length - 1][6].date }
}

// e.g. "12 – 20 Jul 2026" (short) or "5 Sep 2026" for a single day
export function fmtDateRange(fromStr, toStr) {
  const f = new Date(fromStr + 'T12:00:00'), t = new Date(toStr + 'T12:00:00')
  const opt = { day: 'numeric', month: 'short', year: 'numeric' }
  if (fromStr === toStr) return f.toLocaleDateString('en-GB', opt)
  if (f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear()) {
    return `${f.getDate()} – ${t.toLocaleDateString('en-GB', opt)}`
  }
  return `${f.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${t.toLocaleDateString('en-GB', opt)}`
}

// Group raw blocked slot rows (visit_date, visit_time, notes — sorted) into
// ranges for the Blocked-dates rail card: consecutive dates sharing the same
// reason merge; a single partial day keeps its time span.
export function groupBlockedRanges(blockedSlots) {
  const byDay = new Map()
  for (const b of blockedSlots) {
    const key = `${b.visit_date}|${b.notes || ''}`
    if (!byDay.has(key)) byDay.set(key, { date: b.visit_date, notes: b.notes || 'Blocked', slots: [], ids: [] })
    const t = b.visit_time ? toHM(new Date(b.visit_time)) : null
    if (t) byDay.get(key).slots.push(t)
    if (b.id) byDay.get(key).ids.push(b.id)
  }
  const days = [...byDay.values()].sort((a, b) =>
    a.date === b.date ? a.notes.localeCompare(b.notes) : a.date.localeCompare(b.date))
  const ranges = []
  for (const day of days) {
    const last = ranges[ranges.length - 1]
    if (last && last.notes === day.notes && shiftDate(last.to, 1) === day.date) {
      last.to = day.date
      last.partial = false
      last.lastSlot = day.slots[day.slots.length - 1] || last.lastSlot
      last.ids.push(...day.ids)
    } else {
      const fullDay = day.slots.length >= ALL_TIME_SLOTS.length
      ranges.push({
        from: day.date, to: day.date, notes: day.notes,
        partial: !fullDay && day.slots.length > 0,
        fromTime: day.slots[0] || null,
        lastSlot: day.slots[day.slots.length - 1] || null,
        toTime: day.slots.length ? endOfSlot(day.slots[day.slots.length - 1]) : null,
        ids: [...day.ids],
      })
    }
  }
  return ranges
}

// Merge consecutive same-label blocked slots into agenda range entries.
// Input: [{ slot, label, dot }] (slot = "HH:MM"); output items gain `end`.
export function groupAgendaBlocks(items) {
  const sorted = [...items].sort((a, b) => a.slot.localeCompare(b.slot))
  const out = []
  for (const it of sorted) {
    const last = out[out.length - 1]
    if (last && last.label === it.label && last.end === it.slot) {
      last.end = endOfSlot(it.slot)
    } else {
      out.push({ ...it, end: endOfSlot(it.slot) })
    }
  }
  return out
}
