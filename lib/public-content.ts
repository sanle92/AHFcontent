import type { Content, Kind } from './content';
export const routeKinds: Record<string, Kind> = {
  programmes: 'programme',
  stories: 'story',
  events: 'event',
  reports: 'report',
  campaigns: 'campaign',
  shop: 'product',
  albums: 'album',
};
export function pageItem(rows: Content[], path: string) {
  const parts = path.split('/').filter(Boolean);
  const kind =
    parts.length === 2 ? routeKinds[parts[0]] : parts[0] === 'aminia-kids' ? 'programme' : 'page';
  const slug = parts.at(-1) || 'home';
  if (path === '/aminia-kids') {
    const page = rows.find((row) => row.kind === 'page' && row.slug === 'aminia-kids');
    if (page) return page;
  }
  return rows.find((row) => row.kind === kind && row.slug === slug);
}
export function publicQuery(path: string): string {
  const parts = path.split('/').filter(Boolean),
    group = parts[0],
    slug = parts[1];
  const settings = 'and(kind.eq.page,slug.eq.site-settings)';
  if (parts.length === 2 && routeKinds[group])
    return (
      'or=(' +
      settings +
      ',and(kind.eq.' +
      routeKinds[group] +
      ',slug.eq.' +
      encodeURIComponent(slug) +
      '))'
    );
  if (path === '/')
    return 'or=(kind.in.(programme,story,campaign),and(kind.eq.page,slug.in.(home,about,faith,site-settings)))';
  if (path === '/aminia-kids')
    return (
      'or=(' +
      settings +
      ',and(kind.eq.page,slug.eq.aminia-kids),details->>scope.eq.aminia-kids,and(kind.eq.programme,slug.eq.aminia-kids))'
    );
  const listing: Record<string, string> = {
    programmes: 'programme',
    stories: 'story',
    events: 'event',
    transparency: 'report',
    shop: 'product',
    donate: 'campaign',
  };
  if (listing[group])
    return (
      'or=(' + settings + ',kind.eq.' + listing[group] + ',and(kind.eq.page,slug.eq.' + group + '))'
    );
  return (
    'kind=eq.page&slug=in.(site-settings,' +
    encodeURIComponent(group || 'home') +
    (group === 'about' ? ',team' : '') +
    ')'
  );
}
