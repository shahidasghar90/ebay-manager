'use client';

import { useCallback, useEffect, useState } from 'react';

type PushState = 'loading' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on';

const DISMISS_KEY = 'tradepilot-push-banner-dismissed';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

async function saveSubscription(subscription: PushSubscription) {
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON())
  });

  if (!response.ok) {
    const { error: message } = await response.json().catch(() => ({ error: '' }));
    throw new Error(message || 'Could not save subscription');
  }
}

function usePushSubscription() {
  const [state, setState] = useState<PushState>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      // iPhone only exposes Web Push once the app is added to the Home Screen.
      setState(isIos() && !isStandalone() ? 'ios-install' : 'unsupported');
      return;
    }

    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        setState(subscription ? 'on' : 'off');
        // Re-save on every visit: an earlier save may have failed while the browser
        // kept the subscription, which would otherwise look "on" but never receive.
        if (subscription) saveSubscription(subscription).catch(() => {});
      })
      .catch(() => setState('off'));
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    setError('');

    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set');

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        }));

      await saveSubscription(subscription);

      setState('on');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable notifications');
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    setError('');

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        await subscription.unsubscribe();
      }

      setState('off');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disable notifications');
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    setBusy(true);
    setError('');

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setState('off');
        throw new Error('This device is not subscribed. Enable notifications first.');
      }

      await saveSubscription(subscription);
      const response = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });

      if (!response.ok) {
        const { error: message } = await response.json().catch(() => ({ error: '' }));
        throw new Error(message || 'Could not send test notification');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send test notification');
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, error, enable, disable, sendTest };
}

export function NotificationBanner() {
  const { state, busy, error, enable } = usePushSubscription();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Banner simply shows again next visit.
    }
  }

  if (dismissed || (state !== 'off' && state !== 'ios-install')) return null;

  return (
    <div className="card mb-4 p-3.5 flex flex-col sm:flex-row sm:items-center gap-3 border-blue/40 bg-blue/5">
      <div className="flex-1 text-sm">
        <strong className="block">🔔 Get notified when your team changes something</strong>
        <span className="text-muted">
          {state === 'ios-install'
            ? 'On iPhone, tap Share → "Add to Home Screen", open TradePilot from there, then enable notifications.'
            : 'New or edited products, orders, research, inventory, returns and accounts.'}
        </span>
        {error && <span className="block text-red font-semibold mt-1">{error}</span>}
      </div>
      <div className="flex gap-2">
        {state === 'off' && (
          <button type="button" className="btn-primary text-sm" onClick={enable} disabled={busy}>
            {busy ? 'Enabling...' : 'Enable'}
          </button>
        )}
        <button type="button" className="btn-secondary text-sm" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}

export function NotificationSettings() {
  const { state, busy, error, enable, disable, sendTest } = usePushSubscription();

  const description: Record<PushState, string> = {
    loading: 'Checking this device...',
    unsupported: 'This browser does not support push notifications.',
    'ios-install':
      'On iPhone, tap Share → "Add to Home Screen", open TradePilot from the Home Screen, then enable notifications here.',
    denied:
      'Notifications are blocked for this site. Allow them in your browser or phone settings, then reload.',
    off: 'Notifications are off on this device.',
    on: 'This device will be notified when a teammate adds or edits a record.'
  };

  return (
    <div className="card p-5 grid gap-3.5">
      <div>
        <h2 className="font-bold text-base">Notifications</h2>
        <p className="text-muted text-sm">{description[state]}</p>
      </div>

      {error && <p className="text-red font-semibold text-sm">{error}</p>}

      {(state === 'off' || state === 'on') && (
        <div>
          {state === 'off' ? (
            <button type="button" className="btn-primary" onClick={enable} disabled={busy}>
              {busy ? 'Enabling...' : 'Enable notifications on this device'}
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={sendTest} disabled={busy}>
                {busy ? 'Working...' : 'Send test notification'}
              </button>
              <button type="button" className="btn-secondary" onClick={disable} disabled={busy}>
                Turn off on this device
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
