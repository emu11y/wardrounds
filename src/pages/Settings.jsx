import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getHospitalsByTeam, createHospital, updateHospital, setHospitalStatus, createHospitalService, updateHospitalService, fetchTeamProfile, saveTeamProfile, fetchTeamServices, createTeamService, updateTeamService, setTeamServiceStatus, deleteTeamService } from '../lib/api'

const RATE_SERVICES = ['General Ward', 'HDU', 'ICU']
const RATE_LABELS = { 'General Ward': 'Ward', HDU: 'HDU', ICU: 'ICU' }
const DEFAULT_COLOR = '#3B82F6'
const PALETTE = [
  '#3B82F6', '#10B981', '#8B5CF6', '#F97316',
  '#EC4899', '#14B8A6', '#6366F1', '#EF4444',
  '#F59E0B', '#06B6D4', '#F43F5E', '#64748B',
]
const EMPTY_FORM = { name: '', location: '', address: '', phone: '', email: '', color: DEFAULT_COLOR, hospital_id_prefix: '' }

const CATEGORIES = ['Procedure', 'Test', 'Equipment', 'Consultation', 'Other']
const CATEGORY_COLORS = {
  Procedure:    'bg-teal-100 text-teal-700',
  Test:         'bg-blue-100 text-blue-700',
  Equipment:    'bg-orange-100 text-orange-700',
  Consultation: 'bg-purple-100 text-purple-700',
  Other:        'bg-gray-100 text-gray-600',
}
const EMPTY_SERVICE_FORM = { service_name: '', description: '', category: 'Procedure', price: '', billing_type: 'one-off' }

