import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRoute } from './route-loader.mjs';
const React = await import('react');
const jsx = await import('react/jsx-runtime');
const { renderToStaticMarkup } = await import('react-dom/server');
const { default: Methods } = loadRoute('components/donation-methods.tsx', {
  'react/jsx-runtime': jsx,
  './app-link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
});
test('only complete approved payment details render and checkout is clearly unavailable', () => {
  let html = renderToStaticMarkup(Methods({ settings: { donate_bank_name: 'Example bank' } }));
  assert.ok(!html.includes('Example bank'));
  assert.match(html, /Online checkout is not available yet/);
  html = renderToStaticMarkup(
    Methods({
      settings: {
        donate_bank_name: 'Example bank',
        donate_bank_account_name: 'Example foundation',
        donate_bank_account_number: '12345',
        donate_mtn_name: 'Example merchant',
        donate_mtn_code: '456',
      },
    }),
  );
  assert.match(html, /Example bank/);
  assert.match(html, /12345/);
  assert.match(html, /Example merchant/);
  assert.match(html, /verified|verifies receipt/);
  assert.ok(!html.includes('Airtel Money merchant'));
});
