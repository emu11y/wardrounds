import { useState, useEffect } from 'react'
import { X, Printer } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { fetchTeamProfile, fetchAdmissionServices, fetchPositionName } from '../../lib/api'
import { wardBillingLines } from '../../lib/billing'
import { formatKES } from '../../lib/utils'
import Backdrop from '../../components/Backdrop'

function fmt(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function InvoiceModal({ admission, onClose }) {
  const { user } = useAuth()
  const [admissionServices, setAdmissionServices] = useState([])
  const [practice, setPractice] = useState(null)
  const [issuerPosition, setIssuerPosition] = useState(null)
  const [loading, setLoading] = useState(true)
  const [servicesError, setServicesError] = useState(false)

  // Lock page scroll while the invoice modal is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    Promise.all([
      // Financially critical — falling back to admission.visit_services (a possibly-stale
      // prop) on failure is better than showing nothing, but the total may be wrong, so we
      // track and surface the failure separately rather than swallowing it like the two
      // cosmetic lookups below (practice letterhead / issuer title) which are safe to no-op.
      fetchAdmissionServices(admission.id).catch(err => { console.error(err); setServicesError(true); return null }),
      user?.team_id ? fetchTeamProfile(user.team_id).catch(() => null) : Promise.resolve(null),
      user?.position_id ? fetchPositionName(user.position_id).catch(() => null) : Promise.resolve(null),
    ]).then(([svcData, prof, posName]) => {
      setAdmissionServices(svcData?.length ? svcData : (admission.visit_services || []))
      setPractice(prof)
      setIssuerPosition(posName)
    }).finally(() => setLoading(false))
  }, [admission.id, user?.team_id, user?.position_id])

  const hospital    = admission.hospitals
  const patient     = admission.patients
  const accentColor = hospital?.color || '#3B82F6'
  const invoiceNumber = `INV-${admission.id.slice(0, 8).toUpperCase()}`

  const handlePrint = () => {
    const patientName = [patient?.first_name, patient?.last_name].filter(Boolean).join(' ').trim()
    const practiceName = practice?.practice_name || practice?.doctor_name || 'WardRounds'
    const clean = s => (s || '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')
    const parts = [clean(patientName), clean(practiceName), 'Invoice'].filter(Boolean)
    const filename = parts.join('_') || 'Invoice'
    const prevTitle = document.title
    document.title = filename
    window.print()
    setTimeout(() => { document.title = prevTitle }, 500)
  }

  const wardLines = wardBillingLines(admission)
  const lineItems = wardLines.map(l => ({ name: l.ward, days: l.days, rate: l.rate, total: l.total }))
  const wardGrandTotal = lineItems.reduce((s, l) => s + l.total, 0)
  const svcGrandTotal   = admissionServices.reduce((s, svc) => s + Number(svc.price), 0)
  const grandTotal      = wardGrandTotal + svcGrandTotal

  const hasPractice = practice && (
    practice.practice_name || practice.doctor_name ||
    practice.address || practice.phone || practice.email
  )
  const doctorName  = practice?.doctor_name  || 'Dr. Ebrahim Yusuf'
  const doctorTitle = practice?.doctor_title || 'Attending Physician'

  return (
    <>
    <Backdrop zIndex="z-[60]" />
    <div className="invoice-print-viewport fixed inset-0 z-[61] overflow-y-auto">

      {/* Invoice sheet */}
      <div className="invoice-for-print bg-white w-full max-w-2xl mx-auto my-16 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-8rem)]">

        <div className="no-print flex-shrink-0 flex justify-end gap-2 p-3 bg-white/80 backdrop-blur-xl border-b border-white/60">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 backdrop-blur-xl border border-white/60 shadow-sm text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            <Printer size={15} />
            Print Invoice
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-xl border border-white/60 shadow-sm text-gray-600 hover:bg-gray-50 transition"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto invoice-scroll-body">
        {loading ? (
          <div className="p-16 text-center text-gray-400 text-sm">Loading invoice…</div>
        ) : (
          <>
            {servicesError && (
              <div className="no-print px-8 py-2.5 bg-red-50 border-b border-red-100 text-red-600 text-xs font-medium text-center">
                Couldn't refresh procedures &amp; tests — totals below may be out of date. Please retry before sending this invoice.
              </div>
            )}
            {/* ── Header bar ───────────────────────────────────────────────── */}
            <div className="px-8 py-6 flex items-center gap-4" style={{ backgroundColor: accentColor }}>
              {practice?.logo_url && (
                <div className="flex-shrink-0 w-14 h-14 rounded-full bg-white/90 backdrop-blur-xl ring-1 ring-white/60 border border-white/30 shadow-lg overflow-hidden flex items-center justify-center">
                  <img
                    src={practice.logo_url}
                    alt="Practice logo"
                    className="w-9 h-9 object-contain"
                    onError={e => { e.currentTarget.parentElement.style.display = 'none' }}
                  />
                </div>
              )}
              <div className="flex-1 flex items-center justify-between gap-4">
                <div>
                  <p className="text-white/70 text-xs uppercase tracking-widest mb-1">Invoice</p>
                  <h1 className="text-2xl font-bold text-white leading-tight">
                    {practice?.practice_name || practice?.doctor_name || 'My Practice'}
                  </h1>
                  {practice?.address && (
                    <p className="text-white/60 text-sm mt-0.5">{practice.address}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-white text-base">{invoiceNumber}</p>
                  <p className="text-white/60 text-sm mt-0.5">{fmt(new Date())}</p>
                </div>
              </div>
            </div>

            {/* ── Issued by + Invoice number ────────────────────────────────── */}
            <div className="px-8 py-5 border-b border-gray-100">
              <div className="flex justify-between gap-6">
                <div className="min-w-0 flex gap-8">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                      Issued by
                    </p>
                    {hasPractice ? (
                      <div className="text-sm text-gray-600 space-y-0.5">
                        {practice.practice_name && (
                          <p className="font-semibold text-gray-800">{practice.practice_name}</p>
                        )}
                        {practice.doctor_name && (
                          <p>{practice.doctor_name}{practice.doctor_title ? `, ${practice.doctor_title}` : ''}</p>
                        )}
                        {practice.address && <p>{practice.address}</p>}
                        {practice.phone   && <p>{practice.phone}</p>}
                        {practice.email   && <p>{practice.email}</p>}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-300 italic">
                        Complete your practice details in Settings
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                      Issued through
                    </p>
                    <div className="text-sm text-gray-600 space-y-0.5">
                      <p className="font-semibold text-gray-800">{hospital?.name || '—'}</p>
                      {hospital?.location && <p>{hospital.location}</p>}
                    </div>
                  </div>
                </div>
                {/* invoice number moved to header */}
              </div>
            </div>

            {/* ── Bill To + Admission details ───────────────────────────────── */}
            <div className="px-8 py-5 grid grid-cols-2 gap-6 border-b border-gray-100">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  Bill To
                </p>
                <p className="font-semibold text-gray-800">
                  {patient?.first_name} {patient?.last_name}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">DOB: {fmt(patient?.date_of_birth)}</p>
                <p className="text-sm text-gray-500">IP No: {admission.patient_hospital_id || '—'}</p>
                {patient?.insurance_name && (
                  <p className="text-sm text-gray-500">Insurance: {patient.insurance_name}</p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  Admission
                </p>
                <p className="text-sm text-gray-700">
                  Admitted: <span className="font-medium">{fmt(admission.admission_date)}</span>
                </p>
                <p className="text-sm text-gray-700">
                  Ward: <span className="font-medium">{admission.ward || '—'}</span>
                </p>
                <p className="text-sm text-gray-700">
                  Attending: <span className="font-medium">{doctorName}</span>
                </p>
              </div>
            </div>

            {/* ── Line items ───────────────────────────────────────────────── */}
            <div className="px-8 py-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200 text-gray-500 font-semibold">
                    <th className="text-left pb-2">Service</th>
                    <th className="text-center pb-2">Days</th>
                    <th className="text-right pb-2">Rate / day (KES)</th>
                    <th className="text-right pb-2">Amount (KES)</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length === 0 && admissionServices.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-300 italic">
                        No billing records yet
                      </td>
                    </tr>
                  ) : (
                    <>
                      {lineItems.map((item, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-3 font-medium text-gray-800">{item.name}</td>
                          <td className="py-3 text-center text-gray-600 tabular-nums">{item.days}</td>
                          <td className="py-3 text-right text-gray-600 tabular-nums">
                            {item.days > 0 ? Math.round(item.rate).toLocaleString() : '—'}
                          </td>
                          <td className="py-3 text-right font-semibold tabular-nums text-gray-800">
                            {Math.round(item.total).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {admissionServices.length > 0 && (
                        <>
                          <tr>
                            <td colSpan={4} className="pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                              Procedures &amp; Tests
                            </td>
                          </tr>
                          {admissionServices.map(svc => (
                            <tr key={svc.id} className="border-b border-gray-100">
                              <td className="py-3 font-medium text-gray-800">{svc.service_name}</td>
                              <td className="py-3 text-center text-gray-400">—</td>
                              <td className="py-3 text-right text-gray-400">—</td>
                              <td className="py-3 text-right font-semibold tabular-nums text-gray-800">
                                {Math.round(Number(svc.price)).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td colSpan={3} className="pt-4 pb-2 text-right font-bold text-gray-700 pr-4">
                      Total
                    </td>
                    <td
                      className="pt-4 pb-2 text-right font-bold text-lg tabular-nums"
                      style={{ color: accentColor }}
                    >
                      {formatKES(grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ── Footer ───────────────────────────────────────────────────── */}
            <div className="px-8 pt-4 pb-8 border-t border-gray-100">
              <p className="text-sm text-gray-400 text-center mb-10">
                Thank you for choosing{' '}
                <span className="font-medium text-gray-600">{practice?.practice_name || practice?.doctor_name || 'us'}</span>.
              </p>
              <div className="flex justify-between items-end gap-8">
                <div className="w-52">
                  <div className="border-t border-gray-400 pt-2">
                    <p className="text-xs text-gray-400">Received by (name / signature / stamp)</p>
                  </div>
                </div>
                <div className="text-center w-52">
                  <div className="border-t border-gray-400 pt-2">
                    <p className="text-[10px] text-gray-300 mb-1">Issued by</p>
                    <p className="text-sm font-semibold text-gray-700">{user?.full_name || doctorName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{issuerPosition || doctorTitle}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── WardRounds branding ───────────────────────────────────────── */}
            <div className="px-8 py-3 border-t border-gray-100 flex items-center justify-center gap-2">
              <span className="text-xs text-gray-300">Invoice generated by</span>
              <span className="flex items-center gap-1.5">
                <img src="/wardrounds-icon.png" alt="WardRounds" className="w-4 h-4 object-contain" />
                <span className="text-xs font-bold text-gray-500 tracking-tight">WardRounds</span>
              </span>
              <span className="text-xs text-gray-300">· Clinical Billing for Kenyan Doctors</span>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
    </>
  )
}
