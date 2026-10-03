# WardRounds WhatsApp — Go-Live State

_Last updated: 29 Jul 2026 20:00 EAT by the daily 8pm nudge. This file is overwritten each run — it's the single source of truth for "where are we"._

_Re-check this run (29 Jul): `dev` working tree clean (only this state file untracked); latest `dev` commits are docs-only, Phase 6 already in history and in `main`; https://wardrounds.site/privacy still resolves. No change since last run._

## TL;DR
The WhatsApp appointment-messaging feature is **built, committed, pushed, and the Meta app is fully published.** What's left is real-world testing + the PROD WhatsApp number/verification so we can send at scale.

## Done ✅
- **Code:** Phase 6 committed + pushed to `origin/dev` (commit `0a35acb` — RSVP Confirm/Reschedule buttons, inbound webhook, public `/privacy` page, RSVP badge). Working tree clean.
- **Branches:** `main` already contains Phase 6 (histories no longer diverged; only docs-only commits sit unpromoted — doesn't matter for go-live).
- **Privacy page:** https://wardrounds.site/privacy resolves.
- **Meta app** (App ID `2202646650298242`, business `thyroid_kenya`), verified in basic settings 26 Jul:
  - App icon uploaded ✅
  - Privacy policy URL = `https://wardrounds.site/privacy` ✅
  - App status = **Published** ✅
  - Category = Business and pages ✅
- **TEST WABA:** all 5 utility templates APPROVED; webhook subscribed to `messages`; outbound sends verified (WhatsApp arrives with Confirm / Need-to-reschedule buttons).

## Outstanding — in order
1. **Inbound RSVP test** (only the secret needs pasting):
   ```
   cd ~/wardrounds && WHATSAPP_APP_SECRET='PASTE_YOUR_APP_SECRET_HERE' ./WARDROUNDS_WEBHOOK_RSVP_SIMULATE.sh CONFIRM
   ```
   Expect: appointment `rsvp_status` flips to confirmed + a new `message_log` row.
2. **Real-tap RSVP end-to-end** — on the phone, tap Confirm in a real WhatsApp reminder, check the appointment updates. (Phone only, no command.)
3. **Deliverability** — send any email to `privacy@wardrounds.site` from your phone, confirm it lands. (Phone only, no command.)
4. **(Optional) TEST nightly cron 401 fix** — only if it's bothering you; the manual test in step 1 sidesteps it. Ask Claude for the exact one-liner if wanted.
5. **PROD go-live (the real remaining work):** get the PROD WhatsApp number + Business Verification, then recreate + re-approve the 5 utility templates under the PROD WABA (approvals are per-WABA). Lifts the 250 conversations/day cap. Claude can drive the browser parts once you say go in chat.

## Recommended next action
Run the **inbound RSVP test** one-liner above (step 1), then do the phone real-tap test (step 2). Those confirm the loop works end-to-end before starting the PROD number/verification.

## Nudge
Daily at 8pm (local, UTC+3). Task ID: `wardrounds-whatsapp-golive-nudge`. Ask to turn it off once PROD is live.
