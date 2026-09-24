'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterServiceWorker() {
  const router = useRouter();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Installability degrades gracefully without a service worker.
    });

    // Tapping a notification while the app is open asks this page to open the record.
    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== 'navigate' || typeof event.data.url !== 'string') return;
      const target = new URL(event.data.url, window.location.origin);
      if (target.origin !== window.location.origin) return;
      router.push(`${target.pathname}${target.search}${target.hash}`);
    }

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [router]);

  return null;
}
