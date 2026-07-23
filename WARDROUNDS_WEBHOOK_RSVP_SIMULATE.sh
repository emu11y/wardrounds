#!/usr/bin/env bash
# WardRounds — simulate a Meta WhatsApp RSVP button tap against the TEST webhook.
#
# Why: the Meta app is UNPUBLISHED, so real button taps from a phone are not
# delivered to the webhook ("Apps will only be able to receive test webhooks sent
# from the app dashboard while the app is unpublished"). This script reproduces
# exactly what Meta would POST — same JSON shape, same X-Hub-Signature-256 HMAC
# over the raw body — so the handler, the rsvp_status write and the message_log
# insert can all be verified before the app is published.
#
# TEST ONLY. Never point this at PROD.
#
# Usage:
#   WHATSAPP_APP_SECRET='****' ./WARDROUNDS_WEBHOOK_RSVP_SIMULATE.sh [CONFIRM|RESCHED] [visit_id]
#
# Negative test (expect 401 Invalid signature, no DB change):
#   WHATSAPP_APP_SECRET='nope' ./WARDROUNDS_WEBHOOK_RSVP_SIMULATE.sh CONFIRM

set -euo pipefail

: "${WHATSAPP_APP_SECRET:?export WHATSAPP_APP_SECRET first (Meta App Dashboard -> App settings -> Basic -> App secret)}"

ACTION="${1:-CONFIRM}"
VISIT_ID="${2:-b16bc556-782d-4b63-810c-d850702f9c39}"   # WR_SEED_TEST visit on TEST

case "$ACTION" in
  CONFIRM) BUTTON_TEXT="Confirm" ;;
  RESCHED) BUTTON_TEXT="Need to reschedule" ;;
  *) echo "First argument must be CONFIRM or RESCHED" >&2; exit 1 ;;
esac

URL="https://ewkjhqhszbxnizqbosod.functions.supabase.co/whatsapp-webhook"
WABA_ID="1512386093333740"
PHONE_NUMBER_ID="1199957979870204"
FROM="254713377374"
TS="$(date +%s)"

# Single-line raw body — the signature must cover these exact bytes.
BODY="{\"object\":\"whatsapp_business_account\",\"entry\":[{\"id\":\"${WABA_ID}\",\"changes\":[{\"field\":\"messages\",\"value\":{\"messaging_product\":\"whatsapp\",\"metadata\":{\"display_phone_number\":\"15551559940\",\"phone_number_id\":\"${PHONE_NUMBER_ID}\"},\"messages\":[{\"from\":\"${FROM}\",\"id\":\"wamid.SIMULATED-${ACTION}-${TS}\",\"timestamp\":\"${TS}\",\"type\":\"button\",\"button\":{\"payload\":\"${ACTION}:${VISIT_ID}\",\"text\":\"${BUTTON_TEXT}\"}}]}}]}]}"

SIG="sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$WHATSAPP_APP_SECRET" | awk '{print $NF}')"

echo "POST  $URL"
echo "tap   ${ACTION}  ->  visit ${VISIT_ID}"
echo

curl -sS -i -X POST "$URL" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: ${SIG}" \
  --data-binary "$BODY"

echo
echo
echo "Expect: HTTP/2 200 and body OK (401 Invalid signature = wrong app secret)."
echo "Then verify in the TEST SQL Editor:"
echo "  select rsvp_status, rsvp_at from outpatient_visits where id = '${VISIT_ID}';"
echo "  select channel, template, status, created_at from message_log order by created_at desc limit 5;"
