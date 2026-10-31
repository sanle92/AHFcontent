import type { Content } from './content';
import { organization } from './organization.ts';
export function canonicalUrl(origin: string, path: string) {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    return new URL(path === '/programmes/aminia-kids' ? '/aminia-kids' : path, url.origin).href;
  } catch {
    return undefined;
  }
}

export function socialMetadata(origin: string, path: string, item?: Content) {
  const url = canonicalUrl(origin, path);
  if (!url) return {};
  const title = item?.details.seo_title || item?.title || organization.name;
  const description = item?.details.seo_description || item?.summary;
  const image = new URL(
    item?.cover_id && item.kind !== 'report' ? '/media/' + item.cover_id : organization.logo,
    url,
  ).href;
  return {
    openGraph: {
      title,
      description,
      url,
      type: item?.kind === 'story' ? ('article' as const) : ('website' as const),
      images: [{ url: image, alt: title }],
    },
    twitter: { card: 'summary_large_image' as const, title, description, images: [image] },
  };
}
