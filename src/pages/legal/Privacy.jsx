import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowUp } from 'lucide-react'

/*
 * Public privacy policy — no auth, no PageGuard, no permission gate. This page
 * is deliberately reachable signed-out AND signed-in: Meta requires a publicly
 * fetchable Privacy Policy URL before an app can be published (App settings →
 * Basic → Privacy policy URL), and WhatsApp's Business Messaging policy expects
 * patients to be able to read how their number is used.
 *
 * Styling follows the landing pages (slate-950 dark surface) rather than the
 * in-app glassmorphic light theme, because it is linked from the landing
 * footers and is usually the first thing an unauthenticated visitor sees.
 *
 * Keep the WhatsApp section factually in step with the actual implementation:
 * src/lib/whatsapp.js, supabase/functions/_shared/whatsapp.ts,
 * supabase/functions/{send-whatsapp,send-reminders,whatsapp-webhook}.
 */

const LAST_UPDATED = '22 July 2026'
const CONTACT_EMAIL = 'privacy@wardrounds.site'

function Section({ id, title, children }) {
  return (
    <section id={id} className="mt-12 scroll-mt-24">
      <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-400 sm:text-[15px]">
        {children}
      </div>
    </section>
  )
}

function Bullets({ items }) {
  return (
    <ul className="space-y-2 pl-5">
      {items.map((item, i) => (
        <li key={i} className="list-disc marker:text-slate-600">{item}</li>
      ))}
    </ul>
  )
}

