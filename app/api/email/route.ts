import { errorResponse, RequestError } from '@/lib/http';
import type * as Rows from '@/lib/types';
import { parseRequest, idBody } from '@/lib/request-schemas';
import { authorize, config, db, json, sameOrigin } from '@/lib/backend';
import { dispatchEnquiryEmail } from '@/lib/mail';
import { uuidPattern } from '@/lib/editorial';
export async function POST(r: Request) {
  try {
    sameOrigin(r);
    const { profile, token } = await authorize(r);
    if (!profile.roles.some((v) => ['administrator', 'enquiry_coordinator'].includes(v)))
      throw new RequestError('Access denied.', 403);
    const v = await parseRequest(r, idBody);
    if (!uuidPattern.test(v.id)) throw new RequestError('Invalid enquiry.');
    const rows = await db<Rows.EnquiryRow[]>(
      '/rest/v1/website_enquiries?id=eq.' + v.id + '&select=id',
      token,
    );
    if (!rows[0] || !config().service) throw new RequestError('Access denied.', 403);
    return json(await dispatchEnquiryEmail(v.id));
  } catch (e) {
    return errorResponse(e);
  }
}
