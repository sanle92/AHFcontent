import type * as Rows from '@/lib/types';
import { db, json } from '@/lib/backend';
import { uuidPattern, videoEmbed } from '@/lib/editorial';
export async function GET(r: Request) {
  const id = new URL(r.url).searchParams.get('id') || '';
  if (!uuidPattern.test(id)) return json({ error: 'Not found' }, 404);
  try {
    const rows = await db<Rows.MediaRow[]>('/rest/v1/rpc/website_playable_video', undefined, {
      method: 'POST',
      body: JSON.stringify({ media_id: id }),
    });
    const v = rows[0],
      embed = v && videoEmbed(v.external_url);
    if (v?.mime === 'video/mp4')
      return json({ src: '/media/' + id, mime: v.mime, alt_text: v.alt_text, caption: v.caption });
    return embed
      ? json({ embed, alt_text: v.alt_text, caption: v.caption })
      : json({ error: 'Not found' }, 404);
  } catch {
    return json({ error: 'Not found' }, 404);
  }
}
