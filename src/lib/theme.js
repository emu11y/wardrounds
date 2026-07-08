// Canonical glassmorphic card surface (project design rule §1.6). Previously
// retyped verbatim in MyAppointments.jsx, AuthCallback.jsx, Analytics.jsx,
// components/PageGuard.jsx and ModalShell.jsx's SURFACE.solid. Import this base
// and compose site-specific padding/shadow/sizing on top, e.g.
//   className={`${GLASS_CARD} p-4 shadow-sm`}
export const GLASS_CARD = 'bg-white/90 backdrop-blur-xl border border-white/60 rounded-2xl'
