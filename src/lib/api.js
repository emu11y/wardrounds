import { supabase } from './supabaseClient'

// ─── PATIENTS ────────────────────────────────────────────────────────────────

export async function fetchPatients(teamId) {
  const { data, error } = await supabase
    .from('patients')
    .select('*, hospitals(name, location)')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function searchPatients(teamId, query) {
  const { data, error } = await supabase
    .from('patients')
    .select('*, hospitals(name)')
    .eq('team_id', teamId)
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
    .order('last_name')
  if (error) throw error
  return data
}

export async function createPatient(patient) {
  const { data, error } = await supabase
    .from('patients')
    .insert(patient)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePatient(id, updates) {
  const { data, error } = await supabase
    .from('patients')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePatient(id) {
  const { error } = await supabase.from('patients').delete().eq('id', id)
  if (error) throw error
}

// ─── ADMISSIONS ──────────────────────────────────────────────────────────────

export async function fetchActiveAdmissions(teamId) {
  const { data, error } = await supabase
    .from('admissions')
    .select(`
      *,
      patients(id, first_name, last_name, date_of_birth, insurance_name),
      hospitals(id, name, location, hospital_services(id, service_name, price_per_day)),
      timeline_events(id, event_type, ward, timestamp, notes),
      patient_notes(id, note_text, signature, created_at, users(full_name)),
      services_rendered(id, rendered_date, quantity, price_applied, hospital_services(service_name))
    `)
    .eq('team_id', teamId)
    .eq('status', 'admitted')
    .order('admission_date', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchAllAdmissions(teamId) {
  const { data, error } = await supabase
    .from('admissions')
    .select(`
      *,
      patients(id, first_name, last_name, date_of_birth, insurance_name),
      hospitals(id, name, location),
      timeline_events(id, event_type, ward, timestamp, notes)
    `)
    .eq('team_id', teamId)
    .order('admission_date', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchAdmissionsForPatient(patientId) {
  const { data, error } = await supabase
    .from('admissions')
    .select(`
      *,
      hospitals(id, name, location),
      timeline_events(id, event_type, ward, timestamp, notes),
      patient_notes(id, note_text, signature, created_at, users(full_name)),
      services_rendered(id, rendered_date, quantity, price_applied, hospital_services(service_name))
    `)
    .eq('patient_id', patientId)
    .order('admission_date', { ascending: false })
  if (error) throw error
  return data
}

export async function createAdmission(admission) {
  const { data, error } = await supabase
    .from('admissions')
    .insert(admission)
    .select()
    .single()
  if (error) throw error

  await supabase.from('timeline_events').insert({
    admission_id: data.id,
    event_type: 'admitted',
    ward: admission.ward,
  })

  // Immediately create billing records from admission_date to today (EAT)
  const { data: wardSvc } = await supabase
    .from('hospital_services')
    .select('id, price_per_day')
    .eq('hospital_id', admission.hospital_id)
    .eq('service_name', admission.ward)
    .maybeSingle()

  if (wardSvc) {
    const eatOffset = 3 * 60 * 60 * 1000
    const todayEAT = new Date(Date.now() + eatOffset).toISOString().split('T')[0]
    const records = []
    const cursor = new Date(admission.team_start_date || admission.admission_date)
    while (cursor.toISOString().split('T')[0] <= todayEAT) {
      records.push({
        admission_id: data.id,
        service_id: wardSvc.id,
        accrual_date: cursor.toISOString().split('T')[0],
        amount: wardSvc.price_per_day,
        status: 'pending',
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    if (records.length > 0) {
      await supabase.from('billing_records').insert(records)
    }
  }

  return data
}

export async function dischargeAdmission(admissionId) {
  const { data, error } = await supabase
    .from('admissions')
    .update({ status: 'discharged', discharge_date: new Date().toISOString() })
    .eq('id', admissionId)
    .select()
    .single()
  if (error) throw error

  await supabase.from('timeline_events').insert({
    admission_id: admissionId,
    event_type: 'discharged',
  })

  return data
}

export async function transferAdmission(admissionId, newWard, newHospitalId) {
  const updates = { ward: newWard, status: 'admitted' }
  if (newHospitalId) updates.hospital_id = newHospitalId

  const { data, error } = await supabase
    .from('admissions')
    .update(updates)
    .eq('id', admissionId)
    .select()
    .single()
  if (error) throw error

  await supabase.from('timeline_events').insert({
    admission_id: admissionId,
    event_type: 'transferred',
    ward: newWard,
    notes: newHospitalId ? `Transferred to new hospital` : `Transferred to ${newWard}`,
  })

  return data
}

export async function deleteAdmission(admissionId) {
  const { error } = await supabase.from('admissions').delete().eq('id', admissionId)
  if (error) throw error
}

// ─── PATIENT NOTES ───────────────────────────────────────────────────────────

export async function fetchNotes(admissionId) {
  const { data, error } = await supabase
    .from('patient_notes')
    .select('*, users(full_name)')
    .eq('admission_id', admissionId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addNote(admissionId, noteText, userId, signature) {
  const { data, error } = await supabase
    .from('patient_notes')
    .insert({
      admission_id: admissionId,
      note_text: noteText,
      created_by_user_id: userId,
      signature,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── SERVICES ────────────────────────────────────────────────────────────────

export async function fetchHospitalServices(hospitalId) {
  const { data, error } = await supabase
    .from('hospital_services')
    .select('*')
    .eq('hospital_id', hospitalId)
    .order('service_name')
  if (error) throw error
  return data
}

export async function addServiceRendered(serviceData) {
  const { data, error } = await supabase
    .from('services_rendered')
    .insert(serviceData)
    .select()
    .single()
  if (error) throw error

  await supabase.from('billing_records').insert({
    admission_id: serviceData.admission_id,
    service_id: serviceData.service_id,
    accrual_date: serviceData.rendered_date,
    amount: serviceData.price_applied * serviceData.quantity,
    status: 'pending',
  })

  return data
}

export async function fetchServicesRendered(admissionId) {
  const { data, error } = await supabase
    .from('services_rendered')
    .select('*, hospital_services(service_name, price_per_day)')
    .eq('admission_id', admissionId)
    .order('rendered_date', { ascending: false })
  if (error) throw error
  return data
}

// ─── BILLING ─────────────────────────────────────────────────────────────────

export async function fetchBillingRecords(admissionId) {
  const { data, error } = await supabase
    .from('billing_records')
    .select('id, accrual_date, amount, status, service_id')
    .eq('admission_id', admissionId)
    .order('accrual_date', { ascending: false })
  if (error) throw error
  return data
}

export async function updateBilling(id, updates) {
  const { data, error } = await supabase
    .from('billing_records')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── HOSPITALS ───────────────────────────────────────────────────────────────

export async function fetchHospitals(teamId) {
  const { data, error } = await supabase
    .from('hospitals')
    .select('*, hospital_services(*)')
    .eq('team_id', teamId)
    .or('status.eq.active,status.is.null')
    .order('name')
  if (error) throw error
  return data
}

export async function createHospital(hospital) {
  const { data, error } = await supabase
    .from('hospitals')
    .insert(hospital)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateHospital(id, updates) {
  const { data, error } = await supabase
    .from('hospitals')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteHospital(id) {
  const { error } = await supabase.from('hospitals').delete().eq('id', id)
  if (error) throw error
}

export async function createHospitalService(service) {
  const { data, error } = await supabase
    .from('hospital_services')
    .insert(service)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateHospitalService(id, updates) {
  const { data, error } = await supabase
    .from('hospital_services')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteHospitalService(id) {
  const { error } = await supabase.from('hospital_services').delete().eq('id', id)
  if (error) throw error
}

// ─── USERS / TEAM ─────────────────────────────────────────────────────────────

export async function fetchTeamMembers(teamId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('team_id', teamId)
    .order('full_name')
  if (error) throw error
  return data
}

export async function updateUserRole(userId, role) {
  const { data, error } = await supabase
    .from('users')
    .update({ role })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTeam(teamId, updates) {
  const { data, error } = await supabase
    .from('teams')
    .update(updates)
    .eq('id', teamId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── CLAUDE VISION ───────────────────────────────────────────────────────────

export async function scanPatientCard(imageBase64, mediaType = 'image/jpeg') {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY
  if (!apiKey) throw new Error('VITE_CLAUDE_API_KEY not configured in .env.local')

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 512,
      system: 'Extract patient information from hospital ID cards or insurance cards. Return ONLY valid JSON with exactly these fields: {"firstName":"","lastName":"","dateOfBirth":"","patientId":"","hospitalName":"","ward":"","insuranceName":""}. Use empty string for any missing fields. Date format: YYYY-MM-DD.',
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: 'Extract patient information from this card.' },
        ],
      }],
    }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err.error?.message || `Claude API error ${resp.status}`)
  }

  const data = await resp.json()
  const text = data.content?.[0]?.text || ''
  try {
    const match = text.match(/\{[\s\S]*\}/)
    return JSON.parse(match ? match[0] : text)
  } catch {
    throw new Error('Could not parse patient info from image. Try a clearer photo.')
  }
}

// ─── ANALYTICS ───────────────────────────────────────────────────────────────

export async function fetchAdmissionsByDateRange(teamId, from, to) {
  const { data, error } = await supabase
    .from('admissions')
    .select('id, admission_date, discharge_date, status')
    .eq('team_id', teamId)
    .gte('admission_date', from)
    .lte('admission_date', to)
    .order('admission_date')
  if (error) throw error
  return data
}

export async function fetchRevenueByDateRange(teamId, from, to) {
  const { data, error } = await supabase
    .from('billing_records')
    .select('amount, accrual_date, status, admissions!inner(team_id)')
    .eq('admissions.team_id', teamId)
    .gte('accrual_date', from)
    .lte('accrual_date', to)
  if (error) throw error
  return data
}

// ─── PHASE 6A: HOSPITAL MANAGEMENT ───────────────────────────────────────────

export async function getHospitalsByTeam(teamId) {
  const { data, error } = await supabase
    .from('hospitals')
    .select('*, hospital_services(*)')
    .eq('team_id', teamId)
    .order('name')
  if (error) console.error('getHospitalsByTeam error:', error)
  return data || []
}

export async function setHospitalStatus(id, status) {
  const { error } = await supabase
    .from('hospitals')
    .update({ status })
    .eq('id', id)
  if (error) throw error
}

export async function seedTestHospitals(teamId) {
  try {
    const { data: hospitals, error } = await supabase
      .from('hospitals')
      .insert([
        { name: 'City Medical Center', location: 'Nairobi', team_id: teamId },
        { name: 'Prime Health Hospital', location: 'Mombasa', team_id: teamId },
        { name: 'Coastal Clinic', location: 'Kisumu', team_id: teamId }
      ])
      .select()
    if (error) throw error
    const wards = [
      { service_name: 'ICU', price_per_day: 20000, service_type: 'ward' },
      { service_name: 'HDU', price_per_day: 12000, service_type: 'ward' },
      { service_name: 'General Ward', price_per_day: 6000, service_type: 'ward' }
    ]
    for (const hospital of hospitals) {
      for (const ward of wards) {
        await supabase.from('hospital_services').insert({
          hospital_id: hospital.id,
          service_name: ward.service_name,
          price_per_day: ward.price_per_day,
          service_type: ward.service_type
        })
      }
    }
    return { success: true, message: '3 hospitals with 9 wards created!' }
  } catch (error) {
    console.error('seedTestHospitals error:', error)
    return { success: false, error: error.message }
  }
}
