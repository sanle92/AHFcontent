import { waitUntil } from 'cloudflare:workers';
import { config, db } from '@/lib/backend';
import { dispatchPush } from '@/lib/push';
import { dispatchEnquiryEmail } from '@/lib/mail';
import { createEnquiryHandler } from '@/lib/enquiry-handler';
import { BackendError } from '@/lib/http';
export const POST = createEnquiryHandler({
  config,
  async verify(token) {
    const c = config();
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({ secret: c.turnstile, response: token }),
    });
    if (!response.ok) throw new BackendError();
    return response.json<{ success: boolean; hostname?: string; action?: string }>();
  },
  save(value, request_tag, submissionKey) {
    return db<string>('/rest/v1/rpc/receive_website_enquiry', config().service, {
      method: 'POST',
      body: JSON.stringify({
        payload: {
          submission_key: submissionKey,
          kind: value.kind,
          name: value.name.trim(),
          email: value.email.trim(),
          phone: typeof value.phone === 'string' ? value.phone.slice(0, 50) : '',
          message: value.message.trim(),
          consent: true,
        },
        request_tag,
      }),
    });
  },
  async notify(id) {
    waitUntil(Promise.all([dispatchPush(), dispatchEnquiryEmail(id)]).catch(() => {}));
    return { state: 'pending' };
  },
});
