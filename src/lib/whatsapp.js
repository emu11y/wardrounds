import { supabase } from './supabaseClient'

/*
 * WhatsApp appointment messaging via the Meta Cloud API.
 *
 * ⚠️ DRY MIRROR of supabase/functions/_shared/whatsapp.ts (same contract as
 * the email pair email.js ↔ apptEmail.ts). If you change number normalisation
 * or the params builder in ONE, mirror it in the OTHER.
 *
 * The Graph API token NEVER reaches the browser — every client send goes
 * through the `send-whatsapp` Edge Function, which authenticates the user,
 * checks the team toggle + patient opt-in, sends, and writes message_log.
 *
 * WhatsApp is TEMPLATE-BOUND: business-initiated messages outside a 24 h reply
 * window must use a pre-approved template. Manual "free text" reminders send
 * `appt_manual` with the staff note as {{7}}.
 *
 * Templates share the variable order:
 *   {{1}} patient first name · {{2}} practice name · {{3}} date · {{4}} time
 *   {{5}} doctor · {{6}} location · ({{7}} staff note — appt_manual only)
 */

// kind → approved template name (mirror of WA_TEMPLATES in whatsapp.ts).
export const WA_TEMPLATES = {
  confirmation: 'appt_confirmation',
  reminder_1w: 'appt_reminder_1w',
  reminder_1d: 'appt_reminder_1d',
  reminder_dayof: 'appt_reminder_dayof',
  manual: 'appt_manual',
}

// Normalise a Kenyan phone number to E.164 digits (no `+`), or null when the
// input can't be a valid Kenyan mobile — reject junk rather than message a
// wrong number. Accepts 07…/01…/7…/1…/+254…/254… forms.
export function toE164Kenya(phone) {
  if (!phone) return null
  const digits = String(phone).replace(/[\s\-().]/g, '').replace(/^\+/, '')
  if (!/^\d+$/.test(digits)) return null
  if (/^254[17]\d{8}$/.test(digits)) return digits
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`
  return null
}

function fmtDate(dateStr) {
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      timeZone: 'Africa/Nairobi',
    })
  } catch {
    return dateStr
  }
}

// WhatsApp rejects empty params and ones with newlines/tabs/4+ spaces —
// sanitise and give every slot a readable fallback.
export function waParam(value, fallback = '-') {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim()
  return (s || fallback).slice(0, 512)
}

// Ordered {{1}}…{{6}} params from the same data buildAppointmentEmail consumes.
export function buildApptWaParams({
  patientFirstName, team, dateStr, timeLabel,
  doctorName, doctorTitle, hospitalName, hospitalAddress,
}) {
  const doctor = doctorName
    ? `${doctorName}${doctorTitle ? `, ${doctorTitle}` : ''}`
    : ''
  const location = [hospitalName, hospitalAddress].filter(Boolean).join(', ')
  return [
    waParam(patientFirstName, 'there'),
    waParam(team?.practice_name || team?.name, 'WardRounds'),
    waParam(dateStr ? fmtDate(dateStr) : '', 'the scheduled date'),
    waParam(timeLabel, 'the scheduled time'),
    waParam(doctor, 'your doctor'),
    waParam(location, 'the clinic'),
  ]
}

// Low-level sender — invokes the `send-whatsapp` Edge Function. Throws on
// failure with the REAL reason extracted from the response body (same pattern
// as sendEmail — supabase-js hides non-2xx detail in FunctionsHttpError.context).
export async function sendWhatsApp({ to, kind, params, patientId, visitId }) {
  const { data, error } = await supabase.functions.invoke('send-whatsapp', {
    body: { to, kind, params, patientId, visitId },
  })
  if (error) {
    let detail = error.message || 'WhatsApp function call failed'
    try {
      const body = await error.context?.json?.()
      if (body?.error) detail = body.detail ? `${body.error}: ${JSON.stringify(body.detail)}` : body.error
    } catch { /* context not JSON — keep generic message */ }
    throw new Error(detail)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

// Fire-and-forget appointment sender: never throws, never blocks a booking.
// Mirrors sendAppointmentEmailSafe's status contract:
//   { ok: true }                     — sent
//   { ok: false, skipped: true }     — no valid opted-in recipient, nothing attempted
//   { ok: false, error: '<reason>' } — attempted but failed
export async function sendAppointmentWhatsAppSafe({
  phone, optIn, kind = 'confirmation', staffNote, patientId, visitId, ...apptFields
}) {
  const to = toE164Kenya(phone)
  if (!to || !optIn) return { ok: false, skipped: true }
  try {
    const params = buildApptWaParams(apptFields)
    if (kind === 'manual') params.push(waParam(staffNote, '-'))
    await sendWhatsApp({ to, kind, params, patientId, visitId })
    return { ok: true }
  } catch (e) {
    const error = e?.message || String(e)
    console.warn(`Appointment WhatsApp (${kind}) failed (non-blocking):`, error)
    return { ok: false, error }
  }
}
