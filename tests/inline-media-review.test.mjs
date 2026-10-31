import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRoute } from './route-loader.mjs';
import { createHookHarness, findElement, flushMicrotasks } from './hook-harness.mjs';
const jsx = await import('react/jsx-runtime');
const requirements = await import('../lib/media-review-requirements.ts');
test('inline media review sends rights for review and keeps independent approval', async () => {
  const hooks = createHookHarness();
  const { default: Review } = loadRoute('components/admin/inline-media-review.tsx', {
    'react/jsx-runtime': jsx,
    react: hooks.react,
    '@/lib/media-review-requirements': requirements,
  });
  const calls = [];
  let refreshed = 0;
  const props = {
    media: {
      id: 'media',
      version: 4,
      filename: 'photo',
      status: 'Draft',
      created_by: 'author',
      shows_children: true,
      rights_confirmed: true,
      guardian_consent: true,
      alt_text: 'A family at home',
      consent_reference: 'Consent recorded',
    },
    api: async (path, options) => {
      calls.push({ path, body: JSON.parse(options.body) });
    },
    profile: { id: 'author', roles: ['editor'] },
    editable: true,
    publishable: true,
    busy: false,
    run: async (fn) => fn(),
    refresh: () => refreshed++,
  };
  let tree = hooks.render(Review, props);
  const submit = findElement(
    tree,
    (node) => node.type === 'button' && node.props.children === 'Submit media for review',
  );
  submit.props.onClick();
  await flushMicrotasks();
  assert.equal(calls[0].body.target, 'Review');
  assert.equal(calls[0].body.payload.shows_children, true);
  assert.equal(calls[0].body.version, 4);
  assert.equal(refreshed, 1);
  tree = hooks.render(Review, { ...props, media: { ...props.media, status: 'Review' } });
  assert.equal(
    findElement(tree, (node) => node.type === 'button' && node.props.children === 'Approve media'),
    undefined,
  );
  tree = hooks.render(Review, {
    ...props,
    profile: { id: 'publisher', roles: ['publisher'] },
    media: { ...props.media, status: 'Review' },
  });
  const approve = findElement(
    tree,
    (node) => node.type === 'button' && node.props.children === 'Approve media',
  );
  assert.ok(approve);
  assert.equal(approve.props.disabled, false);
  approve.props.onClick();
  await flushMicrotasks();
  assert.equal(calls[1].body.target, 'Approved');
  hooks.unmount();
});

test('the form explains missing rights and consent and prevents premature approval', () => {
  const hooks = createHookHarness();
  const { default: Review } = loadRoute('components/admin/inline-media-review.tsx', {
    'react/jsx-runtime': jsx,
    react: hooks.react,
    '@/lib/media-review-requirements': requirements,
  });
  const media = {
    id: 'm',
    version: 1,
    filename: 'child.jpg',
    status: 'Draft',
    created_by: 'author',
    shows_children: true,
    rights_confirmed: false,
    guardian_consent: false,
    alt_text: '',
    consent_reference: '',
  };
  const base = {
    media,
    api: async () => {},
    profile: { id: 'author', roles: ['editor'] },
    editable: true,
    publishable: false,
    busy: false,
    run: async (fn) => fn(),
    refresh: () => {},
  };
  let tree = hooks.render(Review, base);
  let button = findElement(
    tree,
    (n) => n.type === 'button' && n.props.children === 'Submit media for review',
  );
  assert.equal(button.props.disabled, true);
  assert.equal(requirements.mediaReviewRequirements(media).length, 4);
  tree = hooks.render(Review, {
    ...base,
    media: { ...media, status: 'Review' },
    profile: { id: 'publisher', roles: ['publisher'] },
    editable: false,
    publishable: true,
  });
  button = findElement(tree, (n) => n.type === 'button' && n.props.children === 'Approve media');
  assert.equal(button.props.disabled, true);
  assert.ok(findElement(tree, (n) => n.type === 'button' && n.props.children === 'Return media'));
  hooks.unmount();
});

test('media requirements and editing rights reflect children and account ownership', () => {
  const media = {
    created_by: 'author',
    alt_text: 'Community gathering',
    shows_children: false,
    rights_confirmed: true,
    guardian_consent: false,
    consent_reference: '',
  };
  assert.deepEqual(requirements.mediaReviewRequirements(media), []);
  assert.equal(requirements.mediaReviewRequirements({ ...media, shows_children: true }).length, 2);
  assert.equal(
    requirements.canPrepareMedia(media, { id: 'other', roles: ['editor'] }, true),
    false,
  );
  assert.equal(
    requirements.canPrepareMedia(media, { id: 'other', roles: ['administrator'] }, true),
    true,
  );
  assert.equal(
    requirements.canPrepareMedia(media, { id: 'other', roles: ['publisher'] }, false),
    false,
  );
});
