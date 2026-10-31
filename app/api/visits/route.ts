import { RequestError } from '@/lib/http';
import { parseRequest, visitBody } from '@/lib/request-schemas';
import { env } from 'cloudflare:workers';
import { config, db, json, sameOrigin } from '@/lib/backend';
import { privateHash, publicPath, visitorDevice } from '@/lib/visitor';
import { uuidPattern } from '@/lib/editorial';
export async function POST(r: Request) {
  try {
    sameOrigin(r);
    const c = config();
    if (!c.service)
      return json({ error: 'History deletion and analytics are temporarily unavailable.' }, 503);
    const v = await parseRequest(r, visitBody, 2000);
    if (!uuidPattern.test(v.visitor || '')) return json({ error: 'Invalid visitor' }, 400);
    const visitor = await privateHash('visitor/' + v.visitor, c.service);
    if (v.action === 'forget') {
      await db('/rest/v1/rpc/forget_website_visits', c.service, {
        method: 'POST',
        body: JSON.stringify({ visitor_key: visitor }),
      });
      return json({ ok: true });
    }
    if ((env as unknown as Record<string, string>).AHF_ANALYTICS_ENABLED !== 'true')
      return json({ disabled: true });
    const path = publicPath(v.path);
    if (
      v.consent !== true ||
      !path ||
      !uuidPattern.test(v.session || '') ||
      !['view', 'heartbeat', 'giving', 'merchandise', 'volunteer', 'partner', 'kids'].includes(
        v.action,
      )
    )
      return json({ error: 'Invalid request' }, 400);
    const tag = await privateHash(
      'rate/' +
        new Date().toISOString().slice(0, 10) +
        '/' +
        (r.headers.get('CF-Connecting-IP') || 'local'),
      c.service,
    );
    let referrer = '';
    try {
      referrer = new URL(v.referrer || '').hostname.slice(0, 100);
    } catch {}
    const payload = {
      id: await privateHash('session/' + v.visitor + '/' + v.session, c.service),
      visitor,
      path,
      action: v.action,
      country: decodeURIComponent(r.headers.get('X-AHF-Country') || 'XX'),
      region: decodeURIComponent(r.headers.get('X-AHF-Region') || ''),
      city: decodeURIComponent(r.headers.get('X-AHF-City') || ''),
      referrer,
      ...visitorDevice(r.headers.get('User-Agent') || ''),
    };
    await db('/rest/v1/rpc/record_website_visit', c.service, {
      method: 'POST',
      body: JSON.stringify({ p: payload, request_tag: tag }),
    });
    return json({ ok: true });
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status);
    return json({ error: 'Analytics unavailable' }, 503);
  }
}
