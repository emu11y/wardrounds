import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/gif", "image/webp"];
function normaliseMediaType(rawType: string): string {
  return ALLOWED_MEDIA.includes(rawType) ? rawType : "image/jpeg";
}

interface HospitalRef {
  name?: string;
  hospital_id_prefix?: string | null;
}

function buildPrompt(hospitals: HospitalRef[]): string {
  const hospitalReference = hospitals
    .filter((h) => h.hospital_id_prefix)
    .map((h) => `- "${h.name}" uses ID prefix "${h.hospital_id_prefix}"`)
    .join("\n");

  const referenceBlock = hospitalReference
    ? `The team has registered these hospitals and their patient-ID prefix markers:\n${hospitalReference}\n\nMatch the tag to ONE of these hospitals by finding which prefix marker appears on the tag. Return that exact registered hospital name in the "hospital" field.`
    : `Identify the hospital name as printed on the tag.`;

  return `You are a medical data extraction expert. Extract patient information from this hospital tag/card image.

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

Return ONLY the JSON object, nothing else.`;
}

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    // Gate to authenticated app users only — this spends the owner's Claude credits.
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return Response.json({ error: "Not authenticated" }, { status: 401, headers: CORS });
    }
    const { data: { user }, error: userErr } = await ctx.supabaseAdmin.auth.getUser(token);
    if (userErr || !user) {
      return Response.json({ error: "Not authenticated" }, { status: 401, headers: CORS });
    }

    const apiKey = Deno.env.get("CLAUDE_API_KEY");
    if (!apiKey) {
      console.error("CLAUDE_API_KEY secret is not set on the project");
      return Response.json({ error: "Scanner is not configured" }, { status: 500, headers: CORS });
    }

    let imageBase64: string, hospitals: HospitalRef[], mediaType: string;
    try {
      const body = await req.json();
      imageBase64 = body.imageBase64;
      hospitals = Array.isArray(body.hospitals) ? body.hospitals : [];
      mediaType = body.mediaType || "image/jpeg";
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS });
    }

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return Response.json({ error: "imageBase64 is required" }, { status: 400, headers: CORS });
    }

    const prompt = buildPrompt(hospitals);

    let anthropicRes: Response;
    try {
      anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: normaliseMediaType(mediaType), data: imageBase64 },
                },
                { type: "text", text: prompt },
              ],
            },
          ],
        }),
      });
    } catch (e) {
      console.error("Anthropic fetch failed:", String(e));
      return Response.json({ error: "Scanner request failed" }, { status: 502, headers: CORS });
    }

    const data = await anthropicRes.json();
    if (data.error) {
      console.error("Anthropic returned error:", JSON.stringify(data.error));
      return Response.json({ error: data.error.message ?? "Scanner error" }, { status: 502, headers: CORS });
    }

    const textContent = data.content?.find((c: { type: string }) => c.type === "text")?.text || "";
    const jsonMatch = textContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: "No JSON found in response" }, { status: 502, headers: CORS });
    }

    let extracted: unknown;
    try {
      extracted = JSON.parse(jsonMatch[0]);
    } catch {
      return Response.json({ error: "Could not parse scan result" }, { status: 502, headers: CORS });
    }

    return Response.json({ extracted }, { status: 200, headers: CORS });
  }),
};
