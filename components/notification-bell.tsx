'use client';
import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { StaffApi, NotificationResponse, NotificationRow } from '@/lib/types';

export default function NotificationBell({
  api,
  enabled,
  onOpen,
  onOpenTarget,
}: {
  api: StaffApi;
  enabled: boolean;
  onOpen: () => void;
  onOpenTarget?: (id: string) => void;
}) {
  const [rows, setRows] = useState<NotificationRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true,
      inFlight = false,
      queued = false;
    const load = async () => {
      if (document.visibilityState === 'hidden') return;
      if (inFlight) {
        queued = true;
        return;
      }
      inFlight = true;
      try {
        const response = await api<NotificationResponse>('notifications');
        if (active) {
          setRows(response.rows);
          setError('');
        }
      } catch {
        if (active) setError('Could not load notifications. Try again.');
      } finally {
        inFlight = false;
        if (queued && active) {
          queued = false;
          void load();
        }
      }
    };
    void load();
    const timer = setInterval(load, 20000);
    window.addEventListener('focus', load);
    window.addEventListener('ahf-notifications-changed', load);
    document.addEventListener('visibilitychange', load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', load);
      window.removeEventListener('ahf-notifications-changed', load);
      document.removeEventListener('visibilitychange', load);
    };
  }, [api, enabled]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  const count = rows?.filter((row) => !row.read_at).length;
  return (
    <div className="cms-notification-container" ref={root}>
      <button
        type="button"
        className="cms-notification-bell"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="notification-preview"
        aria-label={
          count === undefined ? 'Open notifications' : `Open notifications, ${count} unread`
        }
        title="Notifications"
      >
        <Bell size={20} />
        {count !== undefined && count > 0 && (
          <span aria-hidden="true">{count > 99 ? '99+' : count}</span>
        )}
      </button>
      {open && (
        <section
          id="notification-preview"
          className="cms-notification-popover"
          aria-label="Recent notifications"
        >
          <div className="cms-notification-heading">
            <strong>Notifications</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close notifications">
              ×
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
          {!enabled ? (
            <p>Notifications are available after signing in.</p>
          ) : rows === null ? (
            <p>Loading notifications…</p>
          ) : rows.length === 0 ? (
            <p>No notifications yet.</p>
          ) : (
            <ul>
              {rows.slice(0, 5).map((row) => (
                <li key={row.id}>
                  <strong>{row.title}</strong>
                  {!row.read_at && <span> · New</span>}
                  <p>{row.body}</p>
                  {onOpenTarget && (
                    <button
                      type="button"
                      className="btn outline small"
                      onClick={() => {
                        setOpen(false);
                        onOpenTarget(row.id);
                      }}
                    >
                      Open related item
                    </button>
                  )}
                  <small>
                    {new Date(row.created_at).toLocaleString('en-GB', {
                      timeZone: 'Africa/Kampala',
                    })}
                  </small>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="btn outline small"
            onClick={() => {
              setOpen(false);
              onOpen();
            }}
          >
            View all notifications
          </button>
          <p className="fine">Showing the latest five; unread count covers the latest 100.</p>
        </section>
      )}
    </div>
  );
}
