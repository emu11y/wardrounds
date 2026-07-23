# WardRounds — WhatsApp Template Approval Check — 20 Jul 2026, 09:24 EAT

**Automated scheduled-task run** (`wardrounds-whatsapp-template-check`). Emu not present.

## Result: STILL IN REVIEW — no change

Read the Status column in WhatsApp Manager (TEST WABA `1512386093333740`, business_id `1239450534066576`). All five v2 templates are **In review**, last edited **Jul 19, 2026**:

| Template | Category | Language | Status |
|---|---|---|---|
| `appt_reminder_1w` | Utility | English | In review |
| `appt_reminder_1d` | Utility | English | In review |
| `appt_reminder_dayof` | Utility | English | In review |
| `appt_confirmation` | Utility | English | In review |
| `appt_manual` | Utility | English | In review |

(The `jaspers_market_*` and `hello_world` rows on the same WABA are unrelated samples and were ignored.)

## What this means

The live blocker is unchanged: these are the **v2** templates (bold formatting + clinic-contact paragraph + Confirm / Need to reschedule quick-reply buttons) resubmitted on Jul 19. **Phase 5 (v1) E2E already passed** in session #9, and all Phase 6 RSVP code + the inbound webhook are already built, deployed to TEST, and live — so nothing to build here. We're purely waiting on Meta.

I did **not** rewrite `WARDROUNDS_PHASE5_E2E_STEPS.md` (the task's original step 2 predates Phase 5 passing). The ready-to-run E2E for the current state is already in **`WARDROUNDS_PHASE6_RSVP_STEPS.md`**.

## Action taken

Scheduled the next check: one-time task **`wardrounds-whatsapp-approval-check-jul20-evening`**, fires **today 18:00 EAT**, carrying an updated self-contained prompt (checks v2 templates; on approval it points to the Phase 6 RSVP steps rather than rewriting Phase 5; on continued review it reschedules for the next morning).

## When the templates DO approve — two flags to clear first (from the 07-19 handoff)

1. **TEST pg_cron secret drift.** `CRON_SECRET` was rotated, but the TEST `wr-send-reminders` pg_cron job still sends the OLD `x-cron-secret` header → nightly auto-runs 401 until updated. Update the job's header in the Supabase SQL Editor (TEST only) or drive the E2E with the manual curl. (PROD unaffected.)
2. **App-publish caveat.** While the Meta app is unpublished, only *test* webhooks from the dashboard are guaranteed delivered — a real phone button-tap may not reach the webhook. If `rsvp_status` doesn't update after a live tap, publish the app (App Dashboard → Publish) or use the dashboard's "Test" button on the `messages` field.

Then run the RSVP round-trip in `WARDROUNDS_PHASE6_RSVP_STEPS.md`.

## Constraints honoured

No SQL run, no deploys, no git, PROD (`bannxzyidkgmbejyrzea`) untouched.
