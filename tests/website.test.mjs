import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { validateContent, csv, seed } from '../lib/content.ts';
test('validation rejects unsafe links and CSV formulas are escaped', () => {
  const v = { kind: 'page', title: 'About AHF', slug: 'about', summary: '', body: '', details: {} };
  assert.equal(validateContent(v).slug, 'about');
  assert.throws(() => validateContent({ ...v, slug: '../admin' }));
  assert.throws(() => validateContent({ ...v, details: { link: 'javascript:alert(1)' } }));
  assert.match(csv([['=SUM(A1)', '"hello"']]), /^\uFEFF"'=SUM/);
  assert.equal(seed.filter((s) => s.kind === 'programme').length, 9);
  assert.ok(!seed.some((s) => s.details.image?.includes('kids')));
});
test('website database keeps drafts, enquiries and unapproved photographs private', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true))$$;grant usage on schema public,auth,storage to anon,authenticated,service_role;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);alter table storage.objects enable row level security;grant select,insert on storage.objects to anon,authenticated;`,
  );
  for (const file of [
    '001_website.sql',
    '002_provided_content.sql',
    '003_public_workspace.sql',
    '004_merchandise.sql',
    '005_engagement.sql',
    '006_faith_copy.sql',
    '007_media_install.sql',
    '008_notifications.sql',
    '009_visitor_analytics.sql',
    '010_enquiry_desk.sql',
    '011_review_hardening.sql',
    '011_review_hardening.sql',
    '012_privacy_revocation.sql',
    '012_privacy_revocation.sql',
    '013_reliable_delivery.sql',
    '013_reliable_delivery.sql',
    '014_analytics_accuracy.sql',
    '014_analytics_accuracy.sql',
    '015_workspace_paging.sql',
    '015_workspace_paging.sql',
    '016_media_impact_and_legacy_leases.sql',
    '016_media_impact_and_legacy_leases.sql',
    '017_device_ownership.sql',
    '017_device_ownership.sql',
    '018_deep_analytics.sql',
    '018_deep_analytics.sql',
    '019_publication_and_choices.sql',
    '019_publication_and_choices.sql',
    '020_operational_controls.sql',
    '020_operational_controls.sql',
    '021_bounded_publication_state.sql',
    '021_bounded_publication_state.sql',
    '022_public_withdrawal.sql',
    '022_public_withdrawal.sql',
    '023_donation_details.sql',
    '023_donation_details.sql',
    '024_dpo_ledger.sql',
    '024_dpo_ledger.sql',
    '025_analytics_presence.sql',
    '025_analytics_presence.sql',
    '026_dpo_reservation.sql',
    '026_dpo_reservation.sql',
  ])
    await db.exec(await readFile(new URL('../supabase/' + file, import.meta.url), 'utf8'));
  const ids = {
    administrator: '00000000-0000-4000-8000-000000000005',
    editor: '00000000-0000-4000-8000-000000000001',
    publisher: '00000000-0000-4000-8000-000000000002',
    coordinator: '00000000-0000-4000-8000-000000000003',
    inactive: '00000000-0000-4000-8000-000000000004',
  };
  for (const [name, id] of Object.entries(ids)) {
    await db.query('insert into auth.users values($1)', [id]);
    await db.query('insert into website_profiles(id,name,roles,active) values($1,$2,$3,$4)', [
      id,
      name,
      [
        name === 'coordinator'
          ? 'enquiry_coordinator'
          : name === 'inactive'
            ? 'administrator'
            : name,
      ],
      name !== 'inactive',
    ]);
  }
  const as = async (name, aal = 'aal2') => {
    await db.exec('reset role');
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.aal',$2,false)",
      [ids[name] || '', aal],
    );
    await db.exec(
      'set role ' +
        (name === 'anon' ? 'anon' : name === 'service' ? 'service_role' : 'authenticated'),
    );
  };
  const payload = {
    kind: 'story',
    slug: 'reviewed-story',
    title: 'Reviewed community story',
    summary: 'A verified introduction',
    body: 'Approved wording',
    details: {},
    cover_id: null,
  };
  const save = async (p, id = null, version = null) =>
    (await db.query('select * from save_website_content($1,$2,$3)', [p, id, version])).rows[0];
  const move = async (r, target, note = '', schedule = null) =>
    (
      await db.query('select * from transition_website_content($1,$2,$3,$4,$5)', [
        r.id,
        target,
        r.version,
        note,
        schedule,
      ])
    ).rows[0];
  let story, photo;
  await t.test('anonymous visitors see provided published facts, never drafts', async () => {
    await as('anon');
    assert.equal((await db.query('select * from published_content')).rows.length, seed.length);
    await assert.rejects(() => db.query('select * from content_items'), /permission denied/);
    await assert.rejects(() => db.query('select * from website_enquiries'), /permission denied/);
    await assert.rejects(() => save(payload), /permission denied/);
    await as('editor');
    story = await save(payload);
    await as('anon');
    assert.equal(
      (await db.query("select * from published_content where slug='reviewed-story'")).rows.length,
      0,
    );
  });
  await t.test('MFA and current staff activity are enforced independently of UI', async () => {
    await as('editor', 'aal1');
    assert.equal((await db.query('select * from content_items')).rows.length, 0);
    await assert.rejects(() => save(payload), /Access denied/);
    await as('inactive');
    assert.equal((await db.query('select * from content_items')).rows.length, 0);
    await as('editor');
    await assert.rejects(
      () =>
        db.query("update website_profiles set roles=array['administrator'] where id=auth.uid()"),
      /permission denied/,
    );
  });
  await t.test('independent approval, locked submissions and version checks', async () => {
    await as('editor');
    story = await move(story, 'Review');
    await assert.rejects(
      () => save({ ...payload, title: 'Changed in review' }, story.id, story.version),
      /draft before editing/,
    );
    await assert.rejects(
      () => move(story, 'Approved'),
      /Transition not permitted|different publisher/,
    );
    await as('publisher');
    story = await move(story, 'Approved');
    story = await move(story, 'Published');
    await as('anon');
    assert.equal(
      (await db.query("select * from published_content where slug='reviewed-story'")).rows[0].title,
      payload.title,
    );
    await as('editor');
    await assert.rejects(() => save(payload, story.id, 1), /Record changed/);
    await assert.rejects(() => save(payload, story.id, null), /Record changed/);
  });
  await t.test(
    'editing a live page preserves its public snapshot; revisions are immutable',
    async () => {
      await as('editor');
      story = await move(story, 'Draft');
      story = await save({ ...payload, title: 'A new draft title' }, story.id, story.version);
      await as('anon');
      assert.equal(
        (await db.query("select * from published_content where slug='reviewed-story'")).rows[0]
          .title,
        payload.title,
      );
      await as('editor');
      assert.ok(
        (await db.query('select * from content_revisions where content_id=$1', [story.id])).rows
          .length >= 4,
      );
      await assert.rejects(() => db.query('delete from content_revisions'), /permission denied/);
    },
  );
  await t.test('future publications stay hidden and can be archived', async () => {
    await as('editor');
    story = await move(story, 'Review');
    await as('publisher');
    story = await move(story, 'Approved');
    const future = (await db.query("select (now()+interval '1 day')::text value")).rows[0].value;
    story = await move(story, 'Scheduled', '', future);
    await as('anon');
    assert.equal(
      (await db.query("select * from published_content where slug='reviewed-story'")).rows[0].title,
      payload.title,
    );
    assert.equal(
      (await db.query('select * from publications where content_id=$1', [story.id])).rows.length,
      1,
    );
    await as('publisher');
    story = await move(story, 'Archived');
    await as('anon');
    assert.equal(
      (await db.query('select * from published_content where id=$1', [story.id])).rows.length,
      0,
    );
  });
  await t.test(
    'republishing hides superseded snapshots and restoration preserves the live page',
    async () => {
      await as('editor');
      let r = await save({ ...payload, slug: 'revision-test' });
      r = await move(r, 'Review');
      await as('publisher');
      r = await move(r, 'Approved');
      r = await move(r, 'Published');
      await as('editor');
      r = await move(r, 'Draft');
      r = await save(
        { ...payload, slug: 'revision-test', title: 'Updated public story' },
        r.id,
        r.version,
      );
      r = await move(r, 'Review');
      await as('publisher');
      r = await move(r, 'Approved');
      r = await move(r, 'Published');
      await as('anon');
      assert.equal(
        (await db.query('select * from publications where content_id=$1', [r.id])).rows.length,
        1,
      );
      assert.equal(
        (await db.query('select * from published_content where id=$1', [r.id])).rows[0].title,
        'Updated public story',
      );
      await as('editor');
      const prior = (
        await db.query(
          'select * from content_revisions where content_id=$1 order by version limit 1',
          [r.id],
        )
      ).rows[0];
      r = (await db.query('select * from restore_website_draft($1,$2)', [prior.id, r.version]))
        .rows[0];
      assert.equal(r.status, 'Draft');
      await as('anon');
      assert.equal(
        (await db.query('select * from published_content where id=$1', [r.id])).rows[0].title,
        'Updated public story',
      );
    },
  );
  await t.test(
    'children’s photographs require rights, guardian consent and independent review',
    async () => {
      await as('editor');
      const path = ids.editor + '/private.jpg';
      await db.query(
        "insert into storage.objects(bucket_id,name,owner_id) values('website-media',$1,auth.uid()::text)",
        [path],
      );
      photo = (
        await db.query('select * from register_website_media($1,$2,$3)', [
          path,
          'Photo.jpg',
          'image/jpeg',
        ])
      ).rows[0];
      await as('anon');
      assert.equal(
        (await db.query('select * from website_public_media($1)', [photo.id])).rows.length,
        0,
      );
      assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
      await as('editor');
      photo = (
        await db.query('select * from review_website_media($1,$2,$3,$4)', [
          photo.id,
          photo.version,
          {
            alt_text: 'Aminia Kids activity',
            caption: 'Approved caption',
            shows_children: true,
            rights_confirmed: true,
            guardian_consent: false,
            consent_reference: '',
          },
          'Review',
        ])
      ).rows[0];
      await as('publisher');
      await assert.rejects(
        () =>
          db.query('select * from review_website_media($1,$2,$3,$4)', [
            photo.id,
            photo.version,
            {},
            'Approved',
          ]),
        /approved media/,
      );
      photo = (
        await db.query('select * from review_website_media($1,$2,$3,$4)', [
          photo.id,
          photo.version,
          {},
          'Rejected',
        ])
      ).rows[0];
      await as('editor');
      photo = (
        await db.query('select * from review_website_media($1,$2,$3,$4)', [
          photo.id,
          photo.version,
          {
            alt_text: 'Aminia Kids activity',
            caption: 'Approved caption',
            shows_children: true,
            rights_confirmed: true,
            guardian_consent: true,
            consent_reference: 'Documented permission reference',
          },
          'Review',
        ])
      ).rows[0];
      await as('publisher');
      photo = (
        await db.query('select * from review_website_media($1,$2,$3,$4)', [
          photo.id,
          photo.version,
          {},
          'Approved',
        ])
      ).rows[0];
      await as('anon');
      assert.equal(
        (await db.query('select * from website_public_media($1)', [photo.id])).rows.length,
        1,
      );
      assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
      await as('publisher');
      await db.query('select * from review_website_media($1,$2,$3,$4)', [
        photo.id,
        photo.version,
        {},
        'Withdrawn',
      ]);
      await as('anon');
      assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
    },
  );
  await t.test(
    'a programme retains its cover through review, approval and publication',
    async () => {
      await as('editor');
      const path = ids.editor + '/programme-review-cover.jpg';
      await db.query(
        "insert into storage.objects(bucket_id,name,owner_id) values('website-media',$1,auth.uid()::text)",
        [path],
      );
      let media = (
        await db.query('select * from register_website_media($1,$2,$3)', [
          path,
          'Programme cover.jpg',
          'image/jpeg',
        ])
      ).rows[0];
      let programme = await save({
        ...payload,
        kind: 'programme',
        slug: 'programme-review-cover',
        cover_id: media.id,
      });
      assert.equal(programme.cover_id, media.id);
      await assert.rejects(() => move(programme, 'Review'), /approved media/);
      media = (
        await db.query('select * from review_website_media($1,$2,$3,$4)', [
          media.id,
          media.version,
          {
            alt_text: 'Programme cover',
            caption: 'Reviewed programme photograph',
            rights_confirmed: true,
            shows_children: false,
            guardian_consent: false,
            consent_reference: '',
          },
          'Review',
        ])
      ).rows[0];
      await as('publisher');
      media = (
        await db.query('select * from review_website_media($1,$2,$3,$4)', [
          media.id,
          media.version,
          {},
          'Approved',
        ])
      ).rows[0];
      await as('editor');
      programme = await move(programme, 'Review');
      assert.equal(programme.status, 'Review');
      assert.equal(programme.cover_id, media.id);
      await as('anon');
      assert.equal(
        (await db.query('select * from published_content where id=$1', [programme.id])).rows.length,
        0,
      );
      await as('publisher');
      programme = await move(programme, 'Approved');
      assert.equal(programme.cover_id, media.id);
      programme = await move(programme, 'Published');
      assert.equal(programme.cover_id, media.id);
      await as('anon');
      assert.equal(
        (await db.query('select * from published_content where id=$1', [programme.id])).rows[0]
          .cover_id,
        media.id,
      );
      await as('editor');
      programme = await move(programme, 'Draft');
      programme = await move(programme, 'Review');
      assert.equal(programme.cover_id, media.id);
      await as('anon');
      assert.equal(
        (await db.query('select * from published_content where id=$1', [programme.id])).rows[0]
          .cover_id,
        media.id,
        'Submitting a later draft must not erase the existing public cover.',
      );
    },
  );
  await t.test(
    'enquiries require the service ingress, stay private, and enforce rate limits',
    async () => {
      const p = {
        kind: 'volunteer',
        name: 'Test adult',
        email: 'test@example.org',
        phone: '',
        message: 'A staged enquiry only',
        consent: true,
      };
      await as('anon');
      await assert.rejects(
        () => db.query('select receive_website_enquiry($1,$2)', [p, 'test-ip']),
        /permission denied/,
      );
      await as('service');
      let id;
      for (let i = 0; i < 5; i++)
        id = (await db.query('select receive_website_enquiry($1,$2) id', [p, 'test-ip'])).rows[0]
          .id;
      await assert.rejects(
        () => db.query('select receive_website_enquiry($1,$2)', [p, 'test-ip']),
        /Too many requests/,
      );
      await as('editor');
      assert.equal((await db.query('select * from website_enquiries')).rows.length, 0);
      await as('coordinator');
      assert.equal((await db.query('select * from website_enquiries')).rows.length, 5);
      await db.query(
        "select * from update_website_enquiry($1,'In review','Follow up separately',1)",
        [id],
      );
      assert.equal((await db.query('select * from enquiry_audit')).rows.length, 1);
      await as('anon');
      await assert.rejects(() => db.query('select * from website_enquiries'), /permission denied/);
    },
  );

  await t.test(
    'external videos stay private until independently consent-reviewed; withdrawal hides embeds',
    async () => {
      await as('editor');
      let video = (
        await db.query('select * from register_website_video($1,$2)', [
          'https://youtu.be/abcdefghijk',
          'Creative activity video',
        ])
      ).rows[0];
      await assert.rejects(
        () =>
          db.query('select * from register_website_video($1,$2)', [
            'https://attacker.test/video',
            'Unsafe video',
          ]),
        /Invalid content/,
      );
      await as('anon');
      assert.equal(
        (await db.query('select * from website_public_video($1)', [video.id])).rows.length,
        0,
      );
      await as('editor');
      video = (
        await db.query('select * from review_website_media($1,$2,$3,$4)', [
          video.id,
          video.version,
          {
            alt_text: 'Group creative activity',
            caption: 'Reviewed group performance',
            shows_children: true,
            rights_confirmed: true,
            guardian_consent: true,
            consent_reference: 'Guardian permissions on file',
          },
          'Review',
        ])
      ).rows[0];
      await as('publisher');
      video = (
        await db.query('select * from review_website_media($1,$2,$3,$4)', [
          video.id,
          video.version,
          {},
          'Approved',
        ])
      ).rows[0];
      await as('editor');
      let album = await save({
        ...payload,
        kind: 'album',
        slug: 'kids-collection',
        details: { scope: 'aminia-kids', video_id: video.id },
      });
      const privateDraft = await save({
        ...payload,
        slug: 'unapproved-photo',
        details: { gallery: JSON.stringify([photo.id]) },
      });
      await assert.rejects(() => move(privateDraft, 'Review'), /approved media/);
      album = await move(album, 'Review');
      await as('publisher');
      album = await move(album, 'Approved');
      album = await move(album, 'Published');
      assert.equal(album.status, 'Published');
      await as('anon');
      assert.equal(
        (await db.query('select * from website_public_video($1)', [video.id])).rows.length,
        1,
      );
      await as('publisher');
      await db.query('select * from review_website_media($1,$2,$3,$4)', [
        video.id,
        video.version,
        {},
        'Withdrawn',
      ]);
      await as('anon');
      assert.equal(
        (await db.query('select * from website_public_video($1)', [video.id])).rows.length,
        0,
      );
    },
  );
  await t.test(
    'email jobs are private, leased once, retryable and stop after acceptance',
    async () => {
      await as('coordinator');
      const enquiry = (await db.query('select * from website_enquiries limit 1')).rows[0];
      assert.equal((await db.query('select * from website_email_outbox')).rows.length, 10);
      await assert.rejects(
        () => db.query('select * from claim_website_email($1)', [enquiry.id]),
        /permission denied/,
      );
      await as('editor');
      assert.equal((await db.query('select * from website_email_outbox')).rows.length, 0);
      await as('service');
      const jobs = (await db.query('select * from claim_website_email($1)', [enquiry.id])).rows;
      assert.equal(jobs.length, 2);
      assert.equal(
        (await db.query('select * from claim_website_email($1)', [enquiry.id])).rows.length,
        0,
      );
      await db.query('select finish_website_email($1,$2,$3)', [jobs[0].id, 'provider-id', '']);
      await db.query('select finish_website_email($1,$2,$3)', [
        jobs[1].id,
        null,
        'Provider unavailable',
      ]);
      const retry = (await db.query('select * from claim_website_email($1)', [enquiry.id])).rows;
      assert.equal(retry.length, 1);
      assert.equal(retry[0].attempts, 2);
      assert.equal(retry[0].id, jobs[1].id);
      await db.query('select finish_website_email($1,$2,$3)', [
        jobs[1].id,
        null,
        'Still unavailable',
      ]);
      await db.exec('reset role');
      await db.query(
        "update website_email_outbox set first_attempt_at=now()-interval '24 hours' where id=$1",
        [jobs[1].id],
      );
      await as('service');
      assert.equal(
        (await db.query('select * from claim_website_email($1)', [enquiry.id])).rows.length,
        0,
      );
      await as('coordinator');
      assert.equal(
        (await db.query('select status from website_email_outbox where id=$1', [jobs[1].id]))
          .rows[0].status,
        'Needs review',
      );
    },
  );
  await t.test('enquiry assignment enforces role, active assignee and version checks', async () => {
    await as('coordinator');
    let e = (await db.query('select * from website_enquiries limit 1')).rows[0];
    await assert.rejects(
      () =>
        db.query('select * from assign_website_enquiry($1,$2,$3,$4)', [
          e.id,
          e.version,
          ids.editor,
          null,
        ]),
      /Access denied/,
    );
    e = (
      await db.query('select * from assign_website_enquiry($1,$2,$3,$4)', [
        e.id,
        e.version,
        ids.coordinator,
        '2026-12-01T15:00:00+03:00',
      ])
    ).rows[0];
    assert.equal(e.assigned_to, ids.coordinator);
    await assert.rejects(
      () =>
        db.query('select * from assign_website_enquiry($1,$2,$3,$4)', [
          e.id,
          e.version - 1,
          null,
          null,
        ]),
      /Record changed/,
    );
    await as('editor');
    await assert.rejects(
      () =>
        db.query('select * from assign_website_enquiry($1,$2,$3,$4)', [
          e.id,
          e.version,
          null,
          null,
        ]),
      /Access denied/,
    );
  });
  await t.test('aggregate engagement accepts service ingress only and caps abuse', async () => {
    await as('anon');
    await assert.rejects(
      () => db.query('select record_website_engagement($1,$2)', ['giving', 'a'.repeat(64)]),
      /permission denied/,
    );
    await as('service');
    for (let i = 0; i < 105; i++)
      await db.query('select record_website_engagement($1,$2)', ['giving', 'a'.repeat(64)]);
    await as('editor');
    assert.equal(
      Number(
        (await db.query("select count from website_engagement where action='giving'")).rows[0]
          .count,
      ),
      100,
    );
    await assert.rejects(
      () => db.query('select * from website_engagement_limits'),
      /permission denied/,
    );
  });
  await t.test(
    'MP4 uploads and WebP draft selection keep publication consent enforced',
    async () => {
      await as('editor');
      const path = ids.editor + '/clip.mp4';
      await db.query(
        "insert into storage.objects(bucket_id,name,owner_id) values('website-media',$1,auth.uid()::text)",
        [path],
      );
      let m = (
        await db.query('select * from register_website_media($1,$2,$3)', [
          path,
          'Clip.mp4',
          'video/mp4',
        ])
      ).rows[0];
      const draft = await save({ ...payload, slug: 'draft-clip', details: { video_id: m.id } });
      await assert.rejects(() => move(draft, 'Review'), /approved media/);
      await as('anon');
      assert.equal(
        (await db.query('select * from website_playable_video($1)', [m.id])).rows.length,
        0,
      );
      await as('editor');
      m = (
        await db.query('select * from review_website_media($1,$2,$3,$4)', [
          m.id,
          m.version,
          {
            alt_text: 'Adult volunteer activity video',
            caption: 'Reviewed clip',
            shows_children: false,
            rights_confirmed: true,
            guardian_consent: false,
            consent_reference: '',
          },
          'Review',
        ])
      ).rows[0];
      await as('publisher');
      m = (
        await db.query('select * from review_website_media($1,$2,$3,$4)', [
          m.id,
          m.version,
          {},
          'Approved',
        ])
      ).rows[0];
      await as('editor');
      await move(draft, 'Review');
      await as('anon');
      assert.equal(
        (await db.query('select * from website_playable_video($1)', [m.id])).rows[0].mime,
        'video/mp4',
      );
    },
  );
  await t.test(
    'push subscriptions are private, leases prevent duplicates and role revocation cancels queued push',
    async () => {
      const sub = {
        endpoint: 'https://fcm.googleapis.com/send/test-device',
        keys: { p256dh: 'a'.repeat(87), auth: 'b'.repeat(22) },
      };
      await as('coordinator');
      await db.query('select save_website_push($1,false)', [sub]);
      await db.query('select test_website_notice()');
      const own = (await db.query('select * from website_notifications')).rows;
      assert.ok(own.length > 0);
      assert.ok(own.every((n) => n.user_id === ids.coordinator));
      await assert.rejects(
        () => db.query('select * from website_push_subscriptions'),
        /permission denied/,
      );
      await as('editor');
      await assert.rejects(
        () => db.query('select save_website_push($1,false)', [sub]),
        /Access denied/,
      );
      await as('service');
      const jobs = (await db.query('select * from claim_website_push()')).rows;
      assert.equal(jobs.length, 1);
      assert.equal((await db.query('select * from claim_website_push()')).rows.length, 0);
      await db.query('select finish_website_push($1,$2)', [jobs[0].job_id, 'Gone']);
      await as('coordinator');
      await db.query('select save_website_push($1,false)', [sub]);
      await db.query('select test_website_notice()');
      await db.exec('reset role');
      await db.query(
        "insert into website_notifications(user_id,kind,title,body,source_key,target_roles) values($1,'enquiry','Private update','Generic body','revoked-test',array['enquiry_coordinator'])",
        [ids.coordinator],
      );
      await db.query('update website_profiles set active=false where id=$1', [ids.coordinator]);
      await as('service');
      assert.equal((await db.query('select * from claim_website_push()')).rows.length, 0);
      await db.exec('reset role');
      await db.query('update website_profiles set active=true where id=$1', [ids.coordinator]);
    },
  );
  await t.test(
    'visitor analytics is admin-only, supports history and deletes withdrawn visitor records',
    async () => {
      const p = {
        id: 's'.repeat(64),
        visitor: 'v'.repeat(64),
        path: '/stories/help',
        action: 'view',
        country: 'UG',
        region: 'Central',
        city: 'Entebbe',
        device: 'Phone',
        browser: 'Safari',
        referrer: 'example.org',
      };
      await as('anon');
      await assert.rejects(
        () => db.query('select record_website_visit($1,$2)', [p, 'r'.repeat(64)]),
        /permission denied/,
      );
      await as('service');
      await db.query('select record_website_visit($1,$2)', [p, 'r'.repeat(64)]);
      await db.query('select record_website_visit($1,$2)', [
        { ...p, action: 'heartbeat' },
        'r'.repeat(64),
      ]);
      await as('editor');
      await assert.rejects(
        () => db.query("select website_analytics(now()-interval '1 day',now()+interval '1 day')"),
        /Access denied/,
      );
      await as('administrator');
      const stats = (
        await db.query(
          "select website_analytics(now()-interval '1 day',now()+interval '1 day') value",
        )
      ).rows[0].value;
      assert.equal(stats.sessions, 1);
      assert.equal(stats.live, 1);
      assert.equal(stats.pageviews, 1);
      assert.equal(stats.history[0].country, 'UG');
      assert.equal(
        (await db.query('select website_visit_history($1) value', [p.id])).rows[0].value.length,
        1,
      );
      await as('service');
      await db.query('select forget_website_visits($1)', [p.visitor]);
      await as('administrator');
      assert.equal(
        (await db.query('select website_visit_history($1) value', [p.id])).rows[0].value.length,
        0,
      );
    },
  );
  await t.test(
    'migration 011 closes hostname lookalikes and moves cleanup out of ingestion',
    async () => {
      await as('coordinator');
      for (const endpoint of [
        'https://fcmXgoogleapisXcom/send/test',
        'https://updatesXpushXservicesXmozillaXcom/test',
        'https://web.pushXappleXcom/test',
        'https://web.notifyXwindowsXcom/test',
      ])
        await assert.rejects(
          () =>
            db.query('select save_website_push($1,false)', [
              { endpoint, keys: { p256dh: 'a'.repeat(87), auth: 'b'.repeat(22) } },
            ]),
          /Invalid content/,
        );
      await db.exec('reset role');
      const source = (
        await db.query(
          "select pg_get_functiondef('public.record_website_visit(jsonb,text)'::regprocedure) value",
        )
      ).rows[0].value;
      assert.ok(!/delete from/i.test(source));
      await db.query(
        "insert into website_engagement_limits(day,tag,count) values(current_date-5,'expired-test',1)",
      );
      await as('service');
      await db.query('select prune_website_visits()');
      await db.exec('reset role');
      assert.equal(
        (await db.query("select * from website_engagement_limits where tag='expired-test'")).rows
          .length,
        0,
      );
      assert.ok(
        (
          await db.query(
            "select indexname from pg_indexes where indexname='website_visits_first_seen_idx'",
          )
        ).rows.length,
      );
    },
  );
  await t.test('privacy deletion prevents queued visits recreating withdrawn history', async () => {
    const p = {
      id: 'd'.repeat(64),
      visitor: 'e'.repeat(64),
      action: 'view',
      path: '/about',
      country: 'UG',
      region: '',
      city: '',
      device: 'Phone',
      browser: 'Safari',
      referrer: '',
    };
    await as('service');
    await db.query('select record_website_visit($1,$2)', [p, 'f'.repeat(64)]);
    await db.query('select forget_website_visits($1)', [p.visitor]);
    await db.query('select record_website_visit($1,$2)', [p, 'f'.repeat(64)]);
    await db.exec('reset role');
    assert.equal(
      (await db.query('select * from website_visits where id=$1', [p.id])).rows.length,
      0,
    );
    assert.equal(
      (await db.query('select * from website_visit_revocations where visitor=$1', [p.visitor])).rows
        .length,
      1,
    );
    await as('anon');
    await assert.rejects(
      () => db.query('select * from website_visit_revocations'),
      /permission denied/,
    );
  });
  await t.test(
    'submission keys deduplicate receipt and reject changed payloads without repeating rate counts',
    async () => {
      const input = {
        kind: 'contact',
        name: 'Test adult',
        email: 'adult@example.org',
        phone: '',
        message: 'Please contact me.',
        consent: true,
        submission_key: '00000000-0000-4000-8000-000000000777',
      };
      await as('service');
      const first = (
        await db.query('select receive_website_enquiry($1,$2) id', [input, 'dedup-tag'])
      ).rows[0].id;
      const second = (
        await db.query('select receive_website_enquiry($1,$2) id', [input, 'dedup-tag'])
      ).rows[0].id;
      assert.equal(first, second);
      await assert.rejects(
        () =>
          db.query('select receive_website_enquiry($1,$2)', [
            { ...input, message: 'Changed message.' },
            'dedup-tag',
          ]),
        /Invalid content/,
      );
      await db.exec('reset role');
      assert.equal(
        Number(
          (await db.query("select count(*) n from website_enquiries where ip_tag='dedup-tag'"))
            .rows[0].n,
        ),
        1,
      );
      await as('anon');
      await assert.rejects(
        () => db.query('select * from website_submission_keys'),
        /permission denied/,
      );
    },
  );
  await t.test(
    'email retry backoff and lease tokens prevent late or duplicate completion',
    async () => {
      await as('service');
      const id = (
        await db.query('select receive_website_enquiry($1,$2) id', [
          {
            kind: 'contact',
            name: 'Test adult',
            email: 'lease@example.org',
            message: 'Please contact me.',
            consent: true,
          },
          'lease-tag',
        ])
      ).rows[0].id;
      const jobs = (await db.query('select * from claim_website_email_v2($1)', [id])).rows;
      assert.equal(jobs.length, 2);
      const job = jobs[0];
      await db.query('select finish_website_email_v2($1,$2,$3,$4)', [
        job.id,
        '00000000-0000-4000-8000-000000000999',
        'wrong',
        '',
      ]);
      await db.exec('reset role');
      assert.equal(
        (await db.query('select status from website_email_outbox where id=$1', [job.id])).rows[0]
          .status,
        'Sending',
      );
      await as('service');
      await db.query('select finish_website_email($1,$2,$3)', [job.id, 'legacy-provider', '']);
      await db.query('select finish_website_email_v2($1,$2,$3,$4)', [
        job.id,
        job.lease_token,
        null,
        'temporary failure',
      ]);
      assert.equal(
        (await db.query('select * from claim_website_email_v2($1)', [id])).rows.length,
        0,
      );
      await db.exec('reset role');
      await db.query(
        "update website_email_outbox set next_attempt=now()-interval '1 second' where id=$1",
        [job.id],
      );
      await as('service');
      const retry = (await db.query('select * from claim_website_email_v2($1)', [id])).rows[0];
      assert.notEqual(retry.lease_token, job.lease_token);
      await db.query('select finish_website_email_v2($1,$2,$3,$4)', [
        job.id,
        retry.lease_token,
        'provider-id',
        '',
      ]);
      assert.equal(
        (await db.query('select * from claim_website_email_v2($1)', [id])).rows.length,
        0,
      );
    },
  );
  await t.test(
    'push dispatcher finalizes exhausted leases and health stays administrator-only',
    async () => {
      await db.exec('reset role');
      await db.exec(
        "update website_push_jobs set status='Sent';update website_profiles set active=true,roles=array['enquiry_coordinator'] where name='coordinator'",
      );
      await as('coordinator');
      await db.query('select save_website_push($1,false)', [
        {
          endpoint: 'https://fcm.googleapis.com/send/lease-audit',
          keys: { p256dh: 'a'.repeat(87), auth: 'b'.repeat(22) },
        },
      ]);
      const notice = (await db.query('select queue_website_test() id')).rows[0].id;
      await db.exec('reset role');
      await db.query(
        "update website_push_jobs set status='Sending',attempts=5,lease_until=now()-interval '3 minutes' where notification_id=$1",
        [notice],
      );
      await as('service');
      await db.query('select * from claim_website_push_v2($1,$2)', [notice, null]);
      await db.exec('reset role');
      const states = (
        await db.query('select status from website_push_jobs where notification_id=$1', [notice])
      ).rows;
      assert.ok(states.length);
      assert.ok(states.every((r) => r.status === 'Failed'));
      await as('editor');
      await assert.rejects(() => db.query('select website_delivery_health()'), /Access denied/);
      await as('administrator');
      assert.ok(
        (await db.query('select website_delivery_health() data')).rows[0].data.push_failed > 0,
      );
    },
  );
  await t.test(
    'analytics includes in-range events from sessions started before midnight and overview shares the same events',
    async () => {
      await db.exec('reset role');
      await db.query(
        "insert into website_visits(id,visitor,country,region,city,device,browser,referrer,last_path,first_seen,last_seen) values($1,$2,'ZZ','','','','','','/about',date_trunc('day',now())-interval '5 minutes',date_trunc('day',now())+interval '5 minutes')",
        ['a'.repeat(64), 'b'.repeat(64)],
      );
      await db.query(
        "insert into website_visit_events(visit,path,action,created_at) values($1,'/about','view',date_trunc('day',now())+interval '5 minutes'),($1,'/about','giving',date_trunc('day',now())+interval '5 minutes')",
        ['a'.repeat(64)],
      );
      await as('administrator');
      const stats = (
        await db.query(
          "select website_analytics(date_trunc('day',now()),date_trunc('day',now())+interval '1 day','ZZ') data",
        )
      ).rows[0].data;
      assert.equal(stats.pageviews, 1);
      assert.equal(stats.sessions, 0);
      assert.equal(stats.actions, 1);
      await as('editor');
      assert.ok(
        (await db.query("select * from website_engagement_summary() where action='giving'")).rows
          .length,
      );
      await as('coordinator');
      await assert.rejects(
        () => db.query('select * from website_engagement_summary()'),
        /Access denied/,
      );
    },
  );
  await t.test('analytics ingestion health is service-only', async () => {
    await as('administrator');
    await assert.rejects(
      () => db.query('select website_analytics_ingest_health()'),
      /permission denied/,
    );
    await as('service');
    assert.equal((await db.query('select website_analytics_ingest_health() ok')).rows[0].ok, true);
  });
  await t.test(
    'a last heartbeat inside the range appears in history without inventing a page view',
    async () => {
      await db.exec('reset role');
      await db.exec(
        "insert into website_visits(id,visitor,country,region,city,device,browser,referrer,first_seen,last_seen,last_path) values('heartbeat-test','heartbeat-visitor','QZ','','','Computer','Other','',now()-interval '5 days',now()-interval '1 hour','/about')",
      );
      await as('administrator');
      const result = (
        await db.query("select website_analytics(now()-interval '2 hours',now(),'QZ') data")
      ).rows[0].data;
      assert.equal(result.visitors, 1);
      assert.equal(result.pageviews, 0);
      assert.equal(result.history[0].id, 'heartbeat-test');
    },
  );
  await t.test('historical visitors require actual events inside the chosen period', async () => {
    await db.exec('reset role');
    await db.exec(
      "insert into website_visits(id,visitor,country,region,city,device,browser,referrer,first_seen,last_seen,last_path) values('gap-test','gap-visitor','QP','','','Computer','Other','',now()-interval '4 days',now()-interval '1 day','/about')",
    );
    await db.exec(
      "insert into website_visit_events(visit,path,action,created_at) values('gap-test','/','view',now()-interval '4 days'),('gap-test','/about','view',now()-interval '1 day')",
    );
    await as('administrator');
    const result = (
      await db.query(
        "select website_analytics(now()-interval '3 days',now()-interval '2 days','QP') data",
      )
    ).rows[0].data;
    assert.equal(result.visitors, 0);
    assert.equal(result.history.length, 0);
  });
  await t.test(
    'editor choices are bounded, searchable, retain selected records and enforce roles',
    async () => {
      await db.exec('reset role');
      await db.query(
        "insert into content_items(kind,slug,title,summary,body,details,created_by) select 'programme','choice-'||n,'Choice programme '||n,'','','{}',$1 from generate_series(1,70) n",
        [ids.editor],
      );
      await as('editor');
      const first = (
        await db.query("select website_editor_choices(null,'Choice programme',0) data")
      ).rows[0].data;
      assert.equal(first.items.length, 50);
      assert.equal(first.has_more, true);
      const second = (
        await db.query("select website_editor_choices(null,'Choice programme',1) data")
      ).rows[0].data;
      assert.equal(second.items.length, 20);
      const selected = first.items[0].id;
      const retained = (
        await db.query("select website_editor_choices(null,'Choice programme',1,$1::uuid[]) data", [
          [selected],
        ])
      ).rows[0].data;
      assert.ok(retained.items.some((v) => v.id === selected));
      await as('coordinator');
      await assert.rejects(() => db.query('select website_editor_choices()'), /Access denied/);
    },
  );
  await t.test(
    'published slug aliases resolve only to a current publication and reserve old URLs',
    async () => {
      await as('editor');
      let record = await save({ ...payload, slug: 'alias-source' });
      record = await move(record, 'Review');
      await as('publisher');
      record = await move(record, 'Approved');
      record = await move(record, 'Published');
      await as('editor');
      record = await move(record, 'Draft');
      record = await save({ ...payload, slug: 'alias-target' }, record.id, record.version);
      assert.equal(
        (await db.query("select resolve_website_redirect('story','alias-source') target")).rows[0]
          .target,
        null,
      );
      record = await move(record, 'Review');
      await as('publisher');
      record = await move(record, 'Approved');
      await move(record, 'Published');
      await as('anon');
      assert.equal(
        (await db.query("select resolve_website_redirect('story','alias-source') target")).rows[0]
          .target,
        '/stories/alias-target',
      );
      await as('editor');
      await assert.rejects(() => save({ ...payload, slug: 'alias-source' }), /URL belongs/);
    },
  );
  await t.test(
    'a related giving campaign must be published independently before story review',
    async () => {
      await as('editor');
      let campaign = await save({ ...payload, kind: 'campaign', slug: 'dependency-campaign' });
      let record = await save({
        ...payload,
        slug: 'dependency-story',
        details: { campaign_id: campaign.id },
      });
      await assert.rejects(() => move(record, 'Review'), /giving campaign first/);
      campaign = await move(campaign, 'Review');
      await as('publisher');
      campaign = await move(campaign, 'Approved');
      await move(campaign, 'Published');
      await as('editor');
      record = await move(record, 'Review');
      assert.equal(record.status, 'Review');
    },
  );
  await t.test(
    'retention requires administration, confirmation, closed records and no holds',
    async () => {
      await as('service');
      const id = (
        await db.query('select receive_website_enquiry($1,$2) id', [
          {
            kind: 'contact',
            name: 'Retention Test',
            email: 'retention@example.org',
            phone: 'private',
            message: 'Private test message',
            consent: true,
          },
          'retention-test',
        ])
      ).rows[0].id;
      await db.exec('reset role');
      await db.query(
        "update website_enquiries set created_at=now()-interval '90 days',status='Closed' where id=$1",
        [id],
      );
      await as('administrator');
      await db.query('select website_retention_hold($1,true)', [id]);
      const before = new Date(Date.now() - 30 * 86400000).toISOString();
      assert.equal(
        (await db.query('select website_retention($1) data', [before])).rows[0].data.eligible,
        0,
      );
      await db.query('select website_retention_hold($1,false)', [id]);
      await assert.rejects(
        () => db.query('select website_retention($1,true,$2)', [before, 'incorrect']),
        /Confirm/,
      );
      await as('coordinator');
      await assert.rejects(
        () => db.query('select website_retention($1)', [before]),
        /Access denied/,
      );
      await as('administrator');
      await db.query('select website_retention($1,true,$2)', [
        before,
        'ANONYMIZE CLOSED ENQUIRIES',
      ]);
      const row = (await db.query('select * from website_enquiries where id=$1', [id])).rows[0];
      assert.equal(row.name, '[Anonymized]');
      assert.equal(row.phone, '');
      assert.ok(row.anonymized_at);
      assert.equal(
        (await db.query('select website_retention($1) data', [before])).rows[0].data.eligible,
        0,
      );
    },
  );
  await t.test(
    'operational diagnostics are aggregate, service-only and administrator-readable',
    async () => {
      await as('service');
      await db.query('select record_website_csp($1,$2)', ['script-src', 'a'.repeat(64)]);
      await db.query('select prune_website_visits()');
      await as('administrator');
      const health = (await db.query('select website_delivery_health() data')).rows[0].data;
      assert.equal(health.quality['csp/script-src'], 1);
      assert.ok(health.maintenance.finished_at);
      await as('editor');
      await assert.rejects(
        () => db.query('select record_website_csp($1,$2)', ['script-src', 'b'.repeat(64)]),
        /permission denied/,
      );
      await assert.rejects(() => db.query('select website_delivery_health()'), /Access denied/);
      await assert.rejects(() => db.query('select website_orphan_media()'), /Access denied/);
    },
  );
  await t.test(
    'provider delays survive completion and cannot be changed by stale leases',
    async () => {
      await as('service');
      const id = (
        await db.query('select receive_website_enquiry($1,$2) id', [
          {
            kind: 'contact',
            name: 'Backoff Test',
            email: 'backoff@example.org',
            message: 'Retry only in local database tests',
            consent: true,
          },
          'provider-delay-test',
        ])
      ).rows[0].id;
      const jobs = (await db.query('select * from claim_website_email_v2($1)', [id])).rows;
      for (const [index, job] of jobs.entries()) {
        if (index === 0) {
          await db.query('select defer_website_job($1,$2,$3,$4)', [
            'email',
            job.id,
            job.lease_token,
            3600,
          ]);
          await db.query('select finish_website_email_v2($1,$2,$3,$4)', [
            job.id,
            job.lease_token,
            null,
            'Provider retry delay',
          ]);
        } else
          await db.query('select finish_website_email_v2($1,$2,$3,$4)', [
            job.id,
            job.lease_token,
            'test-provider',
            null,
          ]);
      }
      const due = (await db.query('select * from website_due_email()')).rows;
      assert.ok(!due.some((v) => v.enquiry_id === id));
      await db.exec('reset role');
      const row = (
        await db.query('select next_attempt from website_email_outbox where id=$1', [jobs[0].id])
      ).rows[0];
      assert.ok(Date.parse(row.next_attempt) > Date.now() + 3500000);
      await as('editor');
      await assert.rejects(
        () =>
          db.query('select defer_website_job($1,$2,$3,$4)', [
            'email',
            jobs[0].id,
            jobs[0].lease_token,
            1,
          ]),
        /permission denied/,
      );
    },
  );
  await t.test(
    'publication state is bounded and distinguishes a scheduled revision from its older live version',
    async () => {
      await as('editor');
      let record = await save({
        ...payload,
        slug: 'effective-state-test',
        title: 'Effective state test',
      });
      record = await move(record, 'Review');
      await as('publisher');
      record = await move(record, 'Approved');
      record = await move(record, 'Published');
      const liveVersion = record.version;
      await as('editor');
      record = await move(record, 'Draft');
      record = await move(record, 'Review');
      await as('publisher');
      record = await move(record, 'Approved');
      record = await move(record, 'Scheduled', '', new Date(Date.now() + 3600000).toISOString());
      let rows = (await db.query('select * from website_publication_state($1)', [[record.id]]))
        .rows;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].version, liveVersion);
      let result = (
        await db.query(
          "select website_workspace('content',0,'Effective state test','Scheduled','story') data",
        )
      ).rows[0].data;
      assert.equal(result.total, 1);
      await db.exec('reset role');
      await db.query(
        'update publications set publish_at=now() where content_id=$1 and version=$2',
        [record.id, record.version],
      );
      await as('publisher');
      rows = (await db.query('select * from website_publication_state($1)', [[record.id]])).rows;
      assert.equal(rows[0].version, record.version);
      result = (
        await db.query(
          "select website_workspace('content',0,'Effective state test','Published','story') data",
        )
      ).rows[0].data;
      assert.equal(result.total, 1);
      await as('coordinator');
      await assert.rejects(
        () => db.query('select * from website_publication_state($1)', [[record.id]]),
        /Access denied/,
      );
    },
  );
  await t.test(
    'only an independent publisher can withdraw a live snapshot while a newer draft exists',
    async () => {
      await as('editor');
      let record = await save({ ...payload, slug: 'withdrawal-test' });
      record = await move(record, 'Review');
      await as('publisher');
      record = await move(record, 'Approved');
      record = await move(record, 'Published');
      await as('editor');
      record = await move(record, 'Draft');
      await assert.rejects(
        () =>
          db.query('select * from withdraw_website_publication($1,$2)', [
            record.id,
            record.version,
          ]),
        /Access denied/,
      );
      await as('publisher');
      record = (
        await db.query('select * from withdraw_website_publication($1,$2)', [
          record.id,
          record.version,
        ])
      ).rows[0];
      assert.equal(record.status, 'Archived');
      assert.equal(record.body, payload.body);
      await as('anon');
      assert.equal(
        (await db.query('select * from published_content where id=$1', [record.id])).rows.length,
        0,
      );
    },
  );
  await t.test(
    'workspace search and paging include records beyond 1000 while preserving roles and MFA',
    async () => {
      await db.exec('reset role');
      await db.query(
        "insert into content_items(kind,slug,title,summary,body,details,created_by) select 'story','paging-'||n,'Paging item '||n,'Searchable summary','', '{}'::jsonb,$1 from generate_series(0,1050) n",
        [ids.editor],
      );
      await as('editor');
      const page = (
        await db.query("select website_workspace('content',21,'Paging item','All','story') data")
      ).rows[0].data;
      assert.equal(page.total, 1051);
      assert.equal(page.rows.length, 1);
      const found = (
        await db.query(
          "select website_workspace('content',0,'Paging item 1050','All','story') data",
        )
      ).rows[0].data;
      assert.equal(found.total, 1);
      assert.equal(found.rows[0].title, 'Paging item 1050');
      await as('coordinator');
      await assert.rejects(() => db.query("select website_workspace('content')"), /Access denied/);
      await as('editor', 'aal1');
      await assert.rejects(() => db.query("select website_workspace('content')"), /Access denied/);
      await as('anon');
      await assert.rejects(
        () => db.query("select website_workspace('content')"),
        /permission denied/,
      );
    },
  );
  await t.test(
    'media impact is editorial-only and legacy completion cannot overwrite a v2 lease',
    async () => {
      await as('editor');
      const draft = await save({ ...payload, slug: 'media-impact-probe', cover_id: photo.id });
      await as('publisher');
      const refs = (await db.query('select website_media_references($1) data', [photo.id])).rows[0]
        .data;
      assert.ok(refs.some((r) => r.id === draft.id));
      assert.ok(!JSON.stringify(refs).includes('object_path'));
      await as('coordinator');
      await assert.rejects(
        () => db.query('select website_media_references($1)', [photo.id]),
        /Access denied/,
      );
      await db.exec('reset role');
      await db.query(
        "select website_notice(array['enquiry_coordinator'],'legacy-probe','test','Lease test',$1)",
        [ids.coordinator],
      );
      const notice = (
        await db.query("select id from website_notifications where source_key='legacy-probe'")
      ).rows[0].id;
      await as('service');
      const jobs = (await db.query('select * from claim_website_push_v2($1,$2)', [notice, null]))
        .rows;
      assert.ok(jobs.length);
      const job = jobs[0];
      await db.query('select finish_website_push($1,$2)', [job.job_id, 'Gone']);
      await db.exec('reset role');
      assert.equal(
        (await db.query('select status from website_push_jobs where id=$1', [job.job_id])).rows[0]
          .status,
        'Sending',
      );
      await as('service');
      await db.query('select finish_website_push_v2($1,$2,$3)', [
        job.job_id,
        job.lease_token,
        'Sent',
      ]);
      await db.exec('reset role');
      assert.equal(
        (await db.query('select status from website_push_jobs where id=$1', [job.job_id])).rows[0]
          .status,
        'Sent',
      );
    },
  );
  await t.test(
    'new push batches exceed four devices while claims remain service-only',
    async () => {
      await as('coordinator');
      for (let n = 0; n < 6; n++)
        await db.query('select save_website_push($1,false)', [
          {
            endpoint: 'https://fcm.googleapis.com/send/batch-' + n,
            keys: { p256dh: 'a'.repeat(87), auth: 'b'.repeat(22) },
          },
        ]);
      await assert.rejects(
        () => db.query('select * from claim_website_push_v2()'),
        /permission denied/,
      );
      await db.exec('reset role');
      await db.query(
        "select website_notice(array['enquiry_coordinator'],'batch-probe','test','Batch test',$1)",
        [ids.coordinator],
      );
      const notice = (
        await db.query("select id from website_notifications where source_key='batch-probe'")
      ).rows[0].id;
      await as('service');
      const jobs = (await db.query('select * from claim_website_push_v2($1,$2)', [notice, null]))
        .rows;
      assert.ok(jobs.length >= 6 && jobs.length <= 16);
      assert.equal(
        (await db.query('select * from claim_website_push_v2($1,$2)', [notice, null])).rows.length,
        0,
      );
    },
  );
  await t.test(
    'device enabled state belongs to the authenticated account and requires MFA',
    async () => {
      const endpoint = 'https://fcm.googleapis.com/send/own-device-state';
      await as('coordinator');
      await db.query('select save_website_push($1,false)', [
        { endpoint, keys: { p256dh: 'a'.repeat(87), auth: 'b'.repeat(22) } },
      ]);
      assert.equal(
        (await db.query('select website_device_enabled($1) enabled', [endpoint])).rows[0].enabled,
        true,
      );
      await as('publisher');
      assert.equal(
        (await db.query('select website_device_enabled($1) enabled', [endpoint])).rows[0].enabled,
        false,
      );
      await as('coordinator', 'aal1');
      await assert.rejects(
        () => db.query('select website_device_enabled($1)', [endpoint]),
        /Access denied/,
      );
      await as('anon');
      await assert.rejects(
        () => db.query('select website_device_enabled($1)', [endpoint]),
        /permission denied/,
      );
    },
  );
  await t.test(
    'scheduled delivery records and test delivery state execute with private ownership checks',
    async () => {
      await as('service');
      await db.query('select record_website_dispatch($1,$2,$3)', [6, 2, false]);
      assert.ok(Array.isArray((await db.query('select * from website_due_email()')).rows));
      await as('administrator');
      const health = (await db.query('select website_delivery_health() data')).rows[0].data;
      assert.equal(health.last_dispatch.sent, 6);
      assert.equal(health.last_dispatch.emails, 2);
      assert.equal(health.last_dispatch.failed, false);
      await db.exec('reset role');
      const sent = (
        await db.query(
          "select n.id as notice,s.endpoint from website_push_jobs j join website_notifications n on n.id=j.notification_id join website_push_subscriptions s on s.id=j.subscription_id where n.user_id=$1 and j.status='Sent' limit 1",
          [ids.coordinator],
        )
      ).rows[0];
      assert.ok(sent);
      await as('coordinator');
      assert.equal(
        (await db.query('select website_test_delivery($1,$2) sent', [sent.notice, sent.endpoint]))
          .rows[0].sent,
        true,
      );
      await as('publisher');
      assert.equal(
        (await db.query('select website_test_delivery($1,$2) sent', [sent.notice, sent.endpoint]))
          .rows[0].sent,
        false,
      );
      await assert.rejects(
        () => db.query('select record_website_dispatch(0,0,false)'),
        /permission denied/,
      );
    },
  );
  await t.test(
    'only administrators with MFA can change payment details and independent approval remains required',
    async () => {
      const settings = {
        ...payload,
        kind: 'page',
        slug: 'site-settings',
        title: 'Website settings',
        details: {
          donate_bank_name: 'Example bank',
          donate_bank_account_name: 'Foundation',
          donate_bank_account_number: '123',
        },
      };
      await as('editor');
      await assert.rejects(() => save(settings), /Only an administrator/);
      await as('administrator', 'aal1');
      await assert.rejects(() => save(settings));
      await as('administrator');
      let draft = await save(settings);
      draft = await move(draft, 'Review');
      await assert.rejects(() => move(draft, 'Approved'), /different publisher/);
      await as('publisher');
      draft = await move(draft, 'Approved');
      draft = await move(draft, 'Published');
      await as('anon');
      const visible = await db.query(
        "select details from published_content where kind='page' and slug='site-settings'",
      );
      assert.equal(visible.rows[0].details.donate_bank_name, 'Example bank');
    },
  );
  await t.test(
    'private donation ledger enforces MFA, service-only confirmation and matching amounts',
    async () => {
      const ref = '00000000-0000-4000-8000-000000000090',
        token = '00000000-0000-4000-8000-000000000091';
      await db.exec('reset role');
      await db.query(
        "insert into website_donation_transactions(reference,provider_token,amount_minor,currency,purpose) values($1,$2,2500000,'UGX','Education')",
        [ref, token],
      );
      await as('editor');
      assert.equal((await db.query('select * from website_donation_transactions')).rows.length, 0);
      await assert.rejects(
        () =>
          db.query('select confirm_website_donation($1,$2,$3,$4)', [ref, token, 2500000, 'UGX']),
        /permission denied/,
      );
      await as('administrator', 'aal1');
      assert.equal((await db.query('select * from website_donation_transactions')).rows.length, 0);
      await as('administrator');
      assert.equal((await db.query('select * from website_donation_transactions')).rows.length, 1);
      await as('service');
      assert.equal(
        (await db.query('select confirm_website_donation($1,$2,$3,$4) ok', [ref, token, 1, 'UGX']))
          .rows[0].ok,
        false,
      );
      assert.equal(
        (
          await db.query('select confirm_website_donation($1,$2,$3,$4) ok', [
            ref,
            token,
            2500000,
            'UGX',
          ])
        ).rows[0].ok,
        true,
      );
      assert.equal(
        (
          await db.query('select confirm_website_donation($1,$2,$3,$4) ok', [
            ref,
            token,
            2500000,
            'UGX',
          ])
        ).rows[0].ok,
        true,
      );
    },
  );
  await t.test(
    'donation reservation is service-only, idempotent and binds one immutable provider token',
    async () => {
      const ref = '00000000-0000-4000-8000-000000000092',
        token = '00000000-0000-4000-8000-000000000093',
        other = '00000000-0000-4000-8000-000000000094';
      await as('administrator');
      await assert.rejects(
        () =>
          db.query('select reserve_website_donation($1,$2,$3,$4)', [
            ref,
            10000,
            'UGX',
            'Education',
          ]),
        /permission denied/,
      );
      await as('service');
      const reserve = () =>
        db.query('select reserve_website_donation($1,$2,$3,$4) data', [
          ref,
          10000,
          'UGX',
          'Education',
        ]);
      assert.equal((await reserve()).rows[0].data.created, true);
      assert.equal((await reserve()).rows[0].data.created, false);
      await assert.rejects(
        () =>
          db.query('select reserve_website_donation($1,$2,$3,$4)', [
            ref,
            20000,
            'UGX',
            'Education',
          ]),
        /reference already used/,
      );
      assert.equal(
        (await db.query('select bind_website_donation_token($1,$2) ok', [ref, token])).rows[0].ok,
        true,
      );
      assert.equal(
        (await db.query('select bind_website_donation_token($1,$2) ok', [ref, token])).rows[0].ok,
        true,
      );
      assert.equal(
        (await db.query('select bind_website_donation_token($1,$2) ok', [ref, other])).rows[0].ok,
        false,
      );
    },
  );
});
