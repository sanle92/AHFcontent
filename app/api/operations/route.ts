import { env } from 'cloudflare:workers';
import { errorResponse } from '@/lib/http';
import { authorize, db, json } from '@/lib/backend';
export async function GET(request: Request) {
  try {
    const { token, profile } = await authorize(request);
    if (!profile.roles.includes('administrator')) return json({ error: 'Access denied.' }, 403);
    const health = await db<{
      last_dispatch?: { finished_at: string };
      quality?: Record<string, number>;
    }>('/rest/v1/rpc/website_delivery_health', token, { method: 'POST', body: '{}' });
    return json({
      ...health,
      scheduler_stale:
        !health.last_dispatch ||
        Date.now() - Date.parse(health.last_dispatch.finished_at) > 15 * 60000,
      csp_mode:
        (env as unknown as Record<string, string>).AHF_CSP_ENFORCE === 'true'
          ? 'enforced'
          : 'report-only',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
