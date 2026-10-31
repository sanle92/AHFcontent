import { errorResponse, RequestError } from '@/lib/http';
import { authorize, db, json } from '@/lib/backend';
import { uuidPattern } from '@/lib/editorial';
export async function GET(r: Request) {
  try {
    const { token, profile } = await authorize(r);
    if (!profile.roles.some((v) => ['administrator', 'enquiry_coordinator'].includes(v)))
      throw new RequestError('Access denied.', 403);
    const id = new URL(r.url).searchParams.get('id') || '';
    if (!uuidPattern.test(id)) throw new RequestError('Invalid enquiry.');
    return json(
      await db(
        '/rest/v1/enquiry_audit?enquiry_id=eq.' + id + '&select=*&order=created_at.desc&limit=100',
        token,
      ),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
