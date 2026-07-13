import { supabase } from './supabaseClient'

/*
 * Transactional email via the Resend-backed `send-email` Edge Function.
 * Requires these Supabase Edge Function secrets to be set:
 *   RESEND_API_KEY, RESEND_FROM  (see supabase/functions/send-email/index.ts)
 */

// Low-level sender. Throws on failure.
export async function sendEmail({ to, subject, html, text, replyTo }) {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: { to, subject, html, text, replyTo },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
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

// Appointment confirmation template → { subject, html }.
export function appointmentConfirmationEmail({ patientName, dateStr, timeLabel, hospitalName, practiceName }) {
  const clinic = practiceName || 'WardRounds'
  const dateLabel = fmtDate(dateStr)
  const subject = `Appointment confirmed — ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ''}`
  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1c1c1e;">
    <div style="text-align:center;margin-bottom:20px;">
      <span style="font-size:18px;font-weight:700;color:#007AFF;">${clinic}</span>
    </div>
    <div style="background:#f2f2f7;border-radius:16px;padding:20px;">
      <h1 style="font-size:18px;margin:0 0 4px;">Appointment confirmed</h1>
      <p style="font-size:14px;color:#6b7280;margin:0 0 16px;">${patientName ? `Hello ${patientName},` : 'Hello,'} your appointment is booked.</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#6b7280;">Date</td><td style="padding:6px 0;text-align:right;font-weight:600;">${dateLabel}</td></tr>
        ${timeLabel ? `<tr><td style="padding:6px 0;color:#6b7280;">Time</td><td style="padding:6px 0;text-align:right;font-weight:600;">${timeLabel}</td></tr>` : ''}
        ${hospitalName ? `<tr><td style="padding:6px 0;color:#6b7280;">Location</td><td style="padding:6px 0;text-align:right;font-weight:600;">${hospitalName}</td></tr>` : ''}
      </table>
    </div>
    <p style="font-size:12px;color:#9ca3af;text-align:center;margin-top:16px;">
      Please arrive a few minutes early. If you need to reschedule, contact the clinic.
    </p>
  </div>`
  return { subject, html }
}

// Fire-and-forget: never throws, never blocks the booking flow. Only sends when
// a recipient email is present.
export async function sendAppointmentConfirmationSafe({ to, ...rest }) {
  try {
    const recipient = (to || '').trim()
    if (!recipient) return
    const { subject, html } = appointmentConfirmationEmail(rest)
    await sendEmail({ to: recipient, subject, html })
  } catch (e) {
    console.warn('Appointment confirmation email failed (non-blocking):', e?.message || e)
  }
}
