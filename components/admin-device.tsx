'use client';
import type * as Rows from '@/lib/types';

import { useEffect, useState } from 'react';
type Api = Rows.StaffApi;
export async function disableDevice(api: Api, stillCurrent: () => boolean = () => true) {
  if (!('serviceWorker' in navigator)) return;
  const r = await navigator.serviceWorker.getRegistration('/holyghost'),
    s = await r?.pushManager.getSubscription();
  if (s) {
    let sessionChanged = false;
    try {
      await api<{ sent: number; configured: boolean }>('notifications', {
        method: 'POST',
        body: JSON.stringify({ action: 'unsubscribe', subscription: s.toJSON() }),
      });
    } catch (error) {
      sessionChanged = (error as Error).name === 'AbortError';
      throw error;
    } finally {
      if (!sessionChanged && stillCurrent()) await s.unsubscribe();
    }
  }
}
export default function AdminDevice({ api, enabled = false }: { api?: Api; enabled?: boolean }) {
  const [install, setInstall] = useState<Rows.BeforeInstallPromptEvent | null>(null),
    [note, setNote] = useState(''),
    [busy, setBusy] = useState(false),
    [cfg, setCfg] = useState<Rows.NotificationResponse | null>(null),
    [subscribed, setSubscribed] = useState(false);
  useEffect(() => {
    const listener = (e: Event) => {
      e.preventDefault();
      setInstall(e as Rows.BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', listener);
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker
        .register('/ahf-admin-sw.js', { scope: '/holyghost' })
        .then(() => {})
        .catch(() =>
          setNote('Install and notifications require HTTPS and service-worker support.'),
        );
    return () => window.removeEventListener('beforeinstallprompt', listener);
  }, []);
  useEffect(() => {
    let active = true;
    if (enabled && api)
      api<Rows.NotificationResponse>('notifications')
        .then(async (v) => {
          if (!active) return;
          setCfg(v);
          const registration = await navigator.serviceWorker?.getRegistration('/holyghost');
          const subscription = await registration?.pushManager?.getSubscription();
          const own = subscription
            ? await api<boolean>(
                'workspace?resource=device&endpoint=' + encodeURIComponent(subscription.endpoint),
              )
            : false;
          if (active) setSubscribed(own);
        })
        .catch(() => {
          if (active)
            setNote('Apply the numbered website migrations to enable the notification workspace.');
        });
    return () => {
      active = false;
    };
  }, [api, enabled]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="device-panel">
      <div>
        <strong>AHF Admin · install on your device</strong>
        <p>
          iPhone/iPad: Share → Add to Home Screen. Other browsers: use the install button or browser
          app menu.
        </p>
      </div>
      {install && (
        <button
          className="btn outline small"
          onClick={() =>
            void run(async () => {
              await install.prompt();
              setInstall(null);
            })
          }
        >
          Install admin
        </button>
      )}
      {enabled && api && (
        <>
          <button
            className="btn green small"
            disabled={busy || !cfg?.configured}
            onClick={() =>
              void run(async () => {
                if (subscribed) {
                  await disableDevice(api);
                  setSubscribed(false);
                  setNote('Notifications disabled for this device.');
                  return;
                }
                if (!('Notification' in window) || !('PushManager' in window))
                  throw Error(
                    'Push is unavailable here. On iPhone/iPad, install and open the Home Screen app first.',
                  );
                const permission = await Notification.requestPermission();
                if (permission !== 'granted')
                  throw Error(
                    'Notifications are blocked. Change the browser/site notification setting to enable them.',
                  );
                const r = await navigator.serviceWorker.getRegistration('/holyghost');
                if (!r) throw Error('Service worker is not ready. Refresh and retry.');
                if (!r.active) throw Error('App installation is finishing. Refresh and retry.');
                const raw = atob(cfg!.publicKey.replace(/-/g, '+').replace(/_/g, '/'));
                const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
                const existing = await r.pushManager.getSubscription();
                if (existing) await existing.unsubscribe();
                const s = await r.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: key,
                });
                await api<{ sent: number; configured: boolean }>('notifications', {
                  method: 'POST',
                  body: JSON.stringify({ action: 'subscribe', subscription: s.toJSON() }),
                });
                setSubscribed(true);
                setNote('Device subscribed. Send a test notification to verify delivery.');
              })
            }
          >
            {subscribed ? 'Disable device notifications' : 'Enable device notifications'}
          </button>
          <button
            className="btn outline small"
            disabled={busy || !subscribed}
            onClick={() =>
              void run(async () => {
                const v = await api<{ sent: number; configured: boolean }>('notifications', {
                  method: 'POST',
                  body: JSON.stringify({
                    action: 'test',
                    subscription: {
                      endpoint: (
                        await (
                          await navigator.serviceWorker.getRegistration('/holyghost')
                        )?.pushManager.getSubscription()
                      )?.endpoint,
                    },
                  }),
                });
                setNote(
                  v.sent
                    ? 'This device’s latest test was accepted by the push service. Popup display still depends on device settings.'
                    : 'Test queued. Check VAPID configuration and dispatch setup.',
                );
              })
            }
          >
            Test notification
          </button>
          {!cfg?.configured && <small>VAPID keys are not configured yet.</small>}
        </>
      )}
      {note && <p role="status">{note}</p>}
    </section>
  );
}
