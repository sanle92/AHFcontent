'use client';
import { useEffect, useState } from 'react';
import type { StaffApi } from '@/lib/types';
interface Health {
  scheduler_stale: boolean;
  csp_mode: string;
  quality?: Record<string, number>;
  maintenance?: { finished_at: string };
  push_pending: number;
  push_failed: number;
  email_pending: number;
  email_review: number;
  oldest_email: string | null;
  last_dispatch: { finished_at: string; sent: number; emails: number; failed: boolean } | null;
}
export default function DeliveryHealth({ api }: { api: StaffApi }) {
  const [health, setHealth] = useState<Health | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = () => {
      void api<Health>('operations')
        .then((v) => {
          if (active) {
            setHealth(v);
            setError('');
          }
        })
        .catch(() => {
          if (active)
            setError(
              'Delivery health is unavailable. Check migrations 011–013 and scheduler configuration.',
            );
        });
    };
    load();
    const timer = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [api]);
  return (
    <section className="cms-card padded">
      <h2>Email & device delivery</h2>
      <p>
        Refreshes every 30 seconds. Provider acceptance does not confirm inbox delivery or a device
        popup.
      </p>
      {error && <p role="alert">{error}</p>}
      {health && (
        <>
          {health.scheduler_stale && (
            <p role="alert">
              Scheduler contact is missing or more than 15 minutes old. Check the protected cron
              Worker.
            </p>
          )}
          <p>
            CSP: {health.csp_mode}. Retention maintenance:{' '}
            {health.maintenance?.finished_at || 'No successful run recorded'}.
          </p>
          <p>
            Today’s data-quality/diagnostic counters: {JSON.stringify(health.quality || {})}.
            Dropped events make visit totals incomplete.
          </p>
          <p>
            Push waiting: {health.push_pending} · failed: {health.push_failed}
          </p>
          <p>
            Email waiting or retrying: {health.email_pending} · needs review: {health.email_review}
          </p>
          <p>
            Oldest waiting email:{' '}
            {health.oldest_email
              ? new Date(health.oldest_email).toLocaleString('en-GB', {
                  timeZone: 'Africa/Kampala',
                })
              : 'None'}
          </p>
          <p>
            Last scheduler dispatch:{' '}
            {health.last_dispatch
              ? new Date(health.last_dispatch.finished_at).toLocaleString('en-GB', {
                  timeZone: 'Africa/Kampala',
                })
              : 'No successful scheduler contact recorded'}
          </p>
          {health.last_dispatch?.failed && (
            <p role="alert">The last dispatch failed. Check Worker secrets and provider logs.</p>
          )}
        </>
      )}
    </section>
  );
}
