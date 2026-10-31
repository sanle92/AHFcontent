import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateContent } from '../lib/content.ts';
import { videoEmbed, fundraisingUrl } from '../lib/editorial.ts';
import { calendarEvent } from '../lib/calendar.ts';
import { confirmationEmail } from '../lib/mail-template.ts';
test('campaign links reject lookalike hosts, credentials and unsafe schemes', () => {
  assert.equal(fundraisingUrl('https://www.gofundme.com/f/community', 'gofundme.com'), true);
  for (const url of [
    'https://gofundme.com.attacker.test/f/x',
    'https://gofundme.com@attacker.test',
    'http://gofundme.com/f/x',
    'https://gofundme.com:444/f/x',
  ])
    assert.equal(fundraisingUrl(url, 'gofundme.com'), false);
  const p = {
    kind: 'campaign',
    title: 'Community campaign',
    slug: 'community',
    summary: '',
    body: '',
    details: {},
  };
  assert.throws(() =>
    validateContent({ ...p, details: { gofundme_url: 'https://attacker.test' } }),
  );
  assert.throws(() => validateContent({ ...p, details: { gallery: '["not-a-media-id"]' } }));
  assert.throws(() =>
    validateContent({ ...p, details: { date: '2026-12-03', end_date: '2026-12-01' } }),
  );
  assert.throws(() => validateContent({ ...p, details: { raised: '-200' } }));
  assert.equal(
    validateContent({ ...p, details: { pillar_url: 'https://pillar.io/aminia', target: '50000' } })
      .details.target,
    '50000',
  );
});
test('video embeds are generated only for supported provider IDs', () => {
  assert.equal(
    videoEmbed('https://youtu.be/abcdefghijk'),
    'https://www.youtube-nocookie.com/embed/abcdefghijk',
  );
  assert.equal(videoEmbed('https://vimeo.com/12345678'), 'https://player.vimeo.com/video/12345678');
  assert.equal(videoEmbed('https://youtube.com.attacker.test/watch?v=abcdefghijk'), null);
  assert.equal(videoEmbed('javascript:alert(1)'), null);
});
test('calendar files convert Kampala time and escape injected calendar lines', () => {
  const text = calendarEvent(
    {
      id: 'event-id',
      slug: 'creative-day',
      title: 'Creative day\nATTENDEE:attacker',
      summary: 'Dance, theatre; singing',
      details: {
        date: '2026-12-01T15:00:00+03:00',
        end_date: '2026-12-01T17:00:00+03:00',
        location: 'Entebbe',
      },
    },
    'https://example.org',
  );
  assert.match(text, /DTSTART:20261201T120000Z/);
  assert.match(text, /DTEND:20261201T140000Z/);
  assert.ok(!text.includes('\r\nATTENDEE:'));
  assert.match(text, /Dance\\, theatre\\; singing/);
  for (const line of text.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
});
test('confirmation emails distinguish enquiries from enrolment and payment', () => {
  assert.match(
    confirmationEmail('aminia-kids', 'reference').text,
    /does not confirm a child’s enrolment/,
  );
  assert.match(
    confirmationEmail('merchandise', 'reference').text,
    /does not confirm stock, an order or payment/,
  );
  assert.match(
    confirmationEmail('volunteer', 'reference', 'We appreciate your time.').text,
    /We appreciate your time/,
  );
});
