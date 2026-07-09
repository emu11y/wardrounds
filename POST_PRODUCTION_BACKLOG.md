# WardRounds — Post-Production Backlog

> Living list of major post-launch initiatives. **Hand this over (updated) with every session handoff summary.** Items are not in strict priority order — sequence with Emu. Each needs Emu direction and/or credentials before build.

_Last updated: 9 Jul 2026_

---

## 1. Landing pages — complete overhaul (standardise mobile + desktop UX)

**Goal:** One coherent, simpler landing experience across mobile and desktop.

- Standardise the UX so mobile and desktop tell the same story with the same components — no divergent designs.
- Simplify the animations and the build: cut heavy dependencies and effects that add complexity without clear UX value (framer-motion weight, Lenis smooth-scroll quirks, stacked blur layers).
- **Strictly DRY:** one set of section components consumed by both breakpoints. **Completely remove the old/superseded landing pages** once the new one is in place — no dead `Landing.jsx` / `MobileLanding.jsx` split left behind.
- Success measure: fast first paint on a mid-range phone, no scroll/animation jank, and a single source of truth for landing content.

## 2. Super-user (platform admin) account — oversee all teams

**Goal:** A privileged account above individual teams for platform oversight.

- See how many teams are registered with WardRounds.
- View team details and the number of users per team.
- Manage each team's subscription to WardRounds.
- **Security is critical:** this crosses the per-team RLS boundary, so it needs a dedicated, tightly-scoped access path (e.g. a `platform_admin` role checked server-side in Edge Functions / SECURITY DEFINER views), never a client-side bypass. Register and gate it in `src/lib/permissions.js` like every other capability.

## 3. Safaricom Daraja — payment system

**Goal:** Accept payments via M-Pesa (Daraja API).

- Integrate STK Push / C2B as appropriate for invoice settlement.
- Credentials (consumer key/secret, passkey, shortcode) stay with Emu; the app configures around them, secrets live in Edge Function config only.
- Ties into the accounting page (item 5) and the existing invoice flow.

## 4. SMS — booking + notification updates

**Goal:** Send booking confirmations and status/notification updates by SMS.

- Provider: Africa's Talking (per prior planning) or equivalent.
- Triggers: appointment booked / rescheduled / cancelled, reminders, and other key notifications.
- Sender credentials held by Emu; sending runs server-side via an Edge Function, gated by permissions.

## 5. Accounting page — robust per-team accounting

**Goal:** A proper accounting view for each team.

- Track invoices, payments (incl. M-Pesa from item 3), outstanding balances, and revenue.
- Mark-as-paid workflow, statements/reporting, and export.
- Must respect team RLS and the permissions model; expose as an admin-toggle page in Settings.

---

### Notes
- All five must follow the project's non-negotiable workflow rules: strictly DRY, surgical edits, glassmorphic design, RLS via `current_user_team_id()`, every new page/action registered + gated in `src/lib/permissions.js`, and `npm run build` clean + browser-verified before "done".
- Keep this file current: when an item ships, move it out; when scope changes, edit it here so the next session inherits the truth.
