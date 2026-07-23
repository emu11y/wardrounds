import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

// Meta WhatsApp Cloud API webhook — receives patient RSVP button taps.
//
// This endpoint is PUBLIC (Meta calls it; no apikey/JWT — deploy with
// --no-verify-jwt / verify_jwt=false). Security is Meta's own contract:
//   • GET  = subscription handshake: hub.verify_token must equal the
//     WHATSAPP_WEBHOOK_VERIFY_TOKEN secret → echo hub.challenge.
//   • POST = X-Hub-Signature-256 header must be the HMAC-SHA256 of the RAW
//     body keyed with the app secret (WHATSAPP_APP_SECRET). Invalid → 401.
//
// What it processes: messages of type "button" (template quick replies) whose
// payload is CONFIRM:<visit_id> or RESCHED:<visit_id> (set at send time by
// send-reminders / send-whatsapp). Everything else (statuses, free text) is
// acknowledged with 200 and ignored — Meta disables webhooks that error.
//
// Writes (service role, bypasses RLS):
//   • outpatient_visits.rsvp_status = 'confirmed' | 'reschedule_requested',
//     rsvp_at = now()  — last tap wins (patients may change their mind).
//   • message_log row (channel whatsapp, status 'received') for the audit trail.
//
// Required secrets: WHATSAPP_WEBHOOK_VERIFY_TOKEN, WHATSAPP_APP_SECRET
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected by the platform).

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RSVP_ACTIONS: Record<string, string> = {
  CONFIRM: "confirmed",
  RESCHED: "reschedule_requested",
};

async function validSignature(
  rawBody: string,
  header: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  const expected = "sha256=" +
    Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  // Constant-time compare.
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  }
  return diff === 0;
}

export default {
  fetch: async (req: Request): Promise<Response> => {
    const url = new URL(req.url);

    // ── GET: Meta subscription handshake ─────────────────────────────────────
    if (req.method === "GET") {
      const verifyToken = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN");
      if (
        verifyToken &&
        url.searchParams.get("hub.mode") === "subscribe" &&
        url.searchParams.get("hub.verify_token") === verifyToken
      ) {
        return new Response(url.searchParams.get("hub.challenge") ?? "", {
          status: 200,
        });
      }
      return new Response("Forbidden", { status: 403 });
    }

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // ── POST: verify Meta's signature over the RAW body ──────────────────────
    const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
    if (!appSecret) {
      console.error("WHATSAPP_APP_SECRET not configured");
      return new Response("Server misconfigured", { status: 500 });
    }
    const rawBody = await req.text();
    const ok = await validSignature(
      rawBody,
      req.headers.get("x-hub-signature-256"),
      appSecret,
    );
    if (!ok) {
      return new Response("Invalid signature", { status: 401 });
    }

    // From here on ALWAYS return 200 — processing hiccups are logged, never
    // surfaced, so Meta doesn't back off / disable the subscription.
    try {
      const body = JSON.parse(rawBody);
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      for (const entry of body?.entry ?? []) {
        for (const change of entry?.changes ?? []) {
          for (const message of change?.value?.messages ?? []) {
            if (message?.type !== "button") continue;
            const payload: string = message?.button?.payload ?? "";
            const [action, visitId] = payload.split(":", 2);
            const status = RSVP_ACTIONS[action];
            if (!status || !UUID_RE.test(visitId ?? "")) continue;

            const { data: visit, error: visitError } = await supabaseAdmin
              .from("outpatient_visits")
              .update({ rsvp_status: status, rsvp_at: new Date().toISOString() })
              .eq("id", visitId)
              .select("id, team_id, patient_id")
              .maybeSingle();
            if (visitError || !visit) {
              console.error(
                `rsvp update failed (${payload}):`,
                JSON.stringify(visitError ?? "visit not found"),
              );
              continue;
            }

            const { error: logError } = await supabaseAdmin
              .from("message_log")
              .insert({
                team_id: visit.team_id,
                patient_id: visit.patient_id,
                visit_id: visit.id,
                channel: "whatsapp",
                template: `rsvp_${status}`,
                recipient: String(message?.from ?? "unknown"),
                status: "received",
                provider_message_id: message?.id ?? null,
              });
            if (logError) {
              console.error("message_log insert failed:", JSON.stringify(logError));
            }
          }
        }
      }
    } catch (e) {
      console.error("webhook processing error:", e instanceof Error ? e.message : String(e));
    }

    return new Response("OK", { status: 200 });
  },
};
