import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cachePolicy,
  PUBLIC_HTML_CACHE,
  PUBLIC_MEDIA_CACHE,
  STATIC_CACHE,
  MUTABLE_ASSET_CACHE,
} from '../lib/cache-policy.ts';
import { pageItem, publicQuery } from '../lib/public-content.ts';
const policy = (path, headers = {}, status = 200, type = 'text/html') =>
  cachePolicy(
    new Request('https://example.org' + path, { headers }),
    new Response(null, { status, headers: { 'Content-Type': type } }),
  );
test('private and authenticated requests never enter shared caches', () => {
  for (const p of ['/holyghost', '/holyghost/x', '/api/enquiry', '/api'])
    assert.equal(policy(p), 'no-store');
  for (const h of [
    { Authorization: 'Bearer token' },
    { Cookie: 'session=x' },
    { RSC: '1' },
    { 'Next-Router-State-Tree': 'x' },
  ])
    assert.equal(policy('/about', h), 'no-store');
  assert.equal(policy('/about', {}, 500), 'no-store');
  assert.equal(policy('/media/id', {}, 404), 'no-store');
});
test('public HTML, static assets and approved media have bounded cache windows', () => {
  assert.equal(policy('/about'), PUBLIC_HTML_CACHE);
  assert.equal(policy('/media/id', {}, 206, 'video/mp4'), PUBLIC_MEDIA_CACHE);
  assert.equal(policy('/media/id', {}, 304, 'video/mp4'), PUBLIC_MEDIA_CACHE);
  assert.equal(policy('/images/logo.png', {}, 200, 'image/jpeg'), MUTABLE_ASSET_CACHE);
  assert.equal(policy('/icons/admin.png', {}, 200, 'image/png'), MUTABLE_ASSET_CACHE);
  assert.equal(policy('/_next/static/chunk.abc.js', {}, 200, 'text/javascript'), STATIC_CACHE);
  assert.equal(policy('/ahf-admin-sw.js', {}, 200, 'text/javascript'), 'no-store');
  assert.equal(
    cachePolicy(
      new Request('https://example.org/about'),
      new Response('', { headers: { 'Set-Cookie': 'session=x', 'Content-Type': 'text/html' } }),
    ),
    'no-store',
  );
});
test('metadata resolves kind and slug; detail queries exclude unrelated full collections', () => {
  const rows = [
    { id: 'a', kind: 'campaign', slug: 'shared', title: 'Campaign' },
    { id: 'b', kind: 'story', slug: 'shared', title: 'Story' },
  ];
  assert.equal(pageItem(rows, '/stories/shared').title, 'Story');
  assert.equal(pageItem(rows, '/campaigns/shared').title, 'Campaign');
  assert.match(publicQuery('/stories/shared'), /kind.eq.story,slug.eq.shared/);
  assert.ok(!publicQuery('/stories/shared').includes('kind.in.'));
});
