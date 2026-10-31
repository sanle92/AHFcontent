'use client';
import { csv } from '@/lib/content';
import type * as Rows from '@/lib/types';
import type { Dispatch, SetStateAction } from 'react';

interface Props {
  section: string;
  enquiryStatus: string;
  setEnquiryStatus: Dispatch<SetStateAction<string>>;
  enquiryKind: string;
  setEnquiryKind: Dispatch<SetStateAction<string>>;
  enquiryAssignee: string;
  setEnquiryAssignee: Dispatch<SetStateAction<string>>;
  staff: Rows.Profile[];
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  demo: boolean;
  enquiries: Rows.EnquiryRow[];
  onOpen: (row: Rows.EnquiryRow) => void;
  setNote: Dispatch<SetStateAction<string>>;
  now: number;
}
export default function EnquiryWorkspace({
  section,
  enquiryStatus,
  setEnquiryStatus,
  enquiryKind,
  setEnquiryKind,
  enquiryAssignee,
  setEnquiryAssignee,
  staff,
  search,
  setSearch,
  demo,
  enquiries,
  onOpen,
  setNote,
  now,
}: Props) {
  return (
    <>
      {section === 'enquiries' && (
        <section className="cms-card">
          <div className="cms-toolbar">
            <h2>Enquiries & follow-up</h2>
            <select
              aria-label="Enquiry status"
              value={enquiryStatus}
              onChange={(e) => setEnquiryStatus(e.target.value)}
            >
              {['Open', 'All', 'New', 'In review', 'Contacted', 'Closed'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            <select
              aria-label="Enquiry type"
              value={enquiryKind}
              onChange={(e) => setEnquiryKind(e.target.value)}
            >
              {[
                'All',
                'contact',
                'volunteer',
                'partner',
                'support',
                'aminia-kids',
                'merchandise',
                'event',
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            <select
              aria-label="Assigned enquiry owner"
              value={enquiryAssignee}
              onChange={(e) => setEnquiryAssignee(e.target.value)}
            >
              <option>All</option>
              <option>Unassigned</option>
              {staff.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              aria-label="Search enquiries"
              placeholder="Search name, email, interest or status…"
              maxLength={100}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              className="btn outline"
              disabled={demo || !enquiries.length}
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob(
                    [
                      csv([
                        ['Kind', 'Name', 'Email', 'Telephone', 'Status', 'Received'],
                        ...enquiries.map((e) => [
                          e.kind,
                          e.name,
                          e.email,
                          e.phone,
                          e.status,
                          e.created_at,
                        ]),
                      ]),
                    ],
                    { type: 'text/csv' },
                  ),
                );
                const a = document.createElement('a');
                a.href = url;
                a.download = 'AHF-website-enquiries.csv';
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Export latest enquiries
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Interest</th>
                  <th>Status</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {[...enquiries]
                  .sort(
                    (a, b) =>
                      (a.priority === 'Urgent' ? -2 : a.priority === 'High' ? -1 : 0) -
                        (b.priority === 'Urgent' ? -2 : b.priority === 'High' ? -1 : 0) ||
                      (a.follow_up_at || '9999').localeCompare(b.follow_up_at || '9999'),
                  )
                  .filter(
                    (e) =>
                      (enquiryStatus === 'All' ||
                        (enquiryStatus === 'Open' && e.status !== 'Closed') ||
                        e.status === enquiryStatus) &&
                      (enquiryKind === 'All' || e.kind === enquiryKind) &&
                      (enquiryAssignee === 'All' ||
                        (enquiryAssignee === 'Unassigned' && !e.assigned_to) ||
                        e.assigned_to === enquiryAssignee) &&
                      [e.name, e.kind, e.email, e.status]
                        .join(' ')
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  )
                  .map((e) => (
                    <tr key={e.id}>
                      <td>
                        <button
                          className="cms-row-title"
                          onClick={() => {
                            onOpen(e);
                            setNote(e.internal_note);
                          }}
                        >
                          {e.name}
                        </button>
                      </td>
                      <td>{e.kind}</td>
                      <td>
                        {e.status}
                        <br />
                        <small>
                          {e.priority || 'Normal'} ·{' '}
                          {staff.find((p) => p.id === e.assigned_to)?.name || 'Unassigned'}
                        </small>
                        {e.follow_up_at && (
                          <small className={Date.parse(e.follow_up_at) < now ? 'error' : ''}>
                            Follow-up:{' '}
                            {new Date(e.follow_up_at).toLocaleString('en-GB', {
                              timeZone: 'Africa/Kampala',
                            })}
                          </small>
                        )}
                      </td>
                      <td>{new Date(e.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!enquiries.length && <div className="cms-empty">No enquiries available.</div>}
          <p className="fine">
            Search and filters cover all enquiries; exports contain the current page. Confirmation
            and staff notifications are queued after submission. No applicant is automatically
            enrolled.
          </p>
        </section>
      )}
    </>
  );
}
