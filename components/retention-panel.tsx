'use client';
import { useEffect, useState } from 'react';
import type { StaffApi } from '@/lib/types';
type Policy = { configured: boolean; days?: number; eligible?: number; before?: string };
export default function RetentionPanel({ api }: { api: StaffApi }) {
  const [policy, setPolicy] = useState<Policy | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [confirmation, setConfirmation] = useState(''),
    [holdId, setHoldId] = useState(''),
    [orphans, setOrphans] = useState<{ id: string; filename: string }[] | null>(null);
  useEffect(() => {
    let active = true;
    void api<Policy>('retention')
      .then((v) => {
        if (active) setPolicy(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [api]);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="cms-card padded">
      <h2>Retention & media review</h2>
      <p>
        Closed enquiries can be anonymized after an approved retention period. Held records and
        records with active email delivery are excluded. File deletion is never automatic.
      </p>
      {error && <p role="alert">{error}</p>}
      {!policy?.configured ? (
        <p>
          Retention processing is disabled. Approve a period, then set AHF_ENQUIRY_RETENTION_DAYS in
          the Worker configuration.
        </p>
      ) : (
        <>
          <p>
            Policy: {policy.days} days. Eligible closed enquiries: {policy.eligible}. Cutoff:{' '}
            {policy.before}.
          </p>
          <label>
            Type ANONYMIZE CLOSED ENQUIRIES
            <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          </label>
          <button
            disabled={busy || confirmation !== 'ANONYMIZE CLOSED ENQUIRIES' || !policy.eligible}
            onClick={() =>
              void run(async () => {
                await api('retention', {
                  method: 'POST',
                  body: JSON.stringify({ confirmation, before: policy.before }),
                });
                setPolicy(await api<Policy>('retention'));
                setConfirmation('');
              })
            }
          >
            Apply approved retention policy
          </button>
        </>
      )}
      <label>
        Enquiry reference for a retention hold
        <input
          value={holdId}
          onChange={(e) => setHoldId(e.target.value)}
          placeholder="Enquiry UUID"
        />
      </label>
      {[true, false].map((hold) => (
        <button
          key={String(hold)}
          disabled={busy || !holdId}
          onClick={() =>
            void run(async () => {
              await api('retention', {
                method: 'POST',
                body: JSON.stringify({ id: holdId, hold }),
              });
              setPolicy(await api<Policy>('retention'));
            })
          }
        >
          {hold ? 'Place hold' : 'Release hold'}
        </button>
      ))}
      <button
        disabled={busy}
        onClick={() => void run(async () => setOrphans(await api('retention?orphans=1')))}
      >
        Review unreferenced media candidates
      </button>
      {orphans && (
        <>
          <p>
            Up to 100 candidates older than seven days. Confirm retention and consent/audit
            requirements before any separate removal.
          </p>
          <ul>
            {orphans.map((v) => (
              <li key={v.id}>
                {v.filename} · {v.id}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
