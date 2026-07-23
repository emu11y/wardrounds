# WardRounds — WhatsApp Template Approval Check — 20 Jul 2026 (evening, automated)

**Result: INCONCLUSIVE — browser unavailable, could not read template status. Rescheduled for tomorrow 05:00.**

## What happened
This was the automated evening re-check of the 5 v2 `appt_*` templates
(appt_reminder_1w, appt_reminder_1d, appt_reminder_dayof, appt_confirmation,
appt_manual) on the TEST WABA `1512386093333740`.

The Claude-in-Chrome browser extension was **not connected**, so I could not
open WhatsApp Manager to read the Status column. No build, SQL, deploy, or git
was run (correct — those are Emu's, and nothing was needed anyway).

## Action taken
Per the task's step 3 (browser unavailable → do not repeat any build, reschedule
once), I created a single follow-up check:

- **Task:** `wardrounds-whatsapp-approval-check-2026-07-21-am`
- **Fires:** 21 Jul 2026, 05:00 (+03:00), one-time
- Carries the same prompt. No duplicate/stacked checks — all earlier checks are
  already disabled/fired.

> Tip: if you want tomorrow's run to reach WhatsApp Manager without stalling on
> permission prompts, make sure the Claude-in-Chrome extension is installed and
> signed in (same account as this app), and consider clicking **Run now** on the
> scheduled task once to pre-approve the browser tools.

## Still open (unchanged from the 07-19 handoff — for when templates approve)
- **Template approval** is still the only thing gating Phase 6 RSVP E2E. Phase 6
  code is built + deployed to TEST; webhook is live and subscribed to `messages`.
  E2E steps are in `WARDROUNDS_PHASE6_RSVP_STEPS.md`.
- **Flag (a) — TEST pg_cron CRON_SECRET drift:** the `wr-send-reminders` pg_cron
  job still sends the OLD `x-cron-secret` header and will 401 on nightly runs
  until updated in the Supabase SQL Editor.
- **Flag (b) — app-publish caveat:** while the Meta app is unpublished, only
  *test* webhooks from the dashboard are delivered; a real phone button-tap may
  not reach the webhook until the app is published.

## Manual alternative (if you want to check now, Emu)
Open WhatsApp Manager → Message templates for the TEST WABA and look at the
Status column for the five `appt_*` templates:
https://business.facebook.com/latest/whatsapp_manager/message_templates?business_id=1239450534066576&tab=message-templates&nav_ref=whatsapp_manager&asset_id=1512386093333740

- All five **Approved/Active** → run `WARDROUNDS_PHASE6_RSVP_STEPS.md`.
- Any **still In review** → nothing to do; tomorrow's 05:00 check will re-look.
- Any **Rejected** → read the rejection reason; the next run will summarize it and
  propose a corrected body (no resubmit without your confirmation).

_No terminal/SQL/git commands were run this session._
