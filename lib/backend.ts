import { readAllRows } from './paging';
import { cache } from 'react';
import { publicQuery, pageItem } from './public-content';
import { dbError } from './db-error';
import { RequestError, BackendError } from './http';
import { env } from 'cloudflare:workers';
import { hasSecondFactor } from './assurance';
import { seed, type Content } from './content';
export function config() {
  const e = env as unknown as Record<string, string>;
  return {
    url: e.AHF_CONTENT_SUPABASE_URL || '',
    key: e.AHF_CONTENT_SUPABASE_ANON_KEY || '',
    service: e.AHF_CONTENT_SERVICE_KEY || '',
    turnstile: e.AHF_TURNSTILE_SECRET || '',
    sitekey: e.AHF_TURNSTILE_SITE_KEY || '',
    origin: e.AHF_PUBLIC_ORIGIN || '',
  };
}
export function json(v: unknown, status = 200) {
  return Response.json(v, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
export async function db<T = unknown>(
  path: string,
  token?: string,
  init: RequestInit = {},
  inspect?: (headers: Headers) => void,
): Promise<T> {
  const c = config();
  if (!c.url || !c.key) throw new BackendError('Website backend is not configured.');
  let r: Response;
  try {
    r = await fetch(c.url + path, {
      ...init,
      headers: {
        apikey: token === c.service ? c.service : c.key,
        Authorization: 'Bearer ' + (token || c.key),
        'Content-Type': 'application/json',
        ...init.headers,
      },
      cache: 'no-store',
      signal: init.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    });
  } catch {
    throw new BackendError(
      'The website backend could not respond. Refresh to check the latest saved state before retrying a change.',
    );
  }
  if (!r.ok) {
    const v = await r
      .json<{ message?: string; code?: string }>()
      .catch((): { message?: string; code?: string } => ({ message: '' }));
    throw dbError(v, r.status);
  }
  inspect?.(r.headers);
  return r.status === 204 ? (null as T) : r.json<T>();
}

export type Profile = { id: string; name: string; roles: string[]; active: boolean };
export async function authorize(r: Request) {
  const token = r.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token) throw new RequestError('Sign in required.', 401);
  const user = await db<{ id: string }>('/auth/v1/user', token);
  if (!hasSecondFactor(token)) throw new RequestError('Two-step verification required.', 403);
  const p = await db<Profile[]>(
    '/rest/v1/website_profiles?id=eq.' + encodeURIComponent(user.id) + '&select=*',
    token,
  );
  if (!p[0]?.active) throw new RequestError('Access denied.', 403);
  return { token, profile: p[0] as Profile };
}
export function sameOrigin(r: Request) {
  if (r.headers.get('Origin') && r.headers.get('Origin') !== new URL(r.url).origin)
    throw new RequestError('Access denied.', 403);
}
export async function published(): Promise<Content[]> {
  const c = config();
  if (!c.url || !c.key) return seed;
  return dbAll<Content>('/rest/v1/published_content?select=*&order=id.asc');
}

// Home summaries are bounded; metadata and the page share the same request-scoped result.
export const publishedHome = cache(
  async (page = 0): Promise<{ items: Content[]; hasMore: boolean }> => {
    if (!config().url || !config().key) return { items: seed, hasMore: false };
    const fields = 'id,kind,slug,title,summary,details,cover_id';
    const [pages, programmes, kids, campaigns, stories] = await Promise.all([
      db<Content[]>(
        '/rest/v1/published_content?select=*&kind=eq.page&slug=in.(home,about,faith,site-settings)',
      ),
      db<Content[]>(
        '/rest/v1/published_content?select=' +
          fields +
          '&kind=eq.programme&slug=neq.aminia-kids&order=slug.asc&limit=4',
      ),
      db<Content[]>('/rest/v1/published_content?select=*&kind=eq.programme&slug=eq.aminia-kids'),
      db<Content[]>(
        '/rest/v1/published_content?select=' +
          fields +
          '&kind=eq.campaign&order=slug.asc&limit=13&offset=' +
          page * 12,
      ),
      db<Content[]>(
        '/rest/v1/published_content?select=' +
          fields +
          '&kind=eq.story&or=(details->>category.eq.Personal%20help,details->>campaign_id.not.is.null,details->>pillar_url.not.is.null,details->>spotfund_url.not.is.null,details->>gofundme_url.not.is.null)&order=slug.asc&limit=3',
      ),
    ]);
    return {
      items: [...pages, ...programmes, ...kids, ...campaigns.slice(0, 12), ...stories].map(
        (item) => ({ ...item, body: item.body || '' }),
      ),
      hasMore: campaigns.length > 12,
    };
  },
);
// React cache is request-scoped: metadata and the server page share this fetch.
export const publishedForPath = cache(async (path: string): Promise<Content[]> => {
  const c = config();
  if (!c.url || !c.key) return seed;
  if (path === '/') return (await publishedHome()).items;
  const rows = await dbAll<Content>(
    '/rest/v1/published_content?select=*&order=id.asc&' + publicQuery(path),
  );
  const item = pageItem(rows, path);
  if (item && path.split('/').filter(Boolean).length === 2) {
    const conditions = ['details->>programme_id.eq.' + item.id];
    if (item.details.campaign_id) conditions.push('id.eq.' + item.details.campaign_id);
    const related = await dbAll<Content>(
      '/rest/v1/published_content?select=*&or=(' + conditions.join(',') + ')',
    );
    return [...new Map([...rows, ...related].map((row) => [row.id, row])).values()];
  }
  return rows;
});

export function dbAll<T>(path: string, token?: string) {
  const clean = path.replace(/([?&])limit=\d+&?/g, '$1').replace(/[?&]$/, '');
  let total: number | undefined;
  return readAllRows<T>(
    (offset) =>
      db<T[]>(
        clean + (clean.includes('?') ? '&' : '?') + 'limit=1000&offset=' + offset,
        token,
        { headers: { Prefer: 'count=exact' } },
        (headers) => {
          const value = headers.get('Content-Range')?.split('/')[1];
          if (value && value !== '*' && Number.isFinite(Number(value))) total = Number(value);
        },
      ),
    () => total,
  );
}
