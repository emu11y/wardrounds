# WardRounds — Colour Palette Transition Plan
### Status: PLAN ONLY — no code changed, no tokens touched · 19 Jul 2026

**New palette (Emu-supplied, uploaded reference image):** `#5BD1D7` light aqua · `#348498` mid teal · `#004D61` deep teal-navy · `#FF502F` bright orange-red. **The two MAIN colours are the last two: `#004D61` and `#FF502F`.** Intent: make the app read as bright and catchy, not the current muted iOS-system look.

This document maps every current colour use in the app to the new palette, phases the rollout, and flags every conflict found — headline conflict: **`#FF502F` is nearly the same colour as the existing "blocked" status red**, confirmed by contrast math below, not just eyeballing. Nothing in this document should be treated as approved for implementation until the open decisions in §8 are answered.

---

## 1. Design principle this plan is built on

This session's earlier work (green → RSVP'd-only, pink → seen) established a rule the hard way: **a colour that means something specific (a status) must never be reused as a general-purpose brand/UI colour**, or the two meanings collide the moment they appear on the same screen. That rule governs every decision below:

- **Brand/structural tokens** (navigation, primary buttons, links, focus rings, sidebar, "this is WardRounds" chrome) — this is what the new 4-colour palette replaces.
- **Semantic/status tokens** (`VISIT_STATUS_STYLES` in `theme.js`, `OUTPATIENT_STATUS_STYLE` in `statusBadges.js` — green/amber/red/pink/purple/grey) — this is a *separate* system that must stay internally consistent and must not collide with whatever the new brand colours turn out to be. It is **not** being replaced by this transition, except where a specific new brand colour collides with it (see §5).

Conflating these two systems is exactly what caused the RSVP-green and seen-badge bugs fixed earlier today. This plan keeps them deliberately separate.

---

## 2. Current-state colour map (condensed from full repo audit)

