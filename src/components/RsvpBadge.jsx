import { Check, CalendarClock } from 'lucide-react'
import { RSVP_BADGES, VISIT_STATUS_STYLES } from '../lib/theme'

/*
 * Patient RSVP badge for an outpatient visit.
 *
 * Data source: outpatient_visits.rsvp_status, written ONLY by the
 * whatsapp-webhook edge function when the patient taps Confirm or
 * Need to reschedule on a WhatsApp appointment template.
 *
 * Gating — deliberately no new permission key:
 *   • Page access is already gated (view_outpatient / PageGuard) and the
 *     action side by can_manage_outpatient.
 *   • The feature itself is gated by the existing admin Settings toggle
 *     teams.whatsapp_enabled: with WhatsApp off, no template is ever sent, so
 *     rsvp_status stays null for every visit and this badge never renders.
 *   • Rendering nothing for null also keeps the card quiet for the common case
 *     (patient simply hasn't replied yet) — "no RSVP" is already carried by the
 *     amber calendar state, and repeating it on every visit card is noise.
 *
 * Colours come from VISIT_STATUS_STYLES so the badge, the calendar dot and the
 * legend can never drift apart.
 *
 * tone:
 *   'accent' (default) — sits on a coloured/gradient card header: translucent
 *                        glass pill, white text, coloured status dot.
 *   'light'            — sits on a white/glass surface: tinted pill.
 */

const ICONS = {
  confirmed:  <Check size={11} className="flex-shrink-0" />,
  reschedule: <CalendarClock size={11} className="flex-shrink-0" />,
}

export default function RsvpBadge({ rsvpStatus, tone = 'accent', className = '' }) {
  const badge = RSVP_BADGES[rsvpStatus]
  if (!badge) return null

  const style = VISIT_STATUS_STYLES[badge.key]
  const base = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none'

  if (tone === 'light') {
    return (
      <span className={`${base} ${style.card.split(' ')[0]} ${style.title} ${className}`}>
        {ICONS[badge.key]}
        {badge.label}
      </span>
    )
  }

  return (
    <span className={`${base} bg-white/20 backdrop-blur text-white ${className}`}>
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${style.dot}`} />
      {badge.label}
    </span>
  )
}
