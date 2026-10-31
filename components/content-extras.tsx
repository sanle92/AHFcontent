import AppLink from './app-link';
import type { Content } from '@/lib/content';
import { fundraisingUrl, ids, updates } from '@/lib/editorial';
import { Gallery, ApprovedVideo, type Asset } from './portfolio';
export function GivingOptions({ item }: { item: Content }) {
  const links = [
    ['Pillar.io', item.details.pillar_url, 'pillar.io'],
    ['Spotfund', item.details.spotfund_url, 'spotfund.com'],
    ['GoFundMe', item.details.gofundme_url, 'gofundme.com'],
  ].filter(([, url, host]) => url && fundraisingUrl(url, host));
  if (!links.length) return null;
  const status = item.details.campaign_status || 'Active';
  return (
    <aside className="giving-options">
      <p className="eyebrow">
        {status === 'Active' ? 'TURN COMPASSION INTO ACTION' : status.toUpperCase() + ' CAMPAIGN'}
      </p>
      <h2>
        {status === 'Completed'
          ? 'Thank you for helping.'
          : status === 'Paused'
            ? 'Giving is currently paused.'
            : item.details.button_label || 'Support this work'}
      </h2>
      {status === 'Active' ? (
        <>
          <div className="hero-actions">
            {links.map(([label, url]) => (
              <AppLink
                key={url}
                className="btn green"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                data-engagement="giving"
              >
                {item.details.button_label || 'Help through ' + label} ↗ <small>{label}</small>
              </AppLink>
            ))}
          </div>
          <p className="fine">
            You will give on the selected external platform. Review its campaign details and terms
            before contributing.
          </p>
        </>
      ) : (
        <AppLink className="text-link" href="/donate">
          Explore other ways to help ↗
        </AppLink>
      )}
      {(item.details.target || item.details.raised) && (
        <p>
          Target: {item.details.currency || 'UGX'} {item.details.target || 'Not set'} · Raised:{' '}
          {item.details.raised || 'Not published'}
          <br />
          <small>
            Manually updated
            {item.details.figures_date ? ' · checked ' + item.details.figures_date : ''}. Check the
            giving platform for its latest figures.
          </small>
        </p>
      )}
    </aside>
  );
}
export default function ContentExtras({
  item,
  content,
  assets,
  portfolio = true,
}: {
  item: Content;
  content: Content[];
  assets: Asset[];
  portfolio?: boolean;
}) {
  const related = content.filter(
    (c) =>
      c.details.programme_id === item.id &&
      c.id !== item.id &&
      ['story', 'event', 'album', 'campaign', 'programme'].includes(c.kind),
  );
  const campaign = content.find((c) => c.id === item.details.campaign_id && c.kind === 'campaign'),
    entries = updates(item.details.updates),
    gallery = ids(item.details.gallery)
      .map((id) => assets.find((a) => a.id === id))
      .filter((a): a is Asset => !!a);
  return (
    <>
      {item.kind === 'page' &&
        ['vision', 'mission']
          .filter((key) => item.details[key])
          .map((key) => (
            <section key={key}>
              <h2>{key === 'vision' ? 'Our vision' : 'Our mission'}</h2>
              <p style={{ whiteSpace: 'pre-line' }}>{item.details[key]}</p>
            </section>
          ))}
      <div className="content-facts">
        {['programme_status', 'activity', 'category', 'reporting_period', 'document_version']
          .filter((k) => item.details[k])
          .map((k) => (
            <span className="pill" key={k}>
              {item.details[k]}
            </span>
          ))}
      </div>
      {portfolio && item.details.video_id && <ApprovedVideo id={item.details.video_id} />}
      {['objectives', 'activities', 'participation']
        .filter((k) => item.details[k])
        .map((k) => (
          <section key={k}>
            <h2>
              {
                {
                  objectives: 'What we aim to do',
                  activities: 'Activities',
                  participation: 'Taking part',
                }[k]
              }
            </h2>
            <p style={{ whiteSpace: 'pre-line' }}>{item.details[k]}</p>
          </section>
        ))}
      {portfolio && gallery.length > 0 && (
        <section>
          <h2>In pictures</h2>
          <Gallery assets={gallery} />
        </section>
      )}
      {entries.length > 0 && (
        <section className="progress-updates">
          <h2>Updates from the foundation</h2>
          {entries
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((u, i) => (
              <article key={i}>
                <time dateTime={u.date}>{u.date}</time>
                <p>{u.text}</p>
              </article>
            ))}
        </section>
      )}
      {item.kind === 'event' && (
        <div className="notice">
          <strong>{item.details.event_status || 'Scheduled'}</strong>
          {item.details.end_date && (
            <p>
              Ends:{' '}
              {new Date(item.details.end_date).toLocaleString('en-GB', {
                timeZone: 'Africa/Kampala',
              })}{' '}
              (Kampala)
            </p>
          )}
          {item.details.capacity && (
            <p>Capacity: {item.details.capacity}. Availability is confirmed by AHF.</p>
          )}
          {!['Cancelled', 'Completed', 'Postponed'].includes(item.details.event_status || '') && (
            <div className="hero-actions">
              <AppLink className="btn outline" href={'/api/calendar?slug=' + item.slug}>
                Add to calendar
              </AppLink>
              <AppLink
                className="btn green"
                href={
                  item.details.registration_url ||
                  '/contact?interest=event&subject=' + encodeURIComponent(item.title)
                }
                target={item.details.registration_url ? '_blank' : undefined}
                rel="noopener noreferrer"
              >
                Enquire / register ↗
              </AppLink>
            </div>
          )}
        </div>
      )}
      {item.kind === 'product' && (
        <div className="notice">
          <p className="eyebrow">SHOP FOR HOPE · {item.details.availability || 'ENQUIRE'}</p>
          <h3>
            {item.details.price
              ? (item.details.currency || 'UGX') + ' ' + item.details.price
              : 'Price to be confirmed'}
          </h3>
          {item.details.variants && (
            <>
              <h3>Available options</h3>
              <p style={{ whiteSpace: 'pre-line' }}>{item.details.variants}</p>
            </>
          )}
          {item.details.fulfilment && <p>{item.details.fulfilment}</p>}
          {item.details.proceeds && (
            <>
              <h3>Your purchase, with purpose</h3>
              <p>{item.details.proceeds}</p>
            </>
          )}
          {item.details.availability !== 'Out of stock' && (
            <AppLink
              className="btn green"
              data-engagement="merchandise"
              href={'/contact?interest=merchandise&subject=' + encodeURIComponent(item.title)}
            >
              Request this product ↗
            </AppLink>
          )}
          <p className="fine">
            An enquiry does not confirm stock, payment or an order. AHF will confirm options, total
            cost and fulfilment.
          </p>
        </div>
      )}
      {related.length > 0 && (
        <section>
          <h2>From this programme</h2>
          {related.map((c) => (
            <AppLink
              className="listing-item"
              key={c.id}
              href={
                (
                  {
                    story: '/stories/',
                    event: '/events/',
                    album: '/albums/',
                    campaign: '/campaigns/',
                    programme: '/programmes/',
                  } as Record<string, string>
                )[c.kind] + c.slug
              }
            >
              <span>
                {c.title}
                <small>{c.summary}</small>
              </span>
              <span>↗</span>
            </AppLink>
          ))}
        </section>
      )}
      <GivingOptions item={item} />
      {campaign && (
        <div className="notice">
          <h3>{campaign.title}</h3>
          <p>{campaign.summary}</p>
          <AppLink className="btn green" href={'/campaigns/' + campaign.slug}>
            {item.details.button_label || 'Help this person or family'} ↗
          </AppLink>
        </div>
      )}
    </>
  );
}
