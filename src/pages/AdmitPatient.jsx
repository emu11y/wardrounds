import { useState, useEffect, useRef } from 'react'
import { Camera, Search, X, CheckCircle, Calendar, Building2, User, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import TopHeader from '../components/TopHeader'
import { extractPatientDataFromTag } from '../lib/hospitalTagReader'
import {
  fetchHospitals,
  searchPatients,
  createPatient,
  updatePatient,
  createAdmission,
  addNote,
} from '../lib/api'

function nowLocalDT() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export default function AdmitPatient() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Patient fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [insurance, setInsurance] = useState('')

  // Admission fields
  const [hospitalId, setHospitalId] = useState('')
  const [ward, setWard] = useState('')
  const [admissionDate, setAdmissionDate] = useState(nowLocalDT())
  const [teamStartDate, setTeamStartDate] = useState(new Date().toISOString().slice(0, 10))

  // Returning patient search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const searchTimeout = useRef(null)

  // Scan modal
  const [showScanModal, setShowScanModal] = useState(false)
  const [scanPreview, setScanPreview] = useState(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState(null)
  const [scannedData, setScannedData] = useState(null)

  // Data + form state
  const [hospitals, setHospitals] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [toast, setToast] = useState(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // Wards derived from selected hospital (no extra fetch — fetchHospitals includes hospital_services)
  const wards = hospitals.find(h => h.id === hospitalId)?.hospital_services || []

  useEffect(() => {
    if (user?.team_id) fetchHospitals(user.team_id).then(setHospitals).catch(console.error)
  }, [user?.team_id])

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  function handleSearchChange(q) {
    setSearchQuery(q)
    setSearchResults([])
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (q.length < 2) return
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await searchPatients(user.team_id, q)
        setSearchResults(results || [])
      } catch (err) {
        console.error(err)
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }

  function handleSelectExistingPatient(patient) {
    setSelectedPatientId(patient.id)
    setFirstName(patient.first_name)
    setLastName(patient.last_name)
    setDateOfBirth(patient.date_of_birth || '')
    setInsurance(patient.insurance_name || '')
    setSearchQuery(`${patient.first_name} ${patient.last_name}`)
    setSearchResults([])
  }

  function clearPatientSelection() {
    setSelectedPatientId(null)
    setFirstName('')
    setLastName('')
    setDateOfBirth('')
    setInsurance('')
    setSearchQuery('')
    setSearchResults([])
  }

  function fileToBase64PNG(file) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const objectUrl = URL.createObjectURL(file)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        canvas.getContext('2d').drawImage(img, 0, 0)
        const base64 = canvas.toDataURL('image/png').split(',')[1]
        URL.revokeObjectURL(objectUrl)
        resolve(base64)
      }
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('Could not load image'))
      }
      img.src = objectUrl
    })
  }

  async function handleScanFile(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setScanError(null)
    setScanPreview(URL.createObjectURL(file))
    setIsScanning(true)

    try {
      const base64 = await fileToBase64PNG(file)
      const extracted = await extractPatientDataFromTag(base64, hospitals, 'image/png')

      if (extracted.firstName) setFirstName(extracted.firstName)
      if (extracted.lastName) setLastName(extracted.lastName)
      if (extracted.dateOfBirth) setDateOfBirth(extracted.dateOfBirth)
      setScannedData(extracted)

      // Auto-select hospital: three-tier matching
      if (hospitals.length > 0) {
        const norm = s => (s || '').toLowerCase().replace(/[\s.]/g, '')
        let matchedHospital = null

        // 1. Vision already matched against registered hospital names in the prompt
        if (extracted.hospital) {
          matchedHospital = hospitals.find(h => norm(h.name) === norm(extracted.hospital))
          if (matchedHospital) console.log('✅ Matched registered hospital:', matchedHospital.name)
        }

        // 2. Match by idPrefix marker against stored hospital_id_prefix
        if (!matchedHospital && extracted.idPrefix) {
          const target = norm(extracted.idPrefix)
          matchedHospital = hospitals.find(h => h.hospital_id_prefix && norm(h.hospital_id_prefix) === target)
          if (matchedHospital) console.log('✅ Matched by prefix marker:', matchedHospital.name)
        }

        // 3. Stored prefix appears inside the raw patient ID
        if (!matchedHospital && extracted.patientHospitalId) {
          const idNorm = norm(extracted.patientHospitalId)
          matchedHospital = hospitals.find(h => h.hospital_id_prefix && idNorm.includes(norm(h.hospital_id_prefix)))
          if (matchedHospital) console.log('✅ Matched by prefix-in-ID:', matchedHospital.name)
        }

        if (matchedHospital) {
          setHospitalId(matchedHospital.id)
          if (extracted.ward && matchedHospital.hospital_services?.length > 0) {
            const matchedWard = matchedHospital.hospital_services.find(s =>
              s.service_name.toLowerCase().includes(extracted.ward.toLowerCase()) ||
              extracted.ward.toLowerCase().includes(s.service_name.toLowerCase())
            )
            if (matchedWard) setWard(matchedWard.service_name)
          }
        } else {
          console.warn('⚠️ No hospital matched. prefix:', extracted.idPrefix, 'id:', extracted.patientHospitalId, 'name:', extracted.hospital)
        }
      }

      setShowScanModal(false)
      setScanPreview(null)
      showToast('Tag scanned — please review and complete admission.', 'info')
    } catch (err) {
      setScanError(err.message || 'Could not read tag — try a clearer photo.')
    } finally {
      setIsScanning(false)
    }
  }

  function closeScanModal() {
    setShowScanModal(false)
    setScanPreview(null)
    setScanError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError(null)

    if (!firstName.trim() || !lastName.trim()) {
      setSubmitError('First and last name are required.')
      return
    }
    if (!hospitalId || !ward) {
      setSubmitError('Please select a hospital and ward.')
      return
    }

    setIsSubmitting(true)
    try {
      let patientId = selectedPatientId
      if (!patientId) {
        const newPatient = await createPatient({
          team_id: user.team_id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          date_of_birth: dateOfBirth || null,
          insurance_name: insurance || null,
        })
        patientId = newPatient.id
      } else if (insurance) {
        await updatePatient(patientId, { insurance_name: insurance })
      }

      const newAdmission = await createAdmission({
        patient_id: patientId,
        team_id: user.team_id,
        hospital_id: hospitalId,
        ward,
        admission_date: new Date(admissionDate).toISOString(),
        team_start_date: teamStartDate,
        status: 'admitted',
        patient_hospital_id: scannedData?.patientHospitalId || null,
      })

      if (scannedData) {
        const noteLines = [
          '📋 Auto-imported from hospital tag scan:',
          (scannedData.firstName || scannedData.lastName)
            ? `Name: ${[scannedData.firstName, scannedData.lastName].filter(Boolean).join(' ')}`
            : null,
          scannedData.dateOfBirth   ? `DOB: ${scannedData.dateOfBirth}` : null,
          scannedData.patientHospitalId ? `Hospital ID: ${scannedData.patientHospitalId}` : null,
          scannedData.idPrefix      ? `ID Prefix: ${scannedData.idPrefix}` : null,
          scannedData.hospital      ? `Hospital: ${scannedData.hospital}` : null,
          scannedData.ward          ? `Ward/Room (from tag): ${scannedData.ward}` : null,
        ].filter(Boolean)
        try {
          await addNote(newAdmission.id, noteLines.join('\n'), user.id, null)
        } catch (noteErr) {
          console.error('⚠️ Failed to save tag note:', noteErr)
        }
      }

      navigate('/')
    } catch (err) {
      setSubmitError(err.message || 'Failed to admit patient.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleReset() {
    setShowResetConfirm(true)
  }

  const doReset = () => {
    setFirstName('')
    setLastName('')
    setDateOfBirth('')
    setInsurance('')
    setHospitalId('')
    setWard('')
    setAdmissionDate(nowLocalDT())
    setTeamStartDate(new Date().toISOString().slice(0, 10))
    setSelectedPatientId(null)
    setSearchQuery('')
    setSearchResults([])
    setScanPreview(null)
    setScanError(null)
    setScannedData(null)
    setSubmitError(null)
    setShowResetConfirm(false)
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopHeader title="Admit Patient" />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-glass-md flex items-center gap-2 text-sm font-medium text-white transition-all
          ${toast.type === 'error' ? 'bg-ios-red' : toast.type === 'info' ? 'bg-ios-orange' : 'bg-ios-green'}`}>
          {toast.type === 'success' && <CheckCircle size={16} />}
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}

      {/* Scan modal */}
      {showScanModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4 overflow-y-auto">
          <div className="glass-card w-full max-w-sm space-y-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Scan Hospital Tag</h3>
              <button onClick={closeScanModal}>
                <X size={18} className="text-ios-gray-1" />
              </button>
            </div>

            <label className="block cursor-pointer">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                disabled={isScanning}
                onChange={handleScanFile}
              />
              <div className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed overflow-hidden min-h-44 transition-all
                ${isScanning ? 'border-ios-blue/40 bg-ios-blue/5' : 'border-ios-gray-4 bg-ios-gray-6 hover:border-ios-blue/50 hover:bg-ios-blue/5'}`}>
                {scanPreview ? (
                  <img src={scanPreview} alt="Tag preview" className="w-full max-h-52 object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 py-6 text-ios-gray-1">
                    <Camera size={36} strokeWidth={1.2} className="opacity-30" />
                    <p className="text-sm font-medium">Tap to photograph tag</p>
                    <p className="text-xs opacity-50">Aga Khan · M.P Shah · Avenue Healthcare</p>
                  </div>
                )}
                {isScanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-black/70 gap-2">
                    <div className="w-7 h-7 border-2 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin" />
                    <p className="text-sm font-semibold text-ios-blue">Reading tag…</p>
                  </div>
                )}
              </div>
            </label>

            {scanError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-2xl text-sm text-red-600 dark:text-red-400">
                <X size={14} className="mt-0.5 flex-shrink-0" />
                <span>{scanError}</span>
              </div>
            )}

            {(scanPreview || scanError) && !isScanning && (
              <button
                type="button"
                onClick={() => { setScanPreview(null); setScanError(null) }}
                className="w-full py-2.5 rounded-2xl text-sm font-medium text-ios-gray-1 bg-ios-gray-6 hover:bg-ios-gray-5 transition-all"
              >
                Clear &amp; try again
              </button>
            )}
          </div>
        </div>
      )}

      <div className="p-4 max-w-lg mx-auto w-full space-y-4 pb-10">

        {/* Scan button + returning patient search */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowScanModal(true)}
            className="flex items-center gap-1.5 py-2.5 px-4 rounded-2xl bg-ios-blue text-white text-sm font-semibold flex-shrink-0"
          >
            <Camera size={15} />
            Scan Tag
          </button>
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ios-gray-1" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Returning patient…"
              className="ios-input pl-9 pr-8 text-sm"
            />
            {selectedPatientId && (
              <button
                type="button"
                onClick={clearPatientSelection}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ios-gray-1 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Patient search results */}
        {(searchResults.length > 0 || isSearching) && (
          <div className="glass-card -mt-2 p-1 space-y-0.5">
            {isSearching ? (
              <div className="flex items-center justify-center py-3">
                <div className="w-4 h-4 border-2 border-ios-blue/30 border-t-ios-blue rounded-full animate-spin" />
              </div>
            ) : searchResults.slice(0, 5).map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectExistingPatient(p)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-ios-blue/10 text-left transition-all"
              >
                <div className="w-8 h-8 rounded-xl bg-ios-blue/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-ios-blue">{p.first_name[0]}{p.last_name[0]}</span>
                </div>
                <div>
                  <p className="text-sm font-medium">{p.first_name} {p.last_name}</p>
                  {p.date_of_birth && <p className="text-xs text-ios-gray-1">DOB: {p.date_of_birth}</p>}
                </div>
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Patient Details */}
          <div className="glass-card space-y-3">
            <div className="flex items-center gap-2">
              <User size={14} className="text-ios-blue" />
              <p className="text-xs font-semibold text-ios-gray-1 uppercase tracking-wide">Patient Details</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">First Name</label>
                <input
                  required
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="ios-input"
                  placeholder="First"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Last Name</label>
                <input
                  required
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="ios-input"
                  placeholder="Last"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Date of Birth</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={e => setDateOfBirth(e.target.value)}
                className="ios-input"
              />
            </div>
          </div>

          {/* Hospital & Ward */}
          <div className="glass-card space-y-3">
            <div className="flex items-center gap-2">
              <Building2 size={14} className="text-ios-blue" />
              <p className="text-xs font-semibold text-ios-gray-1 uppercase tracking-wide">Hospital &amp; Ward</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Hospital</label>
              <div className="relative">
                <select
                  required
                  value={hospitalId}
                  onChange={e => { setHospitalId(e.target.value); setWard('') }}
                  className="ios-input appearance-none pr-8"
                >
                  <option value="">Select hospital…</option>
                  {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ios-gray-1 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Ward / Service</label>
              <div className="relative">
                <select
                  required
                  value={ward}
                  onChange={e => setWard(e.target.value)}
                  disabled={!hospitalId || wards.length === 0}
                  className="ios-input appearance-none pr-8 disabled:opacity-50"
                >
                  <option value="">{hospitalId ? 'Select ward…' : 'Select hospital first'}</option>
                  {wards.map(s => <option key={s.id} value={s.service_name}>{s.service_name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ios-gray-1 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Admission Details */}
          <div className="glass-card space-y-3">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-ios-blue" />
              <p className="text-xs font-semibold text-ios-gray-1 uppercase tracking-wide">Admission Details</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1">
                Hospital Admission Date &amp; Time
                <span className="text-[11px] text-ios-gray-1 font-normal">(when admitted to hospital)</span>
              </label>
              <input
                type="datetime-local"
                required
                value={admissionDate}
                onChange={e => setAdmissionDate(e.target.value)}
                className="ios-input"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1">
                WardRounds Start Date
                <span className="text-[11px] text-ios-gray-1 font-normal">(when your team starts seeing patient)</span>
              </label>
              <input
                type="date"
                required
                value={teamStartDate}
                onChange={e => setTeamStartDate(e.target.value)}
                className="ios-input"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Insurance <span className="text-ios-gray-2 font-normal">(optional)</span></label>
              <input
                value={insurance}
                onChange={e => setInsurance(e.target.value)}
                className="ios-input"
                placeholder="e.g. BUPA, NHIF, Private"
              />
            </div>
          </div>

          {submitError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-2xl text-sm text-red-600 dark:text-red-400">
              <X size={14} className="mt-0.5 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="ios-blue-btn flex-1 py-3.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Admitting…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle size={18} />
                  Admit Patient
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={isSubmitting}
              className="flex-1 py-3.5 rounded-2xl text-sm font-semibold text-ios-gray-1 bg-ios-gray-6 hover:bg-ios-gray-5 transition-all disabled:opacity-50"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {showResetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.2)' }}
        >
          <div className="glass-card rounded-2xl p-6 bg-white/90 backdrop-blur-xl border border-white/60 shadow-2xl w-full max-w-sm">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Clear all fields?</h3>
            <p className="text-sm text-gray-500 mb-6">
              This will reset the form and remove any scanned or entered data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={doReset}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
              >
                Clear Fields
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
