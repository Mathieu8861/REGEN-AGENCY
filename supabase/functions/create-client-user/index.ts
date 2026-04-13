// ============================================
// REGEN AGENCY - Create Client User
// Supabase Edge Function (Deno)
//
// Creates a user account for client access with
// auto-confirmed email (no confirmation needed).
// Called from admin panel when inviting a client.
// ============================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // Verify caller is admin/staff
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Not authenticated" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !caller) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    // Check caller role
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (!callerProfile || !["admin", "staff"].includes(callerProfile.role)) {
      return jsonResponse({ error: "Unauthorized - admin/staff only" }, 403);
    }

    const body = await req.json();
    const { email, password, agency_id } = body;

    if (!email || !password) {
      return jsonResponse({ error: "Email and password required" }, 400);
    }

    // Create user with admin API (auto-confirms email)
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { must_change_password: true },
    });

    if (createErr) {
      // If user already exists, update password + confirm email
      if (createErr.message?.includes("already been registered")) {
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existing = existingUsers?.users?.find(
          (u: { email?: string }) => u.email === email
        );
        if (existing) {
          // Update password and confirm email
          await supabase.auth.admin.updateUserById(existing.id, {
            password,
            email_confirm: true,
            user_metadata: { must_change_password: true },
          });
          // Ensure profile exists
          await supabase.from("profiles").upsert({
            id: existing.id,
            email,
            role: "client",
            agency_id: agency_id || null,
          });
          return jsonResponse({ user_id: existing.id, existing: true });
        }
      }
      throw createErr;
    }

    // Create/update profile
    await supabase.from("profiles").upsert({
      id: newUser.user.id,
      email,
      role: "client",
      agency_id: agency_id || null,
      full_name: null,
    });

    return jsonResponse({
      user_id: newUser.user.id,
      existing: false,
    });
  } catch (err) {
    console.error("[create-client-user] Error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
