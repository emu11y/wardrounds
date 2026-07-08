import { supabase } from './supabaseClient'
import { logActivity } from './activityLog'

// Service role key lives only in the invite-team-member Edge Function's
// secrets (Supabase Dashboard → Edge Functions → Secrets). Never expose
// it client-side.

export const ALL_TIME_SLOTS = (() => {
  const slots = []
  for (let h = 6; h <= 21; h++) {
    for (const m of [0, 30]) {
      if (h === 21 && m === 30) break
      slots.push(`${String(h).padStart(2, '0')}:${m === 0 ? '00' : '30'}`)
    }
  }
  return slots
})()

// Format a "HH:MM" slot key into a human 12-hour label, e.g. "14:30" → "2:30 PM".
// Previously copy-pasted identically in Outpatient.jsx, MyAppointments.jsx and
// components/NewVisitModal.jsx.
export function fmtSlot(s) {
  const [h, m] = s.split(':').map(Number)
  const ampm = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

// Derive the "HH:MM" slot key from a visit's visit_time timestamp (null if unset).
// Previously duplicated in MyAppointments.jsx and components/NewVisitModal.jsx.
export function slotKeyFromVisit(v) {
  if (!v.visit_time) return null
  const d = new Date(v.visit_time)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ─── PATIENTS ────────────────────────────────────────────────────────────────

export async function fetchPatients(teamId) {
  const { data, error } = await supabase
    .from('patients')
    .select('*, hospitals(name, location), admissions(status, patient_hospital_id, created_at), outpatient_visits(id)')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function searchPatients(teamId, query) {
  const { data, error } = await supabase
    .from('patients')
    .select('*, hospitals(name)')
    .eq('team_id', teamId)
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
    .order('last_name')
  if (error) throw error
  return data
}

export async function createPatient(patient) {
  const { data, error } = await supabase
    .from('patients')
    .insert(patient)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePatient(id, updates) {
  const { data, error } = await supabase
    .from('patients')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePatientContact(patientId, { email, phone }) {
  const updates = {}
  if (email !== undefined) updates.email = email || null
  if (phone !== undefined) updates.phone = phone || null
  const { error } = await supabase
    .from('patients')
    .update(updates)
    .eq('id', patientId)
  if (error) throw error
}

export async function deletePatient(id) {
  const { error } = await supabase.from('patients').delete().eq('id', id)
  if (error) throw error
}

// ─── ADMISSIONS ──────────────────────────────────────────────────────────────

export async function fetchActiveAdmissions(teamId) {
  const { data, error } = await supabase
    .from('admissions')
    .select(`
      *,
      patients(id, first_name, last_name, date_of_birth, insurance_name),
      hospitals(id, name, location, address, phone, email, color, hospital_services(id, service_name, price_per_day)),
      timeline_events(id, event_type, ward, timestamp, notes),
      patient_notes(id, note_text, signature, created_at, users(full_name)),
      services_rendered(id, rendered_date, quantity, price_applied, hospital_services(service_name))
    `)
    .eq('team_id', teamId)
    .eq('status', 'admitted')
    .order('admission_date', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchAllAdmissions(teamId) {
  const { data, error } = await supabase
    .from('admissions')
    .select(`
      *,
      patients(id, first_name, last_name, date_of_birth, insurance_name),
      hospitals(id, name, location, color, hospital_services(id, service_name, price_per_day)),
      timeline_events(id, event_type, ward, timestamp, notes),
      admission_services(id, service_name, price, billing_type, added_at, service_at)
    `)
    .eq('team_id', teamId)
    .order('admission_date', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchAdmissionsForPatient(patientId) {
  const { data, error } = await supabase
    .from('admissions')
    .select(`
      *,
      hospitals(id, name, location, color, hospital_services(id, service_name, price_per_day)),
      timeline_events(id, event_type, ward, timestamp, notes),
      patient_notes(id, note_text, signature, created_at, users(full_name)),
      services_rendered(id, rendered_date, quantity, price_applied, hospital_services(service_name))
    `)
    .eq('patient_id', patientId)
    .order('admission_date', { ascending: false })
  if (error) throw error
  return data
}

export async function createAdmission(admission) {
  const { data, error } = await supabase
    .from('admissions')
    .insert(admission)
    .select()
    .single()
  if (error) throw error

  await supabase.from('timeline_events').insert({
    admission_id: data.id,
    event_type: 'admitted',
    ward: admission.ward,
  })

  return data
}

// timeline_events.timestamp comes back from Postgres without a timezone offset even when it
// holds a UTC instant (written via toISOString()). Parsing it with bare `new Date()` reinterprets
// those wall-clock numbers as local time, shifting the truncated calendar day on any non-UTC
// machine. Every consumer of timeline timestamps for day-math must go through this.
export function parseEventTimestamp(ts) {
  if (!ts) return null
  const hasOffset = /[Zz]|[+-]\d{2}:?\d{2}$/.test(ts)
  return new Date(hasOffset ? ts : ts + 'Z')
}

export async function transferPatient(admissionId, newWard, transferDate) {
  // 1. Get current admission
  const { data: admission, error: admError } = await supabase
    .from('admissions')
    .select('id, hospital_id, ward, patient_id, team_id, admission_date, team_start_date')
    .eq('id', admissionId)
    .single()
  if (admError) throw admError

  const oldWard = admission.ward

  // 2. Update admission ward (in-hospital transfer only — hospital_id never changes)
  const { data: updated, error: updateError } = await supabase
    .from('admissions')
    .update({ ward: newWard })
    .eq('id', admissionId)
    .select()
    .single()
  if (updateError) throw updateError

  // 3. Create timeline event
  const { error: timelineError } = await supabase
    .from('timeline_events')
    .insert({
      admission_id: admissionId,
      event_type: 'transferred',
      ward: newWard,
      timestamp: new Date(transferDate).toISOString(),
      notes: `Transferred from ${oldWard} to ${newWard}`,
    })
  if (timelineError) throw timelineError

  return updated
}

// The chronologically-last ward event is the admitted/transferred event with the maximum
// parseEventTimestamp value. Real transfers always occur after admission, and
// correctWrongfulWard (below) writes its correction event at last_timestamp + 1000ms, so
// timestamps are strictly increasing with no ties — this always agrees with billing.js's
// notion of the current ward segment.
function lastWardEvent(events) {
  return events
    .filter(ev => ev.event_type === 'admitted' || ev.event_type === 'transferred')
    .reduce((max, ev) => (!max || parseEventTimestamp(ev.timestamp) > parseEventTimestamp(max.timestamp)) ? ev : max, null)
}

export async function updateTimelineEvent(admissionId, eventId, updates, ctx = {}) {
  const { data: events, error: fetchError } = await supabase
    .from('timeline_events')
    .select('id, event_type, ward, timestamp, notes')
    .eq('admission_id', admissionId)
  if (fetchError) throw fetchError

  const target = events.find(ev => ev.id === eventId)
  if (!target) throw new Error('Timeline event not found')
  if (target.event_type === 'discharged') throw new Error('Cannot edit a discharge event here')

  const patch = {}
  if (updates.ward !== undefined) patch.ward = updates.ward
  if (updates.timestamp !== undefined) patch.timestamp = updates.timestamp

  // Notes are cosmetic — only regenerate on the directly-edited transfer event itself.
  if (updates.ward !== undefined && target.event_type === 'transferred') {
    patch.notes = `Transferred to ${updates.ward}`
  }

  const { error: updateError } = await supabase
    .from('timeline_events')
    .update(patch)
    .eq('id', eventId)
  if (updateError) throw updateError

  // Invariant A: admissions.ward must track the current (last) ward event's ward.
  if (updates.ward !== undefined && lastWardEvent(events)?.id === target.id) {
    const { error: admError } = await supabase
      .from('admissions')
      .update({ ward: updates.ward })
      .eq('id', admissionId)
    if (admError) throw admError
  }

  // Invariant B: admission_date stays in lockstep with the 'admitted' event's timestamp.
  if (target.event_type === 'admitted' && updates.timestamp !== undefined) {
    const { error: dateError } = await supabase
      .from('admissions')
      .update({ admission_date: updates.timestamp.slice(0, 10) })
      .eq('id', admissionId)
    if (dateError) throw dateError
  }

  await logActivity({
    user: ctx.user,
    action: 'edit_timeline_event',
    entityType: 'timeline_event',
    entityId: eventId,
    patientId: ctx.patientId,
    patientName: ctx.patientName,
    details: { event_type: target.event_type, ward: updates.ward ?? null, timestamp: updates.timestamp ?? null },
  })

  return { success: true }
}

export async function deleteTimelineEvent(admissionId, eventId, ctx = {}) {
  const { data: events, error: fetchError } = await supabase
    .from('timeline_events')
    .select('id, event_type, ward, timestamp, notes')
    .eq('admission_id', admissionId)
  if (fetchError) throw fetchError

  const target = events.find(ev => ev.id === eventId)
  if (!target) throw new Error('Timeline event not found')
  if (target.event_type === 'admitted') throw new Error('The admission event cannot be deleted')
  if (target.event_type === 'discharged') throw new Error('Cannot delete a discharge event here')

  const wasLast = lastWardEvent(events)?.id === target.id

  const { error: deleteError } = await supabase
    .from('timeline_events')
    .delete()
    .eq('id', eventId)
  if (deleteError) throw deleteError

  // Invariant A: if the deleted event was the current ward, recompute it from what's left.
  // There is always at least the admitted event remaining (deleting it is forbidden above).
  if (wasLast) {
    const remaining = events.filter(ev => ev.id !== eventId)
    const newLast = lastWardEvent(remaining)
    const { error: admError } = await supabase
      .from('admissions')
      .update({ ward: newLast.ward })
      .eq('id', admissionId)
    if (admError) throw admError
  }

  await logActivity({
    user: ctx.user,
    action: 'delete_timeline_event',
    entityType: 'timeline_event',
    entityId: eventId,
    patientId: ctx.patientId,
    patientName: ctx.patientName,
    details: { event_type: target.event_type, ward: target.ward },
  })

  return { success: true }
}

// The current ward assignment was a mistake; correct it same-day while preserving an audit
// trail — the wrong ward becomes a 0-day correction segment, which billing.js already
// renders as a muted footnote excluded from billing.
export async function correctWrongfulWard(admissionId, correctWard, ctx = {}) {
  const { data: events, error: fetchError } = await supabase
    .from('timeline_events')
    .select('id, event_type, ward, timestamp, notes')
    .eq('admission_id', admissionId)
    .in('event_type', ['admitted', 'transferred'])
  if (fetchError) throw fetchError

  const last = lastWardEvent(events)
  if (!last) throw new Error('No ward history to correct')
  if (last.ward === correctWard) throw new Error('Patient is already in that ward')

  const lastTs = parseEventTimestamp(last.timestamp)
  // +1000ms keeps the same UTC calendar day (0-day correction in billing) while
  // guaranteeing it sorts strictly after the wrong event.
  const correctedTimestamp = lastTs
    ? new Date(lastTs.getTime() + 1000).toISOString()
    : new Date().toISOString()

  const { error: insertError } = await supabase
    .from('timeline_events')
    .insert({
      admission_id: admissionId,
      event_type: 'transferred',
      ward: correctWard,
      timestamp: correctedTimestamp,
      notes: `Wrongful ward corrected: ${last.ward} → ${correctWard} (same day)`,
    })
  if (insertError) throw insertError

  const { error: admError } = await supabase
    .from('admissions')
    .update({ ward: correctWard })
    .eq('id', admissionId)
  if (admError) throw admError

  await logActivity({
    user: ctx.user,
    action: 'correct_wrongful_ward',
    entityType: 'admission',
    entityId: admissionId,
    patientId: ctx.patientId,
    patientName: ctx.patientName,
    details: { from: last.ward, to: correctWard },
  })

  return { success: true }
}

// TASK 4: SOFT DELETE (archive patient) — uses 'archived' status to distinguish from 'discharged'
export async function deleteAdmission(admissionId) {
  try {
    const { data, error } = await supabase
      .from('admissions')
      .update({
        status: 'archived'
      })
      .eq('id', admissionId)
      .select()
      .single()

    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('❌ deleteAdmission error:', error.message)
    return { success: false, error }
  }
}


// ─── PATIENT NOTES ───────────────────────────────────────────────────────────

export async function fetchNotes(admissionId) {
  const { data, error } = await supabase
    .from('patient_notes')
    .select('*, users(full_name)')
    .eq('admission_id', admissionId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addNote(admissionId, noteText, userId, signature) {
  const { data, error } = await supabase
    .from('patient_notes')
    .insert({
      admission_id: admissionId,
      note_text: noteText,
      created_by_user_id: userId,
      signature,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function addVisitNote(visitId, noteText, userId) {
  const { data, error } = await supabase
    .from('patient_notes')
    .insert({ visit_id: visitId, admission_id: null, note_text: noteText, created_by_user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchVisitNotes(visitId) {
  const { data, error } = await supabase
    .from('patient_notes')
    .select('id, note_text, created_at, created_by_user_id')
    .eq('visit_id', visitId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function fetchAllPatientVisitNotes(patientId, visitIds) {
  if (!visitIds || visitIds.length === 0) return []
  const { data, error } = await supabase
    .from('patient_notes')
    .select('*, outpatient_visits!visit_id(id, visit_date, visit_time, hospitals(name))')
    .in('visit_id', visitIds)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ─── SERVICES ────────────────────────────────────────────────────────────────

export async function fetchHospitalServices(hospitalId) {
  const { data, error } = await supabase
    .from('hospital_services')
    .select('*')
    .eq('hospital_id', hospitalId)
    .order('service_name')
  if (error) throw error
  return data
}

export async function fetchHospitalWards(hospitalId) {
  const { data, error } = await supabase
    .from('hospital_services')
    .select('id, service_name, price_per_day')
    .eq('hospital_id', hospitalId)
    .eq('service_type', 'ward')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function addHospitalWard(hospitalId, serviceName, pricePerDay) {
  const { data, error } = await supabase
    .from('hospital_services')
    .insert({
      hospital_id: hospitalId,
      service_name: serviceName,
      price_per_day: pricePerDay,
      service_type: 'ward',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateHospitalWard(wardId, serviceName, pricePerDay) {
  const { data, error } = await supabase
    .from('hospital_services')
    .update({ service_name: serviceName, price_per_day: pricePerDay })
    .eq('id', wardId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteHospitalWard(wardId) {
  const { error } = await supabase
    .from('hospital_services')
    .delete()
    .eq('id', wardId)
  if (error) throw error
  return { success: true }
}

// ─── HOSPITALS ───────────────────────────────────────────────────────────────

export async function fetchHospitals(teamId) {
  const { data, error } = await supabase
    .from('hospitals')
    .select('*, hospital_services(*)')
    .eq('team_id', teamId)
    .or('status.eq.active,status.is.null')
    .order('name')
  if (error) throw error
  return data
}

export async function createHospital(hospital) {
  const { data, error } = await supabase
    .from('hospitals')
    .insert(hospital)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateHospital(id, updates) {
  const { data, error } = await supabase
    .from('hospitals')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteHospital(id) {
  const { error } = await supabase.from('hospitals').delete().eq('id', id)
  if (error) throw error
}

export async function createHospitalService(service) {
  const { data, error } = await supabase
    .from('hospital_services')
    .insert(service)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateHospitalService(id, updates) {
  const { data, error } = await supabase
    .from('hospital_services')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteHospitalService(id) {
  const { error } = await supabase.from('hospital_services').delete().eq('id', id)
  if (error) throw error
}

// ─── USERS / TEAM ─────────────────────────────────────────────────────────────

export async function fetchTeamMembers(teamId) {
  const { data, error } = await supabase
    .from('users')
    .select('*, user_permissions(*)')
    .eq('team_id', teamId)
    .order('status', { ascending: true })
    .order('full_name', { ascending: true })
  if (error) throw error
  return data
}

export async function archiveMember(userId, actingUser) {
  const { data, error } = await supabase
    .from('users')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error

  await logActivity({
    user: actingUser,
    action: 'archive_member',
    entityType: 'user',
    entityId: userId,
    details: { target_email: data?.email, full_name: data?.full_name },
  })

  return data
}

export async function restoreMember(userId, actingUser) {
  const { data, error } = await supabase
    .from('users')
    .update({ status: 'active', archived_at: null })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error

  await logActivity({
    user: actingUser,
    action: 'restore_member',
    entityType: 'user',
    entityId: userId,
    details: { target_email: data?.email, full_name: data?.full_name },
  })

  return data
}

export async function updateUserProfile(userId, fields) {
  const allowed = [
    'full_name', 'role', 'phone', 'date_of_birth',
    'emergency_contact_name', 'emergency_contact_phone',
    'job_title', 'speciality', 'licence_number', 'avatar_url',
  ]
  const updates = {}
  for (const key of allowed) {
    if (key in fields) updates[key] = fields[key] || null
  }
  if (Object.keys(updates).length === 0) return
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchMemberActivity(teamId, userId, limit = 50) {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*, users(full_name)')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function fetchUserPermissions(userId) {
  const { data, error } = await supabase
    .from('user_permissions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function updateUserRole(userId, newRole, actingUser) {
  const { data, error } = await supabase
    .from('users')
    .update({ role: newRole })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error

  await logActivity({
    user: actingUser,
    action: 'change_role',
    entityType: 'user',
    entityId: userId,
    details: { new_role: newRole, target_email: data?.email },
  })

  return data
}

// Check-then-update/insert rather than a real upsert — avoids relying on the unique
// constraint's conflict-resolution behavior when we don't strictly need it.
export async function updateUserPermissions(userId, teamId, permsObject, actingUser) {
  const perms = permsObject || {}
  const allowed = {
    can_manage_patients:  perms.can_manage_patients  ?? false,
    can_discharge:        perms.can_discharge        ?? false,
    can_transfer:         perms.can_transfer         ?? false,
    can_edit_billing:     perms.can_edit_billing     ?? false,
    can_mark_paid:        perms.can_mark_paid        ?? false,
    can_view_all_patients: perms.can_view_all_patients ?? false,
    can_manage_outpatient: perms.can_manage_outpatient ?? false,
    can_view_reports:     perms.can_view_reports     ?? false,
    can_access_admin:     perms.can_access_admin     ?? false,
    can_manage_team:      perms.can_manage_team      ?? false,
    can_view_revenue:     perms.can_view_revenue     ?? null, // null = inherit role default, never coerce to false
  }

  const { data: existing } = await supabase
    .from('user_permissions')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  let result
  if (existing) {
    const { data, error } = await supabase
      .from('user_permissions')
      .update({ ...allowed, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    result = data
  } else {
    const { data, error } = await supabase
      .from('user_permissions')
      .insert({ user_id: userId, team_id: teamId, ...allowed })
      .select()
      .single()
    if (error) throw error
    result = data
  }

  await logActivity({
    user: actingUser,
    action: 'update_permissions',
    entityType: 'user',
    entityId: userId,
    details: permsObject,
  })

  return result
}

// Removes a user's permission override row, reverting them to their role's defaults.
export async function resetUserPermissions(userId, actingUser) {
  const { error } = await supabase.from('user_permissions').delete().eq('user_id', userId)
  if (error) throw error

  await logActivity({
    user: actingUser,
    action: 'reset_permissions',
    entityType: 'user',
    entityId: userId,
  })
}

export async function fetchActivityLogs(teamId, { userId, action, fromDate, toDate, limit = 100 } = {}) {
  let query = supabase
    .from('activity_logs')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (userId) query = query.eq('user_id', userId)
  if (action) query = query.eq('action', action)
  if (fromDate) query = query.gte('created_at', `${fromDate}T00:00:00.000Z`)
  if (toDate) query = query.lte('created_at', `${toDate}T23:59:59.999Z`)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function updateTeam(teamId, updates) {
  const { data, error } = await supabase
    .from('teams')
    .update(updates)
    .eq('id', teamId)
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchTeamDetails(teamId) {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name, practice_name, logo_url')
    .eq('id', teamId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function fetchTeamProfile(teamId) {
  const { data, error } = await supabase
    .from('teams')
    .select('id, practice_name, doctor_name, doctor_title, address, phone, email, logo_url')
    .eq('id', teamId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function saveTeamProfile(teamId, updates) {
  const { data, error } = await supabase
    .from('teams')
    .update(updates)
    .eq('id', teamId)
    .select()
    .maybeSingle()
  if (error) throw error
  return data
}

// ─── TEAM POSITIONS ───────────────────────────────────────────────────────────

export async function fetchTeamPositions(teamId) {
  const { data, error } = await supabase
    .from('team_positions')
    .select('id, name, sort_order')
    .eq('team_id', teamId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data || []
}

export async function updateUserPosition(userId, positionId) {
  const { data, error } = await supabase
    .from('users')
    .update({ position_id: positionId ?? null })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function createTeamPosition(teamId, name, isClinical) {
  const { data, error } = await supabase
    .from('team_positions')
    .insert({ team_id: teamId, name: name.trim(), is_clinical: !!isClinical })
    .select('id, name, sort_order')
    .single()
  if (error) throw error
  return data
}

export async function fetchPositionName(positionId) {
  if (!positionId) return null
  const { data, error } = await supabase
    .from('team_positions')
    .select('name')
    .eq('id', positionId)
    .single()
  if (error) return null
  return data?.name || null
}

export async function fetchMembersWithPositions(teamId, { includeArchived = false } = {}) {
  let usersQuery = supabase.from('users').select('*').eq('team_id', teamId)
  if (!includeArchived) usersQuery = usersQuery.neq('status', 'archived')
  usersQuery = usersQuery.order('full_name', { ascending: true })
  const [{ data: users, error: usersError }, { data: positions, error: positionsError }] = await Promise.all([
    usersQuery,
    supabase.from('team_positions').select('id, name, is_clinical').eq('team_id', teamId),
  ])
  if (usersError) throw usersError
  if (positionsError) throw positionsError

  const positionMap = Object.fromEntries((positions || []).map(p => [p.id, p]))
  return (users || []).map(u => ({
    ...u,
    position_name: u.position_id ? (positionMap[u.position_id]?.name ?? null) : null,
    is_clinical: u.position_id ? (positionMap[u.position_id]?.is_clinical ?? false) : false,
  }))
}

// ─── ANALYTICS ───────────────────────────────────────────────────────────────

export async function fetchAdmissionsByDateRange(teamId, from, to) {
  const { data, error } = await supabase
    .from('admissions')
    .select('id, admission_date, discharge_date, status')
    .eq('team_id', teamId)
    .gte('admission_date', from)
    .lte('admission_date', to)
    .order('admission_date')
  if (error) throw error
  return data
}

// ─── PHASE 6A: HOSPITAL MANAGEMENT ───────────────────────────────────────────

export async function getHospitalsByTeam(teamId) {
  const { data, error } = await supabase
    .from('hospitals')
    .select('*, hospital_services(*)')
    .eq('team_id', teamId)
    .order('name')
  if (error) console.error('getHospitalsByTeam error:', error)
  return data || []
}

export async function setHospitalStatus(id, status) {
  const { error } = await supabase
    .from('hospitals')
    .update({ status })
    .eq('id', id)
  if (error) throw error
}

// ─── TEAM SERVICES ────────────────────────────────────────────────────────────

export async function fetchTeamServices(teamId) {
  const { data, error } = await supabase
    .from('team_services')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createTeamService(data) {
  const { data: result, error } = await supabase
    .from('team_services')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return result
}

export async function updateTeamService(id, updates) {
  const { data, error } = await supabase
    .from('team_services')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setTeamServiceStatus(id, status) {
  const { error } = await supabase
    .from('team_services')
    .update({ status })
    .eq('id', id)
  if (error) throw error
}

export async function deleteTeamService(id) {
  const { error } = await supabase.from('team_services').delete().eq('id', id)
  if (error) throw error
}

// ─── ADMISSION SERVICES ───────────────────────────────────────────────────────

export async function fetchAdmissionServices(admissionId) {
  const { data, error } = await supabase
    .from('admission_services')
    .select('*')
    .eq('admission_id', admissionId)
    .order('added_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createAdmissionService(admissionId, teamServiceId, serviceName, price, billingType) {
  const { data, error } = await supabase
    .from('admission_services')
    .insert({
      admission_id: admissionId,
      team_service_id: teamServiceId,
      service_name: serviceName,
      price,
      billing_type: billingType,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteAdmissionService(id) {
  const { error } = await supabase.from('admission_services').delete().eq('id', id)
  if (error) throw error
}

export async function dischargePatient(admissionId) {
  try {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split('T')[0]

    const { error: updateError } = await supabase
      .from('admissions').update({ status: 'discharged', discharge_date: todayStr }).eq('id', admissionId)
    if (updateError) throw updateError

    await supabase.from('timeline_events').insert({ admission_id: admissionId, event_type: 'discharged' })

    return { success: true }
  } catch (error) {
    console.error('dischargePatient error:', error)
    return { success: false, error }
  }
}

// ─── OUTPATIENT VISITS ────────────────────────────────────────────────────────

export async function fetchOutpatientVisits(teamId) {
  const { data, error } = await supabase
    .from('outpatient_visits')
    .select('*, patients(id, first_name, last_name, date_of_birth, hospitals(id, name))')
    .eq('team_id', teamId)
    .neq('status', 'deleted')
    .order('visit_date', { ascending: false })
  if (error) throw error
  return data || []
}

export async function fetchOutpatientVisitsForPatient(patientId) {
  const { data, error } = await supabase
    .from('outpatient_visits')
    .select('*, visit_services(id, service_name, price), doctor:users!outpatient_visits_doctor_id_fkey(id, full_name)')
    .eq('patient_id', patientId)
    .neq('status', 'deleted')
    .order('visit_date', { ascending: false })
  if (error) throw error
  return data || []
}

export async function fetchPatientInteractions(patientId) {
  const [admissions, visits] = await Promise.all([
    fetchAdmissionsForPatient(patientId),
    fetchOutpatientVisitsForPatient(patientId),
  ])
  const entries = [
    ...admissions.map(a => ({
      kind: 'admission',
      id: a.id,
      date: a.admission_date,
      time: null,
      hospitalName: a.hospitals?.name || null,
      hospitalColor: a.hospitals?.color || null,
      status: a.status,
      ward: a.ward,
      discharge_date: a.discharge_date || null,
      serviceCount: (a.services_rendered?.length || 0),
    })),
    ...visits.map(v => ({
      kind: 'visit',
      id: v.id,
      date: v.visit_date,
      time: v.visit_time || null,
      hospitalName: null,
      hospitalColor: null,
      hospital_id: v.hospital_id,
      status: v.status,
      ward: null,
      discharge_date: null,
      serviceCount: (v.visit_services?.length || 0),
    })),
  ]
  entries.sort((a, b) =>
    (String(b.date) + (b.time || '')).localeCompare(String(a.date) + (a.time || ''))
  )
  return entries
}

// Retries without created_by_user_id when PostgREST schema cache is stale (42703 / PGRST204)
async function insertVisitWithFallback(data, selectClause = '*', asSingle = true) {
  const run = async (payload) => {
    let q = supabase.from('outpatient_visits').insert(payload).select(selectClause)
    if (asSingle) q = q.single()
    return q
  }
  const strip = (row) => { const { created_by_user_id, ...rest } = row; return rest }
  const { data: result, error } = await run(data)
  if (error && (error.code === '42703' || error.message?.includes('created_by_user_id'))) {
    const stripped = Array.isArray(data) ? data.map(strip) : strip(data)
    const { data: result2, error: error2 } = await run(stripped)
    if (error2) throw error2
    return result2
  }
  if (error) throw error
  return result
}

export async function createOutpatientVisit(visitData) {
  return insertVisitWithFallback(
    visitData,
    '*, patients(id, first_name, last_name, date_of_birth)',
    true
  )
}

export async function updateOutpatientVisit(visitId, updates) {
  const { error } = await supabase
    .from('outpatient_visits')
    .update(updates)
    .eq('id', visitId)
  if (error) throw error
}

export async function deleteOutpatientVisit(visitId) {
  const { error } = await supabase.from('outpatient_visits').delete().eq('id', visitId)
  if (error) throw error
}

export async function fetchVisitServices(visitId) {
  const { data, error } = await supabase
    .from('visit_services')
    .select('*')
    .eq('visit_id', visitId)
    .order('added_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function addVisitService(visitId, serviceName, price) {
  const { data, error } = await supabase
    .from('visit_services')
    .insert({ visit_id: visitId, service_name: serviceName, price })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteVisitService(serviceId) {
  const { error } = await supabase.from('visit_services').delete().eq('id', serviceId)
  if (error) throw error
}

export async function fetchOutpatientVisitsFiltered(teamId, doctorId = null, hospitalId = null, dateFrom = null, dateTo = null, encountersOnly = false) {
  let query = supabase
    .from('outpatient_visits')
    .select('*, patients(id, first_name, last_name, date_of_birth), hospitals(id, name, color), visit_services(id, service_name, price)')
    .eq('team_id', teamId)

  if (encountersOnly) query = query.not('status', 'in', '(scheduled,blocked,cancelled)')

  if (doctorId) query = query.eq('doctor_id', doctorId)
  if (hospitalId) query = query.eq('hospital_id', hospitalId)

  if (dateFrom) {
    const from = new Date(dateFrom)
    from.setUTCHours(0, 0, 0, 0)
    query = query.gte('visit_date', from.toISOString().split('T')[0])
  }
  if (dateTo) {
    const to = new Date(dateTo)
    to.setUTCHours(23, 59, 59, 999)
    query = query.lte('visit_date', to.toISOString().split('T')[0])
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Visits checked in on a previous day but never closed by the doctor must not silently
// drop off the outpatient queue just because the calendar date rolled over — checkInVisit
// stamps visit_date at check-in time, so a date-scoped "today" fetch alone will lose them
// at midnight. This is unbounded by date on purpose: a still-open visit stays visible
// until someone closes it, however long ago it started.
export async function fetchOpenOutpatientVisits(teamId) {
  const { data, error } = await supabase
    .from('outpatient_visits')
    .select('*, patients(id, first_name, last_name, date_of_birth), hospitals(id, name, color), visit_services(id, service_name, price)')
    .eq('team_id', teamId)
    .eq('status', 'seen')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function closeVisit(visitId) {
  const { data, error } = await supabase
    .from('outpatient_visits')
    .update({ status: 'closed' })
    .eq('id', visitId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function findPatientByHospitalId(teamId, patientHospitalId) {
  if (!patientHospitalId) return null
  for (const table of ['admissions', 'outpatient_visits']) {
    const { data, error } = await supabase
      .from(table)
      .select('patient_id')
      .eq('team_id', teamId)
      .eq('patient_hospital_id', patientHospitalId)
      .limit(1)
    if (error) throw error
    if (data?.[0]?.patient_id) {
      const { data: p, error: pErr } = await supabase
        .from('patients').select('*').eq('id', data[0].patient_id).maybeSingle()
      if (pErr) throw pErr
      if (p) return p
    }
  }
  return null
}

// patient_hospital_id is scoped to a single hospital's own tag scheme, so it can never
// link the same real person across two different hospitals (e.g. an Avenue Hospital tag
// vs an Aga Khan tag). Name+DOB is the only cross-hospital identity signal a scanned tag
// gives us. Exact match only (no fuzzy matching) to avoid merging different people who
// happen to share a name.
export async function findPatientByNameAndDob(teamId, firstName, lastName, dateOfBirth) {
  if (!firstName || !lastName || !dateOfBirth) return null
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('team_id', teamId)
    .ilike('first_name', firstName.trim())
    .ilike('last_name', lastName.trim())
    .eq('date_of_birth', dateOfBirth)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function bookAppointment(patientId, hospitalId, teamId, userId, appointmentDate, appointmentTime, notes = '', doctorId = null) {
  const visitDateTime = new Date(`${appointmentDate}T${appointmentTime}`)
  return insertVisitWithFallback({
    patient_id: patientId,
    hospital_id: hospitalId,
    team_id: teamId,
    visit_date: appointmentDate,
    visit_time: visitDateTime.toISOString(),
    status: 'scheduled',
    notes: notes || null,
    created_by_user_id: userId,
    // Never fall back to the acting/booking user here — created_by_user_id already
    // records who made the booking. doctor_id must reflect who's actually seeing the
    // patient, so it stays whatever was explicitly assigned (or null) rather than
    // silently attributing front-desk/admin staff as the treating doctor.
    doctor_id: doctorId,
  })
}

export async function seedTestHospitals(teamId) {
  try {
    const { data: hospitals, error } = await supabase
      .from('hospitals')
      .insert([
        { name: 'City Medical Center', location: 'Nairobi', team_id: teamId },
        { name: 'Prime Health Hospital', location: 'Mombasa', team_id: teamId },
        { name: 'Coastal Clinic', location: 'Kisumu', team_id: teamId }
      ])
      .select()
    if (error) throw error
    const wards = [
      { service_name: 'ICU', price_per_day: 20000, service_type: 'ward' },
      { service_name: 'HDU', price_per_day: 12000, service_type: 'ward' },
      { service_name: 'General Ward', price_per_day: 6000, service_type: 'ward' }
    ]
    for (const hospital of hospitals) {
      for (const ward of wards) {
        await supabase.from('hospital_services').insert({
          hospital_id: hospital.id,
          service_name: ward.service_name,
          price_per_day: ward.price_per_day,
          service_type: ward.service_type
        })
      }
    }
    return { success: true, message: '3 hospitals with 9 wards created!' }
  } catch (error) {
    console.error('seedTestHospitals error:', error)
    return { success: false, error: error.message }
  }
}

// ─── TEAM MEMBER INVITES ──────────────────────────────────────────────────────

export async function inviteTeamMember(teamId, email, role, fullName, password, positionId) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-team-member`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, role, teamId, fullName, password, positionId }),
    }
  )

  let data
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const message = data?.error
      ? `${data.error}${data.detail ? ': ' + data.detail : ''}`
      : `HTTP ${response.status}`
    throw new Error(message)
  }

  return data
}

// ─── SCHEDULE / APPOINTMENTS ──────────────────────────────────────────────────

// Fetch all of a doctor's slots (visits + blocks) for a given date
export async function fetchScheduleForDate(teamId, doctorId, date) {
  const { data, error } = await supabase
    .from('outpatient_visits')
    .select('*, patients(id, first_name, last_name, date_of_birth), hospitals(id, name, color)')
    .eq('team_id', teamId)
    .eq('doctor_id', doctorId)
    .eq('visit_date', date)
    .neq('status', 'cancelled')
    .order('visit_time', { ascending: true })
  if (error) throw error
  return data || []
}

// Block a single slot (patient_id null, reason stored in notes)
export async function blockSlot(teamId, userId, date, time, reason, doctorId = null) {
  const visitDateTime = new Date(`${date}T${time}:00`)
  return insertVisitWithFallback({
    patient_id:         null,
    hospital_id:        null,
    team_id:            teamId,
    created_by_user_id: userId,
    doctor_id:          doctorId,
    visit_date:         date,
    visit_time:         visitDateTime.toISOString(),
    status:             'blocked',
    notes:              reason || 'Blocked',
  })
}

// Block a range of slots in one call
export async function blockSlotRange(teamId, userId, date, times, reason, doctorId = null) {
  const rows = times.map(time => ({
    patient_id:         null,
    hospital_id:        null,
    team_id:            teamId,
    created_by_user_id: userId,
    doctor_id:          doctorId,
    visit_date:         date,
    visit_time:         new Date(`${date}T${time}:00`).toISOString(),
    status:             'blocked',
    notes:              reason || 'Blocked',
  }))
  const result = await insertVisitWithFallback(rows, '*', false)
  return result || []
}

// Cancel a booking — frees the slot (soft delete via status)
export async function cancelVisit(visitId) {
  const { data, error } = await supabase
    .from('outpatient_visits')
    .update({ status: 'cancelled' })
    .eq('id', visitId)
    .select()
    .single()
  if (error) throw error
  return data
}

// Unblock a slot — removes the block row entirely
export async function unblockSlot(visitId) {
  const { error } = await supabase
    .from('outpatient_visits')
    .delete()
    .eq('id', visitId)
  if (error) throw error
}

// Promote a scheduled appointment to a live encounter (patient arrived)
export async function checkInVisit(visitId, doctorId = null) {
  const { data: visit, error: fetchError } = await supabase
    .from('outpatient_visits')
    .select('patient_id, hospital_id, patient_hospital_id')
    .eq('id', visitId)
    .single()
  if (fetchError) throw fetchError

  let patientHospitalId = visit.patient_hospital_id
  if (!patientHospitalId && visit.patient_id && visit.hospital_id) {
    const { data: prev } = await supabase
      .from('outpatient_visits')
      .select('patient_hospital_id')
      .eq('patient_id', visit.patient_id)
      .eq('hospital_id', visit.hospital_id)
      .not('patient_hospital_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (prev?.patient_hospital_id) patientHospitalId = prev.patient_hospital_id
  }

  const now = new Date()
  const payload = {
    status:     'seen',
    visit_time: now.toISOString(),
    visit_date: now.toISOString().split('T')[0],
  }
  if (patientHospitalId) payload.patient_hospital_id = patientHospitalId
  if (doctorId) payload.doctor_id = doctorId

  const { data, error } = await supabase
    .from('outpatient_visits')
    .update(payload)
    .eq('id', visitId)
    .select()
    .single()
  if (error) throw error
  return data
}

// Move an existing booking to a new date/time
export async function rescheduleVisit(visitId, newDate, newTime) {
  const visitDateTime = new Date(`${newDate}T${newTime}:00`)
  const { data, error } = await supabase
    .from('outpatient_visits')
    .update({ visit_date: newDate, visit_time: visitDateTime.toISOString() })
    .eq('id', visitId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function fetchAdhocBookings(teamId, date, doctorId = null) {
  let q = supabase
    .from('outpatient_visits')
    .select('id, visit_time, notes, patients(id, first_name, last_name), hospitals(id, name, color)')
    .eq('team_id', teamId)
    .eq('visit_date', date)
    .eq('is_adhoc', true)
  if (doctorId) q = q.eq('doctor_id', doctorId)
  const { data, error } = await q.order('visit_time', { ascending: true })
  if (error) throw error
  return data || []
}

export async function createAdhocBooking(teamId, userId, patientId, hospitalId, date, time, chiefComplaint, doctorId = null) {
  const { data, error } = await supabase
    .from('outpatient_visits')
    .insert({
      team_id: teamId,
      created_by_user_id: userId,
      patient_id: patientId,
      hospital_id: hospitalId,
      visit_date: date,
      visit_time: time,
      status: 'scheduled',
      is_adhoc: true,
      chief_complaint: chiefComplaint || null,
      doctor_id: doctorId,
    })
    .select('id, visit_time, notes, patients(id, first_name, last_name), hospitals(id, name, color)')
    .single()
  if (error) throw error
  return data
}

export async function deleteAdhocBooking(visitId) {
  const { error } = await supabase.from('outpatient_visits').delete().eq('id', visitId)
  if (error) throw error
}

