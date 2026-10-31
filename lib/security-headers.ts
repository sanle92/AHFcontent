function httpsOrigin(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.origin : '';
  } catch {
    return '';
  }
}
export function securityHeaders(
  publicOrigin: string,
  supabaseUrl: string,
  nonce: string,
  enforce = false,
): Record<string, string> {
  const supabase = httpsOrigin(supabaseUrl);
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ${supabase} https://challenges.cloudflare.com`,
    `img-src 'self' data: blob: ${supabase}`,
    `media-src 'self' blob: ${supabase}`,
    "font-src 'self' data:",
    'frame-src https://challenges.cloudflare.com https://www.youtube-nocookie.com https://player.vimeo.com',
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'report-uri /api/csp-report',
  ].join('; ');
  return {
    [enforce ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only']: policy,
    ...(httpsOrigin(publicOrigin)
      ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' }
      : {}),
  };
}
