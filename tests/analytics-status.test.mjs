import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRoute } from './route-loader.mjs';
import { RequestError, errorResponse } from '../lib/http.ts';
import { analyticsFilters } from '../lib/analytics-filters.ts';
import { kampalaDate } from '../lib/kampala-date.ts';
test('analytics status reports configuration and database failures only to administrators', async () => {
  let role = 'administrator',
    ready = true,
    service = '';
  const route = loadRoute('app/api/analytics/route.ts', {
    '@/lib/analytics-filters': { analyticsFilters },
    '@/lib/kampala-date': { kampalaDate },
    '@/lib/http': { RequestError, errorResponse },
    'cloudflare:workers': { env: { AHF_ANALYTICS_ENABLED: 'true' } },
    '@/lib/backend': {
      authorize: async () => ({ token: 'test', profile: { roles: [role] } }),
      config: () => ({ service }),
      json: (v, status = 200) => Response.json(v, { status }),
      db: async (path) => {
        if (!ready) throw Error('private backend details');
        return path.includes('ingest_health') ? true : {};
      },
    },
  });
  const request = () => new Request('https://example.org/api/analytics?status=1');
  let response = await route.GET(request());
  assert.deepEqual(await response.json(), {
    collectionEnabled: true,
    serviceConfigured: false,
    dashboardDatabaseReady: true,
    ingestionConnectionReady: false,
  });
  service = 'configured';
  response = await route.GET(request());
  assert.equal((await response.json()).ingestionConnectionReady, true);
  ready = false;
  response = await route.GET(request());
  const body = await response.text();
  assert.match(body, /"dashboardDatabaseReady":false/);
  assert.doesNotMatch(body, /private backend details/);
  role = 'editor';
  response = await route.GET(request());
  assert.equal(response.status, 403);
});

test('analytics dates use Kampala calendar days across midnight', () => {
  assert.equal(kampalaDate(Date.parse('2026-10-30T20:59:59Z')), '2026-10-30');
  assert.equal(kampalaDate(Date.parse('2026-10-30T21:00:00Z')), '2026-10-31');
});
