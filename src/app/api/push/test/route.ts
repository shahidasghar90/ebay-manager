import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Sends a test notification to one of the current user's own subscribed devices.
export async function POST(request: Request) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    return NextResponse.json({ error: 'Push notifications are not configured' }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { endpoint } = (await request.json()) as { endpoint?: string };
  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('endpoint', endpoint)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!sub) {
    return NextResponse.json(
      { error: 'This device is not registered. Turn notifications off and on again.' },
      { status: 404 }
    );
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    publicKey,
    privateKey
  );

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({
        title: 'TradePilot test',
        body: 'Notifications are working on this device.',
        url: '/settings'
      })
    );
  } catch (err) {
    const { statusCode, body } = err as { statusCode?: number; body?: string };
    if (statusCode === 404 || statusCode === 410) {
      await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    }
    return NextResponse.json(
      { error: `Push service rejected the notification (${statusCode ?? 'error'}) ${body ?? ''}`.trim() },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
