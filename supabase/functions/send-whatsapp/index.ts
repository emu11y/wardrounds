import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { buildRsvpPayloads, sendWhatsAppTemplate, toE164Kenya, WA_TEMPLATES } from "../_shared/whatsapp.ts";

// Browser-facing WhatsApp template sender (mirrors send-email, plus auth +
// gating + audit). Callable via supabase.functions.invoke("send-whatsapp",
// { body: { to, kind, params, patientId?, visitId? } }).
//
// Security model:
//   • The user's JWT (Authorization header, forwarded by functions.invoke) is
//     verified server-side; the sender's team comes from THEIR users row —
//     never from the request body — so a caller can't send/log as another team.
//   • The team must have whatsapp_enabled=true (Settings toggle, Phase 4).
//   • The Graph token stays server-side (WHATSAPP_TOKEN secret).
//   • Every attempt (sent or failed) is appended to message_log.
//
// Required secrets: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    // ── Authenticate the calling user from their JWT ─────────────────────────
    const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
    }
    const { data: userData, error: authError } = await ctx.supabaseAdmin.auth.getUser(jwt);
    if (authError || !userData?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
    }

    const { data: profile, error: profileError } = await ctx.supabaseAdmin
      .from("users")
      .select("id, team_id")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profileError || !profile?.team_id) {
      return Response.json({ error: "No team membership found" }, { status: 403, headers: CORS });
    }

    // ── Validate body ────────────────────────────────────────────────────────
    let to: string, kind: string, params: string[], patientId: string | undefined, visitId: string | undefined;
    try {
      ({ to, kind, params, patientId, visitId } = await req.json());
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS });
    }

    const template = WA_TEMPLATES[kind];
    if (!template) {
      return Response.json({ error: `Unknown kind: ${kind}` }, { status: 400, headers: CORS });
    }
    if (!Array.isArray(params) || params.length < 6 || !params.every((p) => typeof p === "string" && p.trim())) {
      return Response.json({ error: "params must be 6+ non-empty strings" }, { status: 400, headers: CORS });
    }
    const recipient = toE164Kenya(to);
    if (!recipient) {
      return Response.json({ error: "Invalid Kenyan phone number" }, { status: 400, headers: CORS });
    }

    // ── Team gate: whatsapp_enabled must be on ───────────────────────────────
    const { data: team, error: teamError } = await ctx.supabaseAdmin
      .from("teams")
      .select("id, whatsapp_enabled")
      .eq("id", profile.team_id)
      .maybeSingle();
    if (teamError || !team) {
      return Response.json({ error: "Team lookup failed" }, { status: 500, headers: CORS });
    }
    if (!team.whatsapp_enabled) {
      return Response.json({ error: "WhatsApp messaging is not enabled for this team" }, { status: 403, headers: CORS });
    }

    // ── Send + audit ─────────────────────────────────────────────────────────
    // RSVP button payloads are derived server-side from visitId (client never
    // builds them). Missing visitId → "-" sentinel the webhook ignores.
    const res = await sendWhatsAppTemplate({
      to: recipient,
      template,
      params,
      buttonPayloads: buildRsvpPayloads(visitId),
    });

    const { error: logError } = await ctx.supabaseAdmin.from("message_log").insert({
      team_id: profile.team_id,
      patient_id: patientId ?? null,
      visit_id: visitId ?? null,
      channel: "whatsapp",
      template,
      recipient,
      status: res.ok ? "sent" : "failed",
      provider_message_id: res.wamid,
      error: res.ok ? null : (res.error ?? "unknown"),
    });
    if (logError) console.error("message_log insert failed:", JSON.stringify(logError));

    if (!res.ok) {
      console.error("WhatsApp send failed:", res.error);
      return Response.json({ error: "WhatsApp send failed", detail: res.error }, { status: 502, headers: CORS });
    }
    return Response.json({ success: true, wamid: res.wamid }, { status: 200, headers: CORS });
  }),
};
