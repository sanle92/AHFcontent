import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDpoRequest, parseDpoToken, dpoCheckoutUrl } from '../lib/dpo-checkout.ts';
const uuid = '00000000-0000-4000-8000-000000000001';
const valid = {
  companyToken: uuid,
  serviceType: '123',
  reference: uuid,
  amountMinor: 2500000,
  currency: 'UGX',
  origin: 'https://example.org',
  now: new Date('2026-10-31T12:00:00Z'),
};
test('creates a bounded DPO request and rejects unsafe inputs', () => {
  const xml = createDpoRequest(valid);
  assert.match(xml, /<PaymentAmount>25000\.00<\/PaymentAmount>/);
  assert.match(xml, /<CompanyRefUnique>1<\/CompanyRefUnique>/);
  for (const change of [
    { origin: 'https://evil.test/path' },
    { serviceType: '<evil>' },
    { amountMinor: -1 },
    { companyToken: 'bad' },
  ])
    assert.throws(() => createDpoRequest({ ...valid, ...change }));
});
test('only redirects to DPO for a unique valid provider token', () => {
  assert.equal(
    parseDpoToken(`<API3G><Result>000</Result><TransToken>${uuid}</TransToken></API3G>`),
    uuid,
  );
  assert.equal(dpoCheckoutUrl(uuid), 'https://secure.3gdirectpay.com/payv3.php?ID=' + uuid);
  for (const xml of [
    `<API3G><Result>900</Result><TransToken>${uuid}</TransToken></API3G>`,
    `<API3G><Result>000</Result><TransToken>${uuid}</TransToken><TransToken>${uuid}</TransToken></API3G>`,
    '<!DOCTYPE x><API3G></API3G>',
  ])
    assert.throws(() => parseDpoToken(xml));
  assert.throws(() => dpoCheckoutUrl('https://evil.test'));
});