export default function Privacy() {
  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-3xl px-6 pb-20 pt-10 sm:pt-16">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft size={15} /> Back to WardRounds
        </Link>

        <div className="mt-10 flex items-center gap-3">
          <img src="/wardrounds-icon.png" className="h-10 w-10 flex-shrink-0 object-contain" alt="WardRounds" />
          <span className="text-2xl font-bold tracking-tight text-white">WardRounds</span>
        </div>

        <h1 className="mt-8 text-3xl font-bold tracking-tight text-white sm:text-4xl">Privacy Policy</h1>
        <p className="mt-3 text-sm text-slate-500">Last updated {LAST_UPDATED}</p>

        <p className="mt-8 text-sm leading-relaxed text-slate-400 sm:text-[15px]">
          This policy explains what WardRounds collects, why, who it is shared with, and the choices
          you have. It covers the WardRounds web application at wardrounds.site and the appointment
          messages WardRounds sends by email and WhatsApp.
        </p>

        <Section id="what-wardrounds-is" title="1. What WardRounds is — and is not">
          <p>
            WardRounds is a personal billing and practice-management record for clinicians. It helps a
            doctor keep track of the patients they have seen, where they saw them, what was done, what
            was invoiced, and when the patient is next expected.
          </p>
          <p>
            <span className="text-slate-300">WardRounds is not an electronic medical record.</span> It
            does not store clinical notes, diagnoses, investigation results, images or prescriptions.
            Clinical records stay in the hospital or clinic systems where they belong.
          </p>
        </Section>

        <Section id="roles" title="2. Who is responsible for what">
          <p>
            Where you are a clinician using WardRounds, <span className="text-slate-300">you are the
            data controller</span> for the patient contact details you enter. You are responsible for
            having a lawful basis to hold them and for obtaining your patients' consent before
            enabling appointment messages.
          </p>
          <p>
            WardRounds acts as the <span className="text-slate-300">data processor</span> for that
            information: we store it, restrict it to your team, and send only the messages you or your
            configured reminder settings trigger.
          </p>
        </Section>

        <Section id="what-we-collect" title="3. Information we collect">
          <p className="text-slate-300">From you, the clinician:</p>
          <Bullets
            items={[
              'Name, email address, job title and speciality.',
              'Your practice or team details — practice name, phone, email, logo and the hospitals you work in.',
              'Billing and invoicing entries you create.',
              'Authentication data (a hashed password or your chosen sign-in provider) and basic session information.',
            ]}
          />
          <p className="pt-2 text-slate-300">About your patients, entered by you:</p>
          <Bullets
            items={[
              'Name, phone number and email address.',
              'Appointment date, time, treating doctor and hospital or clinic location.',
              'Visit status (scheduled, seen, cancelled), invoice amounts, and any short note you attach to a manual reminder.',
              'Whether the patient has opted in to WhatsApp appointment messages, and any RSVP response they give.',
            ]}
          />
          <p className="pt-2">
            We do not collect patient clinical information, and we do not buy, sell or rent personal
            data. WardRounds carries no advertising.
          </p>
        </Section>

        <Section id="how-we-use" title="4. How we use it">
          <Bullets
            items={[
              'To run the service — showing you your patients, appointments, invoices and analytics.',
              'To send appointment confirmations and reminders on your behalf, by email and, where the patient has opted in, WhatsApp.',
              'To record which messages were sent, to whom and with what outcome, so delivery problems can be diagnosed and duplicates avoided.',
              'To keep the service secure, prevent abuse, and meet legal obligations.',
            ]}
          />
        </Section>

        <Section id="whatsapp" title="5. Appointment messages: email and WhatsApp">
          <p>
            WardRounds sends appointment confirmations and reminders by email, and — separately and
            only where enabled — by WhatsApp.
          </p>
          <Bullets
            items={[
              'WhatsApp messages are sent only when the clinic has enabled the channel AND the individual patient has been recorded as having opted in AND a valid mobile number is held. If any one of those is missing, nothing is sent by WhatsApp.',
              'Messages are sent using pre-approved WhatsApp utility message templates. They contain the patient first name, the practice name, the appointment date, time, doctor and location, and a clinic contact number. Manual reminders may also carry a short note written by the clinic.',
              'Each message carries two quick-reply buttons — Confirm and Need to reschedule. If the patient taps one, WhatsApp sends that response back to WardRounds and it is recorded against the appointment so the clinic can act on it. No other content of a patient\'s WhatsApp account is accessed.',
              'Messages are delivered through the WhatsApp Business Platform, operated by Meta Platforms Ireland Limited. Meta processes the phone number and message content in order to deliver it, under its own terms.',
              'A patient can opt out at any time by telling the clinic, who will clear the opt-in — after which no further WhatsApp messages are sent to that number. They may also block the number in WhatsApp.',
            ]}
          />
        </Section>

        <Section id="sharing" title="6. Who we share information with">
          <p>
            Only the service providers needed to run WardRounds. Each processes data on our
            instructions and for no other purpose:
          </p>
          <Bullets
            items={[
              'Supabase — database, authentication and server functions (hosting and storage).',
              'Vercel — application hosting and delivery.',
              'Resend — sending appointment emails.',
              'Meta Platforms — delivering WhatsApp appointment messages, where enabled.',
            ]}
          />
          <p>
            Beyond these, we disclose personal data only where the law requires it, or with your
            explicit instruction. Data belonging to one clinic is never shared with another: every
            record is scoped to the team that created it and enforced at the database level.
          </p>
        </Section>

        <Section id="security" title="7. How we protect it">
          <Bullets
            items={[
              'All traffic is encrypted in transit (HTTPS/TLS), and data is encrypted at rest by our hosting providers.',
              'Row-level security in the database restricts every record to the team that owns it, so one clinic cannot read another\'s data even in error.',
              'Access-token secrets for messaging never reach the browser — messages are sent only by server-side functions.',
              'Inbound WhatsApp responses are cryptographically verified before they are accepted.',
            ]}
          />
          <p>
            No system is perfectly secure. If a breach affecting your data occurs, we will notify you
            and, where required, the Office of the Data Protection Commissioner.
          </p>
        </Section>

        <Section id="retention" title="8. How long we keep it">
          <p>
            Account and practice records are kept for as long as your account is active. Patient
            records, appointments and invoices are kept for as long as you keep them in the app —
            you can delete any of them at any time, and deletion is immediate.
          </p>
          <p>
            Message logs (channel, recipient, template, outcome and timestamp) are retained for
            troubleshooting and audit. When an account is closed, its data is deleted.
          </p>
        </Section>

        <Section id="your-rights" title="9. Your rights">
          <p>
            Under the Kenya Data Protection Act, 2019 — and equivalent laws where they apply to you —
            you have the right to be informed, to access your data, to have inaccurate data corrected,
            to have data deleted, to object to or restrict processing, and to data portability.
          </p>
          <p>
            To exercise any of these, or to request deletion of your account and all associated data,
            email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-white underline underline-offset-4 hover:text-slate-200">
              {CONTACT_EMAIL}
            </a>
            . We will respond within 30 days. If you are a patient of a clinic using WardRounds,
            please contact that clinic first — they hold your record; we can act on their instruction.
          </p>
          <p>
            You also have the right to lodge a complaint with the Office of the Data Protection
            Commissioner of Kenya.
          </p>
        </Section>

        <Section id="children" title="10. Children">
          <p>
            WardRounds is a tool for clinicians and is not directed at children. Where a clinic holds
            an appointment record for a minor patient, the contact details recorded will ordinarily be
            those of a parent or guardian, and consent is the clinic's responsibility.
          </p>
        </Section>

        <Section id="changes" title="11. Changes to this policy">
          <p>
            We may update this policy as the service changes. The date at the top always reflects the
            current version, and material changes will be notified in the app before they take effect.
          </p>
        </Section>

        <Section id="contact" title="12. Contact">
          <p>
            WardRounds, Nairobi, Kenya.{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-white underline underline-offset-4 hover:text-slate-200">
              {CONTACT_EMAIL}
            </a>
          </p>
        </Section>

        <div className="mt-16 flex items-center justify-between border-t border-white/10 pt-6">
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} WardRounds. All rights reserved.</p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-white"
          >
            Back to top <ArrowUp size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
