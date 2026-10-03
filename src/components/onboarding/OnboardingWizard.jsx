import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Stethoscope, Scissors, HeartPulse, Activity, Pill, ClipboardList, Smile, Apple, UserRound,
  BedDouble, Syringe, Clock3, User, Users, Eye, EyeOff, ChevronLeft, Plus, X, Trash2, Loader2, CircleCheck,
} from 'lucide-react'
import { fetchProfessions, fetchHospitals, fetchPayModels } from '../../lib/api'
import {
  PROFESSIONS_FALLBACK, PAY_MODELS, HOSPITAL_COLORS, WARD_SUGGESTIONS, PROCEDURE_SUGGESTIONS,
  emptyDraft, anyPay, needsHospitals, payFromRows, newLocalId, applyOnboarding, modulesFor, payModelRows, homeRouteFor,
} from '../../lib/onboarding'
import { formatKES } from '../../lib/utils'
import { OptionCard, Field, MoneyInput, Stepper, Segmented, ColorDots, SuggestionChips, fieldCls } from './wizardParts'

// ─────────────────────────────────────────────────────────────────────────────
// OnboardingWizard — first-run setup. Asks who you are, how your practice works
// and how you get paid, then creates everything the app needs (practice profile,
// hospitals, wards + daily rates, consultation fee, procedures, payers, pay types)
// so the user lands on a ready-to-use app. Admins get the full flow; invited
// members only set their own profile and pay types.
// Answers are kept as a local draft (per user) so a refresh never loses them,
// and the final save is idempotent (see lib/onboarding.js → applyOnboarding).
// ─────────────────────────────────────────────────────────────────────────────

const PROFESSION_ICONS = { doctor: Stethoscope, surgeon: Scissors, clinical_officer: ClipboardList, nurse: HeartPulse, physiotherapist: Activity, pharmacist: Pill, dentist: Smile, nutritionist: Apple, other: UserRound }
const PAY_ICONS = { ward_rounds: BedDouble, per_patient: User, per_procedure: Syringe, per_shift: Clock3 }

const draftKey = userId => `wr_onboarding_draft_${userId}`
const loadDraft = userId => { try { return JSON.parse(localStorage.getItem(draftKey(userId)) || 'null') } catch { return null } }
const storeDraft = (userId, d) => { try { localStorage.setItem(draftKey(userId), JSON.stringify(d)) } catch { /* private mode */ } }
const clearDraft = userId => { try { localStorage.removeItem(draftKey(userId)) } catch { /* ignore */ } }

