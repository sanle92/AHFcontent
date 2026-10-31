import { cachePolicy } from '../lib/cache-policy';
import { securityHeaders } from '../lib/security-headers';
import handler from 'vinext/server/fetch-handler';
import { runWithConnectorBinding } from '../lib/connector-context';
import type { ConnectorBinding } from '../lib/connector-contract.mjs';

const worker = {
  fetch(
    request: Request,
    env: Cloudflare.Env,
    ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>,
  ) {
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: 'request_context_expired' };
          return preview.getContext?.() ?? { status: 'binding_unavailable' };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return {
              status: 'request_context_expired',
              message: 'This request has expired. Please try again.',
            };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, async () => {
      const geo = request.cf as unknown as
        | { country?: string; region?: string; city?: string }
        | undefined;
      const headers = new Headers(request.headers);
      for (const [key, value] of Object.entries({
        'X-AHF-Country': geo?.country || 'XX',
        'X-AHF-Region': geo?.region || '',
        'X-AHF-City': geo?.city || '',
      }))
        headers.set(key, encodeURIComponent(value));
      const forwarded = new Request(request, { headers });
      const response = await handler.fetch(forwarded, env, ctx),
        out = new Response(response.body, response);
      out.headers.set('X-Content-Type-Options', 'nosniff');
      out.headers.set('X-Frame-Options', 'DENY');
      out.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      out.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      out.headers.set('Cache-Control', cachePolicy(request, out));
      if (
        new URL(request.url).pathname.startsWith('/holyghost') ||
        new URL(request.url).pathname.startsWith('/api')
      )
        out.headers.set('X-Robots-Tag', 'noindex, nofollow');
      const runtime = env as unknown as Record<string, string>;
      const nonce = crypto.randomUUID().replaceAll('-', '');
      const html = out.headers.get('Content-Type')?.includes('text/html');
      const protection = securityHeaders(
        runtime.AHF_PUBLIC_ORIGIN || '',
        runtime.AHF_CONTENT_SUPABASE_URL || '',
        nonce,
        runtime.AHF_CSP_ENFORCE === 'true',
      );
      for (const [name, value] of Object.entries(protection))
        if (html || name === 'Strict-Transport-Security') out.headers.set(name, value);
      if (html)
        return new HTMLRewriter()
          .on('script', {
            element(element) {
              element.setAttribute('nonce', nonce);
            },
          })
          .transform(out);
      return out;
    });
  },
};

export default worker;
