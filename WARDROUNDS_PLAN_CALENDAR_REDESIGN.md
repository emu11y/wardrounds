# WardRounds — Booking Calendar Redesign + RSVP Plan
### Status: PLAN ONLY — mockup reviewed & revised with Emu, no code written yet · 19 Jul 2026 (v2)

**Decisions (Emu, 19 Jul, via chat mockup review):**
Day + Week + Month views · free slots as slim clickable gaps (consecutive free slots collapse) · **status colours: green = RSVP'd, amber = no RSVP, red = blocked, grey = seen, purple = adhoc/other booking** · collapsible right-rail cards with visible chevrons · new "Blocked dates" rail card (ranges + reason, from existing block data) · patient booking search in header · "squeeze in" second booking on no-RSVP slots · **RSVP via tokenised public link** (attend / can't make it + reason / reschedule request) · WhatsApp RSVP button ships as **v2 template batch AFTER current batch approves + Phase 5 E2E passes**; email link ships first · plan doc only this session.

---

## 1. Problem

`src/pages/MyAppointments.jsx` (959 lines) renders the booking calendar as a flat grid of 31 identical half-hour chips (06:00–21:00), a bare date input, doctor pills, and an "Other Bookings" card. Works, but generic. The reviewed mockup (chat, 19 Jul, v2) defines the target: proportional day timeline with status-coloured event cards, Day/Week/Month toggle, collapsible rail (mini month · agenda · blocked dates · counts), patient search, mobile week strip. Structure from the mock, skin stays glassmorphic + pill + #007AFF.

### Out of scope
Consultation rooms · all-day events · variable slot durations · drag-to-reschedule · multi-doctor overlay · WhatsApp inbound webhook (ruled out — shared number across teams; the RSVP link carries team/visit identity instead).

---

## 2. Interaction parity checklist — nothing may regress

| # | Behaviour | Today's trigger | New home |
|---|---|---|---|
| 1 | Book empty slot → `NewVisitModal` | click green chip | click slim gap row |
| 2 | Block mode (tap-to-block + reason) | toggle button | unchanged; gaps get red hover |
| 3 | Block range → `BlockRangeModal` | button | unchanged; output also feeds Blocked-dates rail card |
| 4 | Unblock | click red chip | click blocked event card |
| 5 | Booked modal: check-in / cancel / reschedule / remind | click blue chip | click event card (+ new "Patient confirmed" toggle) |
| 6 | Reschedule target picking | dashed chips | dashed gap rows |
| 7 | Adhoc bookings + tag scan | card below grid | purple cards inline on timeline + existing card |
| 8 | Doctor pills | above date | header row |
| 9 | `prefillPatient` via location.state | on mount | unchanged |
| 10 | Email + WhatsApp confirmation in `NewVisitModal` | on booking | **no-touch zone** (see §6.3) |
| 11 | Counts | header badges | rail summary: Free / RSVP'd / No RSVP / Blocked |

---

## 3. Architecture

### 3.1 Component split (`src/components/calendar/`)

```
CalendarHeader.jsx   Today · ‹ › · date title · Day/Week/Month segmented pill
PatientBookingSearch.jsx  pill search input + results dropdown (header row)
DayTimeline.jsx      time-axis day view
WeekGrid.jsx         7-column week view
MonthGrid.jsx        month matrix, density dots, blocked days tinted red
MiniMonth.jsx        rail mini calendar (dots; blocked days red-tinted)
WeekStrip.jsx        mobile 7-day pill strip
CalendarRail.jsx     desktop rail: 4 collapsible cards (chevron headers)
BlockedDatesCard.jsx ranges + reasons, e.g. "12 – 20 Jul 2026 · ECo conference"
EventCard.jsx        status-coloured card (green/amber/red/grey/purple)
SlotGap.jsx          slim "+ Book" row; collapsed multi-slot variant
calendarUtils.js     date math + blocked-range aggregation + slot collapsing
```

