'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import { NotificationBanner } from './PushNotifications';
import NotificationBell from './NotificationBell';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-[200] flex items-center gap-3 bg-navy text-white px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] shadow-md">
          <button
            className="rounded-lg border border-white/20 px-3 py-2 text-lg leading-none"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <div className="w-8 h-8 rounded-lg bg-blue grid place-items-center font-bold">T</div>
          <span className="font-bold flex-1">TradePilot</span>
          <NotificationBell />
        </header>

        <main className="flex-1 min-w-0 overflow-x-clip p-4 md:p-7 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <NotificationBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
