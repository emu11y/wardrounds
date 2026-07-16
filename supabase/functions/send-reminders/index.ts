import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { buildAppointmentEmail, fmtTimeLabel } from "../_shared/apptEmail.ts";
import type { ApptKind } from "../_shared/apptEmail.ts";

// Automatic appointment reminders — invoked on a schedule (pg_cron + pg_net).
//
// For each scheduled appointment with a patient email whose team has
// reminders_enabled, sends the branded reminder for whichever window is due
// (1 week / 1 day / day-of, Africa/Nairobi), then stamps the matching
// reminder_*_sent_at so it never double-sends.
//
// Gating: a shared CRON_SECRET (env var) is the real authorization gate and is
// REQUIRED — the request must carry a matching `x-cron-secret` header, or it is
// rejected (fails closed). withSupabase auth ["publishable","secret"] only gets
// the request through the platform gateway (matching the other functions); it
// is NOT the security boundary, because the publishable key is public. The
// pg_cron job passes the publishable key (apikey) + the CRON_SECRET header.
//
// Required secrets: CRON_SECRET (new — set on TEST + PROD), plus the existing
// RESEND_API_KEY, RESEND_FROM.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Nairobi has no DST (UTC+3), so plain calendar-date maths on a noon-UTC anchor
// is safe for +/- day offsets.
function nairobiToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" })
    .format(new Date());
}
function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface Window {
  kind: ApptKind;
  sentCol: "reminder_1w_sent_at" | "reminder_1d_sent_at" | "reminder_dayof_sent_at";
  offsetDays: number;
}

const WINDOWS: Window[] = [
  { kind: "reminder_1w", sentCol: "reminder_1w_sent_at", offsetDays: 7 },
  { kind: "reminder_1d", sentCol: "reminder_1d_sent_at", offsetDays: 1 },
  { kind: "reminder_dayof", sentCol: "reminder_dayof_sent_at", offsetDays: 0 },
];

interface EmbeddedVisit {
  id: string;
  visit_date: string;
  visit_time: string | null;
  patients: { email: string | null; first_name: string | null; last_name: string | null } | null;
  hospitals: { name: string | null; address: string | null } | null;
  teams: {
    name: string | null;
    practice_name: string | null;
    logo_url: string | null;
    phone: string | null;
    email: string | null;
    practice_phone: string | null;
    practice_email: string | null;
    reminders_enabled: boolean | null;
  } | null;
  doctor: { full_name: string | null; job_title: string | null; speciality: string | null } | null;
}

// deno-lint-ignore no-explicit-any
async function sendViaResend(apiKey: string, from: string, to: string, subject: string, html: string): Promise<{ ok: boolean; detail?: any }> {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  const result = await resp.json().catch(() => ({}));
  return resp.ok ? { ok: true } : { ok: false, detail: result };
}

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    // Real authorization gate — REQUIRED shared secret. Fails closed if the env
    // var is unset or the header doesn't match.
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM = Deno.env.get("RESEND_FROM") ?? "WardRounds <onboarding@resend.dev>";
    if (!RESEND_API_KEY) {
      return Response.json({ error: "RESEND_API_KEY not configured" }, { status: 500, headers: CORS });
    }

    const today = nairobiToday();
    const summary: Record<string, { due: number; sent: number; skipped: number; failed: number }> = {};
    const errors: { visitId: string; kind: string; error: string }[] = [];

    for (const win of WINDOWS) {
      const targetDate = addDays(today, win.offsetDays);
      const stat = { due: 0, sent: 0, skipped: 0, failed: 0 };
      summary[win.kind] = stat;

      const { data, error } = await ctx.supabaseAdmin
        .from("outpatient_visits")
        .select(
          `id, visit_date, visit_time, ${win.sentCol},
           patients ( email, first_name, last_name ),
           hospitals ( name, address ),
           teams ( name, practice_name, logo_url, phone, email, practice_phone, practice_email, reminders_enabled ),
           doctor:users!outpatient_visits_doctor_id_fkey ( full_name, job_title, speciality )`,
        )
        .eq("status", "scheduled")
        .eq("visit_date", targetDate)
        .is(win.sentCol, null);

      if (error) {
        console.error(`query failed (${win.kind}):`, JSON.stringify(error));
        errors.push({ visitId: "-", kind: win.kind, error: error.message ?? String(error) });
        continue;
      }

      const visits = (data ?? []) as unknown as EmbeddedVisit[];
      stat.due = visits.length;

      for (const v of visits) {
        const email = (v.patients?.email || "").trim();
        // Skip when the team has reminders off or the patient has no email.
        if (v.teams?.reminders_enabled === false || !email) {
          stat.skipped++;
          continue;
        }

        const name = v.patients
          ? `${v.patients.first_name || ""} ${v.patients.last_name || ""}`.trim()
          : "";

        const { subject, html } = buildAppointmentEmail({
          kind: win.kind,
          patientName: name,
          dateStr: v.visit_date,
          timeLabel: fmtTimeLabel(v.visit_time),
          hospitalName: v.hospitals?.name,
          hospitalAddress: v.hospitals?.address,
          doctorName: v.doctor?.full_name,
          doctorTitle: v.doctor?.job_title || v.doctor?.speciality,
          team: v.teams,
        });

        const res = await sendViaResend(RESEND_API_KEY, FROM, email, subject, html);
        if (!res.ok) {
          stat.failed++;
          console.error(`send failed (${win.kind}, ${v.id}):`, JSON.stringify(res.detail));
          errors.push({ visitId: v.id, kind: win.kind, error: JSON.stringify(res.detail) });
          continue;
        }

        // Stamp only after a confirmed send so a failure is retried next run.
        const { error: stampError } = await ctx.supabaseAdmin
          .from("outpatient_visits")
          .update({ [win.sentCol]: new Date().toISOString() })
          .eq("id", v.id);
        if (stampError) {
          console.error(`stamp failed (${win.kind}, ${v.id}):`, JSON.stringify(stampError));
          errors.push({ visitId: v.id, kind: win.kind, error: `stamp: ${stampError.message ?? String(stampError)}` });
        }
        stat.sent++;
      }
    }

    return Response.json(
      { success: true, ranFor: today, summary, errors },
      { status: 200, headers: CORS },
    );
  }),
};
