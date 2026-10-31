import { constantTimeEqual } from '@/lib/constant-time';
import { dispatchPush, pushConfig } from '@/lib/push';
import { dispatchDueEmail } from '@/lib/mail';
import { config, db, json } from '@/lib/backend';
export async function POST(r: Request) {
  const secret = pushConfig().dispatchSecret;
  if (!secret || !constantTimeEqual(r.headers.get('Authorization') || '', 'Bearer ' + secret))
    return json({ error: 'Access denied.' }, 401);
  try {
    if (config().service) {
      await db('/rest/v1/rpc/prune_website_visits', config().service, {
        method: 'POST',
        body: '{}',
      });
      await db('/rest/v1/rpc/website_due_reminders', config().service, {
        method: 'POST',
        body: '{}',
      });
    }
    const [push, emails] = await Promise.all([dispatchPush(), dispatchDueEmail()]);
    await db('/rest/v1/rpc/record_website_dispatch', config().service, {
      method: 'POST',
      body: JSON.stringify({ sent: push.sent, emails, failed: false }),
    });
    return json(push);
  } catch {
    await db('/rest/v1/rpc/record_website_dispatch', config().service, {
      method: 'POST',
      body: JSON.stringify({ sent: 0, emails: 0, failed: true }),
    }).catch(() => {});
    return json({ error: 'Dispatch failed. Check backend configuration.' }, 503);
  }
}
