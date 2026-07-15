// ── Shared branded appointment-email template (server-side, Deno) ─────────────
//
// ⚠️ DRY MIRROR of src/lib/email.js. The client bundle (email.js) and this Deno
// module cannot import one another, so the branded layout is deliberately
// duplicated. If you change the visual template in ONE, mirror it in the OTHER:
//   • src/lib/email.js         → confirmation + manual reminders (browser)
//   • supabase/functions/_shared/apptEmail.ts → automatic reminders (edge cron)
// Keep them visually identical (header, card, rows, footer, copy).

export type ApptKind =
  | "confirmation"
  | "reminder_1w"
  | "reminder_1d"
  | "reminder_dayof";

export interface TeamBranding {
  name?: string | null;
  practice_name?: string | null;
  logo_url?: string | null;
  phone?: string | null;
  email?: string | null;
  practice_phone?: string | null;
  practice_email?: string | null;
}

interface BrandedLayoutArgs {
  team?: TeamBranding | null;
  heading: string;
  greeting: string;
  rows?: (readonly [string, string] | null)[];
  infoNote?: string;
  marketing?: string;
}

// Format a plain YYYY-MM-DD date the same way the client does (Africa/Nairobi).
export function fmtDate(dateStr: string): string {
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Africa/Nairobi",
    });
  } catch {
    return dateStr;
  }
}

// Derive the "H:MM AM/PM" slot label from a visit_time timestamptz, pinned to
// Africa/Nairobi. (The browser derives this via slotKeyFromVisit + fmtSlot using
// local getHours(); the edge runtime is UTC, so we must format the zone here.)
export function fmtTimeLabel(visitTime?: string | null): string {
  if (!visitTime) return "";
  try {
    return new Date(visitTime)
      .toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Africa/Nairobi",
      })
      .replace(/ /g, " "); // normalise narrow no-break space → plain space
  } catch {
    return "";
  }
}

// Escape user/DB-supplied strings before interpolating into the HTML template.
export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function brandedLayout(
  { team, heading, greeting, rows = [], infoNote, marketing }: BrandedLayoutArgs,
): string {
  const clinicName = team?.practice_name || team?.name || "WardRounds";
  const logoUrl = team?.logo_url;

  const header = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="${esc(clinicName)}" style="max-height:52px;max-width:200px;display:block;margin:0 auto;" />`
    : `<span style="font-size:20px;font-weight:700;color:#007AFF;">${esc(clinicName)}</span>`;

  const rowsHtml = rows
    .filter((r): r is readonly [string, string] => !!r && !!r[1])
    .map(([label, value]) =>
      `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top;">${esc(label)}</td>` +
      `<td style="padding:6px 0;text-align:right;font-weight:600;">${value}</td></tr>`
    )
    .join("");

  const contactBits = [
    team?.phone || team?.practice_phone,
    team?.email || team?.practice_email,
  ]
    .filter(Boolean)
    .map(esc)
    .join(" · ");
  const marketingHtml = marketing
    ? `<p style="font-size:12px;color:#9ca3af;text-align:center;margin:4px 0 0;">${esc(marketing)}</p>`
    : "";
  const contactHtml = contactBits
    ? `<p style="font-size:12px;color:#9ca3af;text-align:center;margin:12px 0 0;">Questions? Contact us: ${contactBits}</p>`
    : "";

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1c1c1e;">
    <div style="text-align:center;margin-bottom:20px;">${header}</div>
    <div style="background:#f2f2f7;border-radius:16px;padding:20px;">
      <h1 style="font-size:18px;margin:0 0 4px;">${esc(heading)}</h1>
      <p style="font-size:14px;color:#6b7280;margin:0 0 16px;">${esc(greeting)}</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse;">${rowsHtml}</table>
    </div>
    ${infoNote ? `<p style="font-size:12px;color:#9ca3af;text-align:center;margin-top:16px;">${esc(infoNote)}</p>` : ""}
    ${contactHtml}
    ${marketingHtml}
  </div>`;
}

interface ApptCopy {
  subjectPrefix: string;
  heading: string;
  intro: (n?: string) => string;
  info: string;
}

const APPT_COPY: Record<ApptKind, ApptCopy> = {
  confirmation: {
    subjectPrefix: "Appointment confirmed",
    heading: "Appointment confirmed",
    intro: (n) => `${n ? `Hello ${n},` : "Hello,"} your appointment is booked.`,
    info: "Please arrive a few minutes early. If you need to reschedule, contact the clinic.",
  },
  reminder_1w: {
    subjectPrefix: "Reminder: your appointment in 1 week",
    heading: "Appointment reminder",
    intro: (n) =>
      `${n ? `Hello ${n},` : "Hello,"} this is a friendly reminder that you have an appointment in one week.`,
    info: "Please arrive a few minutes early. If you need to reschedule, contact the clinic.",
  },
  reminder_1d: {
    subjectPrefix: "Reminder: your appointment tomorrow",
    heading: "Appointment tomorrow",
    intro: (n) =>
      `${n ? `Hello ${n},` : "Hello,"} this is a reminder that your appointment is tomorrow.`,
    info: "Please arrive a few minutes early. If you need to reschedule, contact the clinic.",
  },
  reminder_dayof: {
    subjectPrefix: "Reminder: your appointment today",
    heading: "Appointment today",
    intro: (n) =>
      `${n ? `Hello ${n},` : "Hello,"} this is a reminder that your appointment is today.`,
    info: "Please arrive a few minutes early. If you need to reschedule, contact the clinic.",
  },
};

function locationCell(hospitalName?: string | null, hospitalAddress?: string | null): string {
  if (!hospitalName && !hospitalAddress) return "";
  const name = hospitalName ? esc(hospitalName) : "";
  const addr = hospitalAddress
    ? `<br><span style="font-weight:400;color:#6b7280;font-size:12px;">${esc(hospitalAddress)}</span>`
    : "";
  return `${name}${addr}`;
}

export interface BuildApptEmailArgs {
  kind?: ApptKind;
  patientName?: string;
  dateStr: string;
  timeLabel?: string;
  hospitalName?: string | null;
  hospitalAddress?: string | null;
  doctorName?: string | null;
  doctorTitle?: string | null;
  team?: TeamBranding | null;
  marketing?: string;
  subjectOverride?: string;
  greetingOverride?: string;
}

export function buildAppointmentEmail({
  kind = "confirmation",
  patientName,
  dateStr,
  timeLabel,
  hospitalName,
  hospitalAddress,
  doctorName,
  doctorTitle,
  team,
  marketing,
  subjectOverride,
  greetingOverride,
}: BuildApptEmailArgs): { subject: string; html: string } {
  const copy = APPT_COPY[kind] || APPT_COPY.confirmation;
  const dateLabel = fmtDate(dateStr);
  const subject = subjectOverride ||
    `${copy.subjectPrefix} — ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""}`;

  const doctorValue = doctorName
    ? `${esc(doctorName)}${doctorTitle ? `<span style="font-weight:400;color:#6b7280;">, ${esc(doctorTitle)}</span>` : ""}`
    : "";

  const rows: (readonly [string, string] | null)[] = [
    ["Date", esc(dateLabel)],
    timeLabel ? ["Time", esc(timeLabel)] : null,
    doctorValue ? ["Doctor", doctorValue] : null,
    ["Location", locationCell(hospitalName, hospitalAddress)],
  ];

  const html = brandedLayout({
    team,
    heading: copy.heading,
    greeting: greetingOverride || copy.intro(patientName),
    rows,
    infoNote: copy.info,
    marketing,
  });
  return { subject, html };
}
