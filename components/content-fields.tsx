'use client';
import { useState } from 'react';
import type { MediaRow } from '@/lib/types';
import MediaThumbnail from './admin/media-thumbnail';
import type { Content, Kind } from '@/lib/content';
import { ids, updates } from '@/lib/editorial';
type Media = { id: string; filename: string; mime: string; status: string; alt_text: string };
export default function ContentFields({
  kind,
  item,
  items,
  media,
  kids = false,
  onUpload,
  onSelectionChange,
  onPreview,
  onRegisterVideo,
}: {
  kind: Kind;
  item?: Content | null;
  items: Content[];
  media: Media[];
  kids?: boolean;
  onUpload?: (file: File) => Promise<MediaRow>;
  onSelectionChange?: () => void;
  onPreview?: (id: string) => Promise<string>;
  onRegisterVideo?: (title: string, url: string) => Promise<MediaRow>;
}) {
  const d = item?.details || {},
    [gallery, setGallery] = useState(ids(d.gallery)),
    [entries, setEntries] = useState(updates(d.updates)),
    [video, setVideo] = useState(d.video_id || ''),
    [uploaded, setUploaded] = useState<MediaRow[]>([]),
    [uploading, setUploading] = useState(false),
    [uploadMessage, setUploadMessage] = useState(''),
    [videoTitle, setVideoTitle] = useState(''),
    [videoUrl, setVideoUrl] = useState('');
  const available = [...media, ...uploaded.filter((row) => !media.some((m) => m.id === row.id))];
  const input = (key: string, label: string, type = 'text', hint = '') => (
    <label className="field" key={key}>
      {label}
      <input
        name={key}
        type={type}
        step={type === 'number' ? (key === 'capacity' ? '1' : '0.01') : undefined}
        min={type === 'number' ? '0' : undefined}
        defaultValue={d[key]}
        maxLength={1000}
      />
      {hint && <small>{hint}</small>}
    </label>
  );
  const area = (key: string, label: string) => (
    <label className="field" key={key}>
      {label}
      <textarea name={key} defaultValue={d[key]} maxLength={3000} />
    </label>
  );
  const select = (key: string, label: string, options: string[]) => (
    <label className="field" key={key}>
      {label}
      <select name={key} defaultValue={d[key] || options[0]}>
        {options.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      {kind === 'programme' && (
        <details className="editor-group">
          <summary>Programme information</summary>
          {select('programme_status', 'Programme stage', [
            'Programme area',
            'Planned',
            'Active',
            'Completed',
          ])}
          {area('objectives', 'Objectives')}
          {area('activities', 'Activities')}
          {area('participation', 'Participation / parent enquiry information')}
        </details>
      )}
      {['story', 'campaign', 'programme'].includes(kind) && (
        <details className="editor-group" open={kind === 'campaign' || kind === 'story'}>
          <summary>Donation links and support</summary>
          <p className="fine">
            Add a verified fundraising link or choose an existing published campaign.
          </p>
          <label className="field">
            Related giving campaign
            <select name="campaign_id" defaultValue={d.campaign_id || ''}>
              <option value="">None</option>
              {items
                .filter((i) => i.kind === 'campaign' && i.id !== item?.id)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.title}
                  </option>
                ))}
            </select>
          </label>
          {select('campaign_status', 'Support status', ['Active', 'Paused', 'Completed'])}
          {input(
            'button_label',
            'Button wording',
            'text',
            'For example: Help this family, Support a creative activity',
          )}
          {input('pillar_url', 'Pillar.io campaign URL', 'url')}
          {input('spotfund_url', 'Spotfund campaign URL', 'url')}
          {input('gofundme_url', 'GoFundMe campaign URL', 'url')}
          {kind === 'campaign' && (
            <>
              {input('currency', 'Currency (for example UGX)')}
              <div className="form-grid">
                {input('target', 'Target', 'number')}
                {input('raised', 'Raised (manual figure)', 'number')}
              </div>
              {input('figures_date', 'Figures checked on', 'date')}
              <p className="fine">
                Only publish verified figures. Amounts are not synchronised with fundraising
                platforms.
              </p>
            </>
          )}
        </details>
      )}
      {['story', 'campaign', 'programme'].includes(kind) && (
        <details className="editor-group">
          <summary>Dated progress updates</summary>
          {JSON.stringify(entries).length > 6000 && (
            <p role="alert" className="error">
              Progress updates exceed the combined 6,000-character limit. Shorten them before
              saving.
            </p>
          )}
          <p className="fine">
            Updates: {JSON.stringify(entries).length}/6,000 characters including dates and
            formatting.
          </p>
          <input type="hidden" name="updates" value={JSON.stringify(entries)} />
          {entries.map((u, i) => (
            <div className="update-editor" key={i}>
              <input
                aria-label={'Update date ' + (i + 1)}
                type="date"
                required
                value={u.date}
                onChange={(e) =>
                  setEntries((v) => v.map((x, n) => (n === i ? { ...x, date: e.target.value } : x)))
                }
              />
              <textarea
                aria-label={'Update text ' + (i + 1)}
                required
                maxLength={1500}
                value={u.text}
                onChange={(e) =>
                  setEntries((v) => v.map((x, n) => (n === i ? { ...x, text: e.target.value } : x)))
                }
              />
              <button
                type="button"
                data-dirty
                onClick={() => setEntries((v) => v.filter((_, n) => n !== i))}
              >
                Remove update
              </button>
            </div>
          ))}
          <button
            type="button"
            data-dirty
            className="btn outline small"
            disabled={entries.length >= 12}
            onClick={() =>
              setEntries((v) => [
                ...v,
                {
                  date: new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' }),
                  text: '',
                },
              ])
            }
          >
            Add progress update
          </button>
        </details>
      )}
      {kind === 'event' && (
        <details className="editor-group">
          <summary>Event arrangements</summary>
          <label className="field">
            End date/time (Kampala)
            <input
              type="datetime-local"
              name="end_date"
              defaultValue={d.end_date?.replace(/\+03:00$/, '').slice(0, 16)}
            />
          </label>
          {select('event_status', 'Event status', [
            'Scheduled',
            'Postponed',
            'Cancelled',
            'Completed',
          ])}
          {input('capacity', 'Capacity (optional)', 'number')}
          {input('registration_url', 'External registration URL (optional)', 'url')}
          {area('participation', 'Who can take part / registration information')}
        </details>
      )}
      {kind === 'story' && (
        <details className="editor-group">
          <summary>Who this story helps</summary>
          {select('category', 'Story category', ['Foundation update', 'Personal help'])}
          <p className="fine">
            Personal-help stories appear on Home and Stories. Add approved media and a related
            campaign or verified giving links.
          </p>
        </details>
      )}
      {kind === 'report' && (
        <details className="editor-group">
          <summary>Document information</summary>
          {select('category', 'Document category', [
            'Report',
            'Policy',
            'Safeguarding',
            'Financial summary',
            'Registration update',
          ])}
          {input('reporting_period', 'Reporting period')}
          {input('document_version', 'Document version')}
        </details>
      )}
      {kind === 'product' && (
        <details className="editor-group">
          <summary>Shop for Hope</summary>
          {area('variants', 'Sizes, colours and options (one per line)')}
          {select('availability', 'Availability', [
            'Enquire',
            'Available',
            'Pre-order',
            'Out of stock',
          ])}
          {area('fulfilment', 'Collection / delivery arrangements')}
          {area('proceeds', 'How sales support AHF')}
          <p className="fine">
            This is an order request, not paid checkout. Confirm stock, totals and fulfilment before
            accepting payment.
          </p>
        </details>
      )}
      {kind === 'page' && item?.slug === 'site-settings' && (
        <details className="editor-group">
          <summary>Confirmed foundation details</summary>
          {input('contact_email', 'Official public email', 'email')}
          {input('contact_phone', 'Official public telephone', 'tel')}
          {area('contact_address', 'Official public address')}
          {input('facebook_url', 'Facebook URL', 'url')}
          {input('instagram_url', 'Instagram URL', 'url')}
          {input('linkedin_url', 'LinkedIn URL', 'url')}
          {area('confirmation_message', 'Enquiry confirmation message (plain text)')}
        </details>
      )}
      {kind === 'page' && item?.slug === 'site-settings' && (
        <details className="editor-group">
          <summary>Donate page: bank and mobile money</summary>
          <p className="fine">
            These details become public only after independent approval and publication. Enter only
            verified public payment details.
          </p>
          {area('donate_intro', 'Donate page introduction')}
          <h3>Bank transfer</h3>
          {input('donate_bank_name', 'Bank name')}
          {input('donate_bank_account_name', 'Account name')}
          {input('donate_bank_account_number', 'Account number')}
          {input('donate_bank_branch', 'Branch (optional)')}
          {input('donate_bank_swift', 'SWIFT / BIC (optional)')}
          {input('donate_bank_currency', 'Account currency (optional)')}
          {area('donate_bank_instructions', 'Bank transfer instructions')}
          <h3>MTN MoMo merchant</h3>
          {input('donate_mtn_name', 'MTN merchant name')}
          {input('donate_mtn_code', 'MTN merchant code')}
          {area('donate_mtn_instructions', 'MTN payment instructions')}
          <h3>Airtel Money merchant</h3>
          {input('donate_airtel_name', 'Airtel merchant name')}
          {input('donate_airtel_code', 'Airtel merchant code')}
          {area('donate_airtel_instructions', 'Airtel payment instructions')}
          <p className="fine">
            DPO online checkout is not active yet. Do not enter payment provider secrets here.
          </p>
        </details>
      )}
      <details className="editor-group">
        <summary>Advanced: organisation and search</summary>
        <div className="form-grid">
          <label className="field">
            Workspace
            <select name="scope" defaultValue={d.scope || (kids ? 'aminia-kids' : 'foundation')}>
              <option value="foundation">Foundation</option>
              <option value="aminia-kids">Aminia Kids</option>
            </select>
          </label>
          {input('activity', 'Activity / collection label')}
        </div>
        <label className="field">
          Related programme
          <select name="programme_id" defaultValue={d.programme_id || ''}>
            <option value="">None</option>
            {items
              .filter((i) => i.kind === 'programme' && i.id !== item?.id)
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
          </select>
        </label>
        {input('seo_title', 'Search title')}
        {area('seo_description', 'Search description')}
      </details>
      {kind !== 'report' && (
        <details className="editor-group" data-uploading={uploading || undefined}>
          <summary>Add gallery photos or a video</summary>
          <label className="field">
            Featured video (draft or approved)
            <select
              name="video_id"
              value={video}
              onChange={(e) => {
                setVideo(e.target.value);
                onSelectionChange?.();
              }}
            >
              <option value="">No featured video</option>
              {available
                .filter((m) => m.status !== 'Withdrawn' && m.mime.startsWith('video/'))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.filename}
                  </option>
                ))}
            </select>
          </label>
          {onRegisterVideo && (
            <div className="editor-group">
              <h4>Add a YouTube or Vimeo link</h4>
              <label className="field">
                Video title
                <input
                  value={videoTitle}
                  maxLength={180}
                  onChange={(e) => setVideoTitle(e.target.value)}
                />
              </label>
              <label className="field">
                Video link
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                />
              </label>
              <button
                type="button"
                className="btn outline small"
                disabled={uploading || videoTitle.trim().length < 3 || !videoUrl.trim()}
                onClick={async () => {
                  setUploading(true);
                  setUploadMessage('Adding video link…');
                  try {
                    const row = await onRegisterVideo(videoTitle.trim(), videoUrl.trim());
                    setUploaded((previous) => [...previous, row]);
                    setVideo(row.id);
                    onSelectionChange?.();
                    setVideoTitle('');
                    setVideoUrl('');
                    setUploadMessage(
                      'Video added privately. Save the draft, then complete consent and independent review.',
                    );
                  } catch (error) {
                    setUploadMessage((error as Error).message);
                  } finally {
                    setUploading(false);
                  }
                }}
              >
                Add video link
              </button>
            </div>
          )}
          {onUpload && (
            <label className="field">
              Upload a photo or MP4 video directly
              <input
                type="file"
                disabled={uploading}
                accept="image/jpeg,image/png,image/webp,video/mp4"
                onChange={async (event) => {
                  const input = event.currentTarget,
                    file = input.files?.[0];
                  if (!file) return;
                  if (file.type.startsWith('image/') && gallery.length >= 40) {
                    setUploadMessage('The gallery can contain up to 40 photos.');
                    input.value = '';
                    return;
                  }
                  setUploading(true);
                  setUploadMessage('Uploading… Please keep this form open.');
                  try {
                    const row = await onUpload(file);
                    setUploaded((previous) => [...previous, row]);
                    if (row.mime.startsWith('video/')) setVideo(row.id);
                    else setGallery((previous) => [...previous, row.id]);
                    onSelectionChange?.();
                    setUploadMessage(
                      'Uploaded and added to this draft. Save it, then complete media consent and independent review.',
                    );
                  } catch (error) {
                    setUploadMessage((error as Error).message);
                  } finally {
                    setUploading(false);
                    input.value = '';
                  }
                }}
              />
            </label>
          )}
          {onUpload && (
            <label className="field">
              Upload several photos
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={uploading}
                onChange={async (event) => {
                  const input = event.currentTarget;
                  const files = Array.from(input.files || []);
                  if (!files.length) return;
                  if (files.length > 40 - gallery.length) {
                    setUploadMessage(
                      `You can add ${40 - gallery.length} more photos to this gallery.`,
                    );
                    input.value = '';
                    return;
                  }
                  setUploading(true);
                  const failures: string[] = [];
                  let added = 0;
                  try {
                    for (const [index, file] of files.entries()) {
                      setUploadMessage(
                        `Uploading photo ${index + 1} of ${files.length}… Please keep this form open.`,
                      );
                      try {
                        const row = await onUpload(file);
                        if (!row.mime.startsWith('image/')) {
                          failures.push(file.name + ': not a supported photo');
                          continue;
                        }
                        setUploaded((previous) => [...previous, row]);
                        setGallery((previous) => [...previous, row.id]);
                        onSelectionChange?.();
                        added++;
                      } catch {
                        failures.push(file.name);
                      }
                    }
                    setUploadMessage(
                      `${added} of ${files.length} photos added. ${failures.length ? 'Could not add: ' + failures.join(', ') + '. ' : ''}Save the draft, then complete media consent and independent review.`,
                    );
                  } finally {
                    setUploading(false);
                    input.value = '';
                  }
                }}
              />
            </label>
          )}
          <p className="fine">
            Photos up to 10 MB; MP4 videos up to 20 MB. Save the draft after uploading.
          </p>
          {uploadMessage && <p role="status">{uploadMessage}</p>}
          <input type="hidden" name="gallery" value={JSON.stringify(gallery)} />
          <p className="fine">
            Choose up to 40 photographs for this draft. All must be approved before submission. Use
            arrows to arrange the album.
          </p>
          <div className="gallery-picker">
            {gallery.map((id, i) => (
              <div key={id}>
                {onPreview && (
                  <div className="gallery-thumbnail">
                    <MediaThumbnail
                      id={id}
                      name={available.find((m) => m.id === id)?.alt_text || 'Photo preview'}
                      preview={onPreview}
                    />
                  </div>
                )}
                <span>
                  {available.find((m) => m.id === id)?.filename || 'Previously selected media'} —{' '}
                  {available.find((m) => m.id === id)?.status || 'status unavailable'}
                </span>
                <button
                  type="button"
                  data-dirty
                  disabled={i === 0}
                  aria-label="Move photo earlier"
                  onClick={() =>
                    setGallery((v) => {
                      const a = [...v];
                      [a[i - 1], a[i]] = [a[i], a[i - 1]];
                      return a;
                    })
                  }
                >
                  ↑
                </button>
                <button
                  type="button"
                  data-dirty
                  aria-label="Remove photo"
                  onClick={() => setGallery((v) => v.filter((x) => x !== id))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <select
            aria-label="Add approved photo to gallery"
            value=""
            onChange={(e) => e.target.value && setGallery((v) => [...v, e.target.value])}
            disabled={gallery.length >= 40}
          >
            <option value="">Add draft / approved photo…</option>
            {available
              .filter(
                (m) =>
                  m.status !== 'Withdrawn' &&
                  m.mime.startsWith('image/') &&
                  !gallery.includes(m.id),
              )
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.filename} — {m.alt_text}
                </option>
              ))}
          </select>
        </details>
      )}
    </>
  );
}
