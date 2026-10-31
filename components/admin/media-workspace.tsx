'use client';
import type * as Rows from '@/lib/types';
import { Image as ImageIcon } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
interface Props {
  section: string;
  editable: boolean;
  demo: boolean;
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
  setMessage: Dispatch<SetStateAction<string>>;
  api: Rows.StaffApi;
  load: () => Promise<void>;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  statusFilter: string;
  setStatusFilter: Dispatch<SetStateAction<string>>;
  media: Rows.MediaRow[];
  setChosenMedia: Dispatch<SetStateAction<Rows.MediaRow | null>>;
  setEditingMedia: Dispatch<SetStateAction<Partial<Rows.MediaRow>>>;
}
export default function MediaWorkspace({
  section,
  editable,
  demo,
  busy,
  run,
  setMessage,
  api,
  load,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  media,
  setChosenMedia,
  setEditingMedia,
}: Props) {
  return (
    <>
      {section === 'media' && (
        <section className="cms-card">
          <div className="cms-toolbar">
            <div>
              <h2>Private uploads. Reviewed public media.</h2>
              <p>Children’s images require guardian consent and a reference before approval.</p>
            </div>
            {editable && (
              <label className="btn green">
                Upload media
                <input
                  className="file-hidden"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4"
                  disabled={demo || busy}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []).slice(0, 10);
                    if (files.length)
                      void run(async () => {
                        for (const [index, f] of files.entries()) {
                          setMessage(
                            'Uploading ' + (index + 1) + ' / ' + files.length + ': ' + f.name + '…',
                          );
                          const form = new FormData();
                          form.append('file', f);
                          await api<Rows.MediaRow>('website-media', {
                            method: 'POST',
                            body: form,
                          });
                        }
                        await load();
                        setMessage(
                          'Uploaded privately. Complete rights and consent review before publication.',
                        );
                      });
                  }}
                />
              </label>
            )}
          </div>
          {editable && (
            <form
              className="video-registration"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(async () => {
                  await api<Rows.MediaRow>('website-media', {
                    method: 'POST',
                    body: JSON.stringify({
                      action: 'video',
                      title: f.get('title'),
                      url: f.get('url'),
                    }),
                  });
                  await load();
                  setMessage(
                    'Video registered privately. Submit its rights and guardian consent review before public use.',
                  );
                });
              }}
            >
              <h3>Add a portfolio video</h3>
              <div className="form-grid">
                <label>
                  Video title
                  <input name="title" required minLength={3} maxLength={180} />
                </label>
                <label>
                  YouTube or Vimeo URL
                  <input
                    name="url"
                    type="url"
                    required
                    placeholder="https://www.youtube.com/watch?v=…"
                  />
                </label>
              </div>
              <p className="fine">
                Use a YouTube watch / shorts link, youtu.be link or Vimeo numeric video link.
                Sharing parameters are removed automatically. MP4 files can also be uploaded (20 MB
                maximum). The external platform hosts the video.
              </p>
              <button className="btn outline small" disabled={demo || busy}>
                Add private video
              </button>
            </form>
          )}
          <div className="cms-toolbar">
            <input
              aria-label="Search media"
              placeholder="Find photographs, documents or videos…"
              maxLength={100}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              aria-label="Filter media status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {['All', 'Draft', 'Review', 'Approved', 'Rejected', 'Withdrawn'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>
          <div className="media-grid">
            {media
              .filter(
                (m) =>
                  (statusFilter === 'All' || m.status === statusFilter) &&
                  [m.filename, m.alt_text, m.caption]
                    .join(' ')
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((m) => (
                <button
                  key={m.id}
                  className="media-tile"
                  onClick={() => {
                    setChosenMedia(m);
                    setEditingMedia({ ...m });
                  }}
                >
                  <ImageIcon size={35} />
                  <strong>{m.filename}</strong>
                  <span>
                    {m.status} ·{' '}
                    {m.mime.startsWith('video/')
                      ? 'Video'
                      : m.mime === 'application/pdf'
                        ? 'Document'
                        : 'Photo'}
                  </span>
                  <small>
                    {m.shows_children ? 'Children / consent review' : 'General imagery'}
                  </small>
                </button>
              ))}
          </div>
          {!media.length && (
            <div className="cms-empty">
              No uploaded media. Original supplied photographs are preserved in the source-materials
              folder; children’s photos have not been added to public assets.
            </div>
          )}
        </section>
      )}
    </>
  );
}
