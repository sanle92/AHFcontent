import Website from '@/components/website';
import { canonicalUrl } from '@/lib/metadata';
import { campaignPage } from '@/lib/home-page';
import { socialMetadata } from '@/lib/metadata';
import { config, publishedHome } from '@/lib/backend';
type HomeProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };
export async function generateMetadata({ searchParams }: HomeProps = {}) {
  const page = campaignPage((await searchParams)?.campaignPage);
  const rows = (await publishedHome(page)).items,
    home = rows.find((i) => i.kind === 'page' && i.slug === 'home');
  const canonical = canonicalUrl(config().origin, '/');
  return {
    ...socialMetadata(config().origin, '/', home),
    alternates: canonical ? { canonical } : undefined,
    title:
      (home?.details.seo_title || home?.title || 'Aminia Hope Foundation') +
      ' | Aminia Hope Foundation',
    description: home?.details.seo_description || home?.summary,
  };
}
export default async function Home({ searchParams }: HomeProps = {}) {
  const page = campaignPage((await searchParams)?.campaignPage);
  const content = await publishedHome(page);
  return <Website content={content.items} campaignPage={page} campaignsMore={content.hasMore} />;
}
