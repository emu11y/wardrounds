import { supabase } from './supabaseClient'

// Downscale + JPEG-encode a photo so the base64 payload stays well under the
// Claude API's 10 MB image limit. Phone photos are already several MB, and the
// old approach re-encoded them as lossless PNG, which *inflated* them to 15–30 MB
// and made every scan fail. A hospital tag is just text, so 2000px on the long
// edge is ample for the vision model to read while keeping the JPEG tiny.
// Returns { base64, mediaType } ready for extractPatientDataFromTag.
export function fileToScaledBase64(file, { maxDim = 2000, quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const w = img.naturalWidth, h = img.naturalHeight
      const scale = Math.min(1, maxDim / Math.max(w, h))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(w * scale))
      canvas.height = Math.max(1, Math.round(h * scale))
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      const base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1]
      resolve({ base64, mediaType: 'image/jpeg' })
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Could not load image')) }
    img.src = objectUrl
  })
}

// Calls the `scan-tag` Supabase Edge Function, which proxies the Claude API
// server-side. The Claude key is a project secret (CLAUDE_API_KEY) and is never
// shipped to the browser; only authenticated users can trigger a scan.
export async function extractPatientDataFromTag(imageBase64, hospitals = [], mediaType = 'image/jpeg') {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-tag`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ imageBase64, hospitals, mediaType }),
    }
  )

  let data
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    throw new Error(data?.error || `Scan failed (HTTP ${response.status})`)
  }
  if (!data?.extracted) throw new Error('No data extracted from tag')

  return data.extracted
}

export function matchHospitalFromScan(extracted, hospitals = []) {
  if (!hospitals.length) return { hospital: null, ward: null }
  const norm = s => (s || '').toLowerCase().replace(/[\s.]/g, '')
  let hospital = null

  // 1. Vision-matched registered hospital name
  if (extracted.hospital) {
    hospital = hospitals.find(h => norm(h.name) === norm(extracted.hospital)) || null
  }
  // 2. idPrefix marker against stored hospital_id_prefix
  if (!hospital && extracted.idPrefix) {
    const target = norm(extracted.idPrefix)
    hospital = hospitals.find(h => h.hospital_id_prefix && norm(h.hospital_id_prefix) === target) || null
  }
  // 3. stored prefix appears inside the raw patient ID
  if (!hospital && extracted.patientHospitalId) {
    const idNorm = norm(extracted.patientHospitalId)
    hospital = hospitals.find(h => h.hospital_id_prefix && idNorm.includes(norm(h.hospital_id_prefix))) || null
  }

  // optional ward match (used by Admit; outpatient ignores ward)
  let ward = null
  if (hospital && extracted.ward && hospital.hospital_services?.length) {
    const w = extracted.ward.toLowerCase()
    const matched = hospital.hospital_services.find(s =>
      s.service_name.toLowerCase().includes(w) || w.includes(s.service_name.toLowerCase())
    )
    ward = matched?.service_name || null
  }
  return { hospital, ward }
}
