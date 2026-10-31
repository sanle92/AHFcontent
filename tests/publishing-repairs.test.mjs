import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeApiResponse } from '../lib/api-response.ts';
import { RequestError, errorResponse } from '../lib/http.ts';
import { loadRoute } from './route-loader.mjs';
import { createHookHarness, flushMicrotasks } from './hook-harness.mjs';
test('every editorial mutation returns a JSON error when its RPC rejects', async () => {
  const backend = {
    authorize: async () => ({ token: 'test', profile: { roles: ['publisher'] } }),
    sameOrigin() {},
    db: async () => {
      throw new RequestError('Choose approved media before publication.');
    },
    json: (v, status = 200) => Response.json(v, { status }),
  };
  const route = loadRoute('app/api/editorial/route.ts', {
    '@/lib/publication-state': { publicationState: async (rows) => rows },
    '@/lib/readiness': { contentReadiness: async () => ({ canSubmit: true, blockers: [] }) },
    '@/lib/http': { RequestError, errorResponse },
    '@/lib/backend': backend,
    'cloudflare:workers': { env: {}, waitUntil() {} },
    '@/lib/mail': { mailConfig: () => ({}) },
    '@/lib/push': { dispatchPush: async () => ({}) },
    '@/lib/content': { validateContent: (v) => v },
    '@/lib/request-schemas': { parseRequest: (r) => r.json(), editorialBody: {} },
  });
  for (const action of ['save', 'transition', 'restore', 'assign', 'priority', 'enquiry']) {
    const r = await route.POST(
      new Request('https://example.org/api/editorial', {
        method: 'POST',
        body: JSON.stringify({ action, payload: {} }),
      }),
    );
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /approved media/);
  }
});
test('browser transport handles non-JSON and empty errors without exposing HTML', () => {
  for (const [status, body, type] of [
    [502, '<html>private gateway details</html>', 'text/html'],
    [500, '', ''],
    [200, '{', 'application/json'],
  ])
    assert.throws(
      () => decodeApiResponse(status, body, type),
      (e) => e.message.includes('HTTP ' + status) && !e.message.includes('private gateway'),
    );
  assert.equal(decodeApiResponse(204, '', ''), undefined);
  assert.throws(
    () => decodeApiResponse(409, '{"error":"Record changed; reload."}', 'application/json'),
    /Record changed/,
  );
  assert.deepEqual(decodeApiResponse(200, '{"ok":true}', 'application/json'), { ok: true });
});

