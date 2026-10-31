'use client';
import type { Content } from '@/lib/content';
import type * as Rows from '@/lib/types';
import { X } from 'lucide-react';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { canPrepareMedia, mediaReviewRequirements } from '@/lib/media-review-requirements';
interface Props {
  chosenMedia: Rows.MediaRow | null;
  setSelected: Dispatch<SetStateAction<Content | null>>;
  setCreating: Dispatch<SetStateAction<boolean>>;
  setChosenMedia: Dispatch<SetStateAction<Rows.MediaRow | null>>;
  setSelectedEnquiry: Dispatch<SetStateAction<Rows.EnquiryRow | null>>;
  error: string;
  run: (fn: () => Promise<void>) => Promise<void>;
  api: Rows.StaffApi;
  editingMedia: Partial<Rows.MediaRow>;
  setEditingMedia: Dispatch<SetStateAction<Partial<Rows.MediaRow>>>;
  editable: boolean;
  busy: boolean;
  load: () => Promise<void>;
  publishable: boolean;
  profile: Rows.Profile | null;
  setMessage: Dispatch<SetStateAction<string>>;
}
export default function MediaReview({
  chosenMedia,
  setSelected,
  setCreating,
  setChosenMedia,
  setSelectedEnquiry,
  error,
  run,
  api,
  editingMedia,
  setEditingMedia,
  editable,
  busy,
  load,
  publishable,
  profile,
  setMessage,
}: Props) {
  const [impact, setImpact] = useState<{
    id: string;
    rows: { id: string; title: string; published_reference: boolean }[];
    error: string;
  }>({ id: '', rows: [], error: '' });
  const mediaId = chosenMedia?.id;
  const canPrepare = !!chosenMedia && canPrepareMedia(chosenMedia, profile, editable);
  const missing = mediaReviewRequirements(editingMedia);
  useEffect(() => {
    if (!mediaId) return;
    let active = true;
    const id = mediaId;
    void api<{ id: string; title: string; published_reference: boolean }[]>(
      'workspace?resource=references&id=' + id,
    )
      .then((rows) => {
        if (active) setImpact({ id, rows, error: '' });
      })
      .catch(() => {
        if (active)
          setImpact({
            id,
            rows: [],
            error: 'References could not be loaded. Withdrawal will still stop public file access.',
          });
      });
    return () => {
      active = false;
    };
  }, [api, mediaId]);
  return (
    <>
      {chosenMedia && (
        <div
          className="cms-dialog-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) {
              setSelected(null);
              setCreating(false);
              setChosenMedia(null);
              setSelectedEnquiry(null);
            }
          }}
        >
          <section className="cms-dialog" role="dialog" aria-modal="true" aria-label="Media review">
            <header>
              <h2>{chosenMedia.filename}</h2>
              <button
                disabled={busy}
                aria-label="Close media review"
                onClick={() => setChosenMedia(null)}
              >
                <X />
              </button>
            </header>
            <div className="cms-dialog-body">
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <button
                className="btn outline"
                onClick={() =>
                  void run(async () => {
                    const w = window.open('about:blank', '_blank');
                    try {
                      const v = await api<{ url: string }>('website-media?id=' + chosenMedia.id);
                      if (w) {
                        w.opener = null;
                        w.location.href = v.url;
                      }
                    } catch (e) {
                      w?.close();
                      throw e;
                    }
                  })
                }
              >
                Preview private file
              </button>
              <fieldset
                disabled={
                  busy || !canPrepare || !['Draft', 'Rejected'].includes(chosenMedia.status)
                }
                className="media-metadata"
              >
                <label className="field">
                  Alternative text
                  <input
                    value={editingMedia.alt_text || ''}
                    onChange={(e) => setEditingMedia((v) => ({ ...v, alt_text: e.target.value }))}
                  />
                </label>
                <label className="field">
                  Caption
                  <input
                    value={editingMedia.caption || ''}
                    onChange={(e) => setEditingMedia((v) => ({ ...v, caption: e.target.value }))}
                  />
                </label>
                {(['shows_children', 'rights_confirmed', 'guardian_consent'] as const).map((k) => (
                  <label key={k} className="checkbox">
                    <input
                      type="checkbox"
                      checked={!!editingMedia[k]}
                      onChange={(e) => setEditingMedia((v) => ({ ...v, [k]: e.target.checked }))}
                    />
                    {
                      {
                        shows_children: 'Shows children',
                        rights_confirmed: 'Rights to publish confirmed',
                        guardian_consent: 'Guardian consent for public use confirmed',
                      }[k]
                    }
                  </label>
                ))}
                <label className="field">
                  Consent / permission reference (private)
                  <textarea
                    value={editingMedia.consent_reference || ''}
                    onChange={(e) =>
                      setEditingMedia((v) => ({ ...v, consent_reference: e.target.value }))
                    }
                  />
                </label>
              </fieldset>
              {['Draft', 'Rejected'].includes(chosenMedia.status) && !canPrepare && (
                <p>
                  Ask the uploader or an administrator to complete the rights details and submit
                  this file for review.
                </p>
              )}
              {canPrepare &&
                ['Draft', 'Rejected'].includes(chosenMedia.status) &&
                missing.length > 0 && (
                  <div role="status">
                    <p>Complete these steps before sending this file for review:</p>
                    <ul>
                      {missing.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              {chosenMedia.status === 'Review' &&
                mediaReviewRequirements(chosenMedia).length > 0 && (
                  <p role="status">
                    Permission details are incomplete. Return this file to the uploader for
                    correction.
                  </p>
                )}
              {chosenMedia.status === 'Review' && chosenMedia.created_by === profile?.id && (
                <p role="status">A different publisher must review and approve your media.</p>
              )}
              <section className="editor-group">
                <h3>Where this file is used</h3>
                {impact.id === chosenMedia.id ? (
                  <>
                    {impact.error && <p role="status">{impact.error}</p>}
                    <ul>
                      {impact.rows.map((row) => (
                        <li key={row.id}>
                          {row.title} —{' '}
                          {row.published_reference ? 'published reference' : 'draft reference'}
                        </li>
                      ))}
                    </ul>
                    {!impact.rows.length && !impact.error && <p>No content references found.</p>}
                  </>
                ) : (
                  <p>Loading references…</p>
                )}
                <p className="fine">
                  Withdrawal stops new public authorization. Cached media can remain available for
                  up to five minutes.
                </p>
              </section>
              <div className="cms-actions">
                {canPrepare && ['Draft', 'Rejected'].includes(chosenMedia.status) && (
                  <button
                    className="btn green"
                    disabled={busy || missing.length > 0}
                    onClick={() =>
                      void run(async () => {
                        await api<Rows.MediaRow>('website-media', {
                          method: 'POST',
                          body: JSON.stringify({
                            id: chosenMedia.id,
                            version: chosenMedia.version,
                            target: 'Review',
                            payload: editingMedia,
                          }),
                        });
                        await load();
                        setChosenMedia(null);
                      })
                    }
                  >
                    Submit rights review
                  </button>
                )}
                {publishable &&
                  chosenMedia.status === 'Review' &&
                  chosenMedia.created_by !== profile?.id &&
                  ['Approved', 'Rejected'].map((target) => (
                    <button
                      key={target}
                      className="btn outline"
                      disabled={
                        busy ||
                        (target === 'Approved' && mediaReviewRequirements(chosenMedia).length > 0)
                      }
                      onClick={() =>
                        void run(async () => {
                          await api<Rows.MediaRow>('website-media', {
                            method: 'POST',
                            body: JSON.stringify({
                              id: chosenMedia.id,
                              version: chosenMedia.version,
                              target,
                            }),
                          });
                          await load();
                          setChosenMedia(null);
                        })
                      }
                    >
                      {target === 'Approved' ? 'Approve for public use' : 'Return media'}
                    </button>
                  ))}
                {publishable && chosenMedia.status === 'Approved' && (
                  <button
                    className="btn outline"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await api<Rows.MediaRow>('website-media', {
                          method: 'POST',
                          body: JSON.stringify({
                            id: chosenMedia.id,
                            version: chosenMedia.version,
                            target: 'Withdrawn',
                          }),
                        });
                        await load();
                        setChosenMedia(null);
                        setMessage(
                          'Media withdrawn from public access. Replace any affected covers.',
                        );
                      })
                    }
                  >
                    Withdraw public media
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
