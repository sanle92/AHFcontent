import { analyticsFilters } from '@/lib/analytics-filters';
import { kampalaDate } from '@/lib/kampala-date';
import { errorResponse, RequestError } from '@/lib/http';
import { authorize, config, db, json } from '@/lib/backend';
import { env } from 'cloudflare:workers';
export async function GET(r: Request) {
  try {
    const { token, profile } = await authorize(r);
    if (!profile.roles.includes('administrator')) throw new RequestError('Access denied.', 403);
    const q = new URL(r.url).searchParams;
    if (q.get('status') === '1') {
      let dashboardDatabaseReady = false;
      try {
        const end = new Date();
        await db('/rest/v1/rpc/website_analytics', token, {
          method: 'POST',
          body: JSON.stringify({
            start_at: new Date(end.getTime() - 86400000).toISOString(),
            end_at: end.toISOString(),
            selected_country: '',
            page_offset: 0,
          }),
        });
        dashboardDatabaseReady = true;
      } catch {
        /* Report availability without exposing backend details. */
      }
      const service = config().service;
      let ingestionConnectionReady = false;
      if (service) {
        try {
          ingestionConnectionReady =
            (await db<boolean>('/rest/v1/rpc/website_analytics_ingest_health', service, {
              method: 'POST',
              body: '{}',
            })) === true;
        } catch {
          /* The service credential or migration may be unavailable. */
        }
      }
      return json({
        collectionEnabled:
          (env as unknown as Record<string, string>).AHF_ANALYTICS_ENABLED === 'true',
        serviceConfigured: !!service,
        dashboardDatabaseReady,
        ingestionConnectionReady,
      });
    }

    if (q.get('session') && !/^[a-f0-9]{64}$/.test(q.get('session')!))
      throw new RequestError('Choose a valid session.');
    if (q.get('session'))
      return json(
        await db('/rest/v1/rpc/website_visit_history', token, {
          method: 'POST',
          body: JSON.stringify({ visit_key: q.get('session') }),
        }),
      );
    const start = q.get('from') || kampalaDate(Date.now() - 29 * 86400000),
      end = q.get('to') || kampalaDate(Date.now());
    let filters;
    try {
      filters = analyticsFilters(start, end, q.get('country') || '', q.get('offset') || '0');
    } catch (error) {
      throw new RequestError((error as Error).message);
    }
    return json(
      await db('/rest/v1/rpc/website_analytics', token, {
        method: 'POST',
        body: JSON.stringify(filters),
      }),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