test('About and custom pages render the cover from their published record', async () => {
  const React = await import('react');
  const jsx = await import('react/jsx-runtime');
  const icons = await import('lucide-react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const content = await import('../lib/content.ts');
  const empty = () => null;
  const mocks = {
    'react/jsx-runtime': jsx,
    'lucide-react': icons,
    '@/lib/content': content,
    './app-link': { default: ({ children, ...p }) => React.createElement('a', p, children) },
    './app-image': { default: (p) => React.createElement('img', p) },
    './home-sections': { default: empty, AppealCards: empty, personalHelp: () => false },
    './kids-showcase': { default: empty },
    './content-extras': { default: empty },
    './portfolio': { ApprovedVideo: empty },
    './visitor-consent': { default: empty },
    'cloudflare:workers': { env: {}, waitUntil() {} },
    '@/lib/backend': { config: () => ({ url: 'test' }) },
    '@/lib/editorial': { ids: () => [] },
    '@/lib/public-assets': {
      approvedAssets: () => [
        { id: 'approved-cover', mime: 'image/jpeg', alt_text: 'Approved cover' },
      ],
    },
    './enquiry-form': { default: empty },
    './donation-methods': { default: empty },
  };
  const { default: Website } = loadRoute('components/website.tsx', mocks);
  for (const slug of ['about', 'custom-page', 'contact']) {
    const item = {
      id: slug,
      kind: 'page',
      slug,
      title: 'Published page',
      summary: '',
      body: 'Public copy',
      details: {},
      cover_id: 'approved-cover',
    };
    const html = renderToStaticMarkup(await Website({ path: '/' + slug, content: [item] }));
    assert.ok(html.includes('src="/media/approved-cover"'), slug);
    assert.equal((html.match(/<h1>/g) || []).length, 1, slug + ' heading');
    assert.equal((html.match(/Public copy/g) || []).length, 1, slug + ' body');
  }
});

test('programme listings and detail pages render approved covers and withhold withdrawn files', async () => {
  const React = await import('react'),
    jsx = await import('react/jsx-runtime'),
    content = await import('../lib/content.ts'),
    icons = await import('lucide-react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const empty = () => null;
  const programme = {
    id: 'education',
    kind: 'programme',
    slug: 'education',
    title: 'Education programme',
    summary: 'Support learning',
    body: 'Reviewed programme description',
    details: {},
    cover_id: 'approved-cover',
  };
  let assets = [{ id: 'approved-cover', mime: 'image/jpeg', alt_text: 'Approved programme cover' }];
  const mocks = {
    'react/jsx-runtime': jsx,
    'lucide-react': icons,
    '@/lib/content': content,
    './app-link': { default: ({ children, ...p }) => React.createElement('a', p, children) },
    './app-image': { default: (p) => React.createElement('img', p) },
    './home-sections': { default: empty, AppealCards: empty, personalHelp: () => false },
    './kids-showcase': { default: empty },
    './content-extras': { default: empty },
    './portfolio': { ApprovedVideo: empty },
    './visitor-consent': { default: empty },
    'cloudflare:workers': { env: {}, waitUntil() {} },
    '@/lib/backend': { config: () => ({ url: 'test' }) },
    '@/lib/editorial': { ids: () => [] },
    '@/lib/public-assets': { approvedAssets: () => assets },
    './enquiry-form': { default: empty },
    './donation-methods': { default: empty },
  };
  const { default: Website } = loadRoute('components/website.tsx', mocks);
  for (const path of ['/programmes', '/programmes/education']) {
    let html = renderToStaticMarkup(await Website({ path, content: [programme] }));
    assert.ok(html.includes('src="/media/approved-cover"'), path);
    assert.ok(html.includes('alt="Approved programme cover"'), path);
    assets = [];
    html = renderToStaticMarkup(await Website({ path, content: [programme] }));
    assert.ok(!html.includes('src="/media/approved-cover"'), path + ' withdrawn');
    assets = [{ id: 'approved-cover', mime: 'image/jpeg', alt_text: 'Approved programme cover' }];
  }
  const { default: HomeSections } = loadRoute('components/home-sections.tsx', mocks);
  const home = renderToStaticMarkup(HomeSections({ content: [programme] }));
  assert.ok(home.includes('src="/media/approved-cover"'));
});

test('cover selection previews immediately, retains a new upload option and fences stale previews', async () => {
  const jsx = await import('react/jsx-runtime');
  const hooks = createHookHarness();
  let dirty = 0;
  const pending = new Map();
  const { default: CoverPicker } = loadRoute('components/cover-picker.tsx', {
    'react/jsx-runtime': jsx,
    react: hooks.react,
    window: new EventTarget(),
    './app-image': { default: () => null },
    './app-link': { default: () => null },
  });
  const media = ['first', 'second'].map((id) => ({
    id,
    mime: 'image/jpeg',
    filename: id + '.jpg',
    status: 'Approved',
  }));
  const props = {
    value: '',
    media,
    report: false,
    disabled: false,
    onSelectionChange: () => {
      dirty++;
    },
    onPreview: (id) => new Promise((resolve) => pending.set(id, resolve)),
    onUpload: async () => ({
      id: 'uploaded',
      mime: 'image/jpeg',
      filename: 'new.jpg',
      status: 'Draft',
    }),
  };
  const render = () => hooks.render(CoverPicker, props);
  const find = (node, predicate) => {
    if (!node || typeof node !== 'object') return undefined;
    if (Array.isArray(node)) return node.map((n) => find(n, predicate)).find(Boolean);
    return predicate(node) ? node : find(node.props?.children, predicate);
  };
  let tree = render();
  find(tree, (n) => n.type === 'select').props.onChange({ target: { value: 'first' } });
  tree = render();
  await flushMicrotasks();
  find(tree, (n) => n.type === 'select').props.onChange({ target: { value: 'second' } });
  tree = render();
  await flushMicrotasks();
  pending.get('second')('/signed-second');
  await flushMicrotasks();
  pending.get('first')('/signed-first');
  await flushMicrotasks();
  tree = render();
  assert.ok(find(tree, (n) => n.props?.src === '/signed-second'));
  assert.ok(!find(tree, (n) => n.props?.src === '/signed-first'));
  await find(tree, (n) => n.props?.type === 'file').props.onChange({
    currentTarget: { files: [{ name: 'new.jpg' }], value: 'new.jpg' },
  });
  tree = render();
  await flushMicrotasks();
  pending.get('uploaded')('/signed-uploaded');
  await flushMicrotasks();
  tree = render();
  assert.equal(find(tree, (n) => n.type === 'select').props.value, 'uploaded');
  assert.ok(find(tree, (n) => n.type === 'option' && n.props.value === 'uploaded'));
  assert.ok(find(tree, (n) => n.props?.src === '/signed-uploaded'));
  find(tree, (n) => n.type === 'button' && n.props.children === 'Remove selection').props.onClick();
  tree = render();
  assert.equal(find(tree, (n) => n.type === 'select').props.value, '');
  assert.equal(dirty, 4);
  hooks.unmount();
});

test('history deletion reaches the service RPC when new analytics recording is disabled', async () => {
  const { parseRequest, visitBody } = await import('../lib/request-schemas.ts');
  const visitor = await import('../lib/visitor.ts');
  const { uuidPattern } = await import('../lib/editorial.ts');
  const http = await import('../lib/http.ts');
  let calls = 0;
  const route = loadRoute('app/api/visits/route.ts', {
    '@/lib/http': http,
    '@/lib/request-schemas': { parseRequest, visitBody },
    'cloudflare:workers': { env: { AHF_ANALYTICS_ENABLED: 'false' } },
    '@/lib/backend': {
      sameOrigin() {},
      config: () => ({ service: 'test' }),
      db: async (path) => {
        assert.ok(path.endsWith('forget_website_visits'));
        calls++;
      },
      json: (v, status = 200) => Response.json(v, { status }),
    },
    '@/lib/visitor': visitor,
    '@/lib/editorial': { uuidPattern },
  });
  const r = await route.POST(
    new Request('https://example.org/api/visits', {
      method: 'POST',
      body: JSON.stringify({ visitor: '00000000-0000-4000-8000-000000000001', action: 'forget' }),
    }),
  );
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true });
  assert.equal(calls, 1);
});
test('multipart streams are bounded before parsing and extra files/fields are rejected', async () => {
  const { readMultipartLimited } = await import('../lib/http.ts');
  const make = () => {
    const form = new FormData();
    form.set('file', new Blob(['file bytes']), 'file.jpg');
    return new Request('https://example.org', { method: 'POST', body: form });
  };
  assert.equal((await readMultipartLimited(make(), 2000)).get('file').name, 'file.jpg');
  const body = make();
  const bytes = new Uint8Array(await body.arrayBuffer());
  const streamed = new Request(body.url, {
    method: 'POST',
    headers: body.headers,
    body: new ReadableStream({
      start(c) {
        c.enqueue(bytes);
        c.close();
      },
    }),
    duplex: 'half',
  });
  await assert.rejects(
    () => readMultipartLimited(streamed, 10),
    (e) => e.status === 413,
  );
  const extra = new FormData();
  extra.append('file', new Blob(['one']), 'one.jpg');
  extra.append('file', new Blob(['two']), 'two.jpg');
  await assert.rejects(
    () =>
      readMultipartLimited(
        new Request('https://example.org', { method: 'POST', body: extra }),
        2000,
      ),
    /exactly one/,
  );
});
test('old session capabilities fail after logout or account switching', async () => {
  const { assertCurrentSession } = await import('../lib/session-current.ts');
  assert.doesNotThrow(() => assertCurrentSession('one', JSON.stringify({ access_token: 'one' })));
  for (const stored of [null, 'broken', JSON.stringify({ access_token: 'two' })])
    assert.throws(
      () => assertCurrentSession('one', stored),
      (e) => e.name === 'AbortError',
    );
});

