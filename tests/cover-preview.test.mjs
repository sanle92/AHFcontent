import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRoute } from './route-loader.mjs';
import { createHookHarness, findElement, flushMicrotasks } from './hook-harness.mjs';
import { publicationBlockers } from '../lib/publication-readiness.ts';
const jsx = await import('react/jsx-runtime');
const noop = () => {};
const cover = {
  id: '00000000-0000-4000-8000-000000000001',
  filename: 'Cover.jpg',
  mime: 'image/jpeg',
  alt_text: 'Programme cover',
  status: 'Approved',
};
function picker(props) {
  const hooks = createHookHarness();
  const { default: CoverPicker } = loadRoute('components/cover-picker.tsx', {
    'react/jsx-runtime': jsx,
    react: hooks.react,
    window: new EventTarget(),
    './app-image': { default: noop },
    './app-link': { default: noop },
  });
  return { hooks, render: (next = props) => hooks.render(CoverPicker, next) };
}
const image = (tree) => findElement(tree, (n) => typeof n.props?.src === 'string');

test('Submit for review remounts the editor but automatically restores the saved private cover', async () => {
  const editorHooks = createHookHarness();
  const Cover = () => null;
  const { default: ContentEditor } = loadRoute('components/admin/content-editor.tsx', {
    'react/jsx-runtime': jsx,
    react: editorHooks.react,
    '@/lib/publication-readiness': { publicationBlockers },
    '@/hooks/use-content-readiness': {
      useContentReadiness: () => ({
        blockers: [],
        checking: false,
        error: '',
        canSubmit: true,
        refresh() {},
      }),
    },
    'lucide-react': { X: noop },
    '../cover-picker': { default: Cover },
    './inline-media-review': { default: noop },
    '../content-fields': { default: noop },
  });
  let calls = 0,
    target;
  const props = {
    ready: true,
    dirty: false,
    setDirty: noop,
    onClose: noop,
    creating: false,
    selected: {
      id: '00000000-0000-4000-8000-000000000002',
      kind: 'programme',
      slug: 'education',
      title: 'Education programme',
      summary: '',
      body: '',
      details: {},
      cover_id: cover.id,
      version: 1,
      status: 'Draft',
      created_by: 'author',
    },
    section: 'programme',
    error: '',
    preview: false,
    setPreview: noop,
    save: async () => {},
    api: async (path) => {
      assert.equal(path, 'website-media?id=' + cover.id);
      return { url: '/private-signed-cover-' + ++calls };
    },
    media: [cover],
    demo: false,
    busy: false,
    editable: true,
    load: async () => {},
    items: [],
    kids: false,
    run: async (fn) => fn(),
    setMessage: noop,
    message: '',
    note: '',
    setNote: noop,
    transition: (value) => {
      target = value;
    },
    publishable: false,
    profile: { id: 'author' },
    schedule: '',
    setSchedule: noop,
    revisions: [],
    open: noop,
  };
  let tree = editorHooks.render(ContentEditor, props);
  const draftFormKey = findElement(tree, (n) => n.type === 'form').key;
  const draftProps = findElement(tree, (n) => n.type === Cover).props;
  const draftPicker = picker(draftProps);
  let draftTree = draftPicker.render();
  // Choosing an existing cover previews it before submission, matching the reported sequence.
  findElement(draftTree, (n) => n.type === 'select').props.onChange({
    target: { value: cover.id },
  });
  draftPicker.render();
  await flushMicrotasks();
  assert.ok(image(draftPicker.render()));
  findElement(
    tree,
    (n) => n.type === 'button' && n.props.children === 'Submit for review',
  ).props.onClick();
  assert.equal(target, 'Review');
  draftPicker.hooks.unmount();
  props.selected = { ...props.selected, status: 'Review', version: 2 };
  props.ready = false;
  tree = editorHooks.render(ContentEditor, props);
  assert.equal(
    findElement(tree, (n) => n.type === Cover),
    undefined,
  );
  props.ready = true;
  tree = editorHooks.render(ContentEditor, props);
  assert.notEqual(findElement(tree, (n) => n.type === 'form').key, draftFormKey);
  const reviewProps = findElement(tree, (n) => n.type === Cover).props;
  assert.equal(reviewProps.value, cover.id);
  assert.equal(reviewProps.disabled, true);
  const reviewPicker = picker(reviewProps);
  reviewPicker.render();
  await flushMicrotasks();
  assert.ok(
    image(reviewPicker.render()),
    'The cover must return without reselecting it or clicking Preview.',
  );
  assert.match(image(reviewPicker.render()).props.src, /^\/private-signed-cover-/);
  const requestCount = calls;
  const next = findElement(
    editorHooks.render(ContentEditor, { ...props, note: 'Reviewed' }),
    (n) => n.type === Cover,
  ).props;
  reviewPicker.render(next);
  await flushMicrotasks();
  assert.equal(calls, requestCount, 'Unrelated parent updates must not restart signing requests.');
  reviewPicker.hooks.unmount();
  editorHooks.unmount();
});

