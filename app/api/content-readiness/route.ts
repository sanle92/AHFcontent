import { authorize, json } from '@/lib/backend';
import { contentReadiness } from '@/lib/readiness';
import { RequestError, errorResponse } from '@/lib/http';
import { uuidPattern } from '@/lib/editorial';
export async function GET(r: Request) {
  try {
    const { token, profile } = await authorize(r);
    const id = new URL(r.url).searchParams.get('id') || '';
    if (!uuidPattern.test(id)) throw new RequestError('Choose a valid record.');
    return json(await contentReadiness(id, token, profile));
  } catch (error) {
    return errorResponse(error);
  }
}
