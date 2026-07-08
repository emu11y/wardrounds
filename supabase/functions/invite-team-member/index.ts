import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        },
      });
    }

    let email: string, role: string, teamId: string, password: string, fullName: string, positionId: string | null | undefined;
    try {
      ({ email, role, teamId, password, fullName, positionId } = await req.json());
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    console.log("invite request:", JSON.stringify({ email, role, teamId, positionId, hasPassword: !!password }));

    if (!email || !teamId || !role || !password) {
      return Response.json({ error: "email, role, teamId, and password are required" }, { status: 400 });
    }

    if (role !== "admin" && role !== "member") {
      return Response.json({ error: "role must be admin or member" }, { status: 400 });
    }

    // Check if already a member of this team
    const { data: existing, error: precheckError } = await ctx.supabaseAdmin
      .from("users")
      .select("id, team_id")
      .eq("email", email)
      .maybeSingle();

    if (precheckError) {
      console.error("pre-check failed:", JSON.stringify(precheckError, Object.getOwnPropertyNames(precheckError)));
      return Response.json(
        { error: "Membership pre-check failed", detail: precheckError.message ?? String(precheckError) },
        { status: 500 }
      );
    }

    if (existing && existing.team_id === teamId) {
      return Response.json({ error: "This person is already a member of your team." }, { status: 409 });
    }

    // Create auth user immediately — no invite email sent
    const { data: createData, error: createError } = await ctx.supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, team_id: teamId },
    });

    if (createError) {
      console.error("createUser failed:", JSON.stringify(createError, Object.getOwnPropertyNames(createError ?? {})));
      return Response.json(
        { error: "Failed to create account", detail: createError?.message ?? String(createError), code: createError?.code ?? null },
        { status: 500 }
      );
    }

    const authUserId = createData.user.id;

    if (existing) {
      // Cross-team user — update team assignment
      const { error: updateError } = await ctx.supabaseAdmin
        .from("users")
        .update({ team_id: teamId, role, position_id: positionId ?? null, invited_at: new Date().toISOString() })
        .eq("email", email);
      if (updateError) {
        console.error("updateError failed:", JSON.stringify(updateError, Object.getOwnPropertyNames(updateError ?? {})));
        return Response.json(
          { error: "Account created but profile update failed", detail: updateError?.message ?? String(updateError), code: updateError?.code ?? null },
          { status: 500 }
        );
      }
    } else {
      // New user — upsert public.users row with real auth UUID
      const { error: insertError } = await ctx.supabaseAdmin
        .from("users")
        .upsert({
          id: authUserId,
          email,
          full_name: fullName || "",
          role,
          position_id: positionId ?? null,
          team_id: teamId,
          status: "active",
        }, { onConflict: "id" });
      if (insertError) {
        console.error("insertError failed:", JSON.stringify(insertError, Object.getOwnPropertyNames(insertError ?? {})));
        return Response.json(
          { error: "Account created but profile creation failed", detail: insertError?.message ?? String(insertError), code: insertError?.code ?? null },
          { status: 500 }
        );
      }
    }

    return Response.json({ success: true, userId: authUserId }, { status: 200 });
  }),
};
