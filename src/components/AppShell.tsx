'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Sidebar from './Sidebar';
import { NotificationBanner } from './PushNotifications';
import NotificationBell from './NotificationBell';
import BottomNav from './BottomNav';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email || ''));
  }, []);

  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Phones: navy app header. Desktop: slim white top bar (the sidebar carries the logo). */}
        <header className="sticky top-0 z-[200] flex items-center gap-3 bg-navy text-white px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] shadow-md md:h-16 md:px-7 md:py-0 md:justify-end md:bg-white md:text-text md:shadow-none md:border-b md:border-border">
          <button
            className="md:hidden rounded-lg border border-white/20 px-3 py-2 text-lg leading-none"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-round.png" alt="TradePilot logo" className="md:hidden w-9 h-9 shrink-0 rounded-full bg-white object-cover" />
          <span className="md:hidden font-bold flex-1">TradePilot</span>
          <NotificationBell />
          {email && (
            <div className="hidden md:flex items-center gap-2.5 pl-3 border-l border-border" title={email}>
              <span className="w-9 h-9 rounded-full bg-blue text-white grid place-items-center font-bold uppercase">
                {email[0]}
              </span>
              <span className="text-sm font-semibold max-w-[200px] truncate">{email.split('@')[0]}</span>
            </div>
          )}
        </header>

        {/* Phones reserve room for the fixed bottom tab bar. */}
        <main className="flex-1 min-w-0 overflow-x-clip p-4 md:p-7 pb-[calc(env(safe-area-inset-bottom)+88px)] md:pb-7">
          <NotificationBanner />
          {children}
        </main>
      </div>

      <BottomNav onOpenMenu={() => setSidebarOpen(true)} />
    </div>
  );
}
