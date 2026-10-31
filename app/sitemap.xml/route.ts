import { config, published } from '@/lib/backend';
export async function GET() {
  const c = config();
  if (!c.origin || !/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(c.origin))
    return new Response('Set the public origin before generating a sitemap.', { status: 503 });
  const groups: Record<string, string> = {
    page: '',
    programme: '/programmes',
    story: '/stories',
    event: '/events',
    report: '/reports',
    campaign: '/campaigns',
    product: '/shop',
    album: '/albums',
  };
  const paths = new Set([
    '',
    '/about',
    '/programmes',
    '/aminia-kids',
    '/stories',
    '/events',
    '/get-involved',
    '/donate',
    '/contact',
    '/transparency',
    '/impact',
    '/shop',
    ...(await published())
      .filter((p) => !(p.kind === 'page' && ['home', 'site-settings'].includes(p.slug)))
      .map((p) =>
        p.kind === 'programme' && p.slug === 'aminia-kids'
          ? '/aminia-kids'
          : (groups[p.kind] || '') + '/' + p.slug,
      ),
  ]);
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      [...paths].map((p) => '<url><loc>' + c.origin + p + '</loc></url>').join('') +
      '</urlset>',
    { headers: { 'Content-Type': 'application/xml;charset=utf-8' } },
  );
}
