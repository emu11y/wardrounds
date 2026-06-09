import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { getHospitalsByTeam, createHospital, updateHospital, setHospitalStatus, createHospitalService, updateHospitalService } from '../lib/api'

const RATE_SERVICES = ['General Ward', 'HDU', 'ICU']
const RATE_LABELS = { 'General Ward': 'Ward', HDU: 'HDU', ICU: 'ICU' }
const EMPTY_FORM = { name: '', location: '', address: '', phone: '', email: '' }

export default function Settings() {
  const { user } = useAuth()
  const [hospitals, setHospitals] = useState([])
  const [rates, setRates] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [editingHospital, setEditingHospital] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [savingRates, setSavingRates] = useState(false)
  const [ratesSaved, setRatesSaved] = useState(false)

  const loadHospitals = async () => {
    if (!user?.team_id) return
    const data = await getHospitalsByTeam(user.team_id)
    setHospitals(data)
    const init = {}
    for (const h of data) {
      init[h.id] = { 'General Ward': '', HDU: '', ICU: '' }
      for (const svc of (h.hospital_services || [])) {
        if (svc.service_name in init[h.id]) {
          init[h.id][svc.service_name] = String(svc.price_per_day ?? '')
        }
      }
    }
    setRates(init)
  }

  useEffect(() => {
    loadHospitals()
  }, [user?.team_id])

  const openAddModal = () => {
    setEditingHospital(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEditModal = (hospital) => {
    setEditingHospital(hospital)
    setForm({
      name: hospital.name || '',
      location: hospital.location || '',
      address: hospital.address || '',
      phone: hospital.phone || '',
      email: hospital.email || '',
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingHospital(null)
    setForm(EMPTY_FORM)
  }

  const handleSaveHospital = async () => {
    if (!form.name.trim()) { alert('Hospital name is required'); return }
    setSaving(true)
    try {
      if (editingHospital) {
        await updateHospital(editingHospital.id, {
          name: form.name.trim(),
          location: form.location.trim(),
          address: form.address.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
        })
      } else {
        if (!user?.team_id) { alert('No team found for current user'); setSaving(false); return }
        await createHospital({
          name: form.name.trim(),
          location: form.location.trim(),
          address: form.address.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          team_id: user.team_id,
        })
      }
      closeModal()
      loadHospitals()
    } catch (err) {
      alert('Failed to save hospital: ' + err.message)
    }
    setSaving(false)
  }

  const handleToggleStatus = async (hospital) => {
    const isActive = hospital.status !== 'inactive'
    if (isActive && !window.confirm(`Deactivate "${hospital.name}"? It will be hidden from new admissions.`)) return
    try {
      await setHospitalStatus(hospital.id, isActive ? 'inactive' : 'active')
      loadHospitals()
    } catch (err) {
      alert('Failed to update hospital status: ' + err.message)
    }
  }

  const handleSaveRates = async () => {
    setSavingRates(true)
    try {
      for (const h of hospitals) {
        const hospitalRates = rates[h.id] || {}
        const existingServices = h.hospital_services || []
        for (const serviceName of RATE_SERVICES) {
          const priceStr = hospitalRates[serviceName]
          const price = parseFloat(priceStr)
          if (priceStr === '' || isNaN(price)) continue
          const existing = existingServices.find(s => s.service_name === serviceName)
          if (existing) {
            await updateHospitalService(existing.id, { price_per_day: price })
          } else {
            await createHospitalService({ hospital_id: h.id, service_name: serviceName, price_per_day: price, service_type: 'ward' })
          }
        }
      }
      setRatesSaved(true)
      setTimeout(() => setRatesSaved(false), 3000)
      loadHospitals()
    } catch (err) {
      alert('Failed to save rates: ' + err.message)
    }
    setSavingRates(false)
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <button onClick={openAddModal} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold shadow-sm hover:bg-blue-700 transition">
          + Add Hospital
        </button>
      </div>

      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-xl font-bold mb-4">Daily Visit Rates (KES)</h2>
        {hospitals.length === 0 ? (
          <p className="text-gray-500">No hospitals yet. Click "Add Hospital" to get started.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2">
                <th className="text-left px-4 py-2">Hospital</th>
                {RATE_SERVICES.map(svc => (
                  <th key={svc} className="px-4 py-2">{RATE_LABELS[svc]}</th>
                ))}
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {hospitals.map((h) => {
                const isInactive = h.status === 'inactive'
                return (
                  <tr key={h.id} className={`border-b ${isInactive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-semibold">
                      <div className="flex items-center gap-2">
                        {h.name}
                        {isInactive && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded">Inactive</span>
                        )}
                      </div>
                      {h.location ? <span className="block text-sm text-gray-500 font-normal">{h.location}</span> : null}
                    </td>
                    {RATE_SERVICES.map((svc) => (
                      <td key={svc} className="px-4 py-3 text-center">
                        <input
                          type="number"
                          className="w-24 px-2 py-1 border rounded text-center"
                          placeholder="0"
                          value={rates[h.id]?.[svc] ?? ''}
                          onChange={(e) => setRates(prev => ({
                            ...prev,
                            [h.id]: { ...prev[h.id], [svc]: e.target.value },
                          }))}
                        />
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEditModal(h)}
                        className="px-3 py-1 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition mr-2"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(h)}
                        className={`px-3 py-1 text-sm border rounded-lg transition ${
                          isInactive
                            ? 'border-green-300 text-green-600 hover:bg-green-50'
                            : 'border-orange-200 text-orange-500 hover:bg-orange-50'
                        }`}
                      >
                        {isInactive ? 'Activate' : 'Deactivate'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSaveRates}
            disabled={savingRates}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50"
          >
            {savingRates ? 'Saving...' : 'Save Rates'}
          </button>
          {ratesSaved && <span className="text-green-600 text-sm font-medium">Rates saved!</span>}
        </div>
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white/70 backdrop-blur-2xl shadow-2xl">
            <div className="px-6 py-5 border-b border-white/40">
              <h2 className="text-xl font-bold text-slate-800">{editingHospital ? 'Edit Hospital' : 'Add Hospital'}</h2>
              <p className="text-sm text-slate-500 mt-0.5">Details here will appear on invoices</p>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hospital Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Aga Khan Hospital" className="w-full rounded-lg border border-white/60 bg-white/60 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Nairobi" className="w-full rounded-lg border border-white/60 bg-white/60 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="e.g. 3rd Parklands Ave, P.O. Box 30270" className="w-full rounded-lg border border-white/60 bg-white/60 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. +254 20 366 2000" className="w-full rounded-lg border border-white/60 bg-white/60 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e.g. billing@hospital.com" className="w-full rounded-lg border border-white/60 bg-white/60 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3 justify-end border-t border-white/40">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-slate-300 bg-white/50 text-slate-700 hover:bg-white/80 transition">Cancel</button>
              <button onClick={handleSaveHospital} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-700 disabled:opacity-50 transition">
                {saving ? 'Saving...' : (editingHospital ? 'Save Changes' : 'Save Hospital')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
