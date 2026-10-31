import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRoute } from './route-loader.mjs';
import { RequestError } from '../lib/http.ts';
import { ids } from '../lib/editorial.ts';
import { createHookHarness, flushMicrotasks } from './hook-harness.mjs';
test('readiness observes independent approval changes and checks every reference and author', async () => {
  const item = {
    id: 'record',
    version: 2,
    created_by: 'author',
    cover_id: 'cover',
    details: { gallery: '["00000000-0000-4000-8000-000000000001"]' },
  };
  let status = 'Review';
  const { contentReadiness, canEditContent } = loadRoute('lib/readiness.ts', {
    './editorial': { ids },
    './http': { RequestError },
    './backend': {
      db: async (path) =>
        path.includes('content_items')
          ? [item]
          : ['cover', '00000000-0000-4000-8000-000000000001'].map((id) => ({
              id,
              filename: id,
              status: id === 'cover' ? 'Approved' : status,
              rights_confirmed: true,
              shows_children: true,
              guardian_consent: true,
              consent_reference: 'Recorded consent',
            })),
    },
  });
  const author = { id: 'author', roles: ['editor'] };
  assert.equal((await contentReadiness('record', 'token', author)).blockers.length, 1);
  status = 'Approved';
  const refreshed = await contentReadiness('record', 'token', author);
  assert.equal(refreshed.blockers.length, 0);
  assert.equal(
    refreshed.media.find((row) => row.id === '00000000-0000-4000-8000-000000000001').status,
    'Approved',
  );
  assert.equal(canEditContent(item, { id: 'other', roles: ['editor'] }), false);
  assert.equal(canEditContent(item, { id: 'other', roles: ['administrator'] }), true);
  assert.equal(canEditContent(item, { id: 'other', roles: ['publisher'] }), false);
});

test('every content type checks its cover and gallery before submission', async () => {
  const cover = '00000000-0000-4000-8000-000000000001';
  const photo = '00000000-0000-4000-8000-000000000002';
  let kind = '';
  let galleryStatus = 'Review';
  const { contentReadiness } = loadRoute('lib/readiness.ts', {
    './editorial': { ids },
    './http': { RequestError },
    './backend': {
      db: async (path) =>
        path.includes('content_items')
          ? [
              {
                id: 'record',
                kind,
                version: 1,
                created_by: 'author',
                cover_id: cover,
                details: { gallery: JSON.stringify([photo]) },
              },
            ]
          : [cover, photo].map((id) => ({
              id,
              filename: id,
              status: id === photo ? galleryStatus : 'Approved',
              rights_confirmed: true,
              shows_children: false,
              guardian_consent: false,
              consent_reference: '',
            })),
    },
  });
  for (kind of ['campaign', 'page', 'programme', 'story', 'event', 'report', 'product']) {
    galleryStatus = 'Review';
    assert.equal(
      (await contentReadiness('record', 'token', { id: 'author', roles: ['editor'] })).blockers
        .length,
      1,
      kind,
    );
    galleryStatus = 'Approved';
    assert.equal(
      (await contentReadiness('record', 'token', { id: 'author', roles: ['editor'] })).blockers
        .length,
      0,
      kind,
    );
  }
});

test('analytics accepts custom public pages but excludes private routes and rotates idle sessions', async () => {
  const { publicPath } = await import('../lib/visitor.ts');
  const { visitSession } = await import('../lib/visit-session.ts');
  const { analyticsFilters } = await import('../lib/analytics-filters.ts');
  assert.equal(publicPath('/community-help?private=hidden'), '/community-help');
  for (const path of ['/holyghost', '/api', '/media/test', '/admin'])
    assert.equal(publicPath(path), null);
  const prior = JSON.stringify({ id: 'first', time: 0 });
  assert.equal(visitSession(prior, 29 * 60000, () => 'new').id, 'first');
  assert.equal(visitSession(prior, 31 * 60000, () => 'new').id, 'new');
  assert.throws(() => analyticsFilters('2026-02-31', '2026-03-05', '', '0'));
  assert.throws(() => analyticsFilters('2026-02-01', '2026-03-05', '', 'Infinity'));
  assert.throws(() => analyticsFilters('2026-03-05', '2026-02-01', '', '0'));
  assert.equal(
    analyticsFilters('2026-02-01', '2026-02-01', 'ug', '0').end_at,
    '2026-02-01T21:00:00.000Z',
  );
});

