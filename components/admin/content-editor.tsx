'use client';
import type { Content, Kind } from '@/lib/content';
import type * as Rows from '@/lib/types';
import { publicationBlockers } from '@/lib/publication-readiness';
import { useContentReadiness } from '@/hooks/use-content-readiness';
import { X } from 'lucide-react';
import {
  useCallback,
  useState,
  useRef,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';
import ContentFields from '../content-fields';
import CoverPicker from '../cover-picker';
import InlineMediaReview from './inline-media-review';
interface Props {
  ready: boolean;
  dirty: boolean;
  setDirty: Dispatch<SetStateAction<boolean>>;
  onClose: () => void;
  selected: Content | null;
  creating: boolean;
  section: string;
  error: string;
  setPreview: Dispatch<SetStateAction<boolean>>;
  preview: boolean;
  save: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  api: Rows.StaffApi;
  media: Rows.MediaRow[];
  demo: boolean;
  busy: boolean;
  editable: boolean;
  load: () => Promise<void>;
  loadChoices?: (query: string, page: number, selected: string[]) => Promise<boolean>;
  items: Content[];
  kids: boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
  setMessage: Dispatch<SetStateAction<string>>;
  message: string;
  note: string;
  setNote: Dispatch<SetStateAction<string>>;
  transition: (target: string) => void;
  publishable: boolean;
  profile: Rows.Profile | null;
  schedule: string;
  setSchedule: Dispatch<SetStateAction<string>>;
  revisions: Rows.RevisionRow[];
  open: (item: Content) => void;
}
export default function ContentEditor({
  ready,
  dirty,
  setDirty,
  onClose,
  selected,
  creating,
  section,
  error,
  setPreview,
  preview,
  save,
  api,
  media,
  demo,
  busy,
  editable,
  load,
  loadChoices,
  items,
  kids,
  run,
  setMessage,
  message,
  note,
  setNote,
  transition,
  publishable,
  profile,
  schedule,
  setSchedule,
  revisions,
  open,
}: Props) {
  const form = useRef<HTMLFormElement>(null);
  const [slug, setSlug] = useState(selected?.slug || '');
  const slugEdited = useRef(!!selected?.slug);
  const [choiceQuery, setChoiceQuery] = useState(''),
    [choicePage, setChoicePage] = useState(0),
    [choicesMore, setChoicesMore] = useState(true);
  const searchChoices = async (page: number) => {
    if (!loadChoices) return;
    const values = form.current ? new FormData(form.current) : null;
    let gallery: string[] = [];
    try {
      gallery = JSON.parse(String(values?.get('gallery') || '[]'));
    } catch {}
    const selected = [
      values?.get('cover_id'),
      values?.get('video_id'),
      values?.get('programme_id'),
      values?.get('campaign_id'),
      ...gallery,
    ].filter((v): v is string => typeof v === 'string' && !!v);
    setChoicesMore(await loadChoices(choiceQuery, page, selected));
    readiness.refresh();
    setChoicePage(page);
  };
  const mayEdit =
    editable &&
    (!selected ||
      selected.created_by === profile?.id ||
      !!profile?.roles.includes('administrator'));
  const readiness = useContentReadiness(api, selected?.id, selected?.version, !demo);
  const editorMedia = media.map((row) => {
    const latest = (readiness.media || []).find((value) => value.id === row.id);
    return latest && latest.version >= row.version ? latest : row;
  });
  const blockers = demo ? publicationBlockers(selected, media) : readiness.blockers;
  const previewCover = useCallback(
    async (id: string) =>
      (await api<{ url: string }>('website-media?id=' + encodeURIComponent(id))).url,
    [api],
  );
  return (
    <>
      {(selected || creating) && (
        <div
          className="cms-dialog-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
        >
          <section
            className="cms-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Content editor"
          >
            <header>
              <h2>{creating ? 'New ' + section : selected?.title}</h2>
              <button aria-label="Close editor" onClick={onClose}>
                <X size={22} />
              </button>
            </header>
            <div className="cms-dialog-body compact-editor">
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              {selected && !mayEdit && (
                <p role="status">
                  Read-only for your account. Only the author or an administrator can edit and
                  submit this draft; publishers can independently review it.
                </p>
              )}
              {creating && (
                <p role="status">
                  First save the draft with your selected files. Then complete the media review
                  checklist below the saved form.
                </p>
              )}
              {selected && (
                <div className="cms-actions">
                  <span className="cms-badge">
                    {selected.effective_status || selected.status || 'Provided content'}
                  </span>
                  <button
                    className="btn outline small"
                    disabled={dirty}
                    onClick={() => setPreview(!preview)}
                  >
                    {preview ? 'Show editor' : 'Preview text'}
                  </button>
                </div>
              )}
              {!demo && loadChoices && (
                <details className="editor-group">
                  <summary>Find more media and linked records</summary>
                  <div className="cms-toolbar">
                    <label>
                      Search
                      <input
                        value={choiceQuery}
                        maxLength={100}
                        onChange={(e) => setChoiceQuery(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => searchChoices(0))}
                    >
                      Search choices
                    </button>
                    <button
                      type="button"
                      disabled={busy || choicePage === 0}
                      onClick={() => void run(() => searchChoices(choicePage - 1))}
                    >
                      Previous choices
                    </button>
                    <button
                      type="button"
                      disabled={busy || !choicesMore}
                      onClick={() => void run(() => searchChoices(choicePage + 1))}
                    >
                      More choices
                    </button>
                    <span>Page {choicePage + 1}; current selections stay available.</span>
                  </div>
                </details>
              )}
              {selected?.live_since && (
                <p role="status">
                  Current public version live since{' '}
                  {new Date(selected.live_since).toLocaleString('en-GB', {
                    timeZone: 'Africa/Kampala',
                  })}{' '}
                  (Kampala).
                </p>
              )}
              {preview ? (
                <article className="prose">
                  <h2>{selected?.title}</h2>
                  <p>{selected?.summary}</p>
                  {selected?.body.split('\n\n').map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </article>
              ) : !ready ? (
                <p role="status">Loading editor choices…</p>
              ) : (
                <form
                  ref={form}
                  onChange={() => setDirty(true)}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('[data-dirty]')) setDirty(true);
                  }}
                  onSubmit={save}
                  onInvalidCapture={(event) => {
                    let section = (event.target as HTMLElement).closest('details');
                    while (section) {
                      section.open = true;
                      section = section.parentElement?.closest('details') || null;
                    }
                  }}
                  key={(selected?.id || 'new') + '-' + selected?.version}
                >
                  <fieldset
                    className="editor-fields"
                    disabled={
                      !mayEdit ||
                      busy ||
                      (!!selected && !['Draft', 'Returned'].includes(selected.status || ''))
                    }
                  >
                    <h3>1. Add your information</h3>
                    <p className="fine">
                      Start with a title and the information visitors need to understand your work.
                    </p>
                    <label className="field">
                      Title
                      <input
                        required
                        name="title"
                        defaultValue={selected?.title}
                        onChange={(event) => {
                          if (creating && !slugEdited.current)
                            setSlug(
                              event.target.value
                                .normalize('NFKD')
                                .replace(/[\u0300-\u036f]/g, '')
                                .toLowerCase()
                                .replace(/[^a-z0-9]+/g, '-')
                                .replace(/^-+|-+$/g, '')
                                .slice(0, 100)
                                .replace(/-+$/, ''),
                            );
                        }}
                        minLength={3}
                        maxLength={180}
                      />
                    </label>
                    <label className="field">
                      Website address (created from the title; you can edit it)
                      <input
                        required
                        name="slug"
                        {...(creating
                          ? {
                              value:
                                selected?.id === '' && selected.slug === 'site-settings'
                                  ? 'site-settings'
                                  : slug,
                            }
                          : { defaultValue: selected?.slug })}
                        onChange={(event) => {
                          slugEdited.current = true;
                          setSlug(event.target.value);
                        }}
                        pattern="[a-z0-9]+(-[a-z0-9]+)*"
                        maxLength={100}
                      />
                    </label>
                    <label className="field">
                      Introduction / description
                      <textarea name="summary" defaultValue={selected?.summary} maxLength={1000} />
                    </label>
                    <label className="field">
                      Body (paragraphs)
                      <textarea
                        className="content-body"
                        name="body"
                        defaultValue={selected?.body}
                        maxLength={30000}
                      />
                    </label>
                  </fieldset>
                  <h3>2. Add a cover photo</h3>
                  <CoverPicker
                    onSelectionChange={() => setDirty(true)}
                    onPreview={previewCover}
                    media={editorMedia}
                    value={selected?.cover_id || ''}
                    report={section === 'report'}
                    disabled={
                      demo ||
                      busy ||
                      !mayEdit ||
                      (!!selected && !['Draft', 'Returned'].includes(selected.status || ''))
                    }
                    onUpload={async (f) => {
                      const form = new FormData();
                      form.append('file', f);
                      const row = await api<Rows.MediaRow>('website-media', {
                        method: 'POST',
                        body: form,
                      });
                      try {
                        await load();
                      } catch {
                        setMessage(
                          'Your file uploaded successfully. The media list could not refresh; try refreshing it later.',
                        );
                      }
                      return row;
                    }}
                  />
                  <fieldset
                    className="editor-fields"
                    disabled={
                      !mayEdit ||
                      busy ||
                      (!!selected && !['Draft', 'Returned'].includes(selected.status || ''))
                    }
                  >
                    {section === 'page' && (
                      <>
                        <label className="field">
                          Vision
                          <textarea name="vision" defaultValue={selected?.details.vision} />
                        </label>
                        <label className="field">
                          Mission
                          <textarea name="mission" defaultValue={selected?.details.mission} />
                        </label>
                      </>
                    )}
                    {section === 'event' && (
                      <div className="form-grid">
                        <label className="field">
                          Event date/time (Kampala)
                          <input
                            type="datetime-local"
                            name="date"
                            defaultValue={selected?.details.date
                              ?.replace(/\+03:00$/, '')
                              .slice(0, 16)}
                          />
                        </label>
                        <label className="field">
                          Venue
                          <input name="location" defaultValue={selected?.details.location} />
                        </label>
                      </div>
                    )}
                    <h3>3. Add useful details</h3>
                    <ContentFields
                      kind={selected?.kind || (section as Kind)}
                      item={selected}
                      items={items}
                      media={editorMedia}
                      kids={kids}
                      onSelectionChange={() => setDirty(true)}
                      onPreview={previewCover}
                      onRegisterVideo={async (title, url) =>
                        await api<Rows.MediaRow>('website-media', {
                          method: 'POST',
                          body: JSON.stringify({ action: 'video', title, url }),
                        })
                      }
                      onUpload={async (file) => {
                        const form = new FormData();
                        form.append('file', file);
                        return await api<Rows.MediaRow>('website-media', {
                          method: 'POST',
                          body: form,
                        });
                      }}
                    />
                    <details className="editor-group">
                      <summary>More options: link and image caption</summary>
                      <label className="field">
                        Document / external details link (HTTPS)
                        <input
                          type="url"
                          pattern="https://.*"
                          name="link"
                          defaultValue={selected?.details.link}
                        />
                      </label>
                      <label className="field">
                        Image caption / description
                        <input name="caption" defaultValue={selected?.details.caption} />
                      </label>
                    </details>
                    {section === 'product' && (
                      <div className="form-grid">
                        <label className="field">
                          Price (display only)
                          <input name="price" defaultValue={selected?.details.price} />
                        </label>
                        <label className="field">
                          Currency
                          <input
                            name="currency"
                            defaultValue={selected?.details.currency || 'UGX'}
                          />
                        </label>
                      </div>
                    )}
                    <button
                      className="btn green"
                      disabled={
                        demo ||
                        busy ||
                        !mayEdit ||
                        (!!selected && !['Draft', 'Returned'].includes(selected.status || ''))
                      }
                    >
                      Save draft
                    </button>
                  </fieldset>
                </form>
              )}
              {selected && !demo && (
                <>
                  <hr />
                  <section className="editor-group" aria-label="Review checklist">
                    <h3>Review checklist</h3>
                    <p>
                      1. Save the draft. 2. Submit each attached file for review. 3. A different
                      publisher approves each file. 4. Submit the content for review.
                    </p>
                    <p>
                      {selected.status === 'Draft' || selected.status === 'Returned'
                        ? 'Save your changes, resolve any items below, then send this draft for review.'
                        : selected.status === 'Review'
                          ? 'A different authorized publisher reviews the content and attached media.'
                          : selected.status === 'Approved'
                            ? 'Approved. An authorized publisher can publish or schedule this version.'
                            : selected.status === 'Scheduled'
                              ? 'Scheduled for publication; an earlier public version may remain visible.'
                              : selected.status === 'Published'
                                ? 'This version is published.'
                                : 'This content is archived.'}
                    </p>
                    {readiness.media?.map((file) => (
                      <InlineMediaReview
                        key={file.id + '-' + file.version}
                        media={file}
                        api={api}
                        profile={profile}
                        editable={editable}
                        publishable={publishable}
                        busy={busy}
                        run={run}
                        refresh={readiness.refresh}
                      />
                    ))}
                    {readiness.checking && <p>Checking attached media…</p>}
                    {!readiness.checking && !readiness.error && blockers.length === 0 && (
                      <p>Current checks found no outstanding media or content requirements.</p>
                    )}
                  </section>
                  {selected.status === 'Review' && (
                    <p role="status" className="notice">
                      {selected.created_by === profile?.id
                        ? 'Submitted for review. A different publisher must approve your version.'
                        : publishable
                          ? 'Ready for your independent review. Approval and publishing are separate actions.'
                          : 'Submitted for review. An authorized publisher must approve this version.'}
                    </p>
                  )}
                  {['story', 'campaign', 'programme'].includes(selected.kind) && (
                    <div className="editor-group">
                      <h3>Campaign link checks</h3>
                      <p className="fine">
                        Check response status, then open the platform to confirm recipient and
                        purpose.
                      </p>
                      {['pillar_url', 'spotfund_url', 'gofundme_url']
                        .filter((k) => selected.details[k])
                        .map((k) => (
                          <button
                            key={k}
                            className="btn outline small"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                const v = await api<{ result: string }>('check-campaign', {
                                  method: 'POST',
                                  body: JSON.stringify({ url: selected.details[k] }),
                                });
                                setMessage(v.result);
                              })
                            }
                          >
                            Check {k.replace('_url', '')}
                          </button>
                        ))}
                      {message && <p role="status">{message}</p>}
                    </div>
                  )}
                  <label className="field">
                    Review note
                    <textarea
                      value={note}
                      maxLength={5000}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  {dirty && (
                    <p role="status">
                      Unsaved changes. Save your draft before review or leaving this form.
                    </p>
                  )}
                  {readiness.error && <p role="alert">{readiness.error}</p>}
                  {!demo &&
                    !readiness.checking &&
                    !readiness.error &&
                    !readiness.canSubmit &&
                    ['Draft', 'Returned'].includes(selected.status || '') && (
                      <p role="status">
                        Only the content author with an editor role, or an administrator, can submit
                        this draft. A publisher can approve it after submission.
                      </p>
                    )}
                  <button type="button" disabled={busy} onClick={readiness.refresh}>
                    Refresh approval status
                  </button>
                  {readiness.checking && <p role="status">Checking current approvals…</p>}
                  {blockers.length > 0 && (
                    <div role="status">
                      <p>
                        Before submitting, open Media & consent and arrange independent approval:
                      </p>
                      <ul>
                        {blockers.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="cms-actions editor-sticky-actions">
                    {publishable && selected.live_since && (
                      <button
                        className="btn outline"
                        disabled={busy}
                        onClick={() => transition('WithdrawPublic')}
                      >
                        Withdraw public version now
                      </button>
                    )}
                    {mayEdit && ['Draft', 'Returned'].includes(selected.status || '') && (
                      <button
                        className="btn green"
                        disabled={
                          busy ||
                          !ready ||
                          dirty ||
                          blockers.length > 0 ||
                          readiness.checking ||
                          !!readiness.error ||
                          (!demo && !readiness.canSubmit)
                        }
                        onClick={() => transition('Review')}
                      >
                        Submit for review
                      </button>
                    )}
                    {publishable &&
                      selected.status === 'Review' &&
                      selected.created_by !== profile?.id && (
                        <>
                          <button
                            className="btn green"
                            disabled={busy}
                            onClick={() => transition('Approved')}
                          >
                            Approve version
                          </button>
                          <button
                            className="btn outline"
                            disabled={busy || note.trim().length < 3}
                            onClick={() => transition('Returned')}
                          >
                            Return for changes
                          </button>
                        </>
                      )}
                    {publishable && selected.status === 'Approved' && (
                      <>
                        <button
                          className="btn green"
                          disabled={busy}
                          onClick={() => transition('Published')}
                        >
                          Publish now
                        </button>
                        <label className="field">
                          Schedule (Kampala)
                          <input
                            aria-label="Scheduled publication time"
                            type="datetime-local"
                            value={schedule}
                            onChange={(e) => setSchedule(e.target.value)}
                          />
                        </label>
                        <button
                          className="btn outline"
                          disabled={busy || !schedule}
                          onClick={() => transition('Scheduled')}
                        >
                          Schedule publication
                        </button>
                      </>
                    )}
                    {mayEdit &&
                      ['Published', 'Scheduled', 'Approved', 'Archived'].includes(
                        selected.status || '',
                      ) && (
                        <button
                          className="btn outline"
                          disabled={busy}
                          onClick={() => transition('Draft')}
                        >
                          Create new draft
                        </button>
                      )}
                    {publishable &&
                      ['Published', 'Scheduled', 'Approved'].includes(selected.status || '') && (
                        <button
                          className="btn outline"
                          disabled={busy}
                          onClick={() => transition('Archived')}
                        >
                          Unpublish / archive
                        </button>
                      )}
                  </div>
                  <h3>Version history</h3>
                  {revisions.map((v) => (
                    <div className="revision-row" key={v.id}>
                      <span>
                        Version {v.version} · {v.snapshot.status} ·{' '}
                        {new Date(v.created_at).toLocaleString()}
                      </span>
                      {mayEdit && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              const row = await api<Rows.ContentItem>('editorial', {
                                method: 'POST',
                                body: JSON.stringify({
                                  action: 'restore',
                                  revision_id: v.id,
                                  version: selected.version,
                                }),
                              });
                              open(row);
                              setMessage('Historical version restored as a draft for review.');
                            })
                          }
                        >
                          Restore as draft
                        </button>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
