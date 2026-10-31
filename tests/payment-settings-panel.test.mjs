import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRoute } from './route-loader.mjs';
import { createHookHarness, findElement, flushMicrotasks } from './hook-harness.mjs';
const jsx = await import('react/jsx-runtime');
test('payment settings preserve existing content and submit a draft using the authenticated API', async () => {
  const hooks = createHookHarness();
  const record = {
    id: 'item',
    version: 1,
    status: 'Draft',
    kind: 'page',
    slug: 'site-settings',
    title: 'Settings',
    summary: '',
    body: '',
    details: { contact_email: 'office@example.invalid' },
  };
  const calls = [];
  const api = async (path, options) => {
    if (!options) return [record];
    const body = JSON.parse(options.body);
    calls.push(body);
    return { ...record, details: body.payload.details };
  };
  const { default: Panel } = loadRoute('components/admin/payment-settings-panel.tsx', {
    'react/jsx-runtime': jsx,
    react: hooks.react,
  });
  const props = { api, profile: { id: 'author' }, dirty: false, setDirty() {} };
  hooks.render(Panel, props);
  await flushMicrotasks();
  const tree = hooks.render(Panel, props);
  const button = findElement(
    tree,
    (n) => n.type === 'button' && n.props.children === 'Save payment details',
  );
  button.props.onClick();
  await flushMicrotasks();
  assert.equal(calls[0].payload.details.contact_email, 'office@example.invalid');
  assert.equal(calls[0].id, 'item');
  hooks.unmount();
});
