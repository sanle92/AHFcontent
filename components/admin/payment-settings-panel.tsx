'use client';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { Content } from '@/lib/content';
import type { Profile, StaffApi } from '@/lib/types';

const fields = [
  ['donate_intro', 'Donation page introduction'],
  ['donate_bank_name', 'Bank name'],
  ['donate_bank_account_name', 'Bank account name'],
  ['donate_bank_account_number', 'Bank account number'],
  ['donate_bank_branch', 'Bank branch'],
  ['donate_bank_swift', 'SWIFT / BIC'],
  ['donate_bank_currency', 'Account currency'],
  ['donate_bank_instructions', 'Bank transfer instructions'],
  ['donate_mtn_name', 'MTN merchant name'],
  ['donate_mtn_code', 'MTN merchant code'],
  ['donate_mtn_instructions', 'MTN instructions'],
  ['donate_airtel_name', 'Airtel merchant name'],
  ['donate_airtel_code', 'Airtel merchant code'],
  ['donate_airtel_instructions', 'Airtel instructions'],
] as const;
export default function PaymentSettingsPanel({
  api,
  profile,
  dirty,
  setDirty,
}: {
  api: StaffApi;
  profile: Profile | null;
  dirty: boolean;
  setDirty: Dispatch<SetStateAction<boolean>>;
}) {
  const [record, setRecord] = useState<Content | null>(null),
    [details, setDetails] = useState<Record<string, string>>({}),
    [loading, setLoading] = useState(true),
    [loadFailed, setLoadFailed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void api<Content[]>('editorial?view=website-settings')
      .then((rows) => {
        if (active) {
          setRecord(rows[0] || null);
          setDetails(rows[0]?.details || {});
        }
      })
      .catch(() => {
        if (active) {
          setLoadFailed(true);
          setError('Payment settings could not be loaded. Refresh this page before editing.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api]);
  const action = async (target?: string) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const body = target
        ? { action: 'transition', id: record?.id, version: record?.version, target }
        : {
            action: 'save',
            id: record?.id,
            version: record?.version,
            payload: {
              kind: 'page',
              slug: 'site-settings',
              title: record?.title || 'Foundation website settings',
              summary: record?.summary || '',
              body: record?.body || '',
              cover_id: record?.cover_id || null,
              details,
            },
          };
      const result = await api<Content>('editorial', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setRecord(result);
      setDetails(result.details);
      setDirty(false);
      setMessage(
        target
          ? 'Status updated to ' + target + '.'
          : 'Draft saved. Submit it for independent review.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const editable = !record || ['Draft', 'Returned'].includes(record.status || '');
  return (
    <section className="cms-card padded">
      <h2>Payment settings</h2>
      <p>
        Public bank and merchant details require administrator access and independent publication
        approval.
      </p>
      <p role="status">Status: {loading ? 'Loading…' : record?.status || 'Not created'}</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <fieldset className="editor-fields" disabled={loading || loadFailed || busy || !editable}>
        {fields.map(([key, label]) => (
          <label className="field" key={key}>
            {label}
            <input
              value={details[key] || ''}
              maxLength={1000}
              onChange={(e) => {
                setDetails((v) => ({ ...v, [key]: e.target.value }));
                setDirty(true);
              }}
            />
          </label>
        ))}
        <button type="button" className="btn green" onClick={() => void action()}>
          Save payment details
        </button>
      </fieldset>
      <div className="cms-actions">
        {record && editable && (
          <button
            type="button"
            className="btn outline"
            disabled={busy || dirty}
            onClick={() => void action('Review')}
          >
            Submit for review
          </button>
        )}
        {record?.status === 'Review' && record.created_by !== profile?.id && (
          <button
            type="button"
            className="btn green"
            disabled={busy}
            onClick={() => void action('Approved')}
          >
            Approve independently
          </button>
        )}
        {record?.status === 'Approved' && (
          <button
            type="button"
            className="btn green"
            disabled={busy}
            onClick={() => void action('Published')}
          >
            Publish approved details
          </button>
        )}
        {record &&
          ['Published', 'Scheduled', 'Approved', 'Archived'].includes(record.status || '') && (
            <button
              type="button"
              className="btn outline"
              disabled={busy}
              onClick={() => void action('Draft')}
            >
              Prepare an update
            </button>
          )}
      </div>
      {dirty && <p>Save your changes before submitting for review.</p>}
      <p className="fine">
        DPO checkout is not connected. Configure credentials only as server-side secrets; never
        enter them in these public fields.
      </p>
    </section>
  );
}
