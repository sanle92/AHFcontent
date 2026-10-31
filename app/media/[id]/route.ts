import { BackendError, errorResponse } from '@/lib/http';
import type * as Rows from '@/lib/types';
import { PUBLIC_MEDIA_CACHE } from '@/lib/cache-policy';
import { config, db, json } from '@/lib/backend';
export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Not found' }, 404);
    const c = config(),
      rows = await db<Rows.MediaRow[]>('/rest/v1/rpc/website_public_media', undefined, {
        method: 'POST',
        body: JSON.stringify({ media_id: id }),
      });
    if (!rows[0]) return json({ error: 'Not found' }, 404);
    const f = await fetch(c.url + '/storage/v1/object/website-media/' + rows[0].object_path, {
      headers: {
        apikey: c.key,
        Authorization: 'Bearer ' + c.key,
        ...Object.fromEntries(
          ['Range', 'If-Range', 'If-None-Match'].flatMap((name) =>
            _r.headers.get(name) ? [[name, _r.headers.get(name)!]] : [],
          ),
        ),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (f.status === 416)
      return new Response(null, {
        status: 416,
        headers: {
          'Content-Range': f.headers.get('Content-Range') || 'bytes */*',
          'Cache-Control': 'no-store',
        },
      });
    if (f.status === 404) return json({ error: 'Not found' }, 404);
    if (!f.ok && f.status !== 304) throw new BackendError('Media is temporarily unavailable.');
    const extra: Record<string, string> = {};
    for (const name of [
      'Content-Length',
      'Content-Range',
      'Accept-Ranges',
      'ETag',
      'Last-Modified',
    ])
      if (f.headers.get(name)) extra[name] = f.headers.get(name)!;
    return new Response(f.status === 304 ? null : f.body, {
      status: f.status,
      headers: {
        ...extra,
        'Content-Type': rows[0].mime,
        'Cache-Control': PUBLIC_MEDIA_CACHE,
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return errorResponse(
      error instanceof BackendError ? error : new BackendError('Media is temporarily unavailable.'),
    );
  }
}
