export const PUBLIC_HTML_CACHE = 'public, s-maxage=60, stale-while-revalidate=300';
export const PUBLIC_MEDIA_CACHE = 'public, max-age=300, s-maxage=300';
export const STATIC_CACHE = 'public, max-age=31536000, immutable';
export const MUTABLE_ASSET_CACHE = 'public, max-age=300, s-maxage=300, must-revalidate';
export function cachePolicy(request: Request, response: Response): string {
  const path = new URL(request.url).pathname;
  if (request.method !== 'GET' && request.method !== 'HEAD') return 'no-store';
  if (
    request.headers.has('Authorization') ||
    request.headers.has('Cookie') ||
    response.headers.has('Set-Cookie') ||
    path.startsWith('/holyghost') ||
    path.startsWith('/api/') ||
    path === '/api' ||
    request.headers.has('RSC') ||
    request.headers.has('Next-Router-State-Tree') ||
    request.headers.get('Accept')?.includes('text/x-component')
  )
    return 'no-store';
  if (response.status !== 304 && (response.status < 200 || response.status >= 300))
    return 'no-store';
  if (path.startsWith('/media/')) return PUBLIC_MEDIA_CACHE;
  if (/^\/_next\/static\//.test(path)) return STATIC_CACHE;
  if (/^\/(images|icons)\//.test(path))
    return /[.-][a-f0-9]{8,}\.[a-z]+$/i.test(path) ? STATIC_CACHE : MUTABLE_ASSET_CACHE;
  if (response.headers.get('Content-Type')?.includes('text/html')) return PUBLIC_HTML_CACHE;
  return 'no-store';
}
