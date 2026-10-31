import { errorResponse, RequestError } from '@/lib/http';
import { authorize, db, json } from '@/lib/backend';
export async function GET(r: Request) {
  try {
    const { token } = await authorize(r),
      id = new URL(r.url).searchParams.get('id');
    if (!/^[0-9a-f-]{36}$/i.test(id || '')) throw new RequestError('Invalid record.');
    return json(
      await db(
        '/rest/v1/content_revisions?content_id=eq.' + id + '&select=*&order=version.desc&limit=100',
        token,
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
