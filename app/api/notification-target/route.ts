import { authorize, db, json } from '@/lib/backend';
import { uuidPattern } from '@/lib/editorial';
import { errorResponse, RequestError } from '@/lib/http';
import { notificationTarget } from '@/lib/notification-target';

export async function GET(request: Request) {
  try {
    const { token, profile } = await authorize(request);
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!uuidPattern.test(id)) throw new RequestError('Choose a valid notification.');
    const notices = await db<{ source_key: string }[]>(
      '/rest/v1/website_notifications?select=source_key&id=eq.' + id + '&user_id=eq.' + profile.id,
      token,
    );
    if (!notices[0]) throw new RequestError('Notification unavailable.', 404);
    const target = notificationTarget(notices[0].source_key);
    if (!target) return json({ target: null });
    const table =
      target.resource === 'content'
        ? 'content_items'
        : target.resource === 'media'
          ? 'website_media'
          : 'website_enquiries';
    const rows = await db<unknown[]>('/rest/v1/' + table + '?select=*&id=eq.' + target.id, token);
    if (!rows[0]) throw new RequestError('This item is unavailable to your account.', 404);
    return json({ target: target.resource, row: rows[0] });
  } catch (error) {
    return errorResponse(error);
  }
}
