import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRoute } from './route-loader.mjs';
import { createHookHarness, flushMicrotasks, findElement } from './hook-harness.mjs';
const jsx = await import('react/jsx-runtime');
test('notification bell shows unread updates and refreshes after a notice is read', async () => {
  const hooks = createHookHarness();
  const window = new EventTarget();
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  let rows = [
    { id: 'one', title: 'Review needed', created_at: '2026-01-01' },
    { id: 'two', read_at: '2026-01-01', created_at: '2026-01-01' },
  ];
  const api = async () => ({ rows });
  const { default: Bell } = loadRoute('components/notification-bell.tsx', {
    'react/jsx-runtime': jsx,
    react: hooks.react,
    'lucide-react': { Bell: () => null },
    window,
    document,
  });
  let opened = false;
  const props = {
    api,
    enabled: true,
    onOpen: () => {
      opened = true;
    },
  };
  hooks.render(Bell, props);
  await flushMicrotasks();
  let tree = hooks.render(Bell, props);
  let button = findElement(
    tree,
    (n) => n.type === 'button' && n.props['aria-controls'] === 'notification-preview',
  );
  assert.equal(button.props['aria-label'], 'Open notifications, 1 unread');
  button.props.onClick();
  tree = hooks.render(Bell, props);
  const viewAll = findElement(
    tree,
    (n) => n.type === 'button' && n.props.children === 'View all notifications',
  );
  assert.ok(viewAll);
  viewAll.props.onClick();
  assert.equal(opened, true);
  rows = [{ id: 'one', read_at: '2026-01-01', created_at: '2026-01-01' }];
  window.dispatchEvent(new Event('ahf-notifications-changed'));
  await flushMicrotasks();
  tree = hooks.render(Bell, props);
  button = findElement(
    tree,
    (n) => n.type === 'button' && n.props['aria-controls'] === 'notification-preview',
  );
  assert.equal(button.props['aria-label'], 'Open notifications, 0 unread');
  hooks.unmount();
});

test('mark all keeps failed notifications unread and reports partial failure', async () => {
  const hooks = createHookHarness();
  const window = new EventTarget();
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const api = async (path, options) => {
    if (!options)
      return {
        rows: [
          { id: 'one', title: 'One', created_at: '2026-01-01' },
          { id: 'two', title: 'Two', created_at: '2026-01-01' },
        ],
      };
    if (JSON.parse(options.body).id === 'two') throw Error('Failed');
    return { ok: true };
  };
  const { default: Inbox } = loadRoute('components/notification-inbox.tsx', {
    'react/jsx-runtime': jsx,
    react: hooks.react,
    window,
    document,
  });
  const props = { api, demo: false };
  hooks.render(Inbox, props);
  await flushMicrotasks();
  let tree = hooks.render(Inbox, props);
  const markAll = findElement(
    tree,
    (node) => node.type === 'button' && node.props.children === 'Mark all displayed as read',
  );
  await markAll.props.onClick();
  tree = hooks.render(Inbox, props);
  const alert = findElement(tree, (node) => node.props?.role === 'alert');
  assert.match(alert.props.children, /Some notifications/);
  const one = findElement(tree, (node) => node.type === 'article' && node.key === 'one');
  const two = findElement(tree, (node) => node.type === 'article' && node.key === 'two');
  assert.equal(
    findElement(one, (node) => node.props?.className === 'cms-badge').props.children,
    'Read',
  );
  assert.equal(
    findElement(two, (node) => node.props?.className === 'cms-badge').props.children,
    'Unread',
  );
  hooks.unmount();
});
