import { authorize, db, json } from '@/lib/backend';
import { RequestError, errorResponse } from '@/lib/http';
import { uuidPattern } from '@/lib/editorial';
export async function GET(r: Request) {
  try {
    const { token } = await authorize(r),
      q = new URL(r.url).searchParams,
      id = q.get('id'),
      page = Number(q.get('page') || 0),
      query = q.get('query') || '',
      selected = (q.get('selected') || '').split(',').filter(Boolean);
    if (
      (id && !uuidPattern.test(id)) ||
      !Number.isInteger(page) ||
      page < 0 ||
      page > 10000 ||
      query.length > 100 ||
      selected.length > 50 ||
      selected.some((v) => !uuidPattern.test(v))
    )
      throw new RequestError('Choose valid editor choices.');
    return json(
      await db('/rest/v1/rpc/website_editor_choices', token, {
        method: 'POST',
        body: JSON.stringify({ p_record: id, p_query: query, p_page: page, p_selected: selected }),
      }),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
