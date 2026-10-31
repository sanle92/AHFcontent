import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRoute } from './route-loader.mjs';
import { createHookHarness, findElement, flushMicrotasks } from './hook-harness.mjs';

const jsx = await import('react/jsx-runtime');
const content = await import('../lib/content.ts');
const icons = await import('lucide-react');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const row = (id) => ({
  id,
  kind: 'programme',
  slug: id,
  title: 'Programme ' + id,
  body: '',
  summary: '',
  details: {},
  version: 1,
  status: 'Draft',
  created_by: 'author',
});
async function adminHarness() {
  const hooks = createHookHarness();
  const ContentEditor = () => null;
  const profile = { id: 'author', name: 'Author', active: true, roles: ['administrator'] };
  const data = (items = []) => ({
    profile,
    items,
    media: [],
    enquiries: [],
    mail: [],
    staff: [profile],
    integrations: {},
  });
  let handler;
  const api = async (path, init) => {
    if (handler) {
      const value = handler(path, init);
      if (value !== undefined) return value;
    }
    if (path.startsWith('revisions')) return [];
    if (path.startsWith('workspace')) return {};
    const id = new URL('https://test.invalid/' + path).searchParams.get('id');
    return data(id ? [row(id)] : []);
  };
  const empty = () => null;
  const document = new EventTarget();
  document.querySelector = () => null;
  const mocks = {
    'react/jsx-runtime': jsx,
    react: hooks.react,
    'lucide-react': icons,
    '@/lib/api-response': { readApiResponse: (response) => response.json() },
    '@/lib/content': content,
    '@/lib/editorial': { extraKeys: [] },
    '@/lib/assurance': { hasSecondFactor: () => true },
    '@/hooks/use-workspace': { useWorkspace: () => ({ rows: [], total: 0, error: '' }) },
    '@/hooks/use-staff-api': { useStaffApi: () => api },
    '@/hooks/use-admin-session': { useAdminSession() {} },
    '@/hooks/use-clock': { useClock: () => 0 },
    '@/hooks/use-request-guard': {
      useRequestGuard() {
        const epoch = hooks.react.useRef(0);
        return hooks.react.useState(() => ({
          capture: () => epoch.current,
          isCurrent: (value) => value === epoch.current,
          invalidate: () => epoch.current++,
        }))[0];
      },
    },
    './admin/content-editor': { default: ContentEditor },
    './admin/payment-settings-panel': { default: empty },
    './admin-device': { default: empty, disableDevice: async () => {} },
    fetch: async () =>
      Response.json({ configured: true, url: 'https://test.invalid', key: 'test' }),
    sessionStorage: { getItem: () => JSON.stringify({ access_token: 'test' }) },
    window: Object.assign(new EventTarget(), { confirm: () => true }),
    document,
  };
  for (const name of [
    './workspace-pagination',
    './retention-panel',
    './delivery-health',
    './admin/enquiry-detail',
    './admin/enquiry-workspace',
    './admin/media-review',
    './admin/media-workspace',
    './app-image',
    './app-link',
    './analytics-panel',
    './mfa-gate',
    './notification-inbox',
    './notification-bell',
    './workspace-panels',
  ])
    mocks[name] = { default: empty };
  const { default: Admin } = loadRoute('components/website-admin.tsx', mocks);
  let tree;
  const render = () => {
    tree = hooks.render(Admin, {});
    return tree;
  };
  const editor = () => findElement(tree, (node) => node.type === ContentEditor).props;
  const settle = async () => {
    for (let i = 0; i < 5; i++) {
      render();
      await flushMicrotasks();
    }
  };
  await settle();
  return {
    hooks,
    editor,
    render,
    settle,
    data,
    window: mocks.window,
    handle: (next) => {
      handler = next;
    },
  };
}

test('an old editor reload cannot replace a newly opened record', async () => {
  const app = await adminHarness();
  app.editor().open(row('first'));
  await app.settle();
  const pending = deferred();
  app.handle((path) => (path === 'editorial?view=editor&id=first' ? pending.promise : undefined));
  const reload = app.editor().load();
  app.editor().open(row('second'));
  await app.settle();
  pending.resolve(app.data([row('first')]));
  await reload;
  app.render();
  assert.equal(app.editor().selected?.id, 'second');
  app.hooks.unmount();
});

test('late editor-choice and revision errors do not appear in a different editor', async () => {
  for (const delayedPath of ['editorial?view=editor&id=first', 'revisions?id=first']) {
    const app = await adminHarness();
    const pending = deferred();
    app.handle((path) => (path === delayedPath ? pending.promise : undefined));
    app.editor().open(row('first'));
    await app.settle();
    app.editor().open(row('second'));
    await app.settle();
    pending.reject(Error('Old request failed'));
    await app.settle();
    assert.equal(app.editor().selected?.id, 'second');
    assert.equal(app.editor().error, '');
    app.hooks.unmount();
  }
});