test('read-only reviewers can see and reload a saved cover while editing stays disabled', async () => {
  let calls = 0;
  const props = {
    value: cover.id,
    media: [cover],
    report: false,
    disabled: true,
    onSelectionChange: noop,
    onUpload: async () => {
      throw Error('Must not upload');
    },
    onPreview: async () => {
      if (++calls === 1) throw Error('Sign-in expired.');
      return '/fresh-private-preview';
    },
  };
  const view = picker(props);
  view.render();
  await flushMicrotasks();
  let tree = view.render();
  assert.ok(
    findElement(tree, (n) => n.props?.role === 'alert'),
    'A failed preview must be explained.',
  );
  assert.equal(findElement(tree, (n) => n.type === 'select').props.disabled, true);
  assert.equal(findElement(tree, (n) => n.props?.type === 'file').props.disabled, true);
  const retry = findElement(tree, (n) => n.type === 'button' && /preview/i.test(n.props.children));
  assert.equal(retry.props.disabled, false, 'Preview is allowed for an authorized reviewer.');
  retry.props.onClick();
  view.render();
  await flushMicrotasks();
  tree = view.render();
  assert.equal(image(tree)?.props.src, '/fresh-private-preview');
  view.hooks.unmount();
});

test('a changed cover and an unmounted form ignore pending older preview responses', async () => {
  const pending = new Map();
  const second = { ...cover, id: 'second' };
  const props = {
    value: cover.id,
    media: [cover, second],
    report: false,
    disabled: false,
    onSelectionChange: noop,
    onUpload: async () => {},
    onPreview: (id) => new Promise((resolve) => pending.set(id, resolve)),
  };
  const view = picker(props);
  view.render();
  await flushMicrotasks();
  let tree = view.render();
  findElement(tree, (n) => n.type === 'select').props.onChange({ target: { value: second.id } });
  view.render();
  await flushMicrotasks();
  pending.get(second.id)('/second-preview');
  await flushMicrotasks();
  pending.get(cover.id)('/old-preview');
  await flushMicrotasks();
  tree = view.render();
  assert.equal(image(tree)?.props.src, '/second-preview');
  findElement(
    tree,
    (n) => n.type === 'button' && /preview/i.test(n.props.children),
  ).props.onClick();
  view.render();
  await flushMicrotasks();
  view.hooks.unmount();
  pending.get(second.id)('/late-preview');
  await flushMicrotasks();
  assert.equal(view.hooks.lateUpdates, 0);
});

test('saved report covers also restore their private PDF link on reopen', async () => {
  const props = {
    value: cover.id,
    media: [{ ...cover, mime: 'application/pdf' }],
    report: true,
    disabled: true,
    onSelectionChange: noop,
    onUpload: async () => {},
    onPreview: async () => '/private-report.pdf',
  };
  const view = picker(props);
  view.render();
  await flushMicrotasks();
  const tree = view.render();
  assert.ok(findElement(tree, (n) => n.props?.href === '/private-report.pdf'));
  assert.equal(image(tree), undefined);
  view.hooks.unmount();
});
