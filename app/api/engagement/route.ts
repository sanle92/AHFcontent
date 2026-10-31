import { RequestError } from '@/lib/http';
import { parseRequest, engagementBody } from '@/lib/request-schemas';
import { config, db, json, sameOrigin } from '@/lib/backend';
import { env } from 'cloudflare:workers';
export async function POST(r: Request) {
  try {
    sameOrigin(r);
    const c = config();
    if ((env as unknown as Record<string, string>).AHF_ANALYTICS_ENABLED !== 'true' || !c.service)
      return new Response(null, { status: 204 });
    const v = await parseRequest(r, engagementBody, 1000);
    if (!['giving', 'merchandise', 'volunteer', 'partner', 'kids'].includes(v.action))
      return json({ error: 'Invalid request' }, 400);
    const tag = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(
            c.service +
              ':' +
              new Date().toISOString().slice(0, 10) +
              ':' +
              (r.headers.get('CF-Connecting-IP') || 'local'),
          ),
        ),
      ),
      (b) => b.toString(16).padStart(2, '0'),
    ).join('');
    await db('/rest/v1/rpc/record_website_engagement', c.service, {
      method: 'POST',
      body: JSON.stringify({ category: v.action, request_tag: tag }),
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status);
    return new Response(null, { status: 204 });
  }
}
