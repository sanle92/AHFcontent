'use client';
import AppImage from './app-image';
import AppLink from './app-link';

import type * as Rows from '@/lib/types';
import { useEffect, useState } from 'react';
export default function CoverPicker({
  media,
  value,
  report,
  disabled,
  onUpload,
  onPreview,
  onSelectionChange,
}: {
  media: Rows.MediaRow[];
  value: string;
  report: boolean;
  disabled: boolean;
  onUpload: (f: File) => Promise<Rows.MediaRow>;
  onPreview: (id: string) => Promise<string>;
  onSelectionChange: () => void;
}) {
  const [selected, setSelected] = useState(value),
    [feedback, setFeedback] = useState(''),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<{
      id: string;
      attempt: number;
      url: string;
      error: string;
    } | null>(null),
    [progress, setProgress] = useState(0),
    [uploaded, setUploaded] = useState<Rows.MediaRow | null>(null),
    [previewAttempt, setPreviewAttempt] = useState(0);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    void Promise.resolve()
      .then(() => onPreview(selected))
      .then(
        (url) => {
          if (active) setPreview({ id: selected, attempt: previewAttempt, url, error: '' });
        },
        (error: Error) => {
          if (active)
            setPreview({ id: selected, attempt: previewAttempt, url: '', error: error.message });
        },
      );
    return () => {
      active = false;
    };
  }, [selected, onPreview, previewAttempt]);
  const choose = (id: string) => {
    setFeedback('');
    setSelected(id);
    onSelectionChange();
    setPreviewAttempt((attempt) => attempt + 1);
  };
  const files = uploaded && !media.some((m) => m.id === uploaded.id) ? [...media, uploaded] : media;
  useEffect(() => {
    const listener = (e: Event) => setProgress((e as CustomEvent<number>).detail);
    window.addEventListener('ahf-upload-progress', listener);
    return () => window.removeEventListener('ahf-upload-progress', listener);
  }, []);
  const currentPreview =
    preview?.id === selected && preview.attempt === previewAttempt ? preview : null;
  const selectedFile = files.find((m) => m.id === selected);
  const options = files.filter(
    (m) =>
      m.status !== 'Withdrawn' &&
      (m.mime.startsWith('image/') || (report && m.mime === 'application/pdf')),
  );
  return (
    <fieldset className="editor-group" data-uploading={busy || undefined}>
      <legend>Cover image {report ? 'or document' : ''}</legend>
      <select
        name="cover_id"
        aria-label="Choose cover for draft"
        value={selected}
        disabled={disabled || busy}
        onChange={(e) => choose(e.target.value)}
      >
        <option value="">No uploaded cover</option>
        {options.map((m) => (
          <option key={m.id} value={m.id}>
            {m.filename} — {m.status}
          </option>
        ))}
      </select>
      {selected && (
        <div className="cover-preview">
          {currentPreview?.url && selectedFile?.mime.startsWith('image/') && (
            <AppImage
              src={currentPreview.url}
              alt={selectedFile.alt_text || 'Private cover preview'}
            />
          )}
          {currentPreview?.url && selectedFile?.mime === 'application/pdf' && (
            <AppLink href={currentPreview.url} target="_blank" rel="noopener noreferrer">
              Open private document ↗
            </AppLink>
          )}
          {!currentPreview && <p role="status">Loading private cover preview…</p>}
          {currentPreview?.error && <p role="alert">{currentPreview.error}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={() => setPreviewAttempt((attempt) => attempt + 1)}
          >
            Reload preview
          </button>
          <button type="button" disabled={disabled || busy} onClick={() => choose('')}>
            Remove selection
          </button>
        </div>
      )}
      <label className="field">
        Upload a new photo or document
        <input
          disabled={disabled || busy}
          type="file"
          accept={
            report
              ? 'image/jpeg,image/png,image/webp,application/pdf'
              : 'image/jpeg,image/png,image/webp'
          }
          onChange={async (e) => {
            const input = e.currentTarget,
              f = input.files?.[0];
            if (!f) return;
            setBusy(true);
            setProgress(0);
            setFeedback('Uploading ' + f.name + '… Please keep this form open.');
            try {
              const row = await onUpload(f);
              if (row?.id) {
                setUploaded(row);
                choose(row.id);
              }
              setFeedback(
                'Uploaded and attached to this draft. Save your draft, then complete Media & consent review before submitting for publication.',
              );
            } catch (err) {
              setFeedback((err as Error).message);
            } finally {
              setBusy(false);
              input.value = '';
            }
          }}
        />
      </label>
      <p className="fine">
        JPG, PNG or WebP up to 10 MB. Private media can be saved in drafts; approval is required
        before review or publication. iPhone HEIC photos must be exported as JPEG.
      </p>
      {busy && (
        <label>
          Upload progress
          <progress max={100} value={progress} />
          {progress === 100 ? 'Processing securely…' : progress + '%'}
        </label>
      )}
      {feedback && <p role="status">{feedback}</p>}
    </fieldset>
  );
}
