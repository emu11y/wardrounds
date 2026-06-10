export async function extractPatientDataFromTag(imageBase64, hospitals = [], mediaType = 'image/jpeg') {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY
  if (!apiKey) throw new Error('VITE_CLAUDE_API_KEY is not set')

  const hospitalReference = hospitals
    .filter(h => h.hospital_id_prefix)
    .map(h => `- "${h.name}" uses ID prefix "${h.hospital_id_prefix}"`)
    .join('\n')

  const referenceBlock = hospitalReference
    ? `The team has registered these hospitals and their patient-ID prefix markers:\n${hospitalReference}\n\nMatch the tag to ONE of these hospitals by finding which prefix marker appears on the tag. Return that exact registered hospital name in the "hospital" field.`
    : `Identify the hospital name as printed on the tag.`

  const prompt = `You are a medical data extraction expert. Extract patient information from this hospital tag/card image.

IMPORTANT: Return ONLY valid JSON, nothing else. No markdown, no explanation.

${referenceBlock}

Extract these fields (use null if not found or unclear):
{
  "firstName": "first name only",
  "lastName": "last name or family name",
  "dateOfBirth": "YYYY-MM-DD format (convert from any date format; if only age is shown, approximate the birth year)",
  "patientHospitalId": "the full patient ID value/code printed on the tag",
  "idPrefix": "the short label/marker that identifies the hospital system on the tag, exactly as printed (e.g. the letters before the ID number)",
  "ward": "ward name, room, or service if visible",
  "hospital": "the matched registered hospital name from the list above, or the name printed on the tag if no match"
}

Return ONLY the JSON object, nothing else.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  })

  const data = await response.json()
  if (data.error) throw new Error(data.error.message)

  const textContent = data.content?.find(c => c.type === 'text')?.text || ''
  const jsonMatch = textContent.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in response')

  const extracted = JSON.parse(jsonMatch[0])
  console.log('✅ Extracted:', extracted)
  console.log('   Name:', extracted.firstName, extracted.lastName)
  console.log('   DOB:', extracted.dateOfBirth)
  console.log('   Patient Hospital ID:', extracted.patientHospitalId || '(none)')
  console.log('   ID Prefix marker:', extracted.idPrefix || '(none)')
  console.log('   Hospital (matched):', extracted.hospital || '(none)')
  console.log('   Ward:', extracted.ward || '(empty)')
  return extracted
}
