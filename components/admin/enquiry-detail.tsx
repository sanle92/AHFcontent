'use client';
import type { Content } from '@/lib/content';
import type * as Rows from '@/lib/types';
import { X } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import EnquiryTools from '../enquiry-tools';
interface Props {
  selectedEnquiry: Rows.EnquiryRow | null;
  setSelected: Dispatch<SetStateAction<Content | null>>;
  setCreating: Dispatch<SetStateAction<boolean>>;
  setChosenMedia: Dispatch<SetStateAction<Rows.MediaRow | null>>;
  setSelectedEnquiry: Dispatch<SetStateAction<Rows.EnquiryRow | null>>;
  error: string;
  api: Rows.StaffApi;
  load: () => Promise<void>;
  mail: Rows.EmailJob[];
  busy: boolean;
  run: (fn: () => Promise<void>) => Promise<void>;
  setMessage: Dispatch<SetStateAction<string>>;
  staff: Rows.Profile[];
  note: string;
  setNote: Dispatch<SetStateAction<string>>;
}
export default function EnquiryDetail({
  selectedEnquiry,
  setSelected,
  setCreating,
  setChosenMedia,
  setSelectedEnquiry,
  error,
  api,
  load,
  mail,
  busy,
  run,
  setMessage,
  staff,
  note,
  setNote,
}: Props) {
  return (
    <>
      {selectedEnquiry && (
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
          <section
            className="cms-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Enquiry details"
          >
            <header>
              <h2>{selectedEnquiry.name}</h2>
              <button
                disabled={busy}
                aria-label="Close enquiry"
                onClick={() => setSelectedEnquiry(null)}
              >
                <X />
              </button>
            </header>
            <div className="cms-dialog-body">
              {error && <p className="error">{error}</p>}
              <p>
                {selectedEnquiry.email} · {selectedEnquiry.phone}
              </p>
              <p className="enquiry-message">{selectedEnquiry.message}</p>
              <EnquiryTools
                enquiry={selectedEnquiry}
                api={api}
                onUpdated={async () => {
                  await load();
                }}
              />
              <section className="cms-card padded">
                <h3>Email attempts</h3>
                {mail
                  .filter((m) => m.enquiry_id === selectedEnquiry.id)
                  .map((m) => (
                    <p key={m.id}>
                      {m.kind}: <strong>{m.status}</strong> · {m.attempts} attempts
                      <br />
                      <small>{m.last_error}</small>
                    </p>
                  ))}
                <button
                  className="btn outline small"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const v = await api<{ state: string }>('email', {
                        method: 'POST',
                        body: JSON.stringify({ id: selectedEnquiry.id }),
                      });
                      await load();
                      setMessage(
                        v.state === 'accepted'
                          ? 'Confirmation accepted by the email provider.'
                          : 'Email remains pending. Check configuration and attempt history.',
                      );
                    })
                  }
                >
                  Retry pending / failed emails
                </button>
              </section>
              <form
                className="editor-group"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void run(async () => {
                    await api<Rows.ContentItem>('editorial', {
                      method: 'POST',
                      body: JSON.stringify({
                        action: 'assign',
                        id: selectedEnquiry.id,
                        version: selectedEnquiry.version,
                        assignee: f.get('assignee') || null,
                        due_at: f.get('due_at') ? f.get('due_at') + '+03:00' : null,
                      }),
                    });
                    await load();
                    setSelectedEnquiry(null);
                    setMessage('Assignment and follow-up saved.');
                  });
                }}
              >
                <label className="field">
                  Assigned team member
                  <select name="assignee" defaultValue={selectedEnquiry.assigned_to || ''}>
                    <option value="">Unassigned</option>
                    {staff
                      .filter(
                        (p) =>
                          p.active &&
                          p.roles.some((r) => ['administrator', 'enquiry_coordinator'].includes(r)),
                      )
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field">
                  Follow-up time (Kampala)
                  <input
                    type="datetime-local"
                    name="due_at"
                    defaultValue={
                      selectedEnquiry.follow_up_at
                        ? new Date(Date.parse(selectedEnquiry.follow_up_at) + 3 * 3600000)
                            .toISOString()
                            .slice(0, 16)
                        : ''
                    }
                  />
                </label>
                <button className="btn outline small" disabled={busy}>
                  Save follow-up
                </button>
              </form>
              <label className="field">
                Internal follow-up note
                <textarea value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <div className="cms-actions">
                {['New', 'In review', 'Contacted', 'Closed'].map((target) => (
                  <button
                    className="btn outline"
                    key={target}
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await api<Rows.ContentItem>('editorial', {
                          method: 'POST',
                          body: JSON.stringify({
                            action: 'enquiry',
                            id: selectedEnquiry.id,
                            version: selectedEnquiry.version,
                            target,
                            note,
                          }),
                        });
                        await load();
                        setSelectedEnquiry(null);
                        setMessage('Enquiry updated. No message has been sent.');
                      })
                    }
                  >
                    {target}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
