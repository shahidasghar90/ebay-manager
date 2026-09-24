'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type InboxItem = {
  id: string;
  actor_email: string | null;
  title: string;
  body: string | null;
  url: string | null;
  created_at: string;
};

const REFRESH_MS = 60_000;

function timeAgo(value: string) {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value)
  );
}

/** Bell with unread count; opens the list of team notifications for the current user. */
export default function NotificationBell() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [items, setItems] = useState<InboxItem[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('id, actor_email, title, body, url, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setItems(data);
  }, [supabase]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && load();
    const onMessage = (event: MessageEvent) => event.data?.type === 'notification' && load();

    document.addEventListener('visibilitychange', onVisible);
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
    };
  }, [load]);

  // Only unread notifications are stored, so every row counts.
  const unread = items.length;

  // Mirror the count on the installed app's Home Screen icon where supported.
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    (unread > 0 ? nav.setAppBadge?.(unread) : nav.clearAppBadge?.())?.catch(() => {});
  }, [unread]);

  // Reading a notification deletes it: the inbox never keeps old rows.
  async function dismiss(ids: string[]) {
    if (ids.length === 0) return;
    setItems((current) => current.filter((item) => !ids.includes(item.id)));
    await supabase.from('notifications').delete().in('id', ids);
  }

  function openItem(item: InboxItem) {
    dismiss([item.id]);
    setOpen(false);
    router.push(item.url || '/dashboard');
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-lg border border-white/20 w-10 h-10 grid place-items-center text-lg leading-none text-white"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        🔔
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red text-white text-[11px] font-bold grid place-items-center border-2 border-navy">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[400]" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-label="Notifications"
            className="fixed z-[410] left-2 right-2 top-[calc(env(safe-area-inset-top)+68px)] md:left-[262px] md:right-auto md:top-4 md:w-[380px] max-h-[75dvh] flex flex-col rounded-xl bg-white text-text shadow-2xl border border-border overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
              <strong className="text-base">Notifications</strong>
              {unread > 0 && (
                <button
                  type="button"
                  className="text-xs font-bold text-blue"
                  onClick={() => dismiss(items.map((item) => item.id))}
                >
                  Clear all
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <p className="p-6 text-center text-muted text-sm m-0">No new notifications.</p>
            ) : (
              <ul className="overflow-y-auto m-0 p-0 list-none">
                {items.map((item) => (
                  <li key={item.id} className="border-b border-border last:border-b-0">
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className="w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50"
                    >
                      <span className="mt-1.5 w-2 h-2 shrink-0 rounded-full bg-blue" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold">
                          {item.title}
                        </span>
                        {item.body && (
                          <span className="block text-[13px] text-slate-600 line-clamp-2 break-words">{item.body}</span>
                        )}
                        <span className="block text-[11px] text-muted mt-0.5">
                          {item.actor_email ? `${item.actor_email.split('@')[0]} · ` : ''}
                          {timeAgo(item.created_at)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  );
}
