import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readJsonLimited, RequestError, BackendError } from '../lib/http.ts';
import { createEnquiryHandler, validateEnquiry } from '../lib/enquiry-handler.ts';
import { constantTimeEqual } from '../lib/constant-time.ts';
import {
  parseRequest,
  visitBody,
  notificationBody,
  mediaBody,
  engagementBody,
} from '../lib/request-schemas.ts';
const input = {
  kind: 'volunteer',
  name: 'Test adult',
  email: 'test@example.org',
  message: 'I can volunteer.',
  consent: true,
  token: 'token',
};
const request = (value) =>
  new Request('https://example.org/api/enquiry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
test('enquiry schema keeps all kinds, checks boundaries/consent and short-circuits honeypots', () => {
  for (const kind of [
    'contact',
    'volunteer',
    'partner',
    'aminia-kids',
    'support',
    'merchandise',
    'event',
  ])
    assert.equal(validateEnquiry({ ...input, kind }).honeypot, false);
  assert.equal(validateEnquiry({ website: 'bot' }).honeypot, true);
  for (const bad of [
    { kind: 'unknown' },
    { name: ' ' },
    { name: 'x'.repeat(151) },
    { email: 'no-email' },
    { email: 'a'.repeat(255) },
    { message: 'x' },
    { message: 'x'.repeat(5001) },
    { consent: false },
    { token: 't'.repeat(2049) },
  ])
    assert.throws(() => validateEnquiry({ ...input, ...bad }), RequestError);
});
test('streamed body limits count bytes without trusting Content-Length', async () => {
  for (const [schema, limit] of [
    [visitBody, 2000],
    [notificationBody, 6000],
    [mediaBody, 16000],
    [engagementBody, 1000],
  ]) {
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('{"x":"'));
        c.enqueue(new TextEncoder().encode('x'.repeat(limit)));
        c.close();
      },
    });
    const r = new Request('https://example.org/api/test', {
      method: 'POST',
      body: stream,
      duplex: 'half',
    });
    await assert.rejects(
      () => parseRequest(r, schema, limit),
      (e) => e instanceof RequestError && e.status === 413,
    );
  }
  await assert.rejects(
    () => readJsonLimited(new Request('https://example.org', { method: 'POST', body: '{' }), 100),
    (e) => e.message === 'Invalid JSON request.',
  );
  await assert.rejects(
    () =>
      readJsonLimited(
        new Request('https://example.org', {
          method: 'POST',
          body: JSON.stringify('é'.repeat(10)),
        }),
        15,
      ),
    (e) => e.status === 413,
  );
});
test('enquiry route maps validation, verification, rate-limit and backend errors safely', async () => {
  let saved = 0;
  const deps = {
    config: () => ({
      service: 'test',
      turnstile: 'test',
      sitekey: 'test',
      origin: 'https://example.org',
    }),
    verify: async () => ({ success: true, hostname: 'example.org', action: 'ahf_enquiry' }),
    save: async () => {
      saved++;
      return 'reference';
    },
    notify: async () => ({ state: 'accepted' }),
  };
  const handler = createEnquiryHandler(deps);
  assert.equal((await handler(request({ website: 'bot' }))).status, 200);
  assert.equal(saved, 0);
  assert.equal((await handler(request({ ...input, consent: false }))).status, 400);
  const ok = await handler(request(input));
  assert.deepEqual(await ok.json(), { ok: true, reference: 'reference', email: 'accepted' });
  assert.equal(
    (
      await createEnquiryHandler({
        ...deps,
        verify: async () => ({ success: true, hostname: 'attacker.test', action: 'ahf_enquiry' }),
      })(request(input))
    ).status,
    400,
  );
  assert.equal(
    (
      await createEnquiryHandler({
        ...deps,
        save: async () => {
          throw new BackendError('Too many requests; please try again later.', 429);
        },
      })(request(input))
    ).status,
    429,
  );
  const failure = await createEnquiryHandler({
    ...deps,
    save: async () => {
      throw new SyntaxError('private parser details');
    },
  })(request(input));
  assert.equal(failure.status, 503);
  assert.ok(!(await failure.text()).includes('private parser'));
  const oversized = await handler(request({ ...input, message: 'x'.repeat(20000) }));
  assert.equal(oversized.status, 413);
});
test('dispatch-secret comparison handles unequal lengths without short-circuit equality', () => {
  assert.equal(constantTimeEqual('secret', 'secret'), true);
  for (const s of ['', 's', 'secret-too-long', 'secreu'])
    assert.equal(constantTimeEqual('secret', s), false);
});
