'use client';
import type * as Rows from '@/lib/types';

import { useEffect, useRef, useState } from 'react';
import { csv } from '@/lib/content';
import { kampalaDate } from '@/lib/kampala-date';
export default function AnalyticsPanel({ api, demo }: { api: Rows.StaffApi; demo: boolean }) {
  const [from, setFrom] = useState(() => kampalaDate(Date.now() - 29 * 86400000)),
    [to, setTo] = useState(() => kampalaDate(Date.now())),
    [country, setCountry] = useState(''),
    [offset, setOffset] = useState(0),
    [data, setData] = useState<Rows.AnalyticsData | null>(null),
    [error, setError] = useState(''),
    [live, setLive] = useState(true),
    [history, setHistory] = useState<Rows.VisitEvent[] | null>(null),
    [updated, setUpdated] = useState(''),
    [setup, setSetup] = useState<{
      collectionEnabled: boolean;
      serviceConfigured: boolean;
      dashboardDatabaseReady: boolean;
      ingestionConnectionReady: boolean;
    } | null>(null),
    [setupError, setSetupError] = useState(false);
  useEffect(() => {
    if (demo) return;
    let active = true;
    void api<{
      collectionEnabled: boolean;
      serviceConfigured: boolean;
      dashboardDatabaseReady: boolean;
      ingestionConnectionReady: boolean;
    }>('analytics?status=1')
      .then((value) => {
        if (active) {
          setSetup(value);
          setSetupError(false);
        }
      })
      .catch(() => {
        if (active) setSetupError(true);
      });
    return () => {
      active = false;
    };
  }, [api, demo]);
  const historyRequest = useRef(0);
  const [historyId, setHistoryId] = useState('');
  useEffect(
    () => () => {
      historyRequest.current++;
    },
    [],
  );
  useEffect(() => {
    if (demo) return;
    let active = true,
      inFlight = false;
    const load = () => {
      if (inFlight) return;
      inFlight = true;
      return api<Rows.AnalyticsData>(
        'analytics?' + new URLSearchParams({ from, to, country, offset: String(offset) }),
      )
        .then((v) => {
          if (active) {
            setData(v);
            setUpdated(new Date().toLocaleTimeString('en-GB', { timeZone: 'Africa/Kampala' }));
            setError('');
          }
        })
        .catch((e) => active && setError(e.message))
        .finally(() => {
          inFlight = false;
        });
    };
    void load();
    const t = setInterval(() => {
      if (live && offset === 0 && document.visibilityState === 'visible') void load();
    }, 20000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [api, demo, from, to, country, offset, live]);
  const historyRows = data?.history || [];
  return (
    <>
      <section className="cms-card padded analytics-intro">
        <p className="eyebrow">VISITOR INSIGHTS · CONSENTED SESSIONS</p>
        <h2>Understand your public audience.</h2>
        <p>
          Live means a consented session active in the last two minutes. Locations are approximate
          IP-based estimates and may reflect a VPN. Statistics use pseudonymous browser identifiers
          and do not identify people by name. Times use Kampala. Page views include sessions started
          before the selected dates. Live now always describes the last two minutes.
        </p>
        {setup &&
          (!setup.collectionEnabled ||
            !setup.serviceConfigured ||
            !setup.dashboardDatabaseReady ||
            !setup.ingestionConnectionReady) && (
            <div className="notice" role="status">
              <strong>Analytics needs attention</strong>
              <ul>
                {!setup.collectionEnabled && (
                  <li>
                    Visit collection is disabled. Set AHF_ANALYTICS_ENABLED to true in the deployed
                    website Worker and redeploy.
                  </li>
                )}
                {!setup.serviceConfigured && (
                  <li>
                    The website service key is missing; new visits and history deletion cannot be
                    processed.
                  </li>
                )}
                {setup.serviceConfigured && !setup.ingestionConnectionReady && (
                  <li>
                    The analytics service connection could not be verified. Check the website
                    service key and migration 025.
                  </li>
                )}
                {!setup.dashboardDatabaseReady && (
                  <li>
                    The analytics database query failed. Check website-content migrations, database
                    access and service health.
                  </li>
                )}
              </ul>
            </div>
          )}
        {setupError && (
          <p role="status">
            Analytics setup status could not be checked. Check the connection and sign-in.
          </p>
        )}
        <div className="analytics-filters">
          <label>
            From
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setOffset(0);
              }}
            />
          </label>
          <label>
            Through
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setOffset(0);
              }}
            />
          </label>
          <label>
            Country code
            <input
              maxLength={2}
              placeholder="All / UG"
              value={country}
              onChange={(e) => {
                setCountry(e.target.value.toUpperCase());
                setOffset(0);
              }}
            />
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
            Refresh every 20 seconds
          </label>
        </div>
        <p className="fine">
          Presence is not interaction. Giving clicks do not confirm donations. Nonconsenting
          visitors and blocked events are excluded. Dropped events today (UTC):{' '}
          {JSON.stringify(data?.quality_today || {})}.
        </p>
        {offset > 0 && <p>Automatic refresh is paused while browsing older history pages.</p>}
        {updated && <small>Updated {updated} · 30-day retention</small>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>
      <div className="cms-metrics">
        {[
          ['Live now', 'live'],
          ['Sessions started', 'sessions'],
          ['Active visitors', 'visitors'],
          ['Page views', 'pageviews'],
        ].map(([name, key]) => (
          <div key={key}>
            <span>{name}</span>
            <strong>
              {data ? Number(data[key as keyof Rows.AnalyticsData]).toLocaleString() : '—'}
            </strong>
          </div>
        ))}
      </div>
      <div className="cms-settings">
        <section className="cms-card padded">
          <h2>Countries</h2>
          {(data?.countries || []).map((c) => (
            <div className="metric-bar" key={c.country}>
              <span>{c.country === 'XX' ? 'Unknown' : c.country}</span>
              <meter min="0" max={Math.max(1, data?.sessions || 0)} value={c.sessions} />
              <strong>{c.sessions}</strong>
            </div>
          ))}
          {!data?.countries?.length && <p>No consented location data yet.</p>}
        </section>
        <section className="cms-card padded">
          <h2>Daily page views</h2>
          {(data?.days || []).map((d) => (
            <div className="metric-bar" key={d.day}>
              <span>{d.day}</span>
              <meter
                min="0"
                max={Math.max(1, ...(data?.days || []).map((x) => x.views))}
                value={d.views}
              />
              <strong>{d.views}</strong>
            </div>
          ))}
          {!data?.days?.length && <p>Visit trends will appear here.</p>}
        </section>
      </div>
      <section className="cms-card padded">
        <h2>Top pages</h2>
        {(data?.pages || []).map((p) => (
          <div className="listing-item" key={p.path}>
            <span>{p.path}</span>
            <strong>{p.views} views</strong>
          </div>
        ))}
      </section>
      <section className="cms-card padded">
        <div className="cms-toolbar">
          <h2>Session history</h2>
          <button
            className="btn outline small"
            disabled={!historyRows.length}
            onClick={() => {
              const blob = new Blob(
                [
                  csv([
                    [
                      'Session',
                      'Country',
                      'Region',
                      'City',
                      'Device',
                      'Browser',
                      'First seen (UTC)',
                      'Last active (UTC)',
                      'Last page',
                    ],
                    ...historyRows.map((v) => [
                      v.id.slice(0, 12),
                      v.country,
                      v.region,
                      v.city,
                      v.device,
                      v.browser,
                      v.first_seen,
                      v.last_seen,
                      v.last_path,
                    ]),
                  ]),
                ],
                { type: 'text/csv' },
              );
              const url = URL.createObjectURL(blob),
                a = document.createElement('a');
              a.href = url;
              a.download = 'AHF-session-page.csv';
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Export this page
          </button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Session</th>
                <th>Approx. location</th>
                <th>Device</th>
                <th>First visit / last active</th>
                <th>Last page</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <button
                      className="cms-row-title"
                      onClick={async () => {
                        const ticket = ++historyRequest.current;
                        setHistory(null);
                        setHistoryId(s.id);
                        try {
                          const rows = await api<Rows.VisitEvent[]>('analytics?session=' + s.id);
                          if (historyRequest.current === ticket) setHistory(rows);
                        } catch (e) {
                          if (historyRequest.current === ticket) setError((e as Error).message);
                        }
                      }}
                    >
                      {s.id.slice(0, 10)}…
                    </button>
                  </td>
                  <td>
                    {[s.city, s.region, s.country === 'XX' ? 'Unknown' : s.country]
                      .filter(Boolean)
                      .join(', ')}
                  </td>
                  <td>
                    {s.device}
                    <br />
                    {s.browser}
                  </td>
                  <td>
                    {new Date(s.first_seen).toLocaleString('en-GB', { timeZone: 'Africa/Kampala' })}
                    <br />
                    <small>
                      {new Date(s.last_seen).toLocaleString('en-GB', {
                        timeZone: 'Africa/Kampala',
                      })}
                    </small>
                  </td>
                  <td>{s.last_path}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!historyRows.length && (
          <p className="cms-empty">
            No consented sessions in this period. No sample visitor records are generated.
          </p>
        )}
        <div className="cms-actions">
          <button
            className="btn outline small"
            disabled={offset === 0}
            onClick={() => setOffset((v) => Math.max(0, v - 50))}
          >
            Previous 50
          </button>
          <span>
            {historyRows.length ? offset + 1 : 0}–{offset + historyRows.length}
          </span>
          <button
            className="btn outline small"
            disabled={historyRows.length < 50 || offset >= 10000}
            onClick={() => setOffset((v) => v + 50)}
          >
            Next 50
          </button>
        </div>
      </section>
      {history && (
        <section className="cms-card padded">
          <div className="cms-toolbar">
            <h2>Selected session {historyId.slice(0, 12)} · latest 200 events</h2>
            <button
              className="btn outline small"
              onClick={() => {
                historyRequest.current++;
                setHistory(null);
              }}
            >
              Close history
            </button>
          </div>
          {history.map((e, i) => (
            <div className="listing-item" key={i}>
              <span>
                {e.action} · {e.path}
              </span>
              <small>
                {new Date(e.created_at).toLocaleString('en-GB', { timeZone: 'Africa/Kampala' })}
              </small>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
