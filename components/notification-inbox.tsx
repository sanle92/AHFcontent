'use client';
import type * as Rows from '@/lib/types';

import { useEffect, useRef, useState } from 'react';
export default function NotificationInbox({
  api,
  demo,
  onOpen,
}: {
  api: Rows.StaffApi;
  demo: boolean;
  onOpen?: (id: string) => void;
}) {
  const [rows, setRows] = useState<Rows.NotificationRow[]>([]),
    [error, setError] = useState(''),
    [marking, setMarking] = useState(false);
  const generation = useRef(0),
    markingRef = useRef(false);
  useEffect(() => {
    if (demo) return;
    let active = true;
    const load = () => {
      if (markingRef.current) return;
      const request = generation.current;
      void api<Rows.NotificationResponse>('notifications')
        .then((v) => {
          if (active && request === generation.current) {
            setRows(v.rows);
            setError('');
          }
        })
        .catch((e) => {
          if (active && request === generation.current) setError(e.message);
        });
    };
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 20000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [api, demo]);
  return (
    <section className="cms-card padded">
      <h2>Notification inbox</h2>
      <p>
        Latest 100 updates. Refreshes every 20 seconds while this page is visible. Device push is
        configured above.
      </p>
      {error && <p role="alert">{error}</p>}
      {rows.some((row) => !row.read_at) && (
        <button
          type="button"
          className="btn outline small"
          disabled={marking}
          onClick={async () => {
            markingRef.current = true;
            setMarking(true);
            generation.current++;
            let failed = false;
            try {
              for (const row of rows.filter((value) => !value.read_at)) {
                try {
                  await api('notifications', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'read', id: row.id }),
                  });
                  setRows((current) =>
                    current.map((value) =>
                      value.id === row.id ? { ...value, read_at: new Date().toISOString() } : value,
                    ),
                  );
                } catch {
                  failed = true;
                }
              }
              setError(
                failed ? 'Some notifications could not be marked read. Please try again.' : '',
              );
              window.dispatchEvent(new Event('ahf-notifications-changed'));
            } finally {
              markingRef.current = false;
              setMarking(false);
            }
          }}
        >
          {marking ? 'Marking notifications…' : 'Mark all displayed as read'}
        </button>
      )}
      {rows.map((n) => (
        <article className="inbox-notice" key={n.id}>
          <span className="cms-badge">{n.read_at ? 'Read' : 'Unread'}</span>
          <h3>{n.title}</h3>
          <p>{n.body}</p>
          <small>
            {new Date(n.created_at).toLocaleString('en-GB', { timeZone: 'Africa/Kampala' })}
          </small>
          {onOpen && (
            <button
              type="button"
              className="btn outline small"
              disabled={marking}
              onClick={() => onOpen(n.id)}
            >
              Open related item
            </button>
          )}
          {!n.read_at && (
            <button
              className="btn outline small"
              disabled={marking}
              onClick={async () => {
                markingRef.current = true;
                setMarking(true);
                generation.current++;
                try {
                  await api<{ sent: number; configured: boolean }>('notifications', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'read', id: n.id }),
                  });
                  window.dispatchEvent(new Event('ahf-notifications-changed'));
                  setRows((v) =>
                    v.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)),
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  markingRef.current = false;
                  setMarking(false);
                }
              }}
            >
              Mark read
            </button>
          )}
        </article>
      ))}
      {!rows.length && <div className="cms-empty">No notifications available.</div>}
    </section>
  );
}
