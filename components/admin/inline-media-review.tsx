'use client';
import { useState } from 'react';
import type { MediaRow, StaffApi, Profile } from '@/lib/types';
import { canPrepareMedia, mediaReviewRequirements } from '@/lib/media-review-requirements';

export default function InlineMediaReview({
  media,
  api,
  profile,
  editable,
  publishable,
  busy,
  run,
  refresh,
}: {
  media: MediaRow;
  api: StaffApi;
  profile: Profile | null;
  editable: boolean;
  publishable: boolean;
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
  refresh: () => void;
}) {
  const [metadata, setMetadata] = useState(() => ({
    alt_text: media.alt_text || '',
    caption: media.caption || '',
    shows_children: media.shows_children,
    rights_confirmed: media.rights_confirmed,
    guardian_consent: media.guardian_consent,
    consent_reference: media.consent_reference || '',
  }));
  const canPrepare = canPrepareMedia(media, profile, editable);
  const missing = mediaReviewRequirements(metadata);
  const submit = (target: string) =>
    void run(async () => {
      await api<MediaRow>('website-media', {
        method: 'POST',
        body: JSON.stringify({
          id: media.id,
          version: media.version,
          target,
          ...(target === 'Review' ? { payload: metadata } : {}),
        }),
      });
      refresh();
    });
  return (
    <details className="editor-group">
      <summary>
        {media.filename} — {media.status}
      </summary>
      <p className="fine">
        Review the file and its permission details before approving public use.
      </p>
      <button
        type="button"
        className="btn outline small"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            const tab = window.open('about:blank', '_blank');
            try {
              const result = await api<{ url: string }>(
                'website-media?id=' + encodeURIComponent(media.id),
              );
              if (tab) {
                tab.opener = null;
                tab.location.href = result.url;
              }
            } catch (error) {
              tab?.close();
              throw error;
            }
          })
        }
      >
        Preview private file
      </button>
      {canPrepare && ['Draft', 'Rejected'].includes(media.status) && (
        <fieldset disabled={busy} className="media-metadata">
          <label className="field">
            Photo description / alternative text
            <input
              value={metadata.alt_text}
              onChange={(e) => setMetadata((v) => ({ ...v, alt_text: e.target.value }))}
            />
          </label>
          <label className="field">
            Caption
            <input
              value={metadata.caption}
              onChange={(e) => setMetadata((v) => ({ ...v, caption: e.target.value }))}
            />
          </label>
          {(['shows_children', 'rights_confirmed', 'guardian_consent'] as const).map((key) => (
            <label className="checkbox" key={key}>
              <input
                type="checkbox"
                checked={!!metadata[key]}
                onChange={(e) => setMetadata((v) => ({ ...v, [key]: e.target.checked }))}
              />
              {
                {
                  shows_children: 'Shows children',
                  rights_confirmed: 'Rights to publish confirmed',
                  guardian_consent: 'Guardian consent for public use confirmed',
                }[key]
              }
            </label>
          ))}
          <label className="field">
            Consent / permission reference (private)
            <textarea
              value={metadata.consent_reference}
              onChange={(e) => setMetadata((v) => ({ ...v, consent_reference: e.target.value }))}
            />
          </label>
          {missing.length > 0 && (
            <div role="status">
              <p>Complete these steps before sending this file for review:</p>
              <ul>
                {missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            className="btn green small"
            disabled={missing.length > 0}
            onClick={() => submit('Review')}
          >
            Submit media for review
          </button>
        </fieldset>
      )}
      {!canPrepare && ['Draft', 'Rejected'].includes(media.status) && (
        <p>
          Ask the uploader or an administrator to complete the rights details and submit this file
          for review.
        </p>
      )}
      {media.status === 'Review' && (
        <div>
          <p>
            <strong>Description:</strong> {media.alt_text || 'Not provided'}
          </p>
          <p>
            <strong>Publishing rights:</strong>{' '}
            {media.rights_confirmed ? 'Confirmed' : 'Not confirmed'}
          </p>
          <p>
            <strong>Shows children:</strong> {media.shows_children ? 'Yes' : 'No'}
          </p>
          {media.shows_children && (
            <p>
              <strong>Guardian consent:</strong>{' '}
              {media.guardian_consent ? 'Confirmed' : 'Not confirmed'}; reference:{' '}
              {media.consent_reference || 'Not provided'}
            </p>
          )}
          {mediaReviewRequirements(media).length > 0 && (
            <p>
              Permission details are incomplete. Return this file to the uploader for correction.
            </p>
          )}
        </div>
      )}
      {media.status === 'Review' && media.created_by === profile?.id && (
        <p>A different publisher must approve this media.</p>
      )}
      {publishable && media.status === 'Review' && media.created_by !== profile?.id && (
        <div className="cms-actions">
          <button
            type="button"
            className="btn green small"
            disabled={busy || mediaReviewRequirements(media).length > 0}
            onClick={() => submit('Approved')}
          >
            Approve media
          </button>
          <button
            type="button"
            className="btn outline small"
            disabled={busy}
            onClick={() => submit('Rejected')}
          >
            Return media
          </button>
        </div>
      )}
      {media.status === 'Approved' && <p>This file is approved for public use.</p>}
      {media.status === 'Withdrawn' && (
        <p>This file was withdrawn. Choose another file for this content.</p>
      )}
    </details>
  );
}
