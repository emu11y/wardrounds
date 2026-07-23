# WardRounds — WhatsApp Template Approval Check — 20 Jul 2026, evening (run 2, automated)

**Automated scheduled-task run** (`wardrounds-whatsapp-approval-check-jul20-evening`). Emu not present.

## Result: STILL IN REVIEW — no change (confirmed via browser)

Browser reconnected mid-run; I opened WhatsApp Manager and read the Status column directly (TEST WABA `1512386093333740`, business_id `1239450534066576`, `read_page filter=all` on the client-rendered grid). All five v2 templates are **In review**, last edited **Jul 19, 2026** — none approved, none rejected:

| Template | Category | Language | Status |
|---|---|---|---|
| `appt_reminder_1w` | Utility | English | In review |
| `appt_reminder_1d` | Utility | English | In review |
| `appt_reminder_dayof` | Utility | English | In review |
| `appt_confirmation` | Utility | English | In review |
| `appt_manual` | Utility | English | In review |

(The `jaspers_market_*` and `hello_world` rows are unrelated Meta samples — ignored. Note the first `tabs_context_mcp`/`read_page` attempts this run reported the extension disconnected; a retry after Emu reconnected succeeded.)

## Action taken

Per the task's "browser unavailable" branch: **no build repeated, no SQL/deploy/git run.** A morning re-check is **already pending and enabled** carrying the same prompt — I reused it rather than stacking a new one:

- **Task:** `wardrounds-whatsapp-approval-check-2026-07-21-am`
- **Fires:** 21 Jul 2026, 05:00 (+03:00), one-time

If Emu wants a manual check before then, open:
`https://business.facebook.com/latest/whatsapp_manager/message_templates?business_id=1239450534066576&tab=message-templates&asset_id=1512386093333740`
and read the Status column for the five `appt_*` rows.

## When all five DO flip to Approved/Active

Nothing to build — Phase 5 (v1) E2E already passed; all Phase 6 RSVP code + inbound webhook are built, deployed to TEST, and live. Run the RSVP round-trip in **`WARDROUNDS_PHASE6_RSVP_STEPS.md`**. Two flags to clear first (from the 07-19 handoff):

1. **TEST pg_cron CRON_SECRET drift.** The TEST `wr-send-reminders` pg_cron job still sends the OLD `x-cron-secret` header → nightly auto-runs 401 until updated in the Supabase SQL Editor (TEST only), or drive the E2E with the manual curl. PROD unaffected.
2. **App-publish caveat.** While the Meta app is unpublished, only *test* webhooks from the dashboard are guaranteed delivered — a real phone button-tap may not reach the webhook. If `rsvp_status` doesn't update after a live tap, publish the app (App Dashboard → Publish) or use the dashboard's "Test" button on the `messages` field.

## Constraints honoured

No SQL run, no deploys, no git. PROD (`bannxzyidkgmbejyrzea`) untouched. Only one pending check task at a time.