test('a large portfolio resolves every requested asset in bounded approved batches', async () => {
  const { approvedAssets } = await import('../lib/public-assets.ts');
  const ids = Array.from({ length: 451 }, (_, i) => 'asset-' + i);
  const sizes = [];
  const rows = await approvedAssets([...ids, ids[0]], async (batch) => {
    sizes.push(batch.length);
    return batch.map((id) => ({ id }));
  });
  assert.deepEqual(sizes, [200, 200, 51]);
  assert.deepEqual(
    rows.map((r) => r.id),
    ids,
  );
});

test('complete legacy/public reads continue when the backend returns a short capped batch', async () => {
  const { readAllRows } = await import('../lib/paging.ts');
  const source = Array.from({ length: 1051 }, (_, i) => i);
  const offsets = [];
  const result = await readAllRows(async (offset) => {
    offsets.push(offset);
    return source.slice(offset, offset + 300);
  });
  assert.equal(result.length, 1051);
  assert.deepEqual(offsets, [0, 300, 600, 900, 1051]);
});

test('database and route errors keep authentication, validation, throttling and outages distinct', async () => {
  const { dbError } = await import('../lib/db-error.ts');
  for (const [value, httpStatus, expected] of [
    [{}, 401, 401],
    [{}, 403, 403],
    [{ message: 'Record changed; reload.' }, 400, 409],
    [{ message: 'Too many requests; please try again later.' }, 400, 429],
    [{ code: '42P01' }, 400, 503],
    [{ message: 'private SQL details' }, 500, 503],
  ]) {
    const response = errorResponse(dbError(value, httpStatus));
    assert.equal(response.status, expected);
    assert.ok(!(await response.text()).includes('private SQL'));
  }
  const parser = errorResponse(new SyntaxError('private parser text'));
  assert.equal(parser.status, 503);
  assert.ok(!(await parser.text()).includes('private parser'));
});
test('canonical URLs use the confirmed HTTPS origin and one Aminia Kids landing URL', async () => {
  const { canonicalUrl } = await import('../lib/metadata.ts');
  assert.equal(
    canonicalUrl('https://example.org', '/programmes/aminia-kids'),
    'https://example.org/aminia-kids',
  );
  assert.equal(canonicalUrl('http://localhost:3000', '/'), undefined);
  assert.equal(canonicalUrl('https://user:password@example.org', '/'), undefined);
});

