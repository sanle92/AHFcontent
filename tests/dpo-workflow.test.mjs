import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareDonation, reconcileDonation } from '../lib/dpo-workflow.ts';
const token = '00000000-0000-4000-8000-000000000001';
const checkoutUrl = 'https://secure.3gdirectpay.com/payv3.php?ID=' + token;
const input = { reference: 'id', amountMinor: 10000, currency: 'UGX', purpose: 'Education' };
test('creates provider transaction once and only returns URL after durable binding', async () => {
  let created = 0,
    bound = 0;
  const deps = {
    reserve: async () => ({ created: true }),
    create: async () => {
      created++;
      return { token, checkoutUrl };
    },
    bind: async () => {
      bound++;
      return true;
    },
  };
  assert.deepEqual(await prepareDonation(input, deps), { state: 'ready', checkoutUrl });
  assert.equal(created, 1);
  assert.equal(bound, 1);
  deps.reserve = async () => ({ created: false });
  assert.deepEqual(await prepareDonation(input, deps), { state: 'needs_reconciliation' });
  assert.equal(created, 1);
});
test('uncertain creation or binding never returns a payment URL', async () => {
  const reserve = async () => ({ created: true });
  assert.deepEqual(
    await prepareDonation(input, {
      reserve,
      create: async () => {
        throw Error('timeout');
      },
      bind: async () => true,
    }),
    { state: 'needs_reconciliation' },
  );
  assert.deepEqual(
    await prepareDonation(input, {
      reserve,
      create: async () => ({ token, checkoutUrl }),
      bind: async () => {
        throw Error('timeout');
      },
    }),
    { state: 'needs_reconciliation' },
  );
});

test('a provider redirect outside the fixed DPO address is rejected before binding', async () => {
  let bound = false;
  const result = await prepareDonation(input, {
    reserve: async () => ({ created: true }),
    create: async () => ({ token, checkoutUrl: 'https://evil.example/' }),
    bind: async () => {
      bound = true;
      return true;
    },
  });
  assert.deepEqual(result, { state: 'needs_reconciliation' });
  assert.equal(bound, false);
});

test('reconciliation verifies and records before acknowledgement and can retry it', async () => {
  const record = { ...input, token, status: 'pending' };
  const steps = [];
  const deps = {
    verify: async () => {
      steps.push('verify');
      return { confirmed: true };
    },
    confirm: async () => {
      steps.push('confirm');
      return true;
    },
    acknowledge: async () => {
      steps.push('acknowledge');
      return { confirmed: true };
    },
  };
  assert.deepEqual(await reconcileDonation(record, deps), { state: 'confirmed' });
  assert.deepEqual(steps, ['verify', 'confirm', 'acknowledge']);
  deps.acknowledge = async () => {
    throw Error('timeout');
  };
  assert.deepEqual(await reconcileDonation(record, deps), { state: 'acknowledgement_pending' });
});

test('unverified, mismatched, or unrecorded payments cannot be acknowledged', async () => {
  let acknowledgements = 0;
  const deps = {
    verify: async () => ({ confirmed: false }),
    confirm: async () => true,
    acknowledge: async () => {
      acknowledgements++;
      return { confirmed: true };
    },
  };
  const record = { ...input, token, status: 'pending' };
  assert.deepEqual(await reconcileDonation(record, deps), { state: 'needs_review' });
  deps.verify = async () => ({ confirmed: true });
  deps.confirm = async () => false;
  assert.deepEqual(await reconcileDonation(record, deps), { state: 'needs_review' });
  deps.confirm = async () => {
    throw Error('database unavailable');
  };
  assert.deepEqual(await reconcileDonation(record, deps), { state: 'retry' });
  assert.equal(acknowledgements, 0);
});
