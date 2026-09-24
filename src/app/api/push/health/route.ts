import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { serviceKeyCandidates, serviceRoleKey } from '@/lib/supabase/admin';

// Reports which Supabase project each server key belongs to, without exposing the keys.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const candidates = serviceKeyCandidates();

  return NextResponse.json({
    supabaseUrlProject: url.replace(/^https?:\/\//, '').split('.')[0] || 'missing',
    serviceKeys: Object.fromEntries(candidates.map(({ name, ref }) => [name, ref])),
    usingKey: candidates.find((entry) => entry.key === serviceRoleKey)?.name || 'none',
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? 'set' : 'missing',
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ? 'set' : 'missing'
  });
}