test('mutation schemas reject missing references and invalid transitions before a database call', async () => {
  const { editorialBody, mediaBody } = await import('../lib/request-schemas.ts');
  const id = '00000000-0000-4000-8000-000000000001';
  for (const value of [
    { action: 'transition' },
    { action: 'restore', version: 1 },
    { action: 'priority', id, version: 1, level: 'Owner' },
    { action: 'transition', id, version: 1, target: 'Scheduled', scheduled_at: 'bad-date' },
  ])
    assert.equal(editorialBody.safeParse(value).success, false);
  assert.equal(
    editorialBody.safeParse({ action: 'transition', id, version: 1, target: 'Review' }).success,
    true,
  );
  assert.equal(editorialBody.safeParse({ action: 'save', payload: {} }).success, true);
  assert.equal(mediaBody.safeParse({}).success, false);
  assert.equal(
    mediaBody.safeParse({ id, version: 1, target: 'Review', payload: {} }).success,
    true,
  );
  assert.equal(
    mediaBody.safeParse({ action: 'video', url: 'https://youtu.be/abcdefghijk' }).success,
    false,
  );
});

test('approved media proxies conditional/range responses and checks withdrawal before upstream access', async () => {
  const { PUBLIC_MEDIA_CACHE } = await import('../lib/cache-policy.ts');
  let approved = true,
    calls = 0,
    status = 304;
  const media = loadRoute('app/media/[id]/route.ts', {
    '@/lib/http': await import('../lib/http.ts'),
    '@/lib/cache-policy': { PUBLIC_MEDIA_CACHE },
    '@/lib/backend': {
      config: () => ({ url: 'https://storage.example.org', key: 'test' }),
      db: async () => (approved ? [{ object_path: 'test/clip.mp4', mime: 'video/mp4' }] : []),
      json: (v, status = 200) => Response.json(v, { status }),
    },
    fetch: async (_url, init) => {
      calls++;
      assert.equal(init.headers['If-None-Match'], '"version"');
      return new Response(null, {
        status,
        headers:
          status === 416
            ? { 'Content-Range': 'bytes */100' }
            : { ETag: '"version"', 'Accept-Ranges': 'bytes' },
      });
    },
  });
  const request = () =>
    new Request('https://example.org/media/00000000-0000-4000-8000-000000000001', {
      headers: { 'If-None-Match': '"version"', Range: 'bytes=0-20', 'If-Range': '"version"' },
    });
  const params = { params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000001' }) };
  let r = await media.GET(request(), params);
  assert.equal(r.status, 304);
  assert.equal(r.headers.get('ETag'), '"version"');
  assert.equal(await r.text(), '');
  status = 416;
  r = await media.GET(request(), params);
  assert.equal(r.status, 416);
  assert.equal(r.headers.get('Content-Range'), 'bytes */100');
  status = 503;
  r = await media.GET(request(), params);
  assert.equal(r.status, 503);
  approved = false;
  r = await media.GET(request(), params);
  assert.equal(r.status, 404);
  assert.equal(calls, 3);
});
test('push dispatch drains bounded batches with lease-bound completion', async () => {
  const visitor = await import('../lib/visitor.ts');
  let claims = 0,
    finished = 0;
  const backend = {
    config: () => ({ service: 'test' }),
    db: async (path, _token, init) => {
      if (path.endsWith('website_due_reminders')) return null;
      if (path.endsWith('claim_website_push_v2')) {
        claims++;
        return Array.from({ length: 16 }, (_, i) => ({
          job_id: claims + '-' + i,
          lease_token: 'lease-' + claims,
          payload: { endpoint: 'https://fcm.googleapis.com/send/test' },
          title: 'Test',
          body: 'Test',
        }));
      }
      if (path.endsWith('finish_website_push_v2')) {
        assert.ok(JSON.parse(init.body).lease.startsWith('lease-'));
        finished++;
        return null;
      }
      throw Error('Unexpected DB call ' + path);
    },
  };
  const push = loadRoute('lib/push.ts', {
    './retry-after': { retryAfter: () => null },
    './types': {},
    './backend': backend,
    './visitor': visitor,
    'cloudflare:workers': {
      env: {
        AHF_VAPID_PUBLIC_KEY: 'test',
        AHF_VAPID_PRIVATE_KEY: 'test',
        AHF_VAPID_SUBJECT: 'mailto:test@example.org',
      },
    },
    'web-push': {
      default: {
        generateRequestDetails: (payload) => ({
          endpoint: payload.endpoint,
          headers: {},
          body: 'mocked encrypted push',
        }),
      },
    },
    fetch: async () => new Response(null, { status: 201 }),
  });
  assert.deepEqual({ ...(await push.dispatchPush()) }, { sent: 48, configured: true });
  assert.equal(claims, 3);
  assert.equal(finished, 48);
});
test('known result totals avoid an unnecessary EOF request for a detail query', async () => {
  const { readAllRows } = await import('../lib/paging.ts');
  let calls = 0;
  assert.deepEqual(
    await readAllRows(
      async () => {
        calls++;
        return ['detail', 'settings'];
      },
      () => 2,
    ),
    ['detail', 'settings'],
  );
  assert.equal(calls, 1);
});

test('overview review action opens the pending content type rather than always opening stories', async () => {
  const jsx = await import('react/jsx-runtime');
  const { default: Panels } = loadRoute('components/workspace-panels.tsx', {
    'react/jsx-runtime': jsx,
    '@/hooks/use-clock': { useClock: () => 0 },
  });
  const item = {
    id: 'campaign',
    kind: 'campaign',
    status: 'Review',
    title: 'Review campaign',
    details: {},
  };
  let opened;
  const tree = Panels({
    section: 'overview',
    roles: ['publisher'],
    summary: { content_review: 1 },
    items: [item],
    media: [],
    enquiries: [],
    mail: [],
    integrations: {},
    engagement: [],
    onChoose() {
      throw Error('Wrong navigation');
    },
    onOpen: (value) => {
      opened = value;
    },
    onSettings() {},
  });
  const nodes = [];
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'button') nodes.push(n);
    for (const child of [n.props?.children].flat(Infinity)) walk(child);
  };
  walk(tree);
  const text = (n) =>
    typeof n === 'string'
      ? n
      : Array.isArray(n)
        ? n.map(text).join('')
        : n?.props
          ? text(n.props.children)
          : '';
  const button = nodes.find((n) => text(n).includes('Awaiting content review'));
  assert.ok(button);
  button.props.onClick();
  assert.equal(opened, item);
});