test('delivery Retry-After is parsed and bounded without accepting malformed delays', async () => {
  const { retryAfter } = await import('../lib/retry-after.ts');
  assert.equal(retryAfter('3600'), 3600);
  assert.equal(retryAfter('999999'), 86400);
  assert.equal(retryAfter('invalid'), null);
  assert.equal(retryAfter('-1'), null);
  assert.equal(retryAfter('Thu, 01 Jan 1970 00:01:00 GMT', 0), 60);
});

test('collector records navigation, rotates idle sessions and tolerates blocked storage', async () => {
  const jsx = await import('react/jsx-runtime'),
    session = await import('../lib/visit-session.ts');
  const hooks = createHookHarness();
  let path = '/',
    now = 0;
  const sent = [],
    requests = [],
    timers = [];
  const local = new Map([['ahf-analytics-consent', 'yes']]),
    tab = new Map();
  const storage = (map) => ({
    getItem: (k) => map.get(k) || null,
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  });
  const document = new EventTarget();
  document.visibilityState = 'visible';
  document.referrer = '';
  class Clock extends Date {
    static now() {
      return now;
    }
  }
  const mocks = {
    'react/jsx-runtime': jsx,
    react: { ...hooks.react, useSyncExternalStore: (_subscribe, read) => read() },
    './app-link': { default: () => null },
    'next/navigation': { usePathname: () => path },
    '@/lib/visit-session': session,
    window: new EventTarget(),
    document,
    location: {
      get pathname() {
        return path;
      },
    },
    localStorage: storage(local),
    sessionStorage: storage(tab),
    navigator: { doNotTrack: '0' },
    Date: Clock,
    setInterval: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    clearInterval() {},
    fetch: async (_url, init) => {
      sent.push(JSON.parse(init.body));
      requests.push(init);
      return new Response('{}');
    },
  };
  const { default: Consent } = loadRoute('components/visitor-consent.tsx', mocks);
  hooks.render(Consent, { enabled: true });
  await flushMicrotasks();
  path = '/community-help';
  hooks.render(Consent, { enabled: true });
  await flushMicrotasks();
  assert.equal(sent.filter((v) => v.action === 'view').length, 2);
  assert.equal(
    requests[0].signal?.aborted ?? false,
    false,
    'Navigation must not cancel an already sent view',
  );
  now = 31 * 60000;
  timers.at(-1)();
  await flushMicrotasks();
  assert.notEqual(sent[0].session, sent.at(-1).session);
  hooks.unmount();
  const blockedHooks = createHookHarness();
  mocks.react = { ...blockedHooks.react, useSyncExternalStore: (_subscribe, read) => read() };
  mocks.sessionStorage = {
    getItem() {
      throw Error('Storage blocked');
    },
  };
  const { default: Blocked } = loadRoute('components/visitor-consent.tsx', mocks);
  assert.doesNotThrow(() => blockedHooks.render(Blocked, { enabled: true }));
  blockedHooks.unmount();
});

test('Home uses bounded summaries and campaign pages rather than a full table scan', async () => {
  const requests = [];
  const row = (kind, slug) => ({
    id: slug,
    kind,
    slug,
    title: slug,
    summary: 'Summary',
    details: {},
    cover_id: null,
  });
  const { publishedHome } = loadRoute('lib/backend.ts', {
    './paging': {
      readAllRows() {
        throw Error('Home must not scan full collections');
      },
    },
    react: { cache: (fn) => fn },
    './public-content': {},
    './db-error': { dbError: () => Error('Unexpected backend error') },
    './http': await import('../lib/http.ts'),
    'cloudflare:workers': {
      env: {
        AHF_CONTENT_SUPABASE_URL: 'https://test.invalid',
        AHF_CONTENT_SUPABASE_ANON_KEY: 'test',
      },
    },
    './assurance': {},
    './content': { seed: [] },
    fetch: async (url) => {
      requests.push(url);
      return Response.json(
        url.includes('kind=eq.campaign')
          ? Array.from({ length: url.includes('offset=12') ? 1 : 13 }, (_, i) =>
              row('campaign', 'campaign-' + i),
            )
          : [],
      );
    },
  });
  const first = await publishedHome(0);
  assert.equal(first.items.length, 12);
  assert.equal(first.hasMore, true);
  assert.equal(requests.length, 5);
  const second = await publishedHome(1);
  assert.equal(second.items.length, 1);
  assert.equal(second.hasMore, false);
  assert.ok(requests.some((v) => v.includes('offset=12')));
});