test('a reload reports current failures but discards failures after switching editors', async () => {
  const app = await adminHarness();
  app.editor().open(row('first'));
  await app.settle();
  app.handle((path) => {
    if (path === 'editorial?view=editor&id=first') return Promise.reject(Error('Current failure'));
  });
  await assert.rejects(app.editor().load(), /Current failure/);
  const pending = deferred();
  app.handle((path) => (path === 'editorial?view=editor&id=first' ? pending.promise : undefined));
  const reload = app.editor().load();
  app.editor().open(row('second'));
  await app.settle();
  pending.reject(Error('Obsolete failure'));
  await assert.doesNotReject(reload);
  assert.equal(app.editor().selected.id, 'second');
  app.hooks.unmount();
});

test('approval refresh observes independent review and ignores obsolete record responses', async () => {
  const hooks = createHookHarness();
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const window = new EventTarget();
  const pending = [];
  const api = (path) => {
    const request = deferred();
    pending.push({ path, ...request });
    return request.promise;
  };
  const { useContentReadiness } = loadRoute('hooks/use-content-readiness.ts', {
    react: hooks.react,
    document,
    window,
  });
  const Component = ({ id, version }) => useContentReadiness(api, id, version, true);
  const nextTimer = () => new Promise((resolve) => setTimeout(resolve, 5));
  const props = { id: 'first', version: 1 };
  hooks.render(Component, props);
  await nextTimer();
  assert.equal(pending.length, 1);
  window.dispatchEvent(new Event('focus'));
  assert.equal(pending.length, 1, 'Focus does not duplicate an outstanding request');
  pending[0].resolve({ version: 1, blockers: ['Cover needs review'], canSubmit: true, media: [] });
  await flushMicrotasks();
  let value = hooks.render(Component, props);
  assert.equal(value.blockers[0], 'Cover needs review');
  window.dispatchEvent(new Event('focus'));
  pending[1].resolve({
    version: 1,
    blockers: [],
    canSubmit: true,
    media: [{ id: 'cover', version: 3, status: 'Approved' }],
  });
  await flushMicrotasks();
  value = hooks.render(Component, props);
  assert.equal(value.blockers.length, 0);
  assert.equal(value.media[0].status, 'Approved');

  value.refresh();
  assert.equal(
    hooks.render(Component, props).checking,
    true,
    'Manual refresh does not trust stale approvals',
  );
  await nextTimer();
  pending[2].resolve({
    version: 1,
    blockers: [],
    canSubmit: true,
    media: [{ id: 'cover', version: 3, status: 'Approved' }],
  });
  await flushMicrotasks();
  assert.equal(hooks.render(Component, props).checking, false);

  window.dispatchEvent(new Event('focus'));
  const second = { id: 'second', version: 2 };
  assert.equal(hooks.render(Component, second).checking, true);
  await nextTimer();
  pending[4].resolve({ version: 3, blockers: [], canSubmit: true, media: [] });
  await flushMicrotasks();
  value = hooks.render(Component, second);
  assert.match(value.blockers[0], /record changed/i);
  pending[3].resolve({ version: 1, blockers: ['Obsolete result'], canSubmit: true, media: [] });
  await flushMicrotasks();
  assert.match(hooks.render(Component, second).blockers[0], /record changed/i);

  document.visibilityState = 'hidden';
  window.dispatchEvent(new Event('focus'));
  assert.equal(pending.length, 5);
  document.visibilityState = 'visible';
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(pending.length, 6);
  hooks.unmount();
  pending[5].reject(Error('Late failure'));
  await flushMicrotasks();
  assert.equal(hooks.lateUpdates, 0);
});

test('publishing updates the live timestamp immediately and drafting preserves it', async () => {
  const app = await adminHarness();
  const liveSince = '2026-10-28T12:00:00.000Z';
  app.editor().open({ ...row('first'), status: 'Approved' });
  await app.settle();
  app.handle((path, init) => {
    if (path !== 'editorial' || !init) return;
    const { target, action } = JSON.parse(init.body);
    return {
      ...row('first'),
      status: action === 'withdraw' ? 'Archived' : target,
      version: target === 'Published' ? 2 : 3,
      updated_at: target === 'Published' ? liveSince : '2026-10-28T13:00:00.000Z',
    };
  });
  app.editor().transition('Published');
  await app.settle();
  assert.equal(app.editor().selected.live_since, liveSince);
  assert.equal(app.editor().items.find((item) => item.id === 'first').live_since, liveSince);
  app.editor().transition('Draft');
  await app.settle();
  assert.equal(app.editor().selected.live_since, liveSince);
  app.editor().transition('WithdrawPublic');
  await app.settle();
  assert.equal(app.editor().selected.status, 'Archived');
  assert.equal(app.editor().selected.live_since, undefined);
  app.hooks.unmount();
});

test('cancelling navigation keeps the current workspace and unsaved editor', async () => {
  const app = await adminHarness();
  app.editor().open(row('first'));
  await app.settle();
  app.editor().setDirty(true);
  const tree = app.render();
  app.window.confirm = () => false;
  const kidsButton = findElement(
    tree,
    (node) =>
      node.type === 'button' &&
      Array.isArray(node.props?.children) &&
      node.props.children.includes('Aminia Kids studio'),
  );
  assert.ok(kidsButton);
  kidsButton.props.onClick();
  app.render();
  assert.equal(app.editor().selected?.id, 'first');
  assert.equal(app.editor().kids, false);
  assert.equal(app.editor().dirty, true);
  app.hooks.unmount();
});
