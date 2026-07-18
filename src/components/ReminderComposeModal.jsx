import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import ModalShell from './ModalShell'
import { fetchTeamProfile, fetchUserName, fmtSlot, slotKeyFromVisit } from '../lib/api'
import { buildAppointmentEmail, sendEmail } from '../lib/email'
import { sendAppointmentWhatsAppSafe, toE164Kenya } from '../lib/whatsapp'

// Manual appointment reminder — a glass compose modal. The user picks a reminder
// tone (which pre-fills a subject + message), can freely edit both, then sends.
// The message is rendered inside the shared branded template (logo, doctor,
// detailed location, contact footer) via buildAppointmentEmail's overrides, so a
// manual reminder looks identical to the automatic ones.

const PRESETS = {
  reminder_1w: {
    label: '1 week',
    subject: 'Reminder: your appointment in 1 week',
    message: n => `${n ? `Hello ${n},` : 'Hello,'} this is a friendly reminder that you have an appointment with us in one week. We look forward to seeing you.`,
  },
  reminder_1d: {
    label: 'Tomorrow',
    subject: 'Reminder: your appointment tomorrow',
    message: n => `${n ? `Hello ${n},` : 'Hello,'} this is a reminder that your appointment is tomorrow. Please arrive a few minutes early.`,
  },
  reminder_dayof: {
    label: 'Today',
    subject: 'Reminder: your appointment today',
    message: n => `${n ? `Hello ${n},` : 'Hello,'} this is a reminder that your appointment is today. We look forward to seeing you.`,
  },
}
const PRESET_ORDER = ['reminder_1w', 'reminder_1d', 'reminder_dayof']

