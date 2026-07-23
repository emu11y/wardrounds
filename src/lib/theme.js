// Canonical glassmorphic card surface (project design rule §1.6). Previously
// retyped verbatim in MyAppointments.jsx, AuthCallback.jsx, Analytics.jsx,
// components/PageGuard.jsx and ModalShell.jsx's SURFACE.solid. Import this base
// and compose site-specific padding/shadow/sizing on top, e.g.
//   className={`${GLASS_CARD} p-4 shadow-sm`}
export const GLASS_CARD = 'bg-white/90 backdrop-blur-xl border border-white/60 rounded-2xl'

// Calendar status → visual style map (single source of truth; plan §3.3).
// Colour rule (updated 19 Jul 2026): green = RSVP'd ONLY, amber = no RSVP yet,
// red = blocked, pink = seen/completed, purple = adhoc "other booking". Grey
// is reserved for neutral/non-status states (free slots, closed badges) — it
// is never used for an active status, so it never collides with a status dot.
// Matches OUTPATIENT_STATUS_STYLE.seen in lib/statusBadges.js (also pink), so
// "seen" reads the same colour on the calendar and on the Outpatient/Patients
// visit badges.
//
// rsvp_status is written ONLY by the whatsapp-webhook edge function when a
// patient taps a quick-reply button, and its two values are 'confirmed' and
// 'reschedule_requested' (see supabase/functions/whatsapp-webhook/index.ts and
// WARDROUNDS_SQL_WHATSAPP_PHASE2_RSVP_TEST.sql). The style key must match those
// values — an earlier draft used 'declined', which nothing ever writes, so the
// state was unreachable. Where WhatsApp is off for a team, rsvp_status stays
// null for every visit and visitStatusKey() returns 'pending' (amber).
export const VISIT_STATUS_STYLES = {
  confirmed:  { dot: 'bg-green-400',  card: 'bg-green-50 hover:bg-green-100 border-green-400',   title: 'text-green-900',  sub: 'text-green-600',  label: "RSVP'd" },
  pending:    { dot: 'bg-amber-400',  card: 'bg-amber-50 hover:bg-amber-100 border-amber-400',   title: 'text-amber-900',  sub: 'text-amber-600',  label: 'No RSVP' },
  reschedule: { dot: 'bg-amber-500',  card: 'bg-amber-50 hover:bg-amber-100 border-amber-500',   title: 'text-amber-900',  sub: 'text-amber-600',  label: 'Reschedule' },
  blocked:   { dot: 'bg-red-400',    card: 'bg-red-50 hover:bg-red-100 border-red-400',         title: 'text-red-700',    sub: 'text-red-500',    label: 'Blocked' },
  seen:      { dot: 'bg-pink-400',   card: 'bg-pink-50 hover:bg-pink-100 border-pink-400',      title: 'text-pink-900',   sub: 'text-pink-600',   label: 'Seen' },
  adhoc:     { dot: 'bg-purple-400', card: 'bg-purple-50 border-purple-400',                    title: 'text-purple-900', sub: 'text-purple-600', label: 'Other booking' },
}

export function visitStatusKey(visit) {
  if (!visit) return 'pending'
  if (visit.status === 'blocked') return 'blocked'
  if (visit.status === 'seen' || visit.status === 'closed') return 'seen'
  if (visit.rsvp_status === 'confirmed') return 'confirmed'
  if (visit.rsvp_status === 'reschedule_requested') return 'reschedule'
  return 'pending'
}

// Longer, patient-facing wording for the RSVP badge (the calendar legend needs
// short labels; a visit card can afford the full phrase). Keyed by the raw
// rsvp_status column value — anything else (including null) renders no badge.
export const RSVP_BADGES = {
  confirmed:            { key: 'confirmed',  label: 'Confirmed' },
  reschedule_requested: { key: 'reschedule', label: 'Reschedule requested' },
}