`MyAppointments.jsx` stays the page shell (state, data, modals).

### 3.2 Data layer — new functions in `src/lib/api.js`

```
fetchScheduleForRange(teamId, doctorId, from, to)      week view
fetchAdhocBookingsRange(teamId, from, to, doctorId)    week view
fetchMonthDensity(teamId, doctorId, from, to)          month + mini month (visit_date, status only)
fetchBlockedRanges(teamId, doctorId, from)             future blocked visits → grouped client-side
                                                        by consecutive dates + same notes value
fetchPatientBookings(teamId, patientQuery)             search: patient's upcoming visits
```

Blocked-dates card is pure aggregation of existing block/block-range data — **no schema change**.

### 3.3 Status → colour map (single source in `theme.js`)

| Status | Colour | Meaning |
|---|---|---|
| `rsvp = confirmed` | green #34C759 | patient confirmed attendance |
| `rsvp = none` (scheduled) | amber #FF9500 | no RSVP — squeeze-in candidate |
| `rsvp = declined` | amber + flag | freed for rebooking, reason shown |
| `blocked` | red #FF3B30 | reason in notes |
| `seen` | grey | completed |
| adhoc | purple #AF52DE | "Other booking" tag |

**Build-time check:** verify the real status enum + adhoc discriminator before finalising.

### 3.4 RSVP subsystem (new)

**Why a link, not replies:** the WhatsApp number is shared by unrelated teams, so inbound replies can't be attributed (webhook ruled out). A tokenised link carries visit + team identity implicitly.

**Schema (one SQL, TEST first):** on `outpatient_visits`:
`rsvp_token uuid default gen_random_uuid()`, `rsvp_status text default 'none'` (`none|confirmed|declined|reschedule_requested`), `rsvp_at timestamptz`, `rsvp_note text` (decline reason / proposed slot).

