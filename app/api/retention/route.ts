import { env } from 'cloudflare:workers';
import { authorize, db, json, sameOrigin } from '@/lib/backend';
import { RequestError, errorResponse, readJsonLimited } from '@/lib/http';
import { uuidPattern } from '@/lib/editorial';
function policy() {
  const days = Number((env as unknown as Record<string, string>).AHF_ENQUIRY_RETENTION_DAYS || '');
  return Number.isInteger(days) && days >= 1 && days <= 36500 ? days : null;
}
export async function GET(r: Request) {
  try {
    const { token, profile } = await authorize(r);
    if (!profile.roles.includes('administrator')) throw new RequestError('Access denied.', 403);
    if (new URL(r.url).searchParams.get('orphans') === '1')
      return json(
        await db('/rest/v1/rpc/website_orphan_media', token, { method: 'POST', body: '{}' }),
      );
    const days = policy();
    if (!days) return json({ configured: false });
    return json({
      configured: true,
      days,
      ...(await db<Record<string, unknown>>('/rest/v1/rpc/website_retention', token, {
        method: 'POST',
        body: JSON.stringify({ p_before: new Date(Date.now() - days * 86400000).toISOString() }),
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(r: Request) {
  try {
    sameOrigin(r);
    const { token, profile } = await authorize(r);
    if (!profile.roles.includes('administrator')) throw new RequestError('Access denied.', 403);
    const value = (await readJsonLimited(r, 2000)) as {
      hold?: unknown;
      id?: unknown;
      confirmation?: unknown;
      before?: unknown;
    };
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new RequestError('Invalid retention request.');
    if (
      typeof value.hold === 'boolean' &&
      typeof value.id === 'string' &&
      uuidPattern.test(value.id)
    ) {
      await db('/rest/v1/rpc/website_retention_hold', token, {
        method: 'POST',
        body: JSON.stringify({ p_id: value.id, p_hold: value.hold }),
      });
      return json({ ok: true });
    }
    const days = policy();
    if (!days) throw new RequestError('Approve and configure a retention period first.');
    if (value.confirmation !== 'ANONYMIZE CLOSED ENQUIRIES')
      throw new RequestError('Confirm retention processing.');
    const approvedBefore = typeof value.before === 'string' ? Date.parse(value.before) : NaN;
    if (!Number.isFinite(approvedBefore) || approvedBefore > Date.now() - days * 86400000)
      throw new RequestError('Refresh the retention preview before applying it.');
    return json(
      await db('/rest/v1/rpc/website_retention', token, {
        method: 'POST',
        body: JSON.stringify({
          p_before: new Date(approvedBefore).toISOString(),
          p_apply: true,
          p_confirmation: value.confirmation,
        }),
      }),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
