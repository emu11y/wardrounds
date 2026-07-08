import { supabase } from './supabaseClient'

// Records a row in activity_logs. Never throws and never blocks the calling action —
// a logging failure must not be allowed to surface as if the real action had failed.
export async function logActivity({ user, action, entityType = null, entityId = null, patientId = null, patientName = null, details = null }) {
  try {
    if (!user?.team_id || !user?.id) return
    const { error } = await supabase.from('activity_logs').insert({
      team_id: user.team_id,
      user_id: user.id,
      user_email: user.email ?? null,
      user_name: user.full_name ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      patient_id: patientId,
      patient_name: patientName,
      details: details ?? null,
    })
    if (error) console.warn('logActivity:', error.message)
  } catch (e) {
    console.warn('logActivity:', e?.message || e)
  }
}
