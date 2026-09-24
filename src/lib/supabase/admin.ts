import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// The Vercel Supabase integration injects its own (locked) SUPABASE_SERVICE_ROLE_KEY
// for a different project, so APP_SUPABASE_SERVICE_ROLE_KEY takes priority.
export const serviceRoleKey =
  process.env.APP_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
