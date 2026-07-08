import { supabase } from './supabaseClient'

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
