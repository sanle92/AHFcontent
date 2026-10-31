import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyDpoResponse } from '../lib/dpo-verification.ts';
const expected = { amountMinor: 2500000, currency: 'UGX' };
const xml = (result, currency, amount) =>
  `<API3G><Result>${result}</Result><TransactionCurrency>${currency}</TransactionCurrency><TransactionAmount>${amount}</TransactionAmount></API3G>`;
test('DPO verification confirms only a matching paid response', () => {
  assert.equal(verifyDpoResponse(xml('000', 'UGX', '25000.00'), expected).confirmed, true);
  for (const value of [
    xml('900', 'UGX', '25000'),
    xml('000', 'USD', '25000'),
    xml('000', 'UGX', '25001'),
    '<API3G><Result>000</Result><Result>900</Result><TransactionCurrency>UGX</TransactionCurrency><TransactionAmount>25000</TransactionAmount></API3G>',
    '<!DOCTYPE x>' + xml('000', 'UGX', '25000'),
  ])
    assert.equal(verifyDpoResponse(value, expected).confirmed, false);
});
