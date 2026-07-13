import { useState, useEffect, useRef } from 'react'
import { Camera, Search, X, CheckCircle, Calendar, Building2, User, ChevronDown } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import TopHeader from '../components/TopHeader'
import ModalShell from '../components/ModalShell'
import TagScanDropzone from '../components/TagScanDropzone'
import Toast from '../components/Toast'
import { extractPatientDataFromTag, matchHospitalFromScan, fileToScaledBase64 } from '../lib/hospitalTagReader'
import { supabase } from '../lib/supabaseClient'
import {
  fetchHospitals,
  searchPatients,
  createPatient,
  updatePatient,
  createAdmission,
  addNote,
  findPatientByHospitalId,
  findPatientByNameAndDob,
} from '../lib/api'
import { logActivity } from '../lib/activityLog'

function nowLocalDT() {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export default function AdmitPatient() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Patient fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [insurance, setInsurance] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

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

  // Ward field attention (draws the eye to Ward when it's the one thing prefill couldn't fill in)
  const wardSelectRef = useRef(null)
  const [wardHighlight, setWardHighlight] = useState(false)
  const wardHighlightTimeout = useRef(null)

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
  const [activeAdmissionWarning, setActiveAdmissionWarning] = useState(null)

  // Wards derived from selected hospital (no extra fetch — fetchHospitals includes hospital_services)
  const wards = hospitals.find(h => h.id === hospitalId)?.hospital_services || []

  useEffect(() => {
    if (user?.team_id) fetchHospitals(user.team_id).then(setHospitals).catch(err => { console.error(err); showToast('Failed to load hospitals.', 'error') })
  }, [user?.team_id])

  function flashWardHighlight() {
    wardSelectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setWardHighlight(true)
    if (wardHighlightTimeout.current) clearTimeout(wardHighlightTimeout.current)
    wardHighlightTimeout.current = setTimeout(() => setWardHighlight(false), 2000)
  }

  useEffect(() => {
    const { prefillPatient, prefillHospitalId } = location.state || {}
    if (prefillPatient) {
      setFirstName(prefillPatient.first_name || '')
      setLastName(prefillPatient.last_name || '')
      setDateOfBirth(prefillPatient.date_of_birth || '')
      if (prefillPatient.id) {
        setSelectedPatientId(prefillPatient.id)
        checkActiveAdmission(prefillPatient.id)
      }
      window.history.replaceState({}, '')
    }
    if (prefillHospitalId) {
      setHospitalId(prefillHospitalId)
      // Hospital arrived prefilled but Ward never does — draw attention to it once the form has painted.
      if (!ward) {
        const t = setTimeout(flashWardHighlight, 400)
        return () => clearTimeout(t)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (wardHighlightTimeout.current) clearTimeout(wardHighlightTimeout.current)
  }, [])

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
        showToast('Patient search failed — please try again.', 'error')
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }

  // Single source of truth for "is this patient already admitted somewhere?" —
  // every path that sets selectedPatientId (manual search, prefill from Patients-page
  // Admit quick action, scan) must call this so the warning can't be silently skipped.
  async function checkActiveAdmission(patientId) {
    setActiveAdmissionWarning(null)
    const { data: activeAdmission } = await supabase
      .from('admissions')
      .select('id, ward, hospitals(name)')
      .eq('patient_id', patientId)
      .eq('status', 'admitted')
      .maybeSingle()
    if (activeAdmission) setActiveAdmissionWarning(activeAdmission)
  }

  async function handleSelectExistingPatient(patient) {
    setSelectedPatientId(patient.id)
    setFirstName(patient.first_name)
    setLastName(patient.last_name)
    setDateOfBirth(patient.date_of_birth || '')
    setInsurance(patient.insurance_name || '')
    setSearchQuery(`${patient.first_name} ${patient.last_name}`)
    setSearchResults([])
    await checkActiveAdmission(patient.id)
  }

  function clearPatientSelection() {
    setSelectedPatientId(null)
    setFirstName('')
    setLastName('')
    setDateOfBirth('')
    setInsurance('')
    setPhone('')
    setEmail('')
    setSearchQuery('')
    setSearchResults([])
    setActiveAdmissionWarning(null)
  }

  async function handleScanFile(file) {
    if (!file) return

    setScanError(null)
    setScanPreview(URL.createObjectURL(file))
    setIsScanning(true)

    try {
      const { base64, mediaType } = await fileToScaledBase64(file)
      const extracted = await extractPatientDataFromTag(base64, hospitals, mediaType)

      if (extracted.firstName) setFirstName(extracted.firstName)
      if (extracted.lastName) setLastName(extracted.lastName)
      if (extracted.dateOfBirth) setDateOfBirth(extracted.dateOfBirth)
      setScannedData(extracted)

      if (hospitals.length > 0) {
        const { hospital: matchedHospital, ward: matchedWard } = matchHospitalFromScan(extracted, hospitals)
        if (matchedHospital) {
          setHospitalId(matchedHospital.id)
          if (matchedWard) setWard(matchedWard)
        } else {
          console.warn('⚠️ No hospital matched. prefix:', extracted.idPrefix, 'id:', extracted.patientHospitalId, 'name:', extracted.hospital)
        }
      }

      // A scanned tag's patient_hospital_id is scoped to that one hospital's own ID
      // scheme, so it can never match this same person's record from a different
      // hospital (findPatientByHospitalId in handleSubmit would miss them entirely,
      // silently creating a duplicate patient). Name+DOB is the only identity signal
      // a scan gives us that works across hospitals — check it here, immediately,
      // so both the duplicate-patient creation and the missing active-admission
      // warning are caught before the user even fills in the rest of the form.
      let matchedPatient = null
      if (extracted.firstName && extracted.lastName && extracted.dateOfBirth) {
        matchedPatient = await findPatientByNameAndDob(
          user.team_id, extracted.firstName, extracted.lastName, extracted.dateOfBirth
        )
      }
      if (matchedPatient) {
        setSelectedPatientId(matchedPatient.id)
        setInsurance(matchedPatient.insurance_name || '')
        await checkActiveAdmission(matchedPatient.id)
      }

      setShowScanModal(false)
      setScanPreview(null)
      showToast(
        matchedPatient
          ? 'Tag scanned — matched an existing patient record. Please review.'
          : 'Tag scanned — please review and complete admission.',
        'info'
      )
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
      flashWardHighlight()
      return
    }

    setIsSubmitting(true)
    try {
      let patientId = selectedPatientId
      if (!patientId) {
        let existing = null
        if (scannedData?.patientHospitalId) {
          existing = await findPatientByHospitalId(user.team_id, scannedData.patientHospitalId)
        }
        if (existing) {
          patientId = existing.id
          if (insurance) await updatePatient(patientId, { insurance_name: insurance })
        } else {
          const newPatient = await createPatient({
            team_id: user.team_id,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            date_of_birth: dateOfBirth || null,
            insurance_name: insurance || null,
            phone: phone || null,
            email: email || null,
          })
          patientId = newPatient.id
        }
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

      await logActivity({
        user, action: 'admit', entityType: 'admission', entityId: newAdmission.id,
        patientId, patientName: `${firstName.trim()} ${lastName.trim()}`,
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

      setActiveAdmissionWarning(null)
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
    setPhone('')
    setEmail('')
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
    setActiveAdmissionWarning(null)
    setShowResetConfirm(false)
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopHeader title="Admit Patient" />

      {/* Toast */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* Scan modal */}
      {showScanModal && (
        <ModalShell onClose={closeScanModal}>
          <div className="glass-rim rounded-3xl p-2.5 w-full max-w-sm">
            <div className="surface-shell p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Scan Hospital Tag</h3>
              <button onClick={closeScanModal}>
                <X size={18} className="text-ios-gray-1" />
              </button>
            </div>

            <TagScanDropzone
              onFile={handleScanFile}
              isScanning={isScanning}
              preview={scanPreview}
              error={scanError}
              onClear={() => { setScanPreview(null); setScanError(null) }}
            />
          </div>
          </div>
        </ModalShell>
      )}

      <div className="p-4 max-w-lg mx-auto w-full space-y-4 pb-28 sm:pb-0">

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
          <div className="border border-gray-200 rounded-2xl bg-white/70 -mt-2 p-1 space-y-0.5">
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

        {activeAdmissionWarning && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-amber-500 text-lg flex-shrink-0">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Patient already admitted</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {activeAdmissionWarning.hospitals?.name
                  ? `Currently admitted at ${activeAdmissionWarning.hospitals.name}`
                  : 'This patient has an active admission.'
                }
                {' '}You can still proceed to create a second admission if needed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveAdmissionWarning(null)}
              className="text-amber-400 hover:text-amber-600 text-lg leading-none flex-shrink-0"
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Patient Details */}
          <div className="border border-gray-200 rounded-2xl bg-white/70 p-5 space-y-3">
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
          <div className="border border-gray-200 rounded-2xl bg-white/70 p-5 space-y-3">
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
                  ref={wardSelectRef}
                  required
                  value={ward}
                  onChange={e => setWard(e.target.value)}
                  disabled={!hospitalId || wards.length === 0}
                  className={`ios-input appearance-none pr-8 disabled:opacity-50 transition-shadow duration-300 ${
                    wardHighlight ? 'ring-2 ring-[#007AFF] ring-offset-2' : ''
                  }`}
                >
                  <option value="">{hospitalId ? 'Select ward…' : 'Select hospital first'}</option>
                  {wards.map(s => <option key={s.id} value={s.service_name}>{s.service_name}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ios-gray-1 pointer-events-none" />
              </div>
              {submitError === 'Please select a hospital and ward.' && (
                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-2xl text-sm text-red-600 dark:text-red-400">
                  <X size={14} className="mt-0.5 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Admission Details */}
          <div className="border border-gray-200 rounded-2xl bg-white/70 p-5 space-y-3">
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
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mobile Number <span className="text-ios-gray-2 font-normal">(optional)</span></label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="ios-input"
                placeholder="e.g. 0712 345 678"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email <span className="text-ios-gray-2 font-normal">(optional)</span></label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="ios-input"
                placeholder="e.g. patient@email.com"
              />
            </div>
          </div>

          {submitError && submitError !== 'Please select a hospital and ward.' && (
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
        <ModalShell onClose={() => setShowResetConfirm(false)} maxWidth="max-w-sm">
          <div className="glass-rim rounded-3xl p-2.5">
            <div className="surface-shell p-6">
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
        </ModalShell>
      )}
    </div>
  )
}