**Public page:** `/rsvp/:token` route on wardrounds.site — no login, mobile-first, shows only date/time/clinic. Three actions:
1. **"Yes, I'll be there"** → confirmed.
2. **"I can't make it"** → reason (short free text) → declined; slot flagged amber for rebooking.
3. **"Request a new time"** → public slot picker (free/busy only for that doctor) → patient proposes a slot → `reschedule_requested` + proposed slot in `rsvp_note`. **Staff confirm in-app** (badge on the visit card → booked modal shows proposal → accept = reschedule, existing function). *Open decision: direct self-service rebooking (patient's pick books instantly) — deferred; staff-confirm is the MVP.*

**Edge function `rsvp/`:** GET token → minimal visit info + availability (service role, token-only lookup — RLS stays closed; needs its own `deno.json`); POST token + action → status update, rate-limited, idempotent. Nothing patient-identifying beyond first name.

**Channels:**
- **Email first:** RSVP link added to reminder + confirmation emails — no approval process, ships with the calendar work.
- **WhatsApp second:** Meta URL button with dynamic suffix (`wardrounds.site/rsvp/{{token}}`) requires **new v2 templates → re-review**. Sequenced strictly AFTER the current 5 templates approve and Phase 5 E2E passes. Then: submit v2 batch → on approval, switch template names in `whatsapp.ts`/`whatsapp.js` (documented mirror pair) → retire v1.
- **Manual fallback:** "Patient confirmed" toggle in `BookedSlotModal` for phone confirmations.

**Reminder logic touch:** `send-reminders` unaffected initially (reminders go out regardless of RSVP). Later option: skip reminders for declined visits — note in code, don't build yet.

### 3.5 Squeeze-in (double-booking on no-RSVP slots)

Amber cards get a "+ squeeze in" pill → opens `NewVisitModal` for the same slot. Requires: slot map becomes slot → visit[] (verify no DB unique constraint on doctor+date+time), timeline stacks two cards in one slot row, reminders naturally go to both. Gap rows and counts treat a squeezed slot as booked.

---

## 4. View specs (delta from mockup v2)

- **Day timeline:** grey seen cards, green RSVP'd (check icon), amber no-RSVP (help icon + squeeze-in pill), merged red blocked card, purple adhoc, dashed collapsed gap rows ("9:30 – 10:30 · 2 slots free"), current-time line.
- **Header:** Today/arrows/title + segmented pill + **patient search** (≥2 chars → dropdown of patient's bookings with status dots; click result → jump to that day). Doctor pills below.
- **Rail (desktop, Day view only):** four collapsible cards — Mini month (blocked days red-tinted) · Today's agenda · **Blocked dates** (ranges + reason, "Today, 10:30 – 12:00 · Theatre" for partial days) · counts (Free / RSVP'd / No RSVP / Blocked). Chevron state persisted in localStorage.
- **Week view:** 7 columns, compact status-coloured chips, blocked segments, click empty cell → book that date+slot (via existing `slotDate` prop).
- **Month view:** matrix + density dots; whole blocked days tinted red; click day → Day view.
- **Mobile:** week strip + timeline + compact summary bar; rail cards render as collapsible sections below the timeline; search in header.

---

## 5. Build order

| Phase | Content | Size |
|---|---|---|
| 0 | Component extraction + `calendarUtils` + colour map — zero visual change | M |
| 1 | Range/blocked/search fetchers in `api.js` | S |
| 2 | Day timeline (cards, gaps, merged blocks, time line) | L |
| 3 | Header + segmented pill + patient search + WeekStrip + MiniMonth | M |
| 4 | RSVP schema SQL (Emu, TEST) + edge fn + `/rsvp/:token` page + email link + manual confirm toggle + amber/green rendering | L |
| 5 | Week view | M |
| 6 | Month view + BlockedDatesCard + collapsible rail | M |
| 7 | Squeeze-in double-booking | M |
| 8 | Polish, mobile summary bar, PWA safe-areas, QA vs parity list | M |
| — | **Later, after WA v1 approval + Phase 5 E2E:** v2 WhatsApp templates with RSVP URL button; swap names in the whatsapp mirror pair | M |

Suggested sessions: 0–2 · 3–4 · 5–6 · 7–8.

**Emu's commands:** `npm run build` per phase · `git add -A && git commit -m "calendar: phase N — …"` on `dev` · RSVP schema SQL in TEST SQL Editor (end `NOTIFY pgrst, 'reload schema'`) · `supabase functions deploy rsvp --project-ref ewkjhqhszbxnizqbosod` when Phase 4 lands.

---

## 6. Risks & notes

1. **Date math:** reuse `todayStr()` + noon-anchor trick; all bounds via `calendarUtils`.
2. **Adhoc off-grid times:** snap card to nearest slot, print real time.
3. **`NewVisitModal` + `send-reminders` are no-touch zones** until WA v1 E2E passes (WhatsApp logic just shipped through them). RSVP email link goes in the email templates/sender, not the modal flow. If unavoidable, stop and flag.
4. **RSVP page security:** token is the only credential — unguessable uuid, no enumeration (constant-time-ish responses), no PII beyond first name + slot, rate-limit POSTs.
5. **Blocked-range aggregation:** group by consecutive dates + identical notes; partial-day blocks listed with times.
6. **Squeeze-in:** confirm no unique constraint on (doctor, date, slot); check `slotKeyFromVisit` consumers for 1:1 assumptions.
7. **Template v2 timing:** never edit the in-review v1 batch — edits reset review. v2 = new template names.
8. **PWA:** new fixed elements respect safe-area insets; mind the pinned grey-bar carry-over.

---

## 7. Definition of done

Parity list passes on TEST · RSVP round-trip works from a real email link on a phone (confirm, decline + reason, reschedule request → staff accept) · colour coding consistent across timeline/week/month/rail/search · anchor date survives view switches · 390px + 1440px verified · `npm run build` clean · handoff updated.
