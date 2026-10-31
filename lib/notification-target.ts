import { uuidPattern } from './editorial.ts';
export function notificationTarget(
  source: string,
): { resource: 'content' | 'media' | 'enquiry'; id: string } | null {
  const [kind, id] = source.split('/');
  if (!id || !uuidPattern.test(id)) return null;
  if (kind === 'content_items' || kind === 'campaign-review') return { resource: 'content', id };
  if (kind === 'website_media') return { resource: 'media', id };
  if (['enquiry', 'assigned', 'due', 'overdue'].includes(kind)) return { resource: 'enquiry', id };
  return null;
}
