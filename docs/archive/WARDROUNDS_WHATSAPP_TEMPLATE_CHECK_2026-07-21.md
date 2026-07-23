# WardRounds — WhatsApp Template Approval Check — 21 Jul 2026, morning (automated)

**Automated scheduled-task run** (`wardrounds-whatsapp-approval-check-2026-07-21-am`). Emu not present.

## Result: ✅ ALL FIVE v2 TEMPLATES APPROVED — the blocker is cleared

Opened WhatsApp Manager and read the Status column directly on the client-rendered grid (TEST WABA `1512386093333740`, business_id `1239450534066576`, `read_page filter=all`). All five v2 `appt_*` templates have flipped from **In review** to **Active** — none rejected:

| Template | Category | Language | Status | Last edited |
|---|---|---|---|---|
| `appt_reminder_1w` | Utility | English | **Active** (quality pending) | Jul 19, 2026 |
| `appt_reminder_1d` | Utility | English | **Active** (quality pending) | Jul 19, 2026 |
| `appt_reminder_dayof` | Utility | English | **Active** (quality pending) | Jul 19, 2026 |
| `appt_confirmation` | Utility | English | **Active** (quality pending) | Jul 19, 2026 |
| `appt_manual` | Utility | English | **Active** (quality pending) | Jul 19, 2026 |

"**Active - Quality pending**" = the template is **approved and sendable**; "quality pending" only means Meta hasn't yet accumulated enough send volume to assign a quality rating. It is not a review state. (The `jaspers_market_*` and `hello_world` rows are unrelated Meta samples — ignored.)

No morning re-check needs to be rescheduled — this run was the pending one-time check and it fired; there is nothing left in review. No further template checks are queued.

## What this unblocks

Nothing to build. Phase 5 (v1 utility templates) E2E already **PASSED**; all Phase 6 RSVP code + inbound webhook are **built, deployed to TEST, and live** (webhook subscribed to `messages`). The only thing that was gating the RSVP end-to-end test was template approval — now done.

**Next action for Emu: run the Phase 6 RSVP E2E round-trip** — full steps in **`WARDROUNDS_PHASE6_RSVP_STEPS.md`**. Summary of that flow:
1. Reset the seed's day-of WA stamp so the reminder re-sends (SQL Editor, TEST):
   `update outpatient_visits v set reminder_dayof_wa_sent_at = null from patients p where p.id = v.patient_id and p.first_name = 'WR_SEED_TEST';`
2. Re-run the send-reminders curl (Phase 5 step 2) → WhatsApp arrives **with two quick-reply buttons** (Confirm / Need to reschedule).
3. Tap **Confirm** → verify `select rsvp_status, rsvp_at …` = `confirmed` and a `whatsapp / rsvp_confirmed / received` row in `message_log`. Tap **Need to reschedule** → flips to `reschedule_requested`.

## ⚠️ Two open flags to clear BEFORE / DURING the E2E (carried from the 07-19 handoff)

1. **TEST pg_cron `CRON_SECRET` drift.** `CRON_SECRET` was rotated last session, but the TEST `wr-send-reminders` pg_cron job still sends the **OLD** `x-cron-secret` header → its nightly auto-runs will **401** until the job's header is updated in the Supabase **SQL Editor** (TEST only). For the E2E you can sidestep this by driving the send with the **manual curl** (Phase 5 step 2) rather than waiting for the cron. PROD is unaffected (own secret).

2. **App-publish caveat.** While the Meta app is **unpublished**, only *test* webhooks from the dashboard are guaranteed to be delivered — a **real phone button-tap may not reach the webhook**. If `rsvp_status` doesn't update after a live tap, either **publish the app** (App Dashboard → Publish) or use the dashboard's **"Test"** button on the `messages` field to validate the handler, then revisit.

## Also still open (from the handoff, not blocking the E2E)

- **Phase 6 code is uncommitted** on the `dev` working tree. When ready (Emu runs git):
  `cd ~/wardrounds && git add -A && git commit -m "whatsapp: RSVP buttons + inbound webhook (Phase 6)" && git push origin dev`
- **Surface `rsvp_status` in the Outpatient UI** (badge, permissions-gated) — not built yet.
- **Promote to PROD** only after the E2E passes (SQL Phase 1 + Phase 2, secrets, deploy 3 functions, configure PROD webhook, `main` ff-merge). Remember: **template approvals are per-WABA** — a real PROD number under the PROD WABA needs the 5 templates recreated + re-approved.

## Constraints honoured

No SQL run, no deploys, no git, no build. Phase 5 / Phase 6 step files left untouched. PROD (`bannxzyidkgmbejyrzea`) not touched. This run only read the template grid and wrote this note.
