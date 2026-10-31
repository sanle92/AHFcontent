import { db } from './backend';
import type { Content } from './content';
export async function publicationState(items: Content[], token: string) {
  if (!items.length) return items;
  const records = await db<{ content_id: string; publish_at: string; version: number }[]>(
    '/rest/v1/rpc/website_publication_state',
    token,
    { method: 'POST', body: JSON.stringify({ p_ids: items.map((v) => v.id) }) },
  );
  const now = Date.now();
  return items.map((item) => {
    const live = records.find((v) => v.content_id === item.id && Date.parse(v.publish_at) <= now);
    return {
      ...item,
      effective_status:
        item.status === 'Scheduled' && live?.version === item.version ? 'Published' : item.status,
      live_since: live?.publish_at,
    };
  });
}
