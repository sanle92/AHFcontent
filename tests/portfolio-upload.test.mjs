import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRoute } from './route-loader.mjs';
import { createHookHarness, findElement } from './hook-harness.mjs';
import { ids, updates } from '../lib/editorial.ts';
const jsx = await import('react/jsx-runtime');
test('uploads attach photos and video to the current draft', async () => {
  const hooks = createHookHarness();
  const { default: Fields } = loadRoute('components/content-fields.tsx', {
    'react/jsx-runtime': jsx,
    react: hooks.react,
    '@/lib/editorial': { ids, updates },
    './admin/media-thumbnail': { default: () => null },
  });
  let dirty = 0;
  const props = {
    kind: 'programme',
    items: [],
    media: [],
    onSelectionChange: () => dirty++,
    onUpload: async (file) => ({
      id: file.name,
      filename: file.name,
      mime: file.type,
      status: 'Draft',
    }),
  };
  const render = () => hooks.render(Fields, props);
  let tree = render();
  let upload = findElement(tree, (n) => n.type === 'input' && n.props.type === 'file');
  await upload.props.onChange({
    currentTarget: { files: [{ name: 'photo', type: 'image/jpeg' }], value: 'x' },
  });
  tree = render();
  const gallery = findElement(tree, (n) => n.props?.name === 'gallery');
  assert.equal(gallery.props.value, '["photo"]');
  upload = findElement(tree, (n) => n.type === 'input' && n.props.type === 'file');
  await upload.props.onChange({
    currentTarget: { files: [{ name: 'video', type: 'video/mp4' }], value: 'x' },
  });
  tree = render();
  assert.equal(findElement(tree, (n) => n.props?.name === 'video_id').props.value, 'video');
  assert.equal(dirty, 2);
  hooks.unmount();
});

test('batch upload retains successful photos when another file fails', async () => {
  const hooks = createHookHarness();
  const { default: Fields } = loadRoute('components/content-fields.tsx', {
    'react/jsx-runtime': jsx,
    react: hooks.react,
    '@/lib/editorial': { ids, updates },
    './admin/media-thumbnail': { default: () => null },
  });
  const props = {
    kind: 'programme',
    items: [],
    media: [],
    onUpload: async (file) => {
      if (file.name === 'failed.jpg') throw Error('Upload failed');
      return { id: file.name, filename: file.name, mime: 'image/jpeg', status: 'Draft' };
    },
  };
  let tree = hooks.render(Fields, props);
  const batch = findElement(tree, (n) => n.type === 'input' && n.props.multiple);
  await batch.props.onChange({
    currentTarget: {
      files: [{ name: 'one.jpg' }, { name: 'failed.jpg' }, { name: 'two.jpg' }],
      value: 'files',
    },
  });
  tree = hooks.render(Fields, props);
  assert.equal(
    findElement(tree, (n) => n.props?.name === 'gallery').props.value,
    '["one.jpg","two.jpg"]',
  );
  const status = findElement(tree, (n) => n.props?.role === 'status');
  assert.match(status.props.children, /2 of 3 photos added/);
  assert.match(status.props.children, /failed.jpg/);
  hooks.unmount();
});

test('thumbnail ignores an old private preview after the photo changes', async () => {
  const hooks = createHookHarness();
  let resolveFirst;
  const preview = (id) =>
    id === 'first'
      ? new Promise((resolve) => {
          resolveFirst = resolve;
        })
      : Promise.resolve('/private-second');
  const Image = () => null;
  const { default: Thumbnail } = loadRoute('components/admin/media-thumbnail.tsx', {
    'react/jsx-runtime': jsx,
    react: hooks.react,
    '../app-image': { default: Image },
  });
  hooks.render(Thumbnail, { id: 'first', name: 'First', preview });
  hooks.render(Thumbnail, { id: 'second', name: 'Second', preview });
  await Promise.resolve();
  resolveFirst('/private-first');
  await Promise.resolve();
  const result = hooks.render(Thumbnail, { id: 'second', name: 'Second', preview });
  assert.equal(result.props.src, '/private-second');
  assert.equal(result.props.alt, 'Second');
  hooks.unmount();
});

test('story forms keep donation fields visible and advanced data available', () => {
  const hooks = createHookHarness();
  const { default: Fields } = loadRoute('components/content-fields.tsx', {
    'react/jsx-runtime': jsx,
    react: hooks.react,
    '@/lib/editorial': { ids, updates },
    './admin/media-thumbnail': { default: () => null },
  });
  const tree = hooks.render(Fields, {
    kind: 'story',
    items: [],
    media: [],
    item: {
      details: { seo_title: 'Saved search title', gofundme_url: 'https://gofundme.com/example' },
    },
  });
  const fundraising = findElement(
    tree,
    (node) => node.type === 'details' && node.props.open === true,
  );
  assert.ok(fundraising);
  assert.equal(
    findElement(fundraising, (node) => node.props?.name === 'gofundme_url').props.defaultValue,
    'https://gofundme.com/example',
  );
  assert.equal(
    findElement(tree, (node) => node.props?.name === 'seo_title').props.defaultValue,
    'Saved search title',
  );
  hooks.unmount();
});

test('a video link registers privately and attaches the returned media id', async () => {
  const hooks = createHookHarness();
  const { default: Fields } = loadRoute('components/content-fields.tsx', {
    'react/jsx-runtime': jsx,
    react: hooks.react,
    '@/lib/editorial': { ids, updates },
    './admin/media-thumbnail': { default: () => null },
  });
  const calls = [];
  let changed = false;
  const props = {
    kind: 'story',
    items: [],
    media: [],
    onSelectionChange: () => {
      changed = true;
    },
    onRegisterVideo: async (title, url) => {
      calls.push({ title, url });
      return { id: 'video-id', filename: title, mime: 'video/external', status: 'Draft' };
    },
  };
  let tree = hooks.render(Fields, props);
  findElement(
    tree,
    (n) => n.type === 'input' && n.props.maxLength === 180 && n.props.value === '',
  ).props.onChange({ target: { value: 'Our story' } });
  tree = hooks.render(Fields, props);
  findElement(
    tree,
    (n) => n.type === 'input' && n.props.placeholder?.startsWith('https://www.youtube'),
  ).props.onChange({ target: { value: 'https://youtu.be/abcdefghijk' } });
  tree = hooks.render(Fields, props);
  await findElement(
    tree,
    (n) => n.type === 'button' && n.props.children === 'Add video link',
  ).props.onClick();
  tree = hooks.render(Fields, props);
  assert.equal(findElement(tree, (n) => n.props?.name === 'video_id').props.value, 'video-id');
  assert.equal(calls[0].url, 'https://youtu.be/abcdefghijk');
  assert.equal(changed, true);
  hooks.unmount();
});
