import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// The Vercel Supabase integration injects its own locked SUPABASE_SERVICE_ROLE_KEY for a
// different project, so whichever service_role key (under any variable name) belongs to
// the project in NEXT_PUBLIC_SUPABASE_URL wins.
function decodeKey(value: string) {
  try {
    const payload = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString());
    return { role: payload.role as string | undefined, ref: payload.ref as string | undefined };
  } catch {
    return {};
  }
}

export function serviceKeyCandidates() {
  return Object.entries(process.env)
    .map(([name, value]) => ({ name, key: (value || '').trim().replace(/^"|"$/g, '') }))
    .map((entry) => ({ ...entry, ...decodeKey(entry.key) }))
    .filter((entry) => entry.role === 'service_role');
}

function resolveServiceRoleKey() {
  const urlRef = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^https?:\/\//, '').split('.')[0];
  const candidates = serviceKeyCandidates();
  return (
    candidates.find((entry) => entry.ref === urlRef)?.key ||
    process.env.APP_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export const serviceRoleKey = resolveServiceRoleKey();

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
