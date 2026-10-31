import { config } from '@/lib/backend';
import { canonicalUrl } from '@/lib/metadata';
export function GET() {
  const sitemap = canonicalUrl(config().origin, '/sitemap.xml');
  return new Response(
    'User-agent: *\nDisallow: /holyghost\nDisallow: /api/\n' +
      (sitemap ? 'Sitemap: ' + sitemap + '\n' : ''),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
}
