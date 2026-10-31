import { waitUntil } from 'cloudflare:workers';
import { BackendError, RequestError, errorResponse, readMultipartLimited } from '@/lib/http';
import type * as Rows from '@/lib/types';
import { parseRequest, mediaBody } from '@/lib/request-schemas';
import { authorize, config, db, json, sameOrigin } from '@/lib/backend';
import { dispatchPush } from '@/lib/push';
import { canonicalVideo, detectMedia } from '@/lib/media-validation';
export async function POST(r: Request) {
  try {
    sameOrigin(r);
    const { token, profile } = await authorize(r),
      c = config();
    if (Number(r.headers.get('Content-Length') || 0) > 22 * 1024 * 1024)
      throw new RequestError('MP4 limit is 20 MB; photos/PDF 10 MB.', 413);
    if (r.headers.get('Content-Type')?.includes('multipart/form-data')) {
      return await uploadMedia(r, token, profile, c);
    }
    const v = await parseRequest(r, mediaBody, 16000);
    if (v.action === 'video')
      return json(
        await db('/rest/v1/rpc/register_website_video', token, {
          method: 'POST',
          body: JSON.stringify({
            video_url: (() => {
              try {
                return canonicalVideo(String(v.url || ''));
              } catch (error) {
                throw new RequestError((error as Error).message);
              }
            })(),
            title: v.title,
          }),
        }),
        201,
      );
    const result = await db('/rest/v1/rpc/review_website_media', token, {
      method: 'POST',
      body: JSON.stringify({
        media_id: v.id,
        expected_version: v.version,
        payload: v.payload || {},
        target: v.target,
      }),
    });
    waitUntil(dispatchPush().catch(() => {}));
    return json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
export async function GET(r: Request) {
  try {
    const { token } = await authorize(r),
      c = config(),
      id = new URL(r.url).searchParams.get('id');
    if (!/^[0-9a-f-]{36}$/i.test(id || '')) throw new RequestError('Invalid media.');
    const rows = await db<Rows.MediaRow[]>(
      '/rest/v1/website_media?id=eq.' + id + '&select=*',
      token,
    );
    if (!rows[0]) throw new RequestError('Access denied.', 403);
    if (rows[0].mime === 'video/external') return json({ url: rows[0].external_url });
    const response = await fetch(
      c.url + '/storage/v1/object/sign/website-media/' + rows[0].object_path,
      {
        signal: AbortSignal.timeout(15000),
        method: 'POST',
        headers: {
          apikey: c.key,
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: 120 }),
      },
    );
    if (!response.ok)
      throw new BackendError('Private preview failed. Check Storage policies and sign-in.');
    const s = await response.json<{ signedURL: string }>();
    return json({ url: c.url + '/storage/v1' + s.signedURL });
  } catch (e) {
    return errorResponse(e);
  }
}

async function uploadMedia(
  r: Request,
  token: string,
  profile: Rows.Profile,
  c: ReturnType<typeof config>,
) {
  if (!profile.roles.some((x) => ['administrator', 'editor'].includes(x)))
    throw new RequestError('Only editors or administrators can upload.', 403);
  const form = await readMultipartLimited(r, 22 * 1024 * 1024),
    file = form.get('file');
  if (
    !file ||
    typeof file === 'string' ||
    !('arrayBuffer' in file) ||
    file.size < 1 ||
    file.size > 20 * 1024 * 1024
  )
    throw new RequestError('Choose a photo/PDF up to 10 MB or MP4 up to 20 MB.');
  const bytes = await file.arrayBuffer(),
    type = (() => {
      try {
        return detectMedia(new Uint8Array(bytes));
      } catch (error) {
        throw new RequestError((error as Error).message);
      }
    })();
  if (file.size > type.limit) throw new RequestError('Photos and PDF files must be at most 10 MB.');
  const path = profile.id + '/' + crypto.randomUUID() + '.' + type.extension;
  const upload = await fetch(c.url + '/storage/v1/object/website-media/' + path, {
    method: 'POST',
    signal: AbortSignal.timeout(45000),
    headers: { apikey: c.key, Authorization: 'Bearer ' + token, 'Content-Type': type.mime },
    body: bytes,
  });
  if (!upload.ok)
    throw new BackendError(
      upload.status === 401
        ? 'Sign-in expired. Sign in and retry.'
        : 'Storage rejected the upload (' +
          upload.status +
          '). Check migration 007, bucket limits and your editor role.',
    );
  try {
    return json(
      await db('/rest/v1/rpc/register_website_media', token, {
        method: 'POST',
        body: JSON.stringify({ path, file_name: file.name, file_mime: type.mime }),
      }),
      201,
    );
  } catch {
    const saved = await db<Rows.MediaRow[]>(
      '/rest/v1/website_media?object_path=eq.' + encodeURIComponent(path) + '&select=*',
      token,
    ).catch(() => []);
    if (saved[0]) return json(saved[0], 201);
    if (c.service)
      await fetch(c.url + '/storage/v1/object/website-media/' + path, {
        method: 'DELETE',
        headers: { apikey: c.service, Authorization: 'Bearer ' + c.service },
      }).catch(() => {});
    throw new BackendError(
      'The file record could not be saved. Confirm website migrations 001–007 and retry.',
    );
  }
}