test('normal token rotation retains one login capability while logout/account changes revoke it', async () => {
  const { assertCurrentSession, currentSessionToken } = await import('../lib/session-current.ts');
  const token = (sub, session, nonce, aal = 'aal2') =>
    'header.' +
    Buffer.from(JSON.stringify({ sub, session_id: session, aal })).toString('base64url') +
    '.' +
    nonce;
  const old = token('staff-one', 'login-one', 'old');
  const latest = token('staff-one', 'login-one', 'refreshed');
  assert.equal(currentSessionToken(old, JSON.stringify({ access_token: latest })), latest);
  assert.doesNotThrow(() =>
    assertCurrentSession(
      old,
      JSON.stringify({ access_token: token('staff-one', 'login-one', 'refreshed') }),
    ),
  );
  for (const next of [
    token('staff-two', 'login-two', 'new'),
    token('staff-one', 'different-login', 'new'),
    token('staff-one', 'login-one', 'downgraded', 'aal1'),
  ])
    assert.throws(
      () => assertCurrentSession(old, JSON.stringify({ access_token: next })),
      (e) => e.name === 'AbortError',
    );
});

test('device cleanup revokes the old registration without unsubscribing a newer login', async () => {
  const jsx = await import('react/jsx-runtime');
  let unsubscribed = 0,
    revoked = 0;
  const { disableDevice } = loadRoute('components/admin-device.tsx', {
    'react/jsx-runtime': jsx,
    react: {},
    navigator: {
      serviceWorker: {
        getRegistration: async () => ({
          pushManager: {
            getSubscription: async () => ({
              toJSON: () => ({ endpoint: 'test' }),
              unsubscribe: async () => {
                unsubscribed++;
              },
            }),
          },
        }),
      },
    },
  });
  await disableDevice(
    async () => {
      revoked++;
    },
    () => false,
  );
  assert.equal(revoked, 1);
  assert.equal(unsubscribed, 0);
  await assert.rejects(
    () =>
      disableDevice(async () => {
        throw new DOMException('Session changed', 'AbortError');
      }),
    (e) => e.name === 'AbortError',
  );
  assert.equal(unsubscribed, 0);
  await disableDevice(async () => {});
  assert.equal(unsubscribed, 1);
});

