import { supabase } from './supabaseClient'

/*
 * Transactional email via the Resend-backed `send-email` Edge Function.
 * Requires these Supabase Edge Function secrets to be set:
 *   RESEND_API_KEY, RESEND_FROM  (see supabase/functions/send-email/index.ts)
 *
 * TEMPLATE SYSTEM (DRY): one shared branded layout (`brandedLayout`) drives all
 * four appointment email types — confirmation + the three reminders (1-week,
 * 1-day, day-of) — via `buildAppointmentEmail({ kind, ... })`. Branding (logo,
 * clinic/team name, contact) comes from the team; the doctor name and detailed
 * hospital location are carried through per appointment.
 *
 * NOTE: the automatic reminders run server-side in the `send-reminders` Edge
 * Function (Deno), which mirrors this same layout. If you change the visual
 * template here, mirror it there too.
 */

// Low-level sender. Throws on failure, with the REAL reason extracted from the
// Edge Function's response body (supabase-js hides non-2xx detail inside
// FunctionsHttpError.context, so a bare `throw error` only yields a generic
// "non-2xx status code" message).
export async function sendEmail({ to, subject, html, text, replyTo }) {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: { to, subject, html, text, replyTo },
  })
  if (error) {
    let detail = error.message || 'Email function call failed'
    try {
      const body = await error.context?.json?.()
      if (body?.error) detail = body.detail ? `${body.error}: ${JSON.stringify(body.detail)}` : body.error
    } catch { /* context not JSON — keep generic message */ }
    throw new Error(detail)
  }
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