export default function Settings() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'billing'

  const [hospitals, setHospitals] = useState([])
  const [rates, setRates] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [editingHospital, setEditingHospital] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [savingRates, setSavingRates] = useState(false)
  const [ratesSaved, setRatesSaved] = useState(false)

  const EMPTY_PRACTICE = { practice_name: '', doctor_name: '', doctor_title: 'Attending Physician', address: '', phone: '', email: '', logo_url: '' }
  const [practiceForm, setPracticeForm] = useState(EMPTY_PRACTICE)
  const [savingPractice, setSavingPractice] = useState(false)
  const [practiceSaved, setPracticeSaved] = useState(false)

  const [services, setServices] = useState([])
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [serviceForm, setServiceForm] = useState(EMPTY_SERVICE_FORM)
  const [savingService, setSavingService] = useState(false)

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

  const loadServices = async () => {
    if (!user?.team_id) return
    try {
      const data = await fetchTeamServices(user.team_id)
      setServices(data)
    } catch { /* ignore */ }
  }

  const loadPractice = async () => {
    if (!user?.team_id) return
    try {
      const data = await fetchTeamProfile(user.team_id)
      if (data) {
        setPracticeForm({
          practice_name: data.practice_name || '',
          doctor_name:   data.doctor_name   || '',
          doctor_title:  data.doctor_title  || 'Attending Physician',
          address:       data.address       || '',
          phone:         data.phone         || '',
          email:         data.email         || '',
          logo_url:      data.logo_url      || '',
        })
      }
    } catch { /* columns may not exist yet — silently ignore */ }
  }

  const handleSavePractice = async () => {
    if (!user?.team_id) return
    setSavingPractice(true)
    try {
      await saveTeamProfile(user.team_id, {
        practice_name: practiceForm.practice_name.trim(),
        doctor_name:   practiceForm.doctor_name.trim(),
        doctor_title:  practiceForm.doctor_title.trim(),
        address:       practiceForm.address.trim(),
        phone:         practiceForm.phone.trim(),
        email:         practiceForm.email.trim(),
        logo_url:      practiceForm.logo_url.trim(),
      })
      setPracticeSaved(true)
      setTimeout(() => setPracticeSaved(false), 3000)
    } catch (err) {
      alert('Failed to save practice details: ' + err.message)
    }
    setSavingPractice(false)
  }

  useEffect(() => {
    loadHospitals()
    loadPractice()
    loadServices()
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
      color: hospital.color || DEFAULT_COLOR,
      hospital_id_prefix: hospital.hospital_id_prefix || '',
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
          color: form.color,
          hospital_id_prefix: form.hospital_id_prefix.trim() || null,
        })
      } else {
        if (!user?.team_id) { alert('No team found for current user'); setSaving(false); return }
        await createHospital({
          name: form.name.trim(),
          location: form.location.trim(),
          address: form.address.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          color: form.color,
          hospital_id_prefix: form.hospital_id_prefix.trim() || null,
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

  const openAddServiceModal = () => {
    setEditingService(null)
    setServiceForm(EMPTY_SERVICE_FORM)
    setShowServiceModal(true)
  }

  const openEditServiceModal = (svc) => {
    setEditingService(svc)
    setServiceForm({
      service_name: svc.service_name || '',
      description:  svc.description  || '',
      category:     svc.category     || 'Procedure',
      price:        svc.price != null ? String(svc.price) : '',
      billing_type: svc.billing_type  || 'one-off',
    })
    setShowServiceModal(true)
  }

  const closeServiceModal = () => {
    setShowServiceModal(false)
    setEditingService(null)
    setServiceForm(EMPTY_SERVICE_FORM)
  }

  const handleSaveService = async () => {
    if (!serviceForm.service_name.trim()) { alert('Service name is required'); return }
    const price = parseFloat(serviceForm.price)
    if (isNaN(price) || price < 0) { alert('Enter a valid price'); return }
    setSavingService(true)
    try {
      const payload = {
        service_name: serviceForm.service_name.trim(),
        description:  serviceForm.description.trim(),
        category:     serviceForm.category,
        price,
        billing_type: serviceForm.billing_type,
      }
      if (editingService) {
        await updateTeamService(editingService.id, payload)
      } else {
        await createTeamService({ ...payload, team_id: user.team_id, status: 'active' })
      }
      closeServiceModal()
      loadServices()
    } catch (err) {
      alert('Failed to save service: ' + err.message)
    }
    setSavingService(false)
  }

  const handleToggleServiceStatus = async (svc) => {
    const next = svc.status === 'active' ? 'hidden' : 'active'
    try {
      await setTeamServiceStatus(svc.id, next)
      loadServices()
    } catch (err) {
      alert('Failed to update status: ' + err.message)
    }
  }

  const handleDeleteService = async (svc) => {
    if (!window.confirm(`Delete "${svc.service_name}"? This cannot be undone.`)) return
    try {
      await deleteTeamService(svc.id)
      loadServices()
    } catch (err) {
      alert('Failed to delete service: ' + err.message)
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-4">
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 mb-6">
        {[['billing', 'Billing Settings'], ['admin', 'Admin Settings']].map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setSearchParams({ tab })}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              activeTab === tab
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'billing' && (
        <>
      {/* ── Practice Details ─────────────────────────────────────────────────── */}
      <div className="bg-white p-4 md:p-6 rounded-xl shadow">
        <h2 className="text-xl font-bold mb-1">Practice Details</h2>
        <p className="text-sm text-gray-500 mb-5">Used on invoices — doctor name, clinic info, and optional logo.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Practice / Clinic Name</label>
            <input
              type="text"
              value={practiceForm.practice_name}
              onChange={e => setPracticeForm(f => ({ ...f, practice_name: e.target.value }))}
              placeholder="e.g. Yusuf Specialist Clinic"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Doctor Name</label>
            <input
              type="text"
              value={practiceForm.doctor_name}
              onChange={e => setPracticeForm(f => ({ ...f, doctor_name: e.target.value }))}
              placeholder="e.g. Dr. Ebrahim Yusuf"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Doctor Title</label>
            <input
              type="text"
              value={practiceForm.doctor_title}
              onChange={e => setPracticeForm(f => ({ ...f, doctor_title: e.target.value }))}
              placeholder="e.g. Attending Physician"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <input
              type="text"
              value={practiceForm.address}
              onChange={e => setPracticeForm(f => ({ ...f, address: e.target.value }))}
              placeholder="e.g. Medical Towers, Nairobi"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input
              type="text"
              value={practiceForm.phone}
              onChange={e => setPracticeForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="e.g. +254 700 000 000"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={practiceForm.email}
              onChange={e => setPracticeForm(f => ({ ...f, email: e.target.value }))}
              placeholder="e.g. dr.yusuf@clinic.com"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Logo URL <span className="text-gray-400 font-normal">(optional — paste a direct image link)</span>
            </label>
            <input
              type="url"
              value={practiceForm.logo_url}
              onChange={e => setPracticeForm(f => ({ ...f, logo_url: e.target.value }))}
              placeholder="https://example.com/logo.png"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            {practiceForm.logo_url && (
              <img
                src={practiceForm.logo_url}
                alt="Logo preview"
                className="mt-2 h-10 w-auto object-contain rounded border border-gray-100"
                onError={e => { e.currentTarget.style.display = 'none' }}
              />
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSavePractice}
            disabled={savingPractice}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {savingPractice ? 'Saving...' : 'Save Practice Details'}
          </button>
          {practiceSaved && <span className="text-green-600 text-sm font-medium">Saved!</span>}
        </div>
      </div>

          <div className="bg-white p-4 md:p-6 rounded-xl shadow mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Daily Visit Rates (KES)</h2>
          <button onClick={openAddModal} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold shadow-sm hover:bg-blue-700 transition text-sm">
            + Add Hospital
          </button>
        </div>
        {hospitals.length === 0 ? (
          <p className="text-gray-500">No hospitals yet. Click "Add Hospital" to get started.</p>
        ) : (
          <>
            {/* ── Mobile: one card per hospital ──────────────────────────────── */}
            <div className="block md:hidden space-y-3">
              {hospitals.map((h) => {
                const isInactive = h.status === 'inactive'
                return (
                  <div
                    key={h.id}
                    className={`glass-card border-l-4 ${isInactive ? 'opacity-50' : ''}`}
                    style={{ borderLeftColor: h.color || DEFAULT_COLOR }}
                  >
                    <div className="mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: h.color || DEFAULT_COLOR }} />
                        <span className="font-semibold">{h.name}</span>
                        {isInactive && (
                          <span className="px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded">Inactive</span>
                        )}
                      </div>
                      {h.location && <p className="text-sm text-gray-500 mt-0.5 pl-5">{h.location}</p>}
                      <p className="text-xs text-gray-400 mt-1 pl-5">
                        Tag ID prefix: <span className="font-mono font-medium text-gray-600">{h.hospital_id_prefix || 'Not set'}</span>
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {RATE_SERVICES.map((svc) => (
                        <div key={svc} className="flex flex-col items-center gap-1">
                          <label className="text-xs text-gray-500 font-medium">{RATE_LABELS[svc]}</label>
                          <input
                            type="number"
                            className="w-full px-2 py-1.5 border rounded-lg text-center text-sm"
                            placeholder="0"
                            value={rates[h.id]?.[svc] ?? ''}
                            onChange={(e) => setRates(prev => ({
                              ...prev,
                              [h.id]: { ...prev[h.id], [svc]: e.target.value },
                            }))}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(h)}
                        className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(h)}
                        className={`flex-1 px-3 py-1.5 text-sm border rounded-lg transition ${
                          isInactive
                            ? 'border-green-300 text-green-600 hover:bg-green-50'
                            : 'border-orange-200 text-orange-500 hover:bg-orange-50'
                        }`}
                      >
                        {isInactive ? 'Activate' : 'Deactivate'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Desktop: table layout ──────────────────────────────────────── */}
            <div className="hidden md:block">
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
                            <span
                              className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: h.color || DEFAULT_COLOR }}
                            />
                            {h.name}
                            {isInactive && (
                              <span className="px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 rounded">Inactive</span>
                            )}
                          </div>
                          {h.location ? <span className="block text-sm text-gray-500 font-normal pl-5">{h.location}</span> : null}
                          <span className="block text-xs text-gray-400 font-normal pl-5">
                            Tag prefix: <span className="font-mono">{h.hospital_id_prefix || '—'}</span>
                          </span>
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
            </div>
          </>
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

      {/* ── Additional Services & Charges ───────────────────────────────────── */}
      <div className="bg-white p-4 md:p-6 rounded-xl shadow mt-6">
        <div className="flex justify-between items-start gap-4 mb-1">
          <div>
            <h2 className="text-xl font-bold">Additional Services &amp; Charges</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Create services that can be added to any patient's bill — procedures, tests, equipment, or one-off charges. These appear as line items on the invoice.
            </p>
          </div>
          <button
            onClick={openAddServiceModal}
            className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-blue-700 transition"
          >
            + New Service
          </button>
        </div>

        {services.length === 0 ? (
          <p className="text-gray-400 text-sm mt-4">No services yet. Click "+ New Service" to create your first.</p>
        ) : (
          <>
            {/* ── Mobile: card layout ─────────────────────────────────────── */}
            <div className="block md:hidden mt-4 space-y-3">
              {services.map((svc) => (
                <div key={svc.id} className="glass-card">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-semibold text-slate-800">{svc.service_name}</p>
                      {svc.description && <p className="text-xs text-gray-500 mt-0.5">{svc.description}</p>}
                    </div>
                    <span className={`flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[svc.category] || CATEGORY_COLORS.Other}`}>
                      {svc.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
                    <span className="font-medium text-slate-700">KES {Number(svc.price).toLocaleString()}</span>
                    <span className="text-gray-400">·</span>
                    <span className="capitalize">{svc.billing_type}</span>
                    <span className="text-gray-400">·</span>
                    {svc.status === 'active'
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                      : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Hidden</span>
                    }
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEditServiceModal(svc)} className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition">Edit</button>
                    <button
                      onClick={() => handleToggleServiceStatus(svc)}
                      className={`flex-1 px-3 py-1.5 text-sm border rounded-lg transition ${svc.status === 'active' ? 'border-orange-200 text-orange-500 hover:bg-orange-50' : 'border-green-300 text-green-600 hover:bg-green-50'}`}
                    >
                      {svc.status === 'active' ? 'Hide' : 'Unhide'}
                    </button>
                    <button
                      onClick={() => handleDeleteService(svc)}
                      className="px-3 py-1.5 text-sm border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition"
                      title="Delete service"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop: table layout ───────────────────────────────────── */}
            <div className="hidden md:block mt-4 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2">
                    <th className="text-left px-4 py-2 text-sm font-semibold text-gray-600">Service</th>
                    <th className="text-left px-4 py-2 text-sm font-semibold text-gray-600">Category</th>
                    <th className="text-right px-4 py-2 text-sm font-semibold text-gray-600">Price (KES)</th>
                    <th className="text-left px-4 py-2 text-sm font-semibold text-gray-600">Billing</th>
                    <th className="text-left px-4 py-2 text-sm font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((svc) => (
                    <tr key={svc.id} className="border-b hover:bg-gray-50/50 transition">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">{svc.service_name}</p>
                        {svc.description && <p className="text-xs text-gray-500 mt-0.5">{svc.description}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[svc.category] || CATEGORY_COLORS.Other}`}>
                          {svc.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">
                        {Number(svc.price).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                        {svc.billing_type}
                      </td>
                      <td className="px-4 py-3">
                        {svc.status === 'active'
                          ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                          : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Hidden</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => openEditServiceModal(svc)}
                          className="px-3 py-1 text-sm border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition mr-2"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleServiceStatus(svc)}
                          className={`px-3 py-1 text-sm border rounded-lg transition mr-2 ${svc.status === 'active' ? 'border-orange-200 text-orange-500 hover:bg-orange-50' : 'border-green-300 text-green-600 hover:bg-green-50'}`}
                        >
                          {svc.status === 'active' ? 'Hide' : 'Unhide'}
                        </button>
                        <button
                          onClick={() => handleDeleteService(svc)}
                          className="inline-flex items-center justify-center px-2 py-1 border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition"
                          title="Delete service"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
        </>
      )}

      {activeTab === 'admin' && (
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-xl font-bold mb-2">Team Management</h2>
          <p className="text-gray-500 text-sm">Team management features — coming soon.</p>
        </div>
      )}

      {showServiceModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white/70 backdrop-blur-2xl shadow-2xl">
            <div className="px-6 py-5 border-b border-white/40">
              <h2 className="text-xl font-bold text-slate-800">{editingService ? 'Edit Service' : 'New Service'}</h2>
              <p className="text-sm text-slate-500 mt-0.5">This service will appear as a line item on invoices.</p>
            </div>
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Service Name *</label>
                <input
                  type="text"
                  value={serviceForm.service_name}
                  onChange={e => setServiceForm(f => ({ ...f, service_name: e.target.value }))}
                  placeholder="e.g. CT Scan Abdomen"
                  className="w-full rounded-lg border border-white/60 bg-white/60 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={serviceForm.description}
                  onChange={e => setServiceForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional short description"
                  className="w-full rounded-lg border border-white/60 bg-white/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={serviceForm.category}
                  onChange={e => setServiceForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full rounded-lg border border-white/60 bg-white/60 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Price (KES) *</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={serviceForm.price}
                  onChange={e => setServiceForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="e.g. 5000"
                  className="w-full rounded-lg border border-white/60 bg-white/60 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Billing Type</label>
                <div className="flex gap-3">
                  {[['one-off', 'One-off'], ['daily', 'Daily']].map(([val, label]) => (
                    <label key={val} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="billing_type"
                        value={val}
                        checked={serviceForm.billing_type === val}
                        onChange={() => setServiceForm(f => ({ ...f, billing_type: val }))}
                        className="accent-blue-600"
                      />
                      <span className="text-sm text-slate-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3 justify-end border-t border-white/40">
              <button onClick={closeServiceModal} className="px-4 py-2 rounded-lg border border-slate-300 bg-white/50 text-slate-700 hover:bg-white/80 transition">Cancel</button>
              <button onClick={handleSaveService} disabled={savingService} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-700 disabled:opacity-50 transition">
                {savingService ? 'Saving...' : (editingService ? 'Save Changes' : 'Create Service')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hospital ID Prefix</label>
                <input
                  type="text"
                  value={form.hospital_id_prefix}
                  onChange={(e) => setForm({ ...form, hospital_id_prefix: e.target.value })}
                  placeholder="e.g. AK, UHID, IP No., 3PH"
                  className="w-full rounded-lg border border-white/60 bg-white/60 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">Used to auto-identify hospital from patient tags (e.g., AK0113939366 matches prefix "AK")</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Colour</label>
                <div className="flex flex-wrap gap-2">
                  {PALETTE.map(hex => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setForm({ ...form, color: hex })}
                      className={`w-7 h-7 rounded-lg transition-transform hover:scale-110 ${form.color === hex ? 'ring-2 ring-offset-2 ring-slate-600 scale-110' : ''}`}
                      style={{ backgroundColor: hex }}
                      title={hex}
                    />
                  ))}
                </div>
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
