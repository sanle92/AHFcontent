'use client';
import AppImage from './app-image';

import { useEffect, useRef, useState } from 'react';
export type Asset = { id: string; mime: string; alt_text: string; caption: string };
export function Gallery({ assets }: { assets: Asset[] }) {
  const [selected, setSelected] = useState<Asset | null>(null),
    dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (selected) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selected]);
  if (!assets.length) return null;
  return (
    <>
      <div className="portfolio-grid">
        {assets.map((a) => (
          <figure key={a.id}>
            <button onClick={() => setSelected(a)} aria-label={'Enlarge: ' + a.alt_text}>
              <AppImage src={'/media/' + a.id} alt={a.alt_text} loading="lazy" decoding="async" />
            </button>
            {a.caption && <figcaption>{a.caption}</figcaption>}
          </figure>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="lightbox"
        onCancel={() => setSelected(null)}
        onClose={() => setSelected(null)}
      >
        <button autoFocus className="btn cream small" onClick={() => setSelected(null)}>
          Close photograph ×
        </button>
        {selected && (
          <figure>
            <AppImage src={'/media/' + selected.id} alt={selected.alt_text} />
            <figcaption>{selected.caption}</figcaption>
          </figure>
        )}
      </dialog>
    </>
  );
}
export function ApprovedVideo({ id }: { id: string }) {
  const [video, setVideo] = useState<{
      embed?: string;
      src?: string;
      mime?: string;
      caption: string;
      alt_text: string;
    } | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <section className="approved-video">
      {video ? (
        <>
          {video.src ? (
            <video
              controls
              playsInline
              preload="none"
              src={video.src}
              aria-label={video.alt_text}
            />
          ) : (
            <iframe
              src={video.embed}
              title={video.alt_text}
              allow="fullscreen; picture-in-picture"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )}
          <p>{video.caption}</p>
        </>
      ) : (
        <>
          <p className="eyebrow">WATCH THE STORY</p>
          <button
            className="btn green"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await fetch('/api/public-video?id=' + encodeURIComponent(id), {
                  cache: 'no-store',
                });
                if (!r.ok) throw Error('This video is not currently available.');
                setVideo(await r.json());
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Opening…' : '▶ Play approved video'}
          </button>
          <p className="fine">
            Uploaded videos play here. External videos load from YouTube or Vimeo only when you
            press play; their privacy terms apply.
          </p>
          {error && <p role="alert">{error}</p>}
        </>
      )}
    </section>
  );
}
