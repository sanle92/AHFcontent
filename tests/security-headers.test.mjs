import { test } from 'node:test';
import assert from 'node:assert/strict';
import { securityHeaders } from '../lib/security-headers.ts';
test('report-only CSP permits only required origins and a script nonce', () => {
  const h = securityHeaders('https://example.org', 'https://project.supabase.co/path', 'nonce123'),
    p = h['Content-Security-Policy-Report-Only'];
  assert.match(p, /script-src 'self' 'nonce-nonce123' https:\/\/challenges.cloudflare.com/);
  assert.match(
    p,
    /frame-src https:\/\/challenges.cloudflare.com https:\/\/www.youtube-nocookie.com https:\/\/player.vimeo.com/,
  );
  assert.ok(!p.includes("script-src 'unsafe-inline'"));
  assert.ok(!p.includes('*'));
  for (const rule of [
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ])
    assert.ok(p.includes(rule));
  assert.ok(p.includes('https://project.supabase.co'));
  assert.ok(!p.includes('/path'));
  assert.equal(h['Strict-Transport-Security'], 'max-age=31536000; includeSubDomains');
  assert.equal(h['Content-Security-Policy'], undefined);
});
test('invalid or HTTP settings cannot inject origins or enable HSTS', () => {
  const h = securityHeaders('http://localhost:3000', 'invalid; script-src *', 'validnonce');
  assert.equal(h['Strict-Transport-Security'], undefined);
  assert.ok(!h['Content-Security-Policy-Report-Only'].includes('script-src *'));
});

test('tested deployments can explicitly enforce CSP and collect only first-party reports', () => {
  const value = securityHeaders(
    'https://example.org',
    'https://project.supabase.co',
    'nonce',
    true,
  );
  assert.ok(value['Content-Security-Policy']);
  assert.equal(value['Content-Security-Policy-Report-Only'], undefined);
  assert.ok(value['Content-Security-Policy'].includes('report-uri /api/csp-report'));
});