export default function ReminderComposeModal({ visit, onClose, notify }) {
  const patient = visit.patients
  const name = patient ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() : ''
  const email = (patient?.email || '').trim()
  const timeLabel = fmtSlot(slotKeyFromVisit(visit))

  const [preset, setPreset]   = useState('reminder_1d')
  const [subject, setSubject] = useState(PRESETS.reminder_1d.subject)
  const [message, setMessage] = useState(PRESETS.reminder_1d.message(name))
  const [team, setTeam]       = useState(null)
  const [doctor, setDoctor]   = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError]     = useState(null)

  // Channel selection. WhatsApp requires: valid Kenyan number + patient opt-in +
  // the team's WhatsApp toggle (checked again server-side by send-whatsapp).
  const waNumber  = toE164Kenya(patient?.phone)
  const waAllowed = !!waNumber && patient?.whatsapp_opt_in === true && team?.whatsapp_enabled === true
  const [viaEmail, setViaEmail] = useState(!!email)
  const [viaWa, setViaWa]       = useState(false)

  useEffect(() => {
    let alive = true
    fetchTeamProfile(visit.team_id).then(t => {
      if (!alive) return
      setTeam(t)
      // Pre-tick WhatsApp once we know the team allows it and the patient can get it.
      if (t?.whatsapp_enabled === true && patient?.whatsapp_opt_in === true && toE164Kenya(patient?.phone)) {
        setViaWa(true)
      }
    }).catch(() => {})
    if (visit.doctor_id) fetchUserName(visit.doctor_id).then(d => { if (alive) setDoctor(d) }).catch(() => {})
    return () => { alive = false }
  }, [visit, patient])

  function applyPreset(key) {
    setPreset(key)
    setSubject(PRESETS[key].subject)
    setMessage(PRESETS[key].message(name))
  }

  async function handleSend() {
    const wantEmail = viaEmail && !!email
    const wantWa    = viaWa && waAllowed
    if (!wantEmail && !wantWa) { setError('Pick at least one channel this patient can receive.'); return }
    setSending(true); setError(null)

    const outcomes = []
    try {
      if (wantEmail) {
        const { subject: builtSubject, html, text } = buildAppointmentEmail({
          kind: preset,
          patientName: name,
          dateStr: visit.visit_date,
          timeLabel,
          hospitalName: visit.hospitals?.name,
          hospitalAddress: visit.hospitals?.address,
          doctorName: doctor?.full_name,
          doctorTitle: doctor?.job_title || doctor?.speciality,
          team,
          subjectOverride: subject.trim() || undefined,
          greetingOverride: message.trim() || undefined,
        })
        try {
          await sendEmail({ to: email, subject: builtSubject, html, text })
          outcomes.push(`email → ${email}`)
        } catch (e) {
          throw new Error(`Email failed: ${e?.message || e}`)
        }
      }

      if (wantWa) {
        // WhatsApp is template-bound: the pre-approved appt_manual template carries
        // the appointment details, with the message above included as a short note.
        const res = await sendAppointmentWhatsAppSafe({
          phone: patient?.phone,
          optIn: true,
          kind: 'manual',
          staffNote: message.trim() || undefined,
          patientId: patient?.id,
          visitId: visit.id,
          patientFirstName: patient?.first_name,
          team,
          dateStr: visit.visit_date,
          timeLabel,
          hospitalName: visit.hospitals?.name,
          hospitalAddress: visit.hospitals?.address,
          doctorName: doctor?.full_name,
          doctorTitle: doctor?.job_title || doctor?.speciality,
        })
        if (res.ok) outcomes.push('WhatsApp')
        else if (!res.skipped) throw new Error(`WhatsApp failed: ${res.error}${outcomes.length ? ` (${outcomes.join(', ')} did send)` : ''}`)
      }

      notify?.(`Reminder sent (${outcomes.join(', ')})`, 'success')
      onClose()
    } catch (e) {
      const msg = e?.message || String(e)
      setError(msg)
      notify?.(`Reminder not sent: ${msg}`, 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="glass-rim w-full max-w-sm rounded-3xl p-2.5">
        <div className="surface-shell">
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <div>
              <h2 className="font-bold text-base text-gray-900">Send Reminder</h2>
              <p className="text-xs text-gray-500">
                {name || 'Patient'}{timeLabel ? ` · ${timeLabel}` : ''}
              </p>
            </div>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="px-5 pb-5 pt-2 space-y-3">
            {!email && !waAllowed && (
              <p className="text-xs text-red-500">
                This patient has no email on file{waNumber ? ' and is not set up for WhatsApp' : ''}. Add contact details from their profile first.
              </p>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Send via</label>
              <div className="flex gap-3">
                <label className={`flex items-center gap-1.5 text-xs ${email ? 'text-gray-700 cursor-pointer' : 'text-gray-300'}`}>
                  <input
                    type="checkbox"
                    checked={viaEmail && !!email}
                    disabled={!email}
                    onChange={e => setViaEmail(e.target.checked)}
                    className="accent-[#007AFF]"
                  />
                  Email{email ? '' : ' (none on file)'}
                </label>
                <label className={`flex items-center gap-1.5 text-xs ${waAllowed ? 'text-gray-700 cursor-pointer' : 'text-gray-300'}`}>
                  <input
                    type="checkbox"
                    checked={viaWa && waAllowed}
                    disabled={!waAllowed}
                    onChange={e => setViaWa(e.target.checked)}
                    className="accent-[#007AFF]"
                  />
                  WhatsApp{waAllowed ? '' : (!waNumber ? ' (no valid number)' : patient?.whatsapp_opt_in !== true ? ' (no opt-in)' : ' (off in Settings)')}
                </label>
              </div>
              {viaWa && waAllowed && (
                <p className="text-[11px] text-gray-400 mt-1">
                  WhatsApp sends a fixed, pre-approved template with the appointment details — your message above is included as a short note. Patients can't reply on WhatsApp; the template tells them to contact the clinic directly.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Reminder type</label>
              <div className="flex gap-1.5">
                {PRESET_ORDER.map(key => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className={`flex-1 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      preset === key ? 'bg-ios-blue text-white' : 'bg-black/[0.06] text-gray-700 hover:bg-black/10'
                    }`}
                  >
                    {PRESETS[key].label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white/80 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white/80 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 resize-none"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Sent with your clinic branding, plus the appointment date, time, doctor and location.
              </p>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              onClick={handleSend}
              disabled={sending || !((viaEmail && !!email) || (viaWa && waAllowed))}
              className="w-full py-2.5 rounded-2xl text-sm font-semibold bg-ios-blue text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {sending
                ? 'Sending…'
                : (viaEmail && !!email) || (viaWa && waAllowed)
                  ? `Send via ${[viaEmail && email ? 'email' : null, viaWa && waAllowed ? 'WhatsApp' : null].filter(Boolean).join(' + ')}`
                  : 'No channel available'}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-2xl text-sm font-semibold bg-black/[0.06] text-gray-700 hover:bg-black/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}
