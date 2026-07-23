# WardRounds — WhatsApp Template Approval Check — 20 Jul 2026, 14:38 EAT (automated)

**Automated scheduled-task run** (`wardrounds-whatsapp-approval-check-jul20-evening`, fired early). Emu not present.

## Result: STILL IN REVIEW — no change

Browser was connected this run. Read the Status column in WhatsApp Manager (TEST WABA `1512386093333740`, business_id `1239450534066576`, `read_page filter=all` on the client-rendered grid). All five v2 templates are **In review**, last edited **Jul 19, 2026** — none approved, none rejected:

| Template | Category | Language | Status |
|---|---|---|---|
| `appt_reminder_1w` | Utility | English | In review |
| `appt_reminder_1d` | Utility | English | In review |
| `appt_reminder_dayof` | Utility | English | In review |
| `appt_confirmation` | Utility | English | In review |
| `appt_manual` | Utility | English | In review |

(The `jaspers_market_*` and `hello_world` rows are unrelated Meta samples — ignored.)

## What this means

The live blocker is unchanged: purely waiting on Meta to review the v2 templates (bold formatting + clinic-contact paragraph + Confirm / Need to reschedule quick-reply buttons) resubmitted Jul 19. **Phase 5 (v1) E2E already passed**; all Phase 6 RSVP code + the inbound webhook are built, deployed to TEST, and live. **Nothing to build here.** When all five flip to Approved/Active, run the RSVP round-trip in **`WARDROUNDS_PHASE6_RSVP_STEPS.md`**.

## Action taken

**No new task created** — a morning re-check is already pending and carries the same prompt:

- **Task:** `wardrounds-whatsapp-approval-check-2026-07-21-am`
- **Fires:** 21 Jul 2026, 05:00 (+03:00), one-time

Per the "don't stack more than one pending check" constraint, I reused the existing task rather than proliferating a new one. All earlier checks are already fired/disabled.

## Two flags to clear first when the templates DO approve (from the 07-19 handoff)

1. **TEST pg_cron CRON_SECRET drift.** The TEST `wr-send-reminders` pg_cron job still sends the OLD `x-cron-secret` header → nightly auto-runs 401 until updated in the Supabase SQL Editor (TEST only), or drive the E2E with the manual curl. PROD unaffected.
2. **App-publish caveat.** While the Meta app is unpublished, only *test* webhooks from the dashboard are guaranteed delivered — a real phone button-tap may not reach the webhook. If `rsvp_status` doesn't update after a live tap, publish the app (App Dashboard → Publish) or use the dashboard's "Test" button on the `messages` field.

## Constraints honoured

No SQL run, no deploys, no git. PROD (`bannxzyidkgmbejyrzea`) untouched.
