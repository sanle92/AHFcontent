import { RequestError, errorResponse } from '@/lib/http';
import { parseRequest, notificationBody } from '@/lib/request-schemas';
import { authorize, db, json, sameOrigin } from '@/lib/backend';
import { dispatchPush, pushConfig } from '@/lib/push';
import { pushEndpoint } from '@/lib/visitor';
export async function GET(r: Request) {
  try {
    const { token } = await authorize(r);
    const rows = await db(
        '/rest/v1/website_notifications?select=*&order=created_at.desc&limit=100',
        token,
      ),
      p = pushConfig();
    return json({
      rows,
      publicKey: p.publicKey,
      configured: !!(p.publicKey && p.privateKey && p.subject),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(r: Request) {
  try {
    sameOrigin(r);
    const { token } = await authorize(r);
    const v = await parseRequest(r, notificationBody, 6000);
    if (v.action === 'read') {
      await db('/rest/v1/rpc/read_website_notice', token, {
        method: 'POST',
        body: JSON.stringify({ notice: v.id }),
      });
      return json({ ok: true });
    }
    if (v.action === 'subscribe' || v.action === 'unsubscribe') {
      if (!pushEndpoint(v.subscription?.endpoint || ''))
        throw new RequestError('This browser push service is not supported.');
      await db('/rest/v1/rpc/save_website_push', token, {
        method: 'POST',
        body: JSON.stringify({ payload: v.subscription, remove: v.action === 'unsubscribe' }),
      });
      return json({ ok: true });
    }
    if (v.action === 'test') {
      const endpoint = v.subscription?.endpoint;
      if (!endpoint || !pushEndpoint(endpoint))
        throw new RequestError('Select a subscribed device before testing.');
      const notice = await db<string>('/rest/v1/rpc/queue_website_test', token, {
        method: 'POST',
        body: '{}',
      });
      const result = await dispatchPush(notice, endpoint);
      const delivered = await db<boolean>('/rest/v1/rpc/website_test_delivery', token, {
        method: 'POST',
        body: JSON.stringify({ notice, endpoint }),
      });
      return json({ ...result, sent: delivered ? 1 : 0 });
    }
    throw new RequestError('Unknown action.');
  } catch (e) {
    return errorResponse(e);
  }
}
