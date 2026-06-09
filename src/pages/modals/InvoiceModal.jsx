import { useState, useEffect } from 'react'
import { X, Printer } from 'lucide-react'
import { fetchBillingRecords } from '../../lib/api'

function fmt(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function InvoiceModal({ admission, onClose }) {
  const [billingRecords, setBillingRecords] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBillingRecords(admission.id)
      .then(d => setBillingRecords(d || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [admission.id])

  const hospital = admission.hospitals
  const patient  = admission.patients
  const accentColor   = hospital?.color || '#3B82F6'
  const invoiceNumber = `INV-${admission.id.slice(0, 8).toUpperCase()}`

  // Group billing records by service name, matched via hospital_services on the admission
  const hospitalServices = hospital?.hospital_services || []
  const groups = {}
  for (const record of billingRecords) {
    const svc  = hospitalServices.find(s => s.id === record.service_id)
    const name = svc?.service_name || 'Ward Service'
    if (!groups[name]) groups[name] = { name, days: 0, total: 0 }
    groups[name].days++
    groups[name].total += Number(record.amount)
  }
  const lineItems  = Object.values(groups)
  const grandTotal = lineItems.reduce((s, l) => s + l.total, 0)

  return (
    <div className="fixed inset-0 z-50 bg-black/60 overflow-y-auto">

      {/* Floating controls — hidden on print */}
      <div className="no-print fixed top-4 right-4 z-10 flex gap-2">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
        >
          <Printer size={15} />
          Print Invoice
        </button>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center bg-white rounded-xl shadow-lg text-gray-600 hover:bg-gray-50 transition font-bold text-lg"
        >
          <X size={16} />
        </button>
      </div>

      {/* Invoice sheet */}
      <div className="invoice-for-print bg-white w-full max-w-2xl mx-auto my-16 rounded-xl shadow-2xl overflow-hidden">

        {loading ? (
          <div className="p-16 text-center text-gray-400 text-sm">Loading invoice…</div>
        ) : (
          <>
            {/* ── Header bar ────────────────────────────────────────────────── */}
            <div className="px-8 py-6" style={{ backgroundColor: accentColor }}>
              <p className="text-white/70 text-xs uppercase tracking-widest mb-1">Invoice</p>
              <h1 className="text-2xl font-bold text-white leading-tight">
                {hospital?.name || 'Hospital'}
              </h1>
              {hospital?.location && (
                <p className="text-white/60 text-sm mt-0.5">{hospital.location}</p>
              )}
            </div>

            {/* ── Contact + Invoice number ───────────────────────────────── */}
            <div className="px-8 py-5 flex justify-between gap-6 border-b border-gray-100">
              <div className="text-sm text-gray-500 space-y-0.5">
                {hospital?.address && <p>{hospital.address}</p>}
                {hospital?.phone   && <p>{hospital.phone}</p>}
                {hospital?.email   && <p>{hospital.email}</p>}
                {!hospital?.address && !hospital?.phone && !hospital?.email && (
                  <p className="italic text-gray-300">No contact details saved</p>
                )}
              </div>
              <div className="text-right text-sm flex-shrink-0">
                <p className="font-bold text-gray-800 text-base">{invoiceNumber}</p>
                <p className="text-gray-400 mt-0.5">{fmt(new Date())}</p>
              </div>
            </div>

            {/* ── Bill To + Admission details ────────────────────────────── */}
            <div className="px-8 py-5 grid grid-cols-2 gap-6 border-b border-gray-100">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  Bill To
                </p>
                <p className="font-semibold text-gray-800">
                  {patient?.first_name} {patient?.last_name}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">DOB: {fmt(patient?.date_of_birth)}</p>
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
                  Attending: <span className="font-medium">Dr. Ebrahim Yusuf</span>
                </p>
              </div>
            </div>

            {/* ── Line items ────────────────────────────────────────────────── */}
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
                  {lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-300 italic">
                        No billing records yet
                      </td>
                    </tr>
                  ) : lineItems.map((item, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-3 font-medium text-gray-800">{item.name}</td>
                      <td className="py-3 text-center text-gray-600 tabular-nums">{item.days}</td>
                      <td className="py-3 text-right text-gray-600 tabular-nums">
                        {item.days > 0
                          ? Math.round(item.total / item.days).toLocaleString()
                          : '—'}
                      </td>
                      <td className="py-3 text-right font-semibold tabular-nums text-gray-800">
                        {Math.round(item.total).toLocaleString()}
                      </td>
                    </tr>
                  ))}
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
                      KES {Math.round(grandTotal).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ── Footer ───────────────────────────────────────────────────── */}
            <div className="px-8 pt-4 pb-8 border-t border-gray-100">
              <p className="text-sm text-gray-400 text-center mb-10">
                Thank you for choosing{' '}
                <span className="font-medium text-gray-600">{hospital?.name || 'us'}</span>.
              </p>
              <div className="flex justify-end">
                <div className="text-center w-52">
                  <div className="border-t border-gray-400 pt-2">
                    <p className="text-sm font-semibold text-gray-700">Dr. Ebrahim Yusuf</p>
                    <p className="text-xs text-gray-400 mt-0.5">Attending Physician</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
