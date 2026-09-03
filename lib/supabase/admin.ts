import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Bypasses RLS. Only ever call this after verifying the requesting user's
// role server-side (see requireAdmin() in app/actions/applications.ts).
// Never expose SUPABASE_SERVICE_ROLE_KEY to the client bundle.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
