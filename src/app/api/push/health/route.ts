import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Reports which Supabase project each server key belongs to, without exposing the keys.
function describeKey(key: string | undefined) {
  if (!key) return 'missing';
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    return `${payload.role} @ ${payload.ref}`;
  } catch {
    return key.startsWith('sb_') ? `new-format key (${key.slice(0, 10)}...)` : 'unreadable';
  }
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  return NextResponse.json({
    supabaseUrlProject: url.replace(/^https?:\/\//, '').split('.')[0] || 'missing',
    APP_SUPABASE_SERVICE_ROLE_KEY: describeKey(process.env.APP_SUPABASE_SERVICE_ROLE_KEY),
    SUPABASE_SERVICE_ROLE_KEY: describeKey(process.env.SUPABASE_SERVICE_ROLE_KEY),
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? 'set' : 'missing',
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ? 'set' : 'missing'
  });
}
