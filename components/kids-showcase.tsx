'use client';
import AppLink from './app-link';

import { useState } from 'react';
import type { Content } from '@/lib/content';
import { ids } from '@/lib/editorial';
import { Gallery, ApprovedVideo, type Asset } from './portfolio';
export default function KidsShowcase({ content, assets }: { content: Content[]; assets: Asset[] }) {
  const [tab, setTab] = useState('All'),
    [activity, setActivity] = useState('All activities');
  const rows = content.filter((c) => c.details.scope === 'aminia-kids' || c.slug === 'aminia-kids'),
    albums = rows.filter(
      (c) =>
        (c.kind === 'album' || (c.slug === 'aminia-kids' && ids(c.details.gallery).length > 0)) &&
        (activity === 'All activities' || c.details.activity === activity),
    ),
    videos = rows.filter(
      (c) =>
        c.details.video_id && (activity === 'All activities' || c.details.activity === activity),
    );
  return (
    <section className="wrap section-space kids-showcase">
      <div className="section-head">
        <div>
          <p className="eyebrow">THE AMINIA KIDS PORTFOLIO</p>
          <h2>
            Creativity, in <em>every expression.</em>
          </h2>
        </div>
        <label>
          Explore an activity
          <select value={activity} onChange={(e) => setActivity(e.target.value)}>
            {[
              'All activities',
              ...new Set(rows.map((c) => c.details.activity).filter(Boolean)),
            ].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="portfolio-tabs" role="group" aria-label="Portfolio filter">
        {['All', 'Photos', 'Videos'].map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab !== 'Videos' && (
        <div>
          {albums.map((a) => (
            <article className="album-section" key={a.id}>
              <p className="eyebrow">{a.details.activity || 'PHOTO COLLECTION'}</p>
              <h3>{a.title}</h3>
              <p>{a.summary}</p>
              <Gallery
                assets={ids(a.details.gallery)
                  .map((id) => assets.find((m) => m.id === id))
                  .filter((m): m is Asset => !!m)}
              />
              <AppLink
                className="text-link"
                href={a.kind === 'album' ? '/albums/' + a.slug : '/programmes/' + a.slug}
              >
                View collection ↗
              </AppLink>
            </article>
          ))}
          {!albums.length && (
            <div className="portfolio-awaiting">
              <span>✦</span>
              <h3>Small moments. Lasting memories.</h3>
              <p>
                Approved photo collections will appear here as the foundation shares activities and
                performances.
              </p>
            </div>
          )}
        </div>
      )}
      {tab !== 'Photos' && (
        <div className="video-grid">
          {videos.map((v) => (
            <article key={v.id}>
              <h3>{v.title}</h3>
              <ApprovedVideo id={v.details.video_id} />
            </article>
          ))}
          {!videos.length && tab === 'Videos' && (
            <div className="notice">
              <h3>Performances worth sharing.</h3>
              <p>
                Reviewed videos will be added here. Follow the programme’s events for ways to take
                part.
              </p>
            </div>
          )}
        </div>
      )}
      <div className="kids-pathways">
        {[
          ['Learn & create', 'Education and creative programmes', 'programme', '/programmes/'],
          ['Come together', 'Performances and workshops', 'event', '/events/'],
        ].map(([title, subtitle, kind, prefix]) => (
          <section key={kind}>
            <p className="eyebrow">{subtitle}</p>
            <h3>{title}</h3>
            {rows
              .filter((c) => c.kind === kind && c.slug !== 'aminia-kids')
              .map((c) => (
                <AppLink className="listing-item" key={c.id} href={prefix + c.slug}>
                  <span>
                    {c.title}
                    <small>
                      {c.details.date
                        ? new Date(c.details.date).toLocaleDateString('en-GB', {
                            timeZone: 'Africa/Kampala',
                          })
                        : c.details.programme_status || 'Learn more'}
                    </small>
                  </span>
                  <span>↗</span>
                </AppLink>
              ))}
            <AppLink className="text-link" href="/contact?interest=aminia-kids">
              Ask about taking part ↗
            </AppLink>
          </section>
        ))}
      </div>
      <div className="giving-options">
        <p className="eyebrow">SUPPORT A CREATIVE ACTIVITY</p>
        <h2>Help a little talent grow.</h2>
        <p>
          Explore approved campaigns supporting creative learning, workshops and shared activities.
        </p>
        {rows
          .filter((c) => c.kind === 'campaign')
          .map((c) => (
            <AppLink className="btn green" key={c.id} href={'/campaigns/' + c.slug}>
              {c.title} ↗
            </AppLink>
          ))}
        <AppLink
          className="text-link"
          href="/contact?interest=support&subject=Aminia%20Kids%20creative%20activities"
        >
          Discuss supporting Aminia Kids ↗
        </AppLink>
      </div>
    </section>
  );
}
