'use client';
import AppLink from './app-link';
import type * as Rows from '@/lib/types';

import { useEffect, useState } from 'react';
export default function EnquiryTools({
  enquiry,
  api,
  onUpdated,
}: {
  enquiry: Rows.EnquiryRow;
  api: Rows.StaffApi;
  onUpdated: () => Promise<void>;
}) {
  const [history, setHistory] = useState<Rows.EnquiryAudit[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api<Rows.EnquiryAudit[]>('enquiry-history?id=' + enquiry.id)
      .then((v) => active && setHistory(v))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [api, enquiry.id, enquiry.version]);
  return (
    <section className="editor-group">
      <h3>Follow-up desk</h3>
      <label className="field">
        Priority
        <select
          value={enquiry.priority || 'Normal'}
          onChange={async (e) => {
            try {
              await api<Rows.ContentItem>('editorial', {
                method: 'POST',
                body: JSON.stringify({
                  action: 'priority',
                  id: enquiry.id,
                  version: enquiry.version,
                  level: e.target.value,
                }),
              });
              await onUpdated();
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        >
          {['Normal', 'High', 'Urgent'].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <AppLink
        className="text-link"
        href={
          'mailto:' +
          enquiry.email +
          '?subject=' +
          encodeURIComponent('Your AHF enquiry ' + enquiry.id.slice(0, 8))
        }
      >
        Compose reply in your email app ↗
      </AppLink>
      <p className="fine">
        Email replies are composed outside this workspace. Record the outcome in the internal note.
        Priority does not replace a safeguarding or emergency reporting channel.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <h3>Activity history</h3>
      {history.map((h) => (
        <article className="enquiry-timeline" key={h.id}>
          <small>
            {new Date(h.created_at).toLocaleString('en-GB', { timeZone: 'Africa/Kampala' })} ·{' '}
            {h.status}
          </small>
          <p style={{ whiteSpace: 'pre-wrap' }}>{h.note || 'Status updated'}</p>
        </article>
      ))}
      {!history.length && <p>No recorded follow-up changes yet.</p>}
    </section>
  );
}
