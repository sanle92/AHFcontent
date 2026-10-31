import type { Content } from './content';
import type { MediaRow } from './types';
import { ids } from './editorial.ts';
export function publicationBlockers(item: Content | null, media: MediaRow[]) {
  if (!item) return [];
  const references = [item.cover_id, item.details.video_id, ...ids(item.details.gallery)].filter(
    (v): v is string => !!v,
  );
  return [...new Set(references)].flatMap((id) => {
    const file = media.find((m) => m.id === id);
    return file?.status === 'Approved'
      ? []
      : [`${file?.filename || 'Selected media'} needs independent media approval.`];
  });
}
