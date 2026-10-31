import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acknowledgeDpoPayment, createDpoCheckout, verifyDpoPayment } from '../lib/dpo-client.ts';
const id = '00000000-0000-4000-8000-000000000001';
const input = {
  companyToken: id,
  serviceType: '123',
  reference: id,
  amountMinor: 10000,
  currency: 'UGX',
  origin: 'https://example.org',
  now: new Date('2026-10-31T00:00:00Z'),
};
test('DPO client uses only the fixed provider endpoint and returns the approved redirect', async () => {
  const result = await createDpoCheckout(input, async (url, options) => {
    assert.equal(url, 'https://secure.3gdirectpay.com/API/v6/');
    assert.equal(options.redirect, 'error');
    return new Response(`<API3G><Result>000</Result><TransToken>${id}</TransToken></API3G>`);
  });
  assert.equal(result.checkoutUrl, 'https://secure.3gdirectpay.com/payv3.php?ID=' + id);
});

test('provider acknowledgement uses the same fixed endpoint and enables verification', async () => {
  const result = await acknowledgeDpoPayment(
    { companyToken: id, token: id, amountMinor: 10000, currency: 'UGX' },
    async (url, options) => {
      assert.equal(url, 'https://secure.3gdirectpay.com/API/v6/');
      assert.match(options.body, /<VerifyTransaction>1<\/VerifyTransaction>/);
      return new Response(
        '<API3G><Result>000</Result><TransactionAmount>100.00</TransactionAmount><TransactionCurrency>UGX</TransactionCurrency></API3G>',
      );
    },
  );
  assert.equal(result.confirmed, true);
});
test('provider failures, oversized responses and mismatch never confirm payment', async () => {
  await assert.rejects(
    () => createDpoCheckout(input, async () => new Response('unavailable', { status: 500 })),
    /unavailable/,
  );
  await assert.rejects(
    () => createDpoCheckout(input, async () => new Response('a'.repeat(64001))),
    /invalid/,
  );
  const result = await verifyDpoPayment(
    { companyToken: id, token: id, amountMinor: 10000, currency: 'UGX' },
    async (_url, options) => {
      assert.match(options.body, /<VerifyTransaction>0<\/VerifyTransaction>/);
      return new Response(
        '<API3G><Result>000</Result><TransactionAmount>101.00</TransactionAmount><TransactionCurrency>UGX</TransactionCurrency></API3G>',
      );
    },
  );
  assert.equal(result.confirmed, false);
});
