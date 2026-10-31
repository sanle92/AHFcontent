'use client';
import AppLink from './app-link';
import { usePathname } from 'next/navigation';
import { visitSession } from '@/lib/visit-session';

import { useEffect, useState, useSyncExternalStore } from 'react';
export default function VisitorConsent({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const choice = useSyncExternalStore(subscribeChoice, readChoice, () => 'loading');
  const [open, setOpen] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (!enabled || choice !== 'yes' || navigator.doNotTrack === '1') return;
    let visitor: string;
    try {
      visitor = localStorage.getItem('ahf-visitor') || crypto.randomUUID();
      localStorage.setItem('ahf-visitor', visitor);
    } catch {
      return;
    }
    const send = (action: string) => {
      if (readChoice() !== 'yes' || navigator.doNotTrack === '1') return;
      let visit;
      try {
        visit = visitSession(sessionStorage.getItem('ahf-visit'), Date.now(), () =>
          crypto.randomUUID(),
        );
        sessionStorage.setItem('ahf-visit', JSON.stringify(visit));
      } catch {
        return;
      }
      void fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitor,
          session: visit.id,
          consent: true,
          action,
          path: location.pathname,
          referrer: document.referrer,
        }),
        keepalive: true,
      }).catch(() => {});
    };
    send('view');
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        send('heartbeat');
      }
    }, 45000);
    const click = (e: MouseEvent) => {
      const action = (e.target as HTMLElement)
        ?.closest('a[data-engagement]')
        ?.getAttribute('data-engagement');
      if (action && ['giving', 'merchandise', 'volunteer', 'partner', 'kids'].includes(action))
        send(action);
    };
    const visible = () => {
      if (document.visibilityState === 'visible') send('heartbeat');
    };
    document.addEventListener('click', click);
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('click', click);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [enabled, choice, pathname]);
  if (choice === 'loading' || (!enabled && !choice && !open)) return null;
  const decide = async (value: string) => {
    setError('');
    try {
      if (value === 'no') {
        localStorage.setItem('ahf-analytics-consent', 'no');
        setChoice('no');
        const visitor = localStorage.getItem('ahf-visitor');
        if (visitor) {
          const r = await fetch('/api/visits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visitor, action: 'forget' }),
          });
          if (!r.ok) {
            setError('Recording is stopped. History deletion failed; please retry.');
            setOpen(true);
            return;
          }
        }
        localStorage.removeItem('ahf-visitor');
        sessionStorage.removeItem('ahf-visit');
      }
      localStorage.setItem('ahf-analytics-consent', value);
      setChoice(value);
      setOpen(false);
    } catch {
      setOpen(true);
      setError('Recording is stopped. History deletion could not be confirmed; please retry.');
      setChoice('no');
    }
  };
  return (
    <>
      {(!choice || open) && (
        <aside className="consent-banner" aria-label="Visitor analytics preferences">
          <strong>Help us understand what brings hope.</strong>
          <p>
            With your permission, we record visits using a pseudonymous browser identifier, page
            history, device type and approximate country/city for 30 days. No precise GPS, names or
            enquiry details. You can decline and still use every website feature.
          </p>
          {error && <p role="alert">{error}</p>}
          {!enabled && (
            <p>
              New analytics recording is disabled. You can still request deletion of previous
              history.
            </p>
          )}
          {navigator.doNotTrack === '1' && <p>Your browser’s Do Not Track setting is respected.</p>}
          <div>
            <button className="btn outline small" onClick={() => void decide('no')}>
              Decline / delete my visit history
            </button>
            <button
              className="btn green small"
              disabled={!enabled}
              onClick={() => void decide('yes')}
            >
              Allow visit statistics
            </button>
            <AppLink href="/privacy">Privacy details</AppLink>
          </div>
        </aside>
      )}
      <button className="privacy-preferences" onClick={() => setOpen((v) => !v)}>
        Privacy preferences
      </button>
    </>
  );
}

function readChoice() {
  try {
    return localStorage.getItem('ahf-analytics-consent');
  } catch {
    return 'no';
  }
}
function subscribeChoice(notify: () => void) {
  window.addEventListener('storage', notify);
  window.addEventListener('ahf-consent-change', notify);
  return () => {
    window.removeEventListener('storage', notify);
    window.removeEventListener('ahf-consent-change', notify);
  };
}
function setChoice(value: string) {
  try {
    localStorage.setItem('ahf-analytics-consent', value);
  } catch {}
  window.dispatchEvent(new Event('ahf-consent-change'));
}