// Escape user/DB-supplied strings before interpolating into the HTML template.
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// ── Shared branded layout ────────────────────────────────────────────────────
// Produces the full HTML body used by every appointment email type. Keeping the
// header/card/footer in one place is the DRY core — per-type builders only vary
// the heading, greeting line, and (optionally) an info note.
export function brandedLayout({ team, heading, greeting, rows = [], infoNote, marketing }) {
  const clinicName = team?.practice_name || team?.name || 'WardRounds'
  const logoUrl = team?.logo_url

  const header = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="${esc(clinicName)}" style="max-height:52px;max-width:200px;display:block;margin:0 auto;" />`
    : `<span style="font-size:20px;font-weight:700;color:#007AFF;">${esc(clinicName)}</span>`

  const rowsHtml = rows
    .filter(r => r && r[1])
    .map(([label, value]) =>
      `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top;">${esc(label)}</td>` +
      `<td style="padding:6px 0;text-align:right;font-weight:600;">${value}</td></tr>`)
    .join('')

  // Contact / marketing footer — built from team settings unless a marketing
  // blurb is explicitly supplied.
  const contactBits = [team?.phone || team?.practice_phone, team?.email || team?.practice_email]
    .filter(Boolean).map(esc).join(' · ')
  const marketingHtml = marketing
    ? `<p style="font-size:12px;color:#9ca3af;text-align:center;margin:4px 0 0;">${esc(marketing)}</p>`
    : ''
  const contactHtml = contactBits
    ? `<p style="font-size:12px;color:#9ca3af;text-align:center;margin:12px 0 0;">Questions? Contact us: ${contactBits}</p>`
    : ''

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1c1c1e;">
    <div style="text-align:center;margin-bottom:20px;">${header}</div>
    <div style="background:#f2f2f7;border-radius:16px;padding:20px;">
      <h1 style="font-size:18px;margin:0 0 4px;">${esc(heading)}</h1>
      <p style="font-size:14px;color:#6b7280;margin:0 0 16px;">${esc(greeting)}</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse;">${rowsHtml}</table>
    </div>
    ${infoNote ? `<p style="font-size:12px;color:#9ca3af;text-align:center;margin-top:16px;">${esc(infoNote)}</p>` : ''}
    ${contactHtml}
    ${marketingHtml}
  </div>`
}

// Per-type copy. `intro` is a function of the patient's name.
const APPT_COPY = {
  confirmation: {
    subjectPrefix: 'Appointment confirmed',
    heading: 'Appointment confirmed',
    intro: n => `${n ? `Hello ${n},` : 'Hello,'} your appointment is booked.`,
    info: 'Please arrive a few minutes early. If you need to reschedule, contact the clinic.',
  },
  reminder_1w: {
    subjectPrefix: 'Reminder: your appointment in 1 week',
    heading: 'Appointment reminder',
    intro: n => `${n ? `Hello ${n},` : 'Hello,'} this is a friendly reminder that you have an appointment in one week.`,
    info: 'Please arrive a few minutes early. If you need to reschedule, contact the clinic.',
  },
  reminder_1d: {
    subjectPrefix: 'Reminder: your appointment tomorrow',
    heading: 'Appointment tomorrow',
    intro: n => `${n ? `Hello ${n},` : 'Hello,'} this is a reminder that your appointment is tomorrow.`,
    info: 'Please arrive a few minutes early. If you need to reschedule, contact the clinic.',
  },
  reminder_dayof: {
    subjectPrefix: 'Reminder: your appointment today',
    heading: 'Appointment today',
    intro: n => `${n ? `Hello ${n},` : 'Hello,'} this is a reminder that your appointment is today.`,
    info: 'Please arrive a few minutes early. If you need to reschedule, contact the clinic.',
  },
}

// Build the location cell — hospital name on top, detailed address beneath.
function locationCell(hospitalName, hospitalAddress) {
  if (!hospitalName && !hospitalAddress) return ''
  const name = hospitalName ? esc(hospitalName) : ''
  const addr = hospitalAddress
    ? `<br><span style="font-weight:400;color:#6b7280;font-size:12px;">${esc(hospitalAddress)}</span>`
    : ''
  return `${name}${addr}`
}

// ── Canonical appointment email builder → { subject, html } ──────────────────
// `kind` ∈ 'confirmation' | 'reminder_1w' | 'reminder_1d' | 'reminder_dayof'.
export function buildAppointmentEmail({
  kind = 'confirmation',
  patientName, dateStr, timeLabel,
  hospitalName, hospitalAddress,
  doctorName, doctorTitle,
  team, marketing,
  subjectOverride, greetingOverride,
}) {
  const copy = APPT_COPY[kind] || APPT_COPY.confirmation
  const dateLabel = fmtDate(dateStr)
  const subject = subjectOverride
    || `${copy.subjectPrefix} — ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ''}`

  const doctorValue = doctorName
    ? `${esc(doctorName)}${doctorTitle ? `<span style="font-weight:400;color:#6b7280;">, ${esc(doctorTitle)}</span>` : ''}`
    : ''

  const rows = [
    ['Date', esc(dateLabel)],
    timeLabel ? ['Time', esc(timeLabel)] : null,
    doctorValue ? ['Doctor', doctorValue] : null,
    ['Location', locationCell(hospitalName, hospitalAddress)],
  ]

  const html = brandedLayout({
    team,
    heading: copy.heading,
    greeting: greetingOverride || copy.intro(patientName),
    rows,
    infoNote: copy.info,
    marketing,
  })
  return { subject, html }
}

// Back-compat wrapper — existing callers still pass { patientName, dateStr,
// timeLabel, hospitalName, practiceName }. practiceName maps onto a minimal team.
export function appointmentConfirmationEmail({ practiceName, team, ...rest }) {
  const effectiveTeam = team || (practiceName ? { practice_name: practiceName } : undefined)
  return buildAppointmentEmail({ kind: 'confirmation', team: effectiveTeam, ...rest })
}

// Fire-and-forget: never throws, never blocks the booking flow. Only sends when
// a recipient email is present. Returns a status object so callers can surface
// the outcome (e.g. a toast) without the send ever breaking a booking:
//   { ok: true }                     — sent
//   { ok: false, skipped: true }     — no recipient, nothing attempted
//   { ok: false, error: '<reason>' } — attempted but failed
export async function sendAppointmentConfirmationSafe({ to, ...rest }) {
  return sendAppointmentEmailSafe({ to, kind: 'confirmation', ...rest })
}

// Generic safe sender for any appointment email kind (confirmation or reminder).
export async function sendAppointmentEmailSafe({ to, kind = 'confirmation', ...rest }) {
  const recipient = (to || '').trim()
  if (!recipient) return { ok: false, skipped: true }
  try {
    const { subject, html } = buildAppointmentEmail({ kind, ...rest })
    await sendEmail({ to: recipient, subject, html })
    return { ok: true }
  } catch (e) {
    const error = e?.message || String(e)
    console.warn(`Appointment email (${kind}) failed (non-blocking):`, error)
    return { ok: false, error }
  }
}
