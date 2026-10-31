import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notificationTarget } from '../lib/notification-target.ts';
import { uuidPattern } from '../lib/editorial.ts';
import { RequestError, errorResponse } from '../lib/http.ts';
import { loadRoute } from './route-loader.mjs';
const notice = '00000000-0000-4000-8000-000000000001';
const item = '00000000-0000-4000-8000-000000000002';
test('notification targets only recognized local records', () => {
  assert.equal(notificationTarget('content_items/' + item + '/2').resource, 'content');
  assert.equal(notificationTarget('website_media/' + item + '/3').resource, 'media');
  assert.equal(notificationTarget('due/' + item + '/day').resource, 'enquiry');
  assert.equal(notificationTarget('https://evil.test/' + item), null);
  assert.equal(notificationTarget('content_items/not-a-uuid'), null);
});
test('target lookup respects notification ownership and record visibility', async () => {
  let own = true,
    visible = true;
  const route = loadRoute('app/api/notification-target/route.ts', {
    '@/lib/backend': {
      authorize: async () => ({ token: 'test', profile: { id: item } }),
      json: (v, status = 200) => Response.json(v, { status }),
      db: async (path) =>
        path.includes('website_notifications')
          ? own
            ? [{ source_key: 'website_media/' + item + '/1' }]
            : []
          : visible
            ? [{ id: item }]
            : [],
    },
    '@/lib/editorial': { uuidPattern },
    '@/lib/http': { RequestError, errorResponse },
    '@/lib/notification-target': { notificationTarget },
  });
  const request = () => new Request('https://test.invalid/api/notification-target?id=' + notice);
  let response = await route.GET(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).target, 'media');
  visible = false;
  response = await route.GET(request());
  assert.equal(response.status, 404);
  own = false;
  response = await route.GET(request());
  assert.equal(response.status, 404);
});
