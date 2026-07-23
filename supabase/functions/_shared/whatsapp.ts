// ── Shared WhatsApp Cloud API sender (server-side, Deno) ─────────────────────
//
// ⚠️ DRY MIRROR of src/lib/whatsapp.js (same contract as the email pair
// src/lib/email.js ↔ _shared/apptEmail.ts — the client bundle and this Deno
// module cannot import one another). If you change number normalisation or the
// params builder in ONE, mirror it in the OTHER. The actual Graph API call
// lives ONLY here (the browser never holds the token — client paths go through
// the `send-whatsapp` edge function).
//
// Required secrets: WHATSAPP_TOKEN (permanent system-user token),
// WHATSAPP_PHONE_NUMBER_ID (test number id on TEST, real number id on PROD).
//
// Templates (Meta WhatsApp Manager, category Utility, language en) share the
// variable order (v2, RSVP revision):
//   {{1}} patient first name · {{2}} practice name · {{3}} date · {{4}} time
//   {{5}} doctor · {{6}} location · {{7}} clinic contact
//   (appt_manual only: {{7}} staff note, {{8}} clinic contact)
// Every template carries two quick-reply buttons — [Confirm] and
// [Need to reschedule] — whose payloads are set PER SEND (CONFIRM:<visit_id> /
// RESCHED:<visit_id>) and come back via the whatsapp-webhook edge function.

import { fmtDate, fmtTimeLabel } from "./apptEmail.ts";
import type { ApptKind, TeamBranding } from "./apptEmail.ts";

const GRAPH_VERSION = "v23.0";

// ApptKind → approved template name. `manual` extends the email kinds — it is
// only ever sent from the browser path (ReminderComposeModal → send-whatsapp).
export const WA_TEMPLATES: Record<string, string> = {
  confirmation: "appt_confirmation",
  reminder_1w: "appt_reminder_1w",
  reminder_1d: "appt_reminder_1d",
  reminder_dayof: "appt_reminder_dayof",
  manual: "appt_manual",
};

// Normalise a Kenyan phone number to E.164 digits (no `+`), or null when the
// input can't be a valid Kenyan mobile — REJECT junk rather than message a
// wrong number. Accepts: 07XXXXXXXX / 01XXXXXXXX / 7XXXXXXXX / 1XXXXXXXX /
// +2547… / 2547… (with spaces, dashes, parens tolerated).
export function toE164Kenya(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/[\s\-().]/g, "").replace(/^\+/, "");
  if (!/^\d+$/.test(digits)) return null;
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  return null;
}

// WhatsApp rejects template parameters that are empty or contain newlines,
// tabs, or 4+ consecutive spaces. Sanitise every value and give each slot a
// readable fallback so a sparse visit never bricks the send.
export function waParam(value: unknown, fallback = "-"): string {
  const s = String(value ?? "").replace(/\s+/g, " ").trim();
  return (s || fallback).slice(0, 512);
}

// Ordered {{1}}…{{7}} params from the same data buildAppointmentEmail consumes.
// {{7}} = clinic contact (practice phone → team phone → practice email).
export function buildApptWaParams(
  { patientFirstName, team, dateStr, timeLabel, doctorName, doctorTitle, hospitalName, hospitalAddress }: {
    patientFirstName?: string | null;
    team?: TeamBranding | null;
    dateStr?: string | null;
    timeLabel?: string | null;
    doctorName?: string | null;
    doctorTitle?: string | null;
    hospitalName?: string | null;
    hospitalAddress?: string | null;
  },
): string[] {
  const doctor = doctorName
    ? `${doctorName}${doctorTitle ? `, ${doctorTitle}` : ""}`
    : "";
  const location = [hospitalName, hospitalAddress].filter(Boolean).join(", ");
  return [
    waParam(patientFirstName, "there"),
    waParam(team?.practice_name || team?.name, "WardRounds"),
    waParam(dateStr ? fmtDate(dateStr) : "", "the scheduled date"),
    waParam(timeLabel, "the scheduled time"),
    waParam(doctor, "your doctor"),
    waParam(location, "the clinic"),
    waParam(
      team?.practice_phone || team?.phone || team?.practice_email,
      "your clinic",
    ),
  ];
}

// RSVP quick-reply payloads for a visit — order matches the template buttons
// (index 0 = Confirm, index 1 = Need to reschedule). Decoded by whatsapp-webhook.
export function buildRsvpPayloads(visitId?: string | null): string[] {
  const id = visitId || "-";
  return [`CONFIRM:${id}`, `RESCHED:${id}`];
}

export { fmtDate, fmtTimeLabel };
export type { ApptKind };

// Send one pre-approved template message. "Safe" contract (same as the email
// senders): never throws — always resolves { ok, wamid?, error? }.
export async function sendWhatsAppTemplate(
  { to, template, params, buttonPayloads }: {
    to: string;
    template: string;
    params: string[];
    buttonPayloads?: string[];
  },
): Promise<{ ok: boolean; wamid: string | null; error?: string }> {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneNumberId) {
    return { ok: false, wamid: null, error: "WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID not configured" };
  }
  try {
    const resp = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: template,
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: params.map((p) => ({ type: "text", text: p })),
              },
              // Templates with quick-reply buttons REQUIRE a payload per button
              // at send time (the payload is what the webhook receives back).
              ...(buttonPayloads ?? []).map((payload, i) => ({
                type: "button",
                sub_type: "quick_reply",
                index: String(i),
                parameters: [{ type: "payload", payload }],
              })),
            ],
          },
        }),
      },
    );
    // deno-lint-ignore no-explicit-any
    const result: any = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const error = result?.error?.message
        ? `${result.error.message}${result.error.error_data?.details ? ` — ${result.error.error_data.details}` : ""}`
        : `HTTP ${resp.status}`;
      return { ok: false, wamid: null, error };
    }
    return { ok: true, wamid: result?.messages?.[0]?.id ?? null };
  } catch (e) {
    return { ok: false, wamid: null, error: e instanceof Error ? e.message : String(e) };
  }
}
