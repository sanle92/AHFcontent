import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectMedia, canonicalVideo } from '../lib/media-validation.ts';
import { publicPath, pushEndpoint, privateHash, visitorDevice } from '../lib/visitor.ts';
test('mobile media is detected by bytes, not an unreliable filename or MIME', () => {
  assert.equal(detectMedia(new Uint8Array([255, 216, 255, 0])).mime, 'image/jpeg');
  assert.equal(detectMedia(new TextEncoder().encode('RIFF0000WEBPdata')).mime, 'image/webp');
  assert.equal(detectMedia(new TextEncoder().encode('0000ftypisom0000')).mime, 'video/mp4');
  assert.throws(() => detectMedia(new TextEncoder().encode('<script>attack</script>')));
  assert.throws(() => detectMedia(new TextEncoder().encode('0000ftypheic0000')));
});
test('shared video links are normalised without tracking parameters', () => {
  assert.equal(
    canonicalVideo('https://youtu.be/abcdefghijk?si=tracking'),
    'https://www.youtube.com/watch?v=abcdefghijk',
  );
  assert.equal(
    canonicalVideo('https://m.youtube.com/shorts/abcdefghijk?feature=share'),
    'https://www.youtube.com/watch?v=abcdefghijk',
  );
  assert.equal(
    canonicalVideo('https://vimeo.com/12345678?share=copy'),
    'https://vimeo.com/12345678',
  );
  assert.throws(() => canonicalVideo('https://youtube.com.attacker.test/watch?v=abcdefghijk'));
});
test('analytics discards query strings and private routes; push prevents SSRF', async () => {
  assert.equal(publicPath('/stories/help?email=private#x'), '/stories/help');
  assert.equal(publicPath('/holyghost'), null);
  assert.equal(publicPath('/api/enquiry'), null);
  assert.equal(publicPath('/stories/../../holyghost'), null);
  assert.equal(pushEndpoint('https://fcm.googleapis.com/send/token'), true);
  assert.equal(pushEndpoint('https://web.push.apple.com/token'), true);
  assert.equal(pushEndpoint('https://127.0.0.1/internal'), false);
  assert.equal(pushEndpoint('https://fcm.googleapis.com.attacker.test/send/token'), false);
  assert.equal(pushEndpoint('https://user@fcm.googleapis.com/send/x'), false);
  assert.notEqual(
    await privateHash('visitor/one', 'secret'),
    await privateHash('visitor/one', 'other-secret'),
  );
  assert.equal(visitorDevice('iPhone Mobile Safari').device, 'Phone');
});
