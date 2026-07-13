import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// Generic transactional email sender backed by Resend.
// Callable from the app via supabase.functions.invoke("send-email", { body: { to, subject, html } }).
//
// Required secrets (set in Supabase → Project Settings → Edge Functions → Secrets):
//   RESEND_API_KEY  — your Resend API key (re_...)
//   RESEND_FROM     — verified sender, e.g. "WardRounds <reminders@wardrounds.site>"
//                     (falls back to Resend's onboarding@resend.dev sandbox sender)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, _ctx) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("RESEND_FROM") ?? "WardRounds <onboarding@resend.dev>";

    if (!RESEND_API_KEY) {
      return Response.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
    }

    let to: string | string[], subject: string, html: string | undefined, text: string | undefined, replyTo: string | undefined;
    try {
      ({ to, subject, html, text, replyTo } = await req.json());
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!to || !subject || (!html && !text)) {
      return Response.json({ error: "to, subject, and html (or text) are required" }, { status: 400 });
    }

    const payload: Record<string, unknown> = { from: FROM, to, subject };
    if (html) payload.html = html;
    if (text) payload.text = text;
    if (replyTo) payload.reply_to = replyTo;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error("Resend send failed:", JSON.stringify(result));
      return Response.json({ error: "Email send failed", detail: result }, { status: 502 });
    }

    return Response.json({ success: true, id: (result as { id?: string }).id ?? null }, { status: 200 });
  }),
};