export default function OnboardingWizard({ user, onDone, onClose = null }) {
  const isAdmin = user?.role === 'admin'
  const [d, setD] = useState(() => {
    const saved = loadDraft(user.id)
    return saved && !saved.done ? saved : emptyDraft(user)
  })
  const [professions, setProfessions] = useState(PROFESSIONS_FALLBACK)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState([])
  const [error, setError] = useState(null)
  const set = patch => setD(prev => ({ ...prev, ...patch }))
  const setPay = (key, patch) => setD(prev => ({ ...prev, pay: { ...prev.pay, [key]: { ...prev.pay[key], ...patch } } }))

  useEffect(() => { storeDraft(user.id, d) }, [user.id, d])

  // Load lookups + anything already set up (re-running setup from Settings).
  useEffect(() => {
    fetchProfessions().then(p => p.length && setProfessions(p)).catch(() => {})
    const fresh = !loadDraft(user.id)?.hospitals?.length
    if (isAdmin && fresh) {
      fetchHospitals(user.team_id).then(rows => {
        if (!rows?.length) return
        setD(prev => prev.hospitals.length ? prev : {
          ...prev,
          hospitals: rows.map(h => ({
            localId: newLocalId(), id: h.id, existing: true, name: h.name, color: h.color || HOSPITAL_COLORS[0], prefix: h.hospital_id_prefix || '',
            existingWards: (h.hospital_services || []).filter(s => s.service_type === 'ward').map(s => ({ name: s.service_name, rate: s.price_per_day })),
            wards: [],
          })),
        })
      }).catch(() => {})
    }
    fetchPayModels(user.id).then(rows => {
      if (rows?.length) setD(prev => anyPay(prev) ? prev : { ...prev, pay: payFromRows(rows) })
    }).catch(() => {})
  }, [user.id, user.team_id, isAdmin])

  const professionLabel = professions.find(p => p.key === d.professionKey)?.label || ''

  // ── Steps (depend on role + answers) ──
  const steps = useMemo(() => {
    const s = [{ key: 'you', title: 'Welcome' }, { key: 'profession', title: 'Your profession' }]
    if (isAdmin) s.push({ key: 'practice', title: 'Your practice' })
    s.push({ key: 'pay', title: 'How you get paid' })
    if (isAdmin && (needsHospitals(d) || d.pay.per_shift.on)) s.push({ key: 'hospitals', title: 'Where you work' })
    if (isAdmin && (d.pay.ward_rounds.on || d.pay.per_procedure.on)) s.push({ key: 'rates', title: 'Your rates' })
    s.push({ key: 'review', title: 'Review' })
    return s
  }, [isAdmin, d])
  const stepIndex = Math.min(d.step, steps.length - 1)
  const step = steps[stepIndex]

  // ── Validation per step ──
  const valid = (() => {
    switch (step.key) {
      case 'you': return d.fullName.trim().length > 1
      case 'profession': return !!d.professionKey
      case 'practice': return d.practiceName.trim().length > 1
      case 'pay':
        if (!anyPay(d)) return false
        if (d.pay.per_patient.on && d.pay.per_patient.mode === 'percent' && !(Number(d.pay.per_patient.percent) > 0)) return false
        return true
      case 'hospitals': return !needsHospitals(d) || d.hospitals.some(h => h.name.trim())
      case 'rates':
        if (!d.pay.ward_rounds.on) return true
        return d.hospitals.filter(h => h.name.trim()).every(h =>
          (h.existingWards?.length || 0) + h.wards.filter(w => w.name.trim() && Number(w.rate) > 0).length > 0)
      default: return true
    }
  })()

  const go = delta => { setError(null); set({ step: Math.max(0, Math.min(steps.length - 1, stepIndex + delta)) }) }

  async function finish() {
    setSaving(true); setError(null); setProgress([])
    try {
      const cleaned = { ...d, hospitals: d.hospitals.filter(h => h.name.trim()) }
      const result = await applyOnboarding(cleaned, {
        user, isAdmin, professionLabel,
        onProgress: (label, next) => { setProgress(p => [...p, label]); storeDraft(user.id, next); setD(next) },
      })
      clearDraft(user.id)
      setD(result)
    } catch (err) {
      console.error('onboarding:', err)
      setError(err.message || 'Something went wrong while saving. Your answers are kept — try again.')
    } finally { setSaving(false) }
  }

  const modules = modulesFor(payModelRows(d))
  const home = homeRouteFor(modules)

  // ── Hospital helpers ──
  const addHospital = () => set({ hospitals: [...d.hospitals, { localId: newLocalId(), name: '', color: HOSPITAL_COLORS[d.hospitals.length % HOSPITAL_COLORS.length], prefix: '', wards: [] }] })
  const updHospital = (localId, patch) => set({ hospitals: d.hospitals.map(h => h.localId === localId ? { ...h, ...patch } : h) })
  const delHospital = localId => set({ hospitals: d.hospitals.filter(h => h.localId !== localId) })
  const addWard = (localId, name = '') => updHospital(localId, { wards: [...d.hospitals.find(h => h.localId === localId).wards, { localId: newLocalId(), name, rate: '' }] })
  const updWard = (hId, wId, patch) => updHospital(hId, { wards: d.hospitals.find(h => h.localId === hId).wards.map(w => w.localId === wId ? { ...w, ...patch } : w) })
  const delWard = (hId, wId) => updHospital(hId, { wards: d.hospitals.find(h => h.localId === hId).wards.filter(w => w.localId !== wId) })
  const addProcedure = (name = '') => set({ procedures: [...d.procedures, { localId: newLocalId(), name, price: '' }] })
  const updProcedure = (id, patch) => set({ procedures: d.procedures.map(p => p.localId === id ? { ...p, ...patch } : p) })
  const delProcedure = id => set({ procedures: d.procedures.filter(p => p.localId !== id) })

  // ── Done screen ──
  if (d.done) {
    return (
      <Shell onClose={null}>
        <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-10 flex flex-col items-center text-center">
          <span className="w-16 h-16 rounded-full bg-green-50 text-green-600 flex items-center justify-center"><CircleCheck size={34} /></span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-gray-900">You’re ready, {d.fullName.split(' ')[0]}</h1>
          <p className="mt-2 text-sm text-gray-500 max-w-sm">WardRounds is set up for {isAdmin ? d.practiceName : 'you'}. Everything can be changed later in Settings.</p>
          <ul className="mt-6 w-full max-w-sm text-left space-y-2">
            {progress.filter(p => p !== 'All set').map((p, i) => (
              <li key={i} className="flex items-center gap-2 text-[13px] text-gray-600"><CircleCheck size={15} className="text-green-500 flex-shrink-0" /> {p}</li>
            ))}
          </ul>
          <div className="mt-8 w-full max-w-sm space-y-2">
            <button onClick={() => onDone(home)} className="w-full px-6 py-3 rounded-full bg-ios-blue text-white text-sm font-semibold shadow-sm">
              {home === '/shifts' ? 'Log my first shift' : home === '/outpatient' ? 'See my first patient' : 'Admit my first patient'}
            </button>
            {isAdmin && d.practiceType === 'team' && (
              <button onClick={() => onDone('/settings?tab=admin')} className="w-full px-6 py-3 rounded-full bg-white border border-gray-200 text-sm font-semibold text-gray-700">
                Add my team members
              </button>
            )}
          </div>
        </div>
      </Shell>
    )
  }

  return (
    <Shell onClose={onClose}>
      {/* Progress */}
      <div className="px-6 sm:px-10 pt-6 flex-shrink-0">
        <div className="flex gap-1.5">
          {steps.map((s, i) => <div key={s.key} className={`h-1 flex-1 rounded-full ${i <= stepIndex ? 'bg-ios-blue' : 'bg-gray-200'}`} />)}
        </div>
        <p className="mt-3 text-xs font-medium text-gray-400">Step {stepIndex + 1} of {steps.length} · {step.title}</p>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-10 py-5" data-lenis-prevent>
        {step.key === 'you' && (
          <section className="space-y-5">
            <Heading title="Let’s set up WardRounds" sub={isAdmin ? 'A few questions about you, your practice and how you get paid. It takes about three minutes, and you can change anything later.' : 'A few quick questions about you and how you get paid.'} />
            <Field label="Your full name" hint="As it should appear on your invoices">
              <input value={d.fullName} onChange={e => set({ fullName: e.target.value })} className={fieldCls} placeholder="e.g. Dr. Amina Odhiambo" autoFocus />
            </Field>
            <Field label="Mobile number (optional)">
              <input value={d.phone} onChange={e => set({ phone: e.target.value })} inputMode="tel" className={fieldCls} placeholder="07xx xxx xxx" />
            </Field>
          </section>
        )}

        {step.key === 'profession' && (
          <section className="space-y-4">
            <Heading title="What is your profession?" sub="This shapes the setup — you can still use every part of the app." />
            <div className="grid grid-cols-2 gap-2">
              {professions.map(p => (
                <OptionCard key={p.key} compact icon={PROFESSION_ICONS[p.key] || UserRound} title={p.label}
                  selected={d.professionKey === p.key} onClick={() => set({ professionKey: p.key })} />
              ))}
            </div>
            <Field label="Speciality (optional)" hint="Shown under your name on invoices, e.g. Consultant Physician">
              <input value={d.speciality} onChange={e => set({ speciality: e.target.value })} className={fieldCls} placeholder="e.g. Endocrinology" />
            </Field>
          </section>
        )}

        {step.key === 'practice' && (
          <section className="space-y-5">
            <Heading title="Tell us about your practice" sub="You can switch between solo and team at any time." />
            <Field label="Practice name">
              <input value={d.practiceName} onChange={e => set({ practiceName: e.target.value })} className={fieldCls} placeholder="e.g. Nairobi Heart Clinic" />
            </Field>
            <div className="space-y-2.5">
              <OptionCard icon={User} title="Just me" hint="I work on my own" selected={d.practiceType === 'solo'} onClick={() => set({ practiceType: 'solo' })} />
              <OptionCard icon={Users} title="A team" hint="Colleagues, associates or staff work with me" selected={d.practiceType === 'team'} onClick={() => set({ practiceType: 'team' })}>
                <div className="space-y-4 pt-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-gray-700">How many people, including you?</span>
                    <Stepper value={d.teamSize} min={2} onChange={teamSize => set({ teamSize })} />
                  </div>
                  <div className="space-y-2">
                    <span className="block text-[13px] text-gray-700">What should your team see?</span>
                    <OptionCard icon={Eye} title="Patients and financials" hint="Fees, totals, invoices and exports" selected={d.membersSeeFinancials} onClick={() => set({ membersSeeFinancials: true })} />
                    <OptionCard icon={EyeOff} title="Patients and services only" hint="Amounts are hidden from team members" selected={!d.membersSeeFinancials} onClick={() => set({ membersSeeFinancials: false })} />
                    <p className="text-[11.5px] text-gray-400">You can change this for any individual later in Settings → Team.</p>
                  </div>
                </div>
              </OptionCard>
            </div>
          </section>
        )}

        {step.key === 'pay' && (
          <section className="space-y-4">
            <Heading title="How do you get paid?" sub="Choose all that apply. WardRounds will track each one and show you only what you use." />
            {PAY_MODELS.map(m => (
              <OptionCard key={m.key} multi icon={PAY_ICONS[m.key]} title={m.label} hint={m.hint}
                selected={d.pay[m.key].on} onClick={() => setPay(m.key, { on: !d.pay[m.key].on })}>
                {m.key === 'per_patient' && (
                  <div className="space-y-3 pt-1">
                    <Segmented options={[{ key: 'fixed', label: 'Fixed amount' }, { key: 'percent', label: 'Percentage' }]}
                      value={d.pay.per_patient.mode} onChange={mode => setPay('per_patient', { mode })} />
                    <div className={`grid gap-3 ${d.pay.per_patient.mode === 'percent' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      <Field label={d.pay.per_patient.mode === 'percent' ? 'Typical fee per patient' : 'Your fee per patient'}>
                        <MoneyInput value={d.pay.per_patient.amount} onChange={amount => setPay('per_patient', { amount })} />
                      </Field>
                      {d.pay.per_patient.mode === 'percent' && (
                        <Field label="Your share">
                          <MoneyInput value={d.pay.per_patient.percent} suffix="%" onChange={percent => setPay('per_patient', { percent })} />
                        </Field>
                      )}
                    </div>
                  </div>
                )}
                {m.key === 'per_shift' && (
                  <div className="space-y-3 pt-1">
                    <Segmented options={[{ key: 'shift', label: 'Per shift' }, { key: 'hour', label: 'Per hour' }]}
                      value={d.pay.per_shift.unit} onChange={unit => setPay('per_shift', { unit })} />
                    <Field label={d.pay.per_shift.unit === 'hour' ? 'Typical rate per hour' : 'Typical rate per shift'} hint="Pre-fills new shifts. Overtime and per-patient pay can be added on each shift.">
                      <MoneyInput value={d.pay.per_shift.rate} onChange={rate => setPay('per_shift', { rate })} />
                    </Field>
                  </div>
                )}
              </OptionCard>
            ))}
          </section>
        )}

        {step.key === 'hospitals' && (
          <section className="space-y-4">
            <Heading title="Where do you work?" sub={needsHospitals(d) ? 'Add the hospitals or facilities where you see patients. Each gets a colour so you can tell them apart at a glance.' : 'Optional — add the hospitals where you do shifts so they’re ready to pick.'} />
            {d.hospitals.map((h, i) => (
              <div key={h.localId} className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: h.color }} />
                  <span className="text-xs font-semibold text-gray-400 flex-1">{h.existing ? 'Already added' : `Hospital ${i + 1}`}</span>
                  {!h.existing && <button type="button" onClick={() => delHospital(h.localId)} aria-label="Remove hospital" className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100"><Trash2 size={15} /></button>}
                </div>
                {h.existing ? (
                  <p className="text-[15px] font-semibold text-gray-900">{h.name}</p>
                ) : (
                  <>
                    <Field label="Hospital name"><input value={h.name} onChange={e => updHospital(h.localId, { name: e.target.value })} className={fieldCls} placeholder="e.g. Aga Khan University Hospital" /></Field>
                    <Field label="Colour"><ColorDots colors={HOSPITAL_COLORS} value={h.color} onChange={color => updHospital(h.localId, { color })} /></Field>
                    <Field label="Patient ID prefix on tags (optional)" hint="Helps the tag scanner recognise this hospital — e.g. AK, UHID, IP No.">
                      <input value={h.prefix} onChange={e => updHospital(h.localId, { prefix: e.target.value })} className={fieldCls} placeholder="e.g. AK" />
                    </Field>
                  </>
                )}
              </div>
            ))}
            <button type="button" onClick={addHospital}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl border border-dashed border-gray-300 text-sm font-semibold text-ios-blue hover:bg-blue-50/50">
              <Plus size={16} /> {d.hospitals.length ? 'Add another hospital' : 'Add a hospital'}
            </button>
          </section>
        )}

        {step.key === 'rates' && (
          <section className="space-y-6">
            <Heading title="Set your rates" sub="These drive your bills automatically. Change them any time in Settings." />
            {d.pay.ward_rounds.on && d.hospitals.filter(h => h.name.trim()).map(h => (
              <div key={h.localId} className="space-y-2.5">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-900"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: h.color }} />{h.name} — wards and daily rates</p>
                {(h.existingWards || []).map((w, i) => (
                  <div key={`e${i}`} className="flex items-center justify-between text-[13px] text-gray-500 px-1"><span>{w.name}</span><span className="tabular-nums">{formatKES(w.rate)}/day</span></div>
                ))}
                {h.wards.map(w => (
                  <div key={w.localId} className="flex items-center gap-2">
                    <input value={w.name} onChange={e => updWard(h.localId, w.localId, { name: e.target.value })} className={`${fieldCls} flex-1`} placeholder="Ward name" />
                    <div className="w-36"><MoneyInput value={w.rate} placeholder="Per day" onChange={rate => updWard(h.localId, w.localId, { rate })} /></div>
                    <button type="button" onClick={() => delWard(h.localId, w.localId)} aria-label="Remove ward" className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100"><X size={15} /></button>
                  </div>
                ))}
                <SuggestionChips items={WARD_SUGGESTIONS} taken={[...h.wards.map(w => w.name), ...(h.existingWards || []).map(w => w.name)]} onPick={name => addWard(h.localId, name)} />
                <button type="button" onClick={() => addWard(h.localId)} className="text-xs font-semibold text-ios-blue">+ Another ward</button>
              </div>
            ))}
            {d.pay.per_procedure.on && (
              <div className="space-y-2.5">
                <p className="text-sm font-semibold text-gray-900">Procedures and their prices</p>
                {d.procedures.map(p => (
                  <div key={p.localId} className="flex items-center gap-2">
                    <input value={p.name} onChange={e => updProcedure(p.localId, { name: e.target.value })} className={`${fieldCls} flex-1`} placeholder="Procedure" />
                    <div className="w-36"><MoneyInput value={p.price} placeholder="Price" onChange={price => updProcedure(p.localId, { price })} /></div>
                    <button type="button" onClick={() => delProcedure(p.localId)} aria-label="Remove procedure" className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100"><X size={15} /></button>
                  </div>
                ))}
                <SuggestionChips items={PROCEDURE_SUGGESTIONS} taken={d.procedures.map(p => p.name)} onPick={addProcedure} />
                <button type="button" onClick={() => addProcedure()} className="text-xs font-semibold text-ios-blue">+ Another procedure</button>
                <p className="text-[11.5px] text-gray-400">Optional now — you can add procedures later in Settings → Services.</p>
              </div>
            )}
          </section>
        )}

        {step.key === 'review' && (
          <section className="space-y-4">
            <Heading title="Ready to finish?" sub="Here’s what WardRounds will set up. Tap Back to change anything." />
            <dl className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 text-[13px]">
              <Row k="You" v={`${d.fullName}${professionLabel ? ` · ${professionLabel}` : ''}${d.speciality ? ` · ${d.speciality}` : ''}`} />
              {isAdmin && <Row k="Practice" v={`${d.practiceName} · ${d.practiceType === 'team' ? `team of ${d.teamSize}${d.membersSeeFinancials ? '' : ' · financials hidden from members'}` : 'solo'}`} />}
              <Row k="Paid by" v={PAY_MODELS.filter(m => d.pay[m.key].on).map(m => m.label).join(', ')} />
              {d.pay.per_patient.on && <Row k="Per patient" v={d.pay.per_patient.mode === 'percent' ? `${d.pay.per_patient.percent}% of ${formatKES(d.pay.per_patient.amount)}` : d.pay.per_patient.amount ? formatKES(d.pay.per_patient.amount) : 'amount not set'} />}
              {d.pay.per_shift.on && <Row k="Shifts" v={d.pay.per_shift.rate ? `${formatKES(d.pay.per_shift.rate)} per ${d.pay.per_shift.unit}` : 'rate not set'} />}
              {isAdmin && d.hospitals.some(h => h.name.trim()) && <Row k="Hospitals" v={d.hospitals.filter(h => h.name.trim()).map(h => h.name.trim()).join(', ')} />}
              {isAdmin && d.pay.ward_rounds.on && <Row k="New wards" v={`${d.hospitals.reduce((n, h) => n + h.wards.filter(w => w.name.trim()).length, 0)}`} />}
              {isAdmin && d.pay.per_procedure.on && d.procedures.some(p => p.name.trim()) && <Row k="Procedures" v={d.procedures.filter(p => p.name.trim()).map(p => p.name.trim()).join(', ')} />}
            </dl>
            {saving && (
              <ul className="space-y-1.5">
                {progress.map((p, i) => <li key={i} className="flex items-center gap-2 text-[12.5px] text-gray-500"><CircleCheck size={14} className="text-green-500" />{p}</li>)}
                <li className="flex items-center gap-2 text-[12.5px] text-gray-500"><Loader2 size={14} className="animate-spin" />Setting things up…</li>
              </ul>
            )}
            {error && <p className="text-[13px] text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-gray-100 px-6 sm:px-10 py-4 flex items-center gap-3 bg-white/80">
        {stepIndex > 0 && (
          <button type="button" onClick={() => go(-1)} disabled={saving} className="inline-flex items-center gap-1 px-4 py-2.5 rounded-full text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-40">
            <ChevronLeft size={16} /> Back
          </button>
        )}
        <div className="flex-1" />
        {step.key === 'review' ? (
          <button type="button" onClick={finish} disabled={saving} className="px-6 py-2.5 rounded-full bg-ios-blue text-white text-sm font-semibold shadow-sm disabled:opacity-50">
            {saving ? 'Setting up…' : error ? 'Try again' : 'Finish setup'}
          </button>
        ) : (
          <button type="button" onClick={() => go(1)} disabled={!valid} className="px-6 py-2.5 rounded-full bg-ios-blue text-white text-sm font-semibold shadow-sm disabled:opacity-40">
            Continue
          </button>
        )}
      </div>
    </Shell>
  )
}

function Shell({ children, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[95] bg-[#eef0f3] sm:bg-black/20 sm:backdrop-blur-sm flex sm:items-center sm:justify-center sm:p-6">
      <div className="relative w-full sm:max-w-xl h-full sm:h-auto sm:max-h-[90vh] bg-[#f8f9fb] sm:rounded-3xl sm:shadow-2xl flex flex-col"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {onClose && (
          <button onClick={onClose} aria-label="Close setup" className="absolute right-4 top-4 z-10 w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}>
            <X size={15} />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body
  )
}

function Heading({ title, sub }) {
  return (
    <div>
      <h1 className="text-[22px] font-bold tracking-tight text-gray-900 leading-tight">{title}</h1>
      {sub && <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{sub}</p>}
    </div>
  )
}

function Row({ k, v }) {
  return (
    <div className="flex gap-4 px-4 py-3">
      <dt className="w-24 flex-shrink-0 text-gray-400">{k}</dt>
      <dd className="flex-1 text-gray-800">{v || '—'}</dd>
    </div>
  )
}