test('Kids programme facts and updates render without duplicating the portfolio; page vision/mission render', async () => {
  const React = await import('react'),
    jsx = await import('react/jsx-runtime'),
    editorial = await import('../lib/editorial.ts');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: Extras } = loadRoute('components/content-extras.tsx', {
    'react/jsx-runtime': jsx,
    '@/lib/editorial': editorial,
    './portfolio': {
      Gallery: () => React.createElement('span', null, 'GALLERY'),
      ApprovedVideo: () => React.createElement('span', null, 'VIDEO'),
    },
    './app-link': { default: ({ children, ...p }) => React.createElement('a', p, children) },
  });
  const item = {
    id: 'kids',
    kind: 'programme',
    details: {
      objectives: 'Reviewed objectives',
      activities: 'Reviewed activities',
      participation: 'Parent enquiries',
      video_id: 'video',
      updates: JSON.stringify([{ date: '2026-10-25', text: 'Reviewed progress' }]),
    },
  };
  const html = renderToStaticMarkup(Extras({ item, content: [], assets: [], portfolio: false }));
  for (const value of [
    'Reviewed objectives',
    'Reviewed activities',
    'Parent enquiries',
    'Reviewed progress',
  ])
    assert.ok(html.includes(value));
  assert.ok(!html.includes('VIDEO'));
  const page = renderToStaticMarkup(
    Extras({
      item: {
        id: 'page',
        kind: 'page',
        details: { vision: 'Reviewed vision', mission: 'Reviewed mission' },
      },
      content: [],
      assets: [],
    }),
  );
  assert.ok(page.includes('Reviewed vision'));
  assert.ok(page.includes('Reviewed mission'));
});
