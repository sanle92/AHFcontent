import { config, db, sameOrigin } from '@/lib/backend';
import { readJsonLimited, errorResponse, RequestError } from '@/lib/http';
import { privateHash } from '@/lib/visitor';
export async function POST(r: Request) {
  try {
    sameOrigin(r);
    const value = (await readJsonLimited(r, 16000)) as {
      'csp-report'?: { 'effective-directive'?: unknown };
    };
    const directive = value?.['csp-report']?.['effective-directive'];
    if (
      typeof directive !== 'string' ||
      ![
        'default-src',
        'script-src',
        'script-src-elem',
        'script-src-attr',
        'style-src',
        'style-src-elem',
        'style-src-attr',
        'connect-src',
        'img-src',
        'media-src',
        'font-src',
        'frame-src',
        'worker-src',
        'frame-ancestors',
        'base-uri',
        'form-action',
        'object-src',
      ].includes(directive)
    )
      throw new RequestError('Invalid report.');
    const c = config();
    if (c.service)
      await db('/rest/v1/rpc/record_website_csp', c.service, {
        method: 'POST',
        body: JSON.stringify({
          p_directive: directive,
          p_tag: await privateHash(
            'csp/' +
              new Date().toISOString().slice(0, 10) +
              '/' +
              (r.headers.get('CF-Connecting-IP') || 'local'),
            c.service,
          ),
        }),
      });
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