### 2.1 Brand/CTA — the primary thing being replaced
- **`ios-blue` / `#007AFF`** (`tailwind.config.js:9`) — the app's single brand colour today, doing double duty as both *structural* colour (active nav item, sidebar highlights, selected-date rings, "this is where you are") and *action* colour (Save/Book/Confirm buttons, links, focus rings). Used across **27+ files**, heaviest in `Outpatient.jsx`, `Settings.jsx`, `Patients.jsx`, `NewVisitModal.jsx`, `LogVisitModal.jsx`, `Sidebar.jsx`, `AdmitPatient.jsx`, `InstallModal.jsx`. Also present as raw inline hex (~120+ hits) in Analytics charts, calendar "today" markers, auth pages, onboarding.
- Darker gradient/pressed-state stops riding alongside it: `#0066DD` / `#0055CC` / `#0051D5` / `#0066CC` (button gradients), `#3B82F6` (Tailwind `blue-500`, used as a fallback/secondary accent in `Settings.jsx` hospital-colour picker and `billing.js`'s `wardColor()` fallback).
- Codified as a reusable class: `.ios-blue-btn` in `src/styles/globals.css:74-78` (note: its hover state already hardcodes plain Tailwind `blue-600`, not an `ios-*` token — a small pre-existing inconsistency worth fixing in the same pass).

### 2.2 The sidebar's `#023859` card (shipped earlier today)
- `src/components/Sidebar.jsx:277` — the glassmorphic account-menu card, `bg-[#023859]/85`. This was a one-off custom hex, not a config token. **It's already almost the same colour as the new palette's `#004D61`** — see §5.2.

### 2.3 Semantic/status colours — NOT being replaced (only checked for collisions)
Single source of truth: `VISIT_STATUS_STYLES` in `src/lib/theme.js` and `OUTPATIENT_STATUS_STYLE` in `src/lib/statusBadges.js`, both already internally consistent as of today's earlier fixes:

| Status | Colour | Meaning |
|---|---|---|
| `confirmed` | green (`green-400/50/900/600`) | RSVP'd — **and only this** |
| `pending` / `declined` | amber (`amber-400/500`) | no RSVP / can't attend |
| `blocked` | red (`red-400/700/500`) | blocked slot |
| `seen` | pink (`pink-400/50/900/600`) | seen/completed (matches `statusBadges.js`) |
| `adhoc` | purple (`purple-400/50/900/600`) | other/walk-in booking |
| *(free/closed/neutral)* | grey | never an active status — deliberately neutral |
| `scheduled` (outpatient badge only) | `blue-100/700` (plain Tailwind blue, **not** `ios-blue`) | already kept distinct from the brand blue on purpose |

### 2.4 Charts — `Analytics.jsx`
Recharts series currently reuse `ios-blue` / `ios-green` / `ios-orange` (`#FF9500`) / `ios-purple` (`#AF52DE`) as a 4-colour categorical sequence, plus `#e2e8f0` grid lines. This needs its own mapping pass (§7, Phase 4) — a chart needs several distinguishable series colours, which a 2-main-colour brand system can't supply alone.

### 2.5 Landing/marketing pages — separate palette already, out of scope
`src/pages/landing/*` layers a **violet accent `#8B5CF6`** (not in `tailwind.config.js` at all) plus its own dark-navy gradient backgrounds (`#020617`, `#0a1226`, `#1a1f5e`, etc.) on top of `#007AFF`. This is a materially different, marketing-specific system. **Recommendation: explicitly out of scope for this transition** — swapping it needs its own design/stakeholder pass, not a mechanical token swap, and mixing it into this plan risks scope creep into the highest-visibility pages with the least token discipline.

### 2.6 Dark mode — vestigial, not a real feature
`darkMode: 'class'` is configured and 23 `dark:` classes exist across 11 files, but **nothing in the codebase ever adds/removes/toggles the `.dark` class** — confirmed via grep for any toggle mechanism. These classes cannot currently activate. Not blocking for this plan; see §7 Phase 6 for a disposal recommendation.

---

## 3. New palette → role mapping

The four new colours already form a coherent shape: `#5BD1D7` / `#348498` / `#004D61` sit in a tight 183°–192° hue band (light → mid → deep teal), and `#FF502F` sits alone at 10° hue — a genuine complementary accent. That shape maps naturally onto a **3-step structural ramp + 1 attention colour** system:

| New token (proposed name) | Hex | HSL | Role |
|---|---|---|---|
| `brand.deep` **(MAIN)** | `#004D61` | 192°, 100%, 19% | Primary structural colour — navigation active states, sidebar, headers, primary surfaces, "current location" indicators. Replaces `ios-blue`'s *structural* usages. |
| `brand.pop` **(MAIN)** | `#FF502F` | 10°, 100%, 59% | Primary action/attention colour — CTA buttons (Save/Book/Confirm/New Visit), links, focus rings. Replaces `ios-blue`'s *action* usages. This is the "bright and catchy" colour. |
| `brand.teal` | `#348498` | 192°, 49%, 40% | Secondary — hover/pressed state of `brand.deep`, secondary buttons, secondary nav accents, info-tinted surfaces. Candidate replacement for the little-used `ios-teal` (`#5AC8FA`). |
| `brand.aqua` | `#5BD1D7` | 183°, 61%, 60% | Tertiary/highlight — light tinted backgrounds, translucent avatar/badge fills (today's `bg-ios-blue/20` pattern), hover backgrounds, chart accents. **Needs dark text on top — see §6.** |

Why split `ios-blue`'s dual role: today the same blue means both "you are here" (structural) and "click me" (action). Splitting them across `brand.deep` (dark, calm, structural) and `brand.pop` (bright, loud, action) is what actually delivers "bright and catchy" — a uniformly-recoloured single blue-replacement would not; it would just be a different flat colour doing the same undifferentiated job.

---

## 4. Old → new mapping table (by current usage category)

| Current | New | Notes |
|---|---|---|
| `ios-blue` structural uses (active nav item, sidebar highlight, selected-date ring, "current" state) | `brand.deep` (`#004D61`) | See §7 Phase 2 for the file-by-file reclassification needed — this is not a blind find/replace. |
| `ios-blue` action uses (primary buttons, links, focus rings, `.ios-blue-btn`) | `brand.pop` (`#FF502F`) | Same caveat — reclassify per instance. Also fix `.ios-blue-btn`'s hardcoded `hover:bg-blue-600` to a `brand.pop` hover shade in the same pass. |
| `#0066DD`/`#0055CC`/`#0051D5` (CTA gradient dark stops) | `brand.deep` or a computed darker `brand.pop` shade | Decide per-button whether the gradient partner is structural or action-toned. |
| `#3B82F6` (`Settings.jsx` hospital-colour picker default, `billing.js` ward-colour fallback) | Keep as a distinct Tailwind blue, **not** touched | These are *user-facing colour pickers* for hospitals/wards — unrelated to brand identity, changing them would silently relabel existing hospital colour choices. Out of scope. |
| Sidebar `#023859` | `brand.deep` (`#004D61`) | Near-identical already (contrast ratio 1.30 between them — practically the same colour). See §5.2. |
| `ios-teal` (`#5AC8FA`, low usage — service-category colours in `Settings.jsx`) | Audit usage first; likely folds into `brand.teal` | Confirm actual usage count in Phase 0 before deciding. |
| Analytics chart series (`ios-blue/green/orange/purple`) | `brand.deep` + `brand.pop` as the two "primary metric" series, semantic green/amber/purple kept for status-shaped data | See §7 Phase 4 — needs its own design pass, not a mechanical swap. |
| `VISIT_STATUS_STYLES` / `OUTPATIENT_STATUS_STYLE` (green/amber/red/pink/purple/grey) | **Unchanged**, except `blocked` red — see §5.1 | This is the semantic system from §2.3; it is deliberately not part of the brand swap. |
| Landing pages (`#8B5CF6` violet, dark-navy gradients) | **Unchanged — explicitly out of scope** | See §2.5. |
| `ios-gray-*` scale | **Unchanged** | Confirmed neutral, never a status or brand colour; no relationship to this transition. |

---

## 5. Conflicts — must be resolved before Phase 2 ships

### 5.1 `#FF502F` vs the existing "blocked" status red — real, measured, not cosmetic

Computed WCAG contrast ratio between `#FF502F` and the calendar's current blocked-status reds:

| Pair | Contrast ratio | Hue distance |
|---|---|---|
| `#FF502F` vs `ios-red` `#FF3B30` (old brand red, still referenced in `globals.css`) | **1.09** | 7° |
| `#FF502F` vs `red-400` (`VISIT_STATUS_STYLES.blocked.dot`) | **1.18** | 10° |
| `#FF502F` vs `red-500` (`.blocked.sub`) | **1.15** | 10° |
| `#FF502F` vs `red-700` (`.blocked.title`) | **1.98** | 10° |
| `#FF502F` vs `amber-400` (`.pending.dot`) | **1.95** | 33° |

A contrast ratio near 1.0 means "virtually the same brightness and hue" — these numbers confirm the two colours are close enough that a bright-orange "Book Appointment" CTA button sitting near a red "Blocked" calendar dot will read as *the same colour family*, especially for red-green colourblind users (the two most common forms of colour vision deficiency compress exactly this red–orange region). This is not a hypothetical risk — it's the same class of bug as this morning's green collision, just on a different hue.

**This must be resolved before `#FF502F` ships anywhere near the calendar.** Options for Phase 3 to choose between (decision owner: Emu):
1. **Shift "blocked" further from red toward maroon/brick** (e.g. Tailwind `rose-800`/`red-900`, a dark desaturated red) so it separates from `#FF502F` on both hue and lightness, not just hue.
2. **Keep "blocked" as-is, restrict `#FF502F` to UI chrome that never appears adjacent to status dots** (buttons, links) and never use it as a dot/badge fill — reduces collision surface but doesn't eliminate it if a button and a blocked dot ever appear in the same view (they already do, e.g. the "Book" CTA and a blocked-slot dot in the same day-view card).
3. **Add a non-colour cue to "blocked"** beyond the dot (e.g. a diagonal-hash pattern, or lean harder on the existing text label — `VISIT_STATUS_STYLES.blocked.label` already says "Blocked" everywhere a dot appears, which helps, but dot-only contexts like the week-view timeline exist too).

Recommendation for the plan (not yet a decision, needs Emu sign-off): **combine 1 and 3** — move blocked to a dark brick red and confirm every dot-only surface still carries a label or icon nearby.

### 5.2 Sidebar `#023859` vs new `#004D61`

Contrast ratio between the two: **1.30** — they are practically the same colour already (the sidebar card was built a few hours before this palette arrived, and happened to land almost exactly on the new deep-teal target). **Recommendation: replace `#023859` with the token `brand.deep` (`#004D61`) outright** in Phase 2 — this is a near-zero-visible-change, low-risk consolidation that removes a duplicate one-off hex from the codebase and folds the sidebar card into the new token system for free.

### 5.3 `#FF502F` white-text contrast — borderline, needs per-component care

| Background | Text colour | Contrast | WCAG AA normal text (4.5) | WCAG AA large text/UI (3.0) |
|---|---|---|---|---|
| `#FF502F` | white | 3.26 | ❌ fails | ✅ passes |
| `#348498` | white | 4.29 | ❌ fails (barely) | ✅ passes |
| `#004D61` | white | 9.40 | ✅ passes | ✅ passes |
| `#5BD1D7` | white | 1.82 | ❌ fails badly | ❌ fails |
| `#5BD1D7` | `#004D61` (dark) | 5.17 | ✅ passes | ✅ passes |

Implications:
- **`#5BD1D7` (aqua) must always pair with dark text** (`brand.deep` or black), never white. It's a light-background tint colour, not something to put white text on.
- **`#FF502F` and `#348498` buttons with small white text are a real accessibility risk** — both fail AA for normal-size text. Every button using these as a fill needs either (a) bold/large text (≥14px bold or ≥18px regular, satisfying the 3:1 UI-component threshold most CTA buttons already meet), or (b) dark text instead of white, decided per-component during Phase 2, not assumed globally.

### 5.4 Chart series need more than 2 colours

`Analytics.jsx` currently uses a 4-colour categorical palette. The 2 "main" brand colours can't alone supply a readable multi-series chart. Phase 4 needs to decide whether chart series borrow from the full 4-colour brand ramp, mix in the (unchanged) semantic colours, or get their own small chart-specific palette — this is a design decision, not something this plan should pre-empt.

### 5.5 Landing pages will look inconsistent with the app during the transition window

Once the in-app brand colour changes but landing pages keep `#007AFF` + `#8B5CF6`, a user going from marketing site → login → app will see two different brand colours. Acceptable for a phased rollout (the alternative — blocking the whole transition on a landing-page redesign — is worse), but worth flagging as a known, temporary side effect rather than an oversight.

---

## 6. Accessibility checklist (carried into Phase 3, not optional)

- [ ] Run every brand-colour + text-colour pairing actually shipped through a contrast checker (WebAIM or equivalent) — §5.3's numbers cover the obvious pairings but not every gradient/hover state.
- [ ] Colourblindness simulation (e.g. Stark, Coblis, or Chrome DevTools' vision-deficiency emulation) specifically comparing `#FF502F` against the calendar's red/amber status dots — this is the single highest-risk pairing in the whole transition (§5.1).
- [ ] Confirm every status indicator that relies on colour also has a non-colour cue (label text, icon, position) — spot-checked as already true for `VISIT_STATUS_STYLES` (each has a `.label`), needs re-confirming after any hue changes from §5.1.
- [ ] `#5BD1D7` never used as a background for white/light text (§5.3).
- [ ] Any button using `#FF502F` or `#348498` fills is checked individually for text contrast, not assumed safe.
- [ ] Focus-ring visibility re-tested once `brand.pop` replaces `ios-blue` as the focus colour — focus rings are a pure-accessibility feature and easy to regress silently.

---

## 7. Phased rollout

| Phase | Scope | Deliverable | Risk | Rollback |
|---|---|---|---|---|
| **0 — Audit & sign-off** | No code. Confirm `ios-teal` actual usage count; resolve §5.1's blocked-red decision with Emu; confirm token names in §3. | This document, finalised, plus a short decisions log. | None (no code touched) | N/A |
| **1 — Tokens foundation** | Add `brand.aqua/teal/deep/pop` to `tailwind.config.js` (additive — `ios.*` untouched, nothing visually changes yet). Mirror as CSS custom properties in `globals.css` alongside the existing `--ios-*` vars. | New tokens exist, compile, unused by any component yet. | Near-zero — purely additive | Delete the new config block |
| **2 — Structural/CTA surfaces** | File-by-file reclassification of every `ios-blue` usage (the ~27-file list in §2.1) into structural (→`brand.deep`) vs action (→`brand.pop`), starting with the sidebar (fold in `#023859`, §5.2) and the highest-traffic surfaces (calendar, Outpatient, Settings, modals). Fix `.ios-blue-btn`'s stray `hover:bg-blue-600`. Each surface gets a visual-mock verification pass (same technique used for the sidebar/calendar work today — screenshot against real compiled CSS before/after) before moving to the next. | App's structural/CTA colour fully migrated, surface by surface, each independently reviewable/revertable. | Medium — highest-visible-surface change in the app | Each surface is its own commit; revert per-surface if a screen reads worse |
| **3 — Status/semantic reconciliation** | Resolve §5.1 (blocked-red vs `brand.pop`) using whichever option Emu picked in Phase 0. Re-run the full status-legend consistency check (the same rigor applied to green/pink earlier today) across `theme.js` + `statusBadges.js` against the *final* brand colours, not just the semantic set in isolation. | Zero colour collisions between brand and status systems, verified, not assumed. | Low-medium — small, well-scoped set of files (`theme.js`, `statusBadges.js`, their consumers) | Single-file revert |
| **4 — Charts & data viz** | `Analytics.jsx` recharts series repainted per §5.4's decision. | Charts readable and on-brand. | Low — isolated to one page | Single-file revert |
| **5 — Peripheral surfaces** | Auth pages, onboarding (`WelcomeModal`/`TooltipTour`), PWA `InstallModal`, transactional email templates (`email.js` — separate inline-hex system, not Tailwind). Landing pages explicitly **excluded** (§2.5) — revisit as its own initiative if wanted. | Full in-app coverage except marketing pages. | Low | Per-file |
| **6 — Cleanup (optional/stretch)** | Decide fate of the vestigial `dark:` classes (§2.6) — either wire up real dark mode using `brand.deep` as a natural dark-mode anchor (it's already dark), or strip the dead classes. Not blocking; can slip indefinitely without affecting Phases 1-5. | Either a working dark mode or a smaller, honest codebase. | None — currently inert either way | N/A |

Each phase after Phase 1 should ship as its own PR/commit set, verified visually the same way this session's calendar/sidebar work was verified: build the real Tailwind CSS, mock the actual JSX output against it, screenshot at mobile + desktop widths, compare before/after — not just "looks right in the diff."

---

## 8. Open decisions needing Emu's sign-off before Phase 2 starts

1. Token names — `brand.deep`/`brand.pop`/`brand.teal`/`brand.aqua` (proposed) vs alternatives?
2. §5.1 — which of the three "blocked" resolution options (or the combined recommendation) to take?
3. Does `ios-blue` get fully retired once migration completes, or kept permanently as an alias to `brand.deep` for any stragglers?
4. `ios-teal` (`#5AC8FA`) — confirmed low-usage in Phase 0; fold into `brand.teal` or leave alone?
5. Landing pages — confirmed out of scope for now, or should a lightweight follow-up plan be scoped separately?
6. Phase 6 dark mode — worth reviving, or strip the dead `dark:` classes as pure cleanup?

---

## 9. Non-goals

- No landing/marketing page changes (§2.5).
- No changes to user-facing colour *pickers* (hospital colours, ward colours) — those are data the user chose, not brand chrome.
- No dark-mode implementation unless Phase 6 is explicitly greenlit later.
- No code changes of any kind in this session — this document only.
