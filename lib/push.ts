import { retryAfter } from './retry-after';
import type * as Rows from './types';
import webpush from 'web-push';
import { env } from 'cloudflare:workers';
import { config, db } from './backend';
import { pushEndpoint } from './visitor';
export function pushConfig() {
  const e = env as unknown as Record<string, string>;
  return {
    publicKey: e.AHF_VAPID_PUBLIC_KEY || '',
    privateKey: e.AHF_VAPID_PRIVATE_KEY || '',
    subject: e.AHF_VAPID_SUBJECT || '',
    dispatchSecret: e.AHF_PUSH_DISPATCH_SECRET || '',
  };
}
export async function dispatchPush(notice?: string, endpoint?: string) {
  const c = config(),
    p = pushConfig();
  if (!c.service || !p.publicKey || !p.privateKey || !p.subject)
    return { sent: 0, configured: false };
  let sent = 0;
  for (let batch = 0; batch < 3; batch++) {
    const jobs = await claimPush(c.service, notice, endpoint);
    if (!jobs.length) break;
    await Promise.all(
      jobs.map(async (job) => {
        const result = await sendPush(job, p);
        if (result === 'Sent') sent++;
        await finishPush(c.service, job.job_id, job.lease_token, result);
      }),
    );
  }
  return { sent, configured: true };
}

async function sendPush(job: Rows.PushJob, p: ReturnType<typeof pushConfig>) {
  let result = 'Push service unavailable';
  try {
    if (!pushEndpoint(job.payload.endpoint)) throw Error('Unsupported push endpoint');
    const request = webpush.generateRequestDetails(
      job.payload,
      JSON.stringify({ title: job.title, body: job.body, url: '/holyghost', tag: job.job_id }),
      {
        TTL: 3600,
        vapidDetails: { subject: p.subject, publicKey: p.publicKey, privateKey: p.privateKey },
      },
    );
    const response = await fetch(request.endpoint, {
      method: 'POST',
      headers: request.headers as Record<string, string>,
      body: request.body as unknown as BodyInit,
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });
    const delay = retryAfter(response.headers?.get('Retry-After'));
    if (!response.ok && delay)
      await db('/rest/v1/rpc/defer_website_job', config().service, {
        method: 'POST',
        body: JSON.stringify({
          p_kind: 'push',
          p_id: job.job_id,
          p_lease: job.lease_token,
          p_seconds: delay,
        }),
      });
    result = response.ok
      ? 'Sent'
      : [404, 410].includes(response.status)
        ? 'Gone'
        : 'Push service returned ' + response.status;
  } catch (e) {
    result = (e as Error).message;
  }

  return result;
}
async function finishPush(service: string, job: string, lease: string, result: string) {
  await db('/rest/v1/rpc/finish_website_push_v2', service, {
    method: 'POST',
    body: JSON.stringify({ job, lease, result }),
  });
}
async function claimPush(service: string, notice?: string, endpoint?: string) {
  return db<Rows.PushJob[]>('/rest/v1/rpc/claim_website_push_v2', service, {
    method: 'POST',
    body: JSON.stringify({ selected_notice: notice || null, selected_endpoint: endpoint || null }),
  });
}
