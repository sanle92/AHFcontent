import { retryAfter } from './retry-after';
import type * as Rows from './types';
import { env } from 'cloudflare:workers';
import { config, db } from './backend';
import { confirmationEmail } from './mail-template';
export function mailConfig() {
  const e = env as unknown as Record<string, string>;
  return {
    key: e.AHF_RESEND_API_KEY || '',
    from: e.AHF_EMAIL_FROM || '',
    staff: e.AHF_ENQUIRY_NOTIFY_EMAIL || '',
    reply: e.AHF_EMAIL_REPLY_TO || '',
  };
}
export async function dispatchEnquiryEmail(id: string) {
  const c = config(),
    m = mailConfig();
  if (!m.key || !m.from) return { state: 'pending' };
  const enquiry = (
    await db<Rows.EnquiryRow[]>(
      '/rest/v1/website_enquiries?id=eq.' + encodeURIComponent(id) + '&select=id,kind,email',
      c.service,
    )
  )[0];
  if (!enquiry) return { state: 'pending' };
  const jobs = await claimEmail(c.service, id);
  for (const job of jobs) {
    let provider: string | null = null,
      error = '';
    try {
      provider = await sendEmail(job, enquiry, m, c);
    } catch (e) {
      error = (e as Error).message;
      const delay = (e as Error & { retryAfter?: number | null }).retryAfter;
      if (delay)
        await db('/rest/v1/rpc/defer_website_job', c.service, {
          method: 'POST',
          body: JSON.stringify({
            p_kind: 'email',
            p_id: job.id,
            p_lease: job.lease_token,
            p_seconds: delay,
          }),
        });
    }
    await finishEmail(c.service, job.id, job.lease_token, provider, error);
  }
  const rows = await db<Rows.EmailJob[]>(
    '/rest/v1/website_email_outbox?enquiry_id=eq.' + id + '&kind=eq.confirmation&select=status',
    c.service,
  );
  return { state: rows[0]?.status === 'Accepted' ? 'accepted' : 'pending' };
}

async function sendEmail(
  job: Rows.EmailJob,
  enquiry: Rows.EnquiryRow,
  m: ReturnType<typeof mailConfig>,
  c: ReturnType<typeof config>,
) {
  if (job.kind === 'staff' && !m.staff)
    throw Error('Staff notification address is not configured.');
  const template =
    job.kind === 'confirmation'
      ? confirmationEmail(enquiry.kind, enquiry.id, job.message || '')
      : {
          subject: 'AHF website — new ' + enquiry.kind + ' enquiry',
          text:
            'A new website enquiry is ready for review.\n\nReference: ' +
            enquiry.id +
            '\n\nSign in to the website workspace: ' +
            c.origin +
            '/holyghost\n\nPersonal enquiry details are available in the protected workspace.',
        };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + m.key,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'ahf-website/' + job.id,
    },
    body: JSON.stringify({
      from: m.from,
      to: [job.kind === 'confirmation' ? enquiry.email : m.staff],
      ...(m.reply ? { reply_to: m.reply } : {}),
      ...template,
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok)
    throw Object.assign(
      Error(
        'Email provider rejected the request (' +
          r.status +
          '). Check sender verification and provider logs.',
      ),
      { retryAfter: retryAfter(r.headers.get('Retry-After')) },
    );
  const v = await r.json<{ id?: string }>();
  if (!v.id) throw Error('Provider response was incomplete; review provider logs.');
  return v.id;
}

async function finishEmail(
  service: string,
  id: string,
  lease: string,
  provider: string | null,
  error: string,
) {
  await db('/rest/v1/rpc/finish_website_email_v2', service, {
    method: 'POST',
    body: JSON.stringify({ mail_id: id, lease, provider, error_text: error }),
  });
}
async function claimEmail(service: string, id: string) {
  return db<(Rows.EmailJob & { lease_token: string })[]>(
    '/rest/v1/rpc/claim_website_email_v2',
    service,
    {
      method: 'POST',
      body: JSON.stringify({ enquiry: id }),
    },
  );
}

export async function dispatchDueEmail() {
  const c = config(),
    m = mailConfig();
  if (!c.service || !m.key || !m.from) return 0;
  const rows = await db<{ enquiry_id: string }[]>('/rest/v1/rpc/website_due_email', c.service, {
    method: 'POST',
    body: '{}',
  });
  await Promise.all(rows.map((row) => dispatchEnquiryEmail(row.enquiry_id)));
  return rows.length;
}
