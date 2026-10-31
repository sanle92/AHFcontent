import { config, json } from '@/lib/backend';
export function GET() {
  const c = config();
  return json({
    url: c.url,
    key: c.key,
    sitekey: c.sitekey,
    configured: !!(c.url && c.key),
    formsReady: !!(c.url && c.key && c.service && c.turnstile && c.sitekey && c.origin),
  });
}
