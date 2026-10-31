'use client';
import type * as Rows from '@/lib/types';
import { useClock } from '@/hooks/use-clock';
import type { Content } from '@/lib/content';
export default function WorkspacePanels({
  roles = [],
  summary,
  section,
  items,
  media,
  enquiries,
  mail,
  integrations,
  engagement,
  onChoose,
  onOpen,
  onSettings,
}: {
  roles?: string[];
  summary?: Record<string, number> | null;
  section: string;
  items: Content[];
  media: Rows.MediaRow[];
  enquiries: Rows.EnquiryRow[];
  mail: Rows.EmailJob[];
  integrations: Record<string, boolean>;
  engagement: Rows.EngagementRow[];
  onChoose: (s: string) => void;
  onOpen: (c: Content) => void;
  onSettings: () => void;
}) {
  const now = useClock();
  const canEditorial = roles.some((r) => ['administrator', 'editor', 'publisher'].includes(r));
  const canEnquiries = roles.some((r) => ['administrator', 'enquiry_coordinator'].includes(r));
  const upcoming = items
      .filter((i) => i.kind === 'event' && i.details.date && Date.parse(i.details.date) >= now)
      .sort((a, b) => a.details.date.localeCompare(b.details.date)),
    needs = enquiries.filter((e) => e.status !== 'Closed'),
    failed = mail.filter((e) => ['Failed', 'Needs review'].includes(e.status));
  if (section === 'donation' && canEditorial)
    return (
      <section className="cms-card padded">
        <h2>Donation workspace</h2>
        <p>Manage fundraising campaigns and the public donation page.</p>
        <div className="cms-actions">
          <button className="btn green" onClick={() => onChoose('campaign')}>
            Manage giving campaigns
          </button>
          <button className="btn outline" onClick={() => onChoose('page')}>
            Manage donation page
          </button>
          {roles.includes('administrator') && (
            <button className="btn outline" onClick={() => onChoose('payment-settings')}>
              Payment settings
            </button>
          )}
        </div>
        <p className="fine">
          Online DPO checkout remains unavailable until integration and verification are complete.
        </p>
      </section>
    );
  if (section === 'payment-settings' && roles.includes('administrator'))
    return (
      <section className="cms-card padded">
        <h2>Payment settings</h2>
        <p>
          Manage verified bank and merchant details through the approved website settings workflow.
        </p>
        <button className="btn green" onClick={onSettings}>
          Edit bank and merchant details
        </button>
        <p>Save the draft and arrange independent approval before publishing changes.</p>
        <p className="fine">
          DPO credentials must be configured as server-only secrets. DPO checkout is not yet
          available.
        </p>
      </section>
    );
  if (section === 'overview')
    return (
      <>
        <div className="cms-metrics">
          {canEditorial && (
            <button
              onClick={() => {
                const next = items.find((i) => i.status === 'Review');
                if (next) onOpen(next);
                else onChoose('story');
              }}
            >
              <span>Awaiting content review</span>
              <strong>
                {summary?.content_review ?? items.filter((i) => i.status === 'Review').length}
              </strong>
            </button>
          )}
          {canEnquiries && (
            <button onClick={() => onChoose('enquiries')}>
              <span>Open enquiries</span>
              <strong>{summary?.open_enquiries ?? needs.length}</strong>
            </button>
          )}
          {canEditorial && (
            <button onClick={() => onChoose('calendar')}>
              <span>Upcoming events</span>
              <strong>{summary?.upcoming_events ?? upcoming.length}</strong>
            </button>
          )}
          {canEditorial && (
            <button onClick={() => onChoose('media')}>
              <span>Media awaiting review</span>
              <strong>
                {summary?.media_review ?? media.filter((m) => m.status === 'Review').length}
              </strong>
            </button>
          )}
        </div>
        <div className="cms-settings">
          {canEditorial && (
            <section className="cms-card padded">
              <h2>Next up</h2>
              {upcoming.slice(0, 5).map((i) => (
                <button className="listing-item" key={i.id} onClick={() => onOpen(i)}>
                  <span>
                    {i.title}
                    <small>
                      {new Date(i.details.date).toLocaleString('en-GB', {
                        timeZone: 'Africa/Kampala',
                      })}
                    </small>
                  </span>
                  <span>↗</span>
                </button>
              ))}
              {!upcoming.length && <p>No upcoming events have been entered.</p>}
              {integrations.analytics && (
                <div>
                  <h3>Recent engagement counts</h3>
                  {['giving', 'merchandise', 'volunteer', 'partner', 'kids'].map((a) => (
                    <p key={a}>
                      {a}:{' '}
                      {engagement
                        .filter((v) => v.action === a)
                        .reduce((s, v) => s + Number(v.count), 0)}{' '}
                      clicks
                    </p>
                  ))}
                  <small>
                    Consented action totals retained for the latest 30 days. Counts are not unique
                    people or confirmed donations.
                  </small>
                </div>
              )}
              <button className="text-link" onClick={() => onChoose('calendar')}>
                Open editorial calendar ↗
              </button>
            </section>
          )}
          {canEnquiries && (
            <section className="cms-card padded">
              <h2>Follow-up desk</h2>
              <p>
                {summary?.email_failed ?? failed.length} failed or review-needed email attempts.
              </p>
              <p>
                {summary?.overdue ??
                  needs.filter((e) => e.follow_up_at && Date.parse(e.follow_up_at) < now)
                    .length}{' '}
                overdue enquiry follow-ups.
              </p>
              <p>
                {summary?.campaign_checks ??
                  items.filter(
                    (i) =>
                      i.kind === 'campaign' &&
                      i.details.campaign_status !== 'Completed' &&
                      (!i.details.figures_date ||
                        Date.parse(i.details.figures_date) < now - 30 * 86400000),
                  ).length}{' '}
                campaigns to check for updates.
              </p>
              <button className="btn outline" onClick={() => onChoose('enquiries')}>
                Review enquiries & emails
              </button>
            </section>
          )}
        </div>
      </>
    );
  if (section === 'calendar')
    return (
      <section className="cms-card padded">
        <h2>Editorial calendar</h2>
        <p>Publication schedules, event dates and campaign checks. All times shown in Kampala.</p>
        <div className="calendar-agenda">
          {items
            .filter(
              (i) =>
                i.details.date ||
                i.scheduled_at ||
                i.status === 'Review' ||
                i.status === 'Scheduled' ||
                i.kind === 'campaign',
            )
            .sort((a, b) =>
              (a.details.date || a.scheduled_at || '9999').localeCompare(
                b.details.date || b.scheduled_at || '9999',
              ),
            )
            .map((i) => (
              <button key={i.id} onClick={() => onOpen(i)}>
                <span>
                  {i.details.date
                    ? new Date(i.details.date).toLocaleDateString('en-GB', {
                        timeZone: 'Africa/Kampala',
                      })
                    : i.scheduled_at
                      ? 'Publish ' +
                        new Date(i.scheduled_at).toLocaleString('en-GB', {
                          timeZone: 'Africa/Kampala',
                        })
                      : 'Needs editorial attention'}
                </span>
                <strong>{i.title}</strong>
                <small>
                  {i.kind} · {i.status || 'Provided content'}
                </small>
              </button>
            ))}
        </div>
        <p className="fine">
          Open an item to review its publication schedule or edit its event date. This does not send
          invitations.
        </p>
      </section>
    );
  if (section === 'settings')
    return (
      <section className="cms-card padded">
        <h2>Foundation details & integrations</h2>
        <p>
          Public contacts, social links and confirmation wording follow the same draft and
          independent approval process as other pages.
        </p>
        <button className="btn green" onClick={onSettings}>
          Manage foundation details
        </button>
        <div className="integration-grid">
          {Object.entries({
            backend: 'Website database',
            email: 'Email sending',
            staffEmail: 'Staff notification address',
            turnstile: 'Turnstile forms',
            analytics: 'Aggregate engagement counts',
          }).map(([key, label]) => (
            <div key={key}>
              <strong>{label}</strong>
              <span className="cms-badge">
                {integrations[key] ? 'Configured' : 'Not configured'}
              </span>
            </div>
          ))}
        </div>
        <p className="fine">
          API keys, the verified email sender and recipient addresses are configured as Cloudflare
          Worker secrets. Secret values are never displayed here. Accepted email means accepted by
          the provider, not verified inbox delivery.
        </p>
      </section>
    );
  return null;
}
