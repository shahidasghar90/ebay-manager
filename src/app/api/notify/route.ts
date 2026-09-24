import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, serviceRoleKey } from '@/lib/supabase/admin';

type NotifyBody = {
  title?: string;
  body?: string;
  url?: string;
};

export async function POST(request: Request) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey || !serviceRoleKey) {
    return NextResponse.json({ error: 'Push notifications are not configured' }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { title, body, url } = (await request.json()) as NotifyBody;
  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: membership } = await admin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ sent: 0 });
  }

  const { data: members } = await admin
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', membership.workspace_id)
    .neq('user_id', user.id);

  const teammateIds = (members || []).map((member) => member.user_id);
  if (teammateIds.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const { data: subscriptions } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', teammateIds);

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    publicKey,
    privateKey
  );

  const payload = JSON.stringify({
    title,
    body: `${body ? `${body}\n` : ''}by ${user.email}`,
    url: url || '/dashboard'
  });

  const expired: string[] = [];

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        .catch((err: { statusCode?: number }) => {
          // 404/410 mean the browser dropped the subscription for good.
          if (err.statusCode === 404 || err.statusCode === 410) expired.push(sub.endpoint);
          throw err;
        })
    )
  );

  if (expired.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', expired);
  }

  return NextResponse.json({
    sent: results.filter((result) => result.status === 'fulfilled').length
  });
}
