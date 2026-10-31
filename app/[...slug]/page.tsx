import Website from '@/components/website';
import { canonicalUrl, socialMetadata } from '@/lib/metadata';
import { config, publishedForPath } from '@/lib/backend';
import { pageItem } from '@/lib/public-content';
import { db } from '@/lib/backend';
import { notFound, permanentRedirect } from 'next/navigation';
const fixed = [
  'about',
  'programmes',
  'aminia-kids',
  'stories',
  'events',
  'transparency',
  'impact',
  'get-involved',
  'donate',
  'contact',
  'privacy',
  'safeguarding',
  'shop',
];
const groups: Record<string, string> = {
  programmes: 'programme',
  stories: 'story',
  events: 'event',
  reports: 'report',
  campaigns: 'campaign',
  shop: 'product',
  albums: 'album',
};
export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  if (
    slug.length > 2 ||
    slug.some((part) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(part) || part.length > 100)
  )
    notFound();
  const rows = await publishedForPath('/' + slug.join('/'));
  const item = pageItem(rows, '/' + slug.join('/'));
  const title =
    item?.title ||
    (
      {
        'aminia-kids': 'Aminia Kids',
        programmes: 'Our programmes',
        stories: 'Stories',
        events: 'Events',
        transparency: 'Transparency',
        impact: 'Impact & learning',
        'get-involved': 'Get involved',
        donate: 'Support our work',
        contact: 'Contact',
        privacy: 'Privacy',
        safeguarding: 'Safeguarding',
        shop: 'Shop to support',
      } as Record<string, string>
    )[slug[0]] ||
    'Aminia Hope Foundation';
  const canonical = canonicalUrl(config().origin, '/' + slug.join('/'));
  return {
    ...socialMetadata(config().origin, '/' + slug.join('/'), item),
    alternates: canonical ? { canonical } : undefined,
    title: (item?.details.seo_title || title) + ' | Aminia Hope Foundation',
    description:
      item?.details.seo_description ||
      item?.summary ||
      'Community-based programmes supporting children, families and communities in Uganda.',
  };
}
export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  if (
    slug.length > 2 ||
    slug.some((part) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(part) || part.length > 100)
  )
    notFound();
  const content = await publishedForPath('/' + slug.join('/'));
  if (['admin', 'site-settings', 'holyghost'].includes(slug[0])) notFound();
  if (
    !(
      slug.length === 1 &&
      (fixed.includes(slug[0]) || content.some((c) => c.kind === 'page' && c.slug === slug[0]))
    ) &&
    !(
      slug.length === 2 &&
      groups[slug[0]] &&
      content.some((c) => c.kind === groups[slug[0]] && c.slug === slug[1])
    )
  ) {
    if (config().url && (slug.length === 1 || !!groups[slug[0]])) {
      const target = await db<string | null>('/rest/v1/rpc/resolve_website_redirect', undefined, {
        method: 'POST',
        body: JSON.stringify({
          p_kind: slug.length === 1 ? 'page' : groups[slug[0]],
          p_slug: slug.at(-1),
        }),
      });
      if (target && /^\/[a-z0-9/-]+$/.test(target)) permanentRedirect(target);
    }
    notFound();
  }
  return <Website path={'/' + slug.join('/')} content={content} />;
}
