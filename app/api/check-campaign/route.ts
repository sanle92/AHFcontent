import { errorResponse, RequestError } from '@/lib/http';
import { parseRequest, campaignBody } from '@/lib/request-schemas';
import { authorize, json, sameOrigin } from '@/lib/backend';
import { fundraisingUrl } from '@/lib/editorial';
export async function POST(r: Request) {
  try {
    sameOrigin(r);
    const { profile } = await authorize(r);
    if (!profile.roles.some((v) => ['administrator', 'editor', 'publisher'].includes(v)))
      throw new RequestError('Access denied.', 403);
    const v = await parseRequest(r, campaignBody);
    const host = ['pillar.io', 'spotfund.com', 'gofundme.com'].find(
      (h) => typeof v.url === 'string' && fundraisingUrl(v.url, h),
    );
    if (!host || v.url.length > 1000)
      throw new RequestError('Use an approved fundraising platform URL.');
    let url = v.url;
    for (let i = 0; i < 4; i++) {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(6000),
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('Location');
        if (!location)
          return json({ result: 'Unable to verify this redirect. Open and review the campaign.' });
        const next = new URL(location, url).href;
        if (!fundraisingUrl(next, host))
          return json({
            result: 'Redirect leaves the selected platform. Review the link manually.',
          });
        url = next;
        continue;
      }
      return json({
        result: response.ok
          ? 'Link responded successfully. Confirm the recipient, purpose and campaign status manually.'
          : [404, 410].includes(response.status)
            ? 'Page was not found. Check the campaign URL.'
            : 'The platform did not allow verification (' +
              response.status +
              '). Open the campaign and check it manually.',
      });
    }
    return json({ result: 'Too many redirects. Review the campaign manually.' });
  } catch (e) {
    return errorResponse(e);
  }
}
