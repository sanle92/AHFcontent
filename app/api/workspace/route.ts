import { publicationState } from '@/lib/publication-state';
import type { Content } from '@/lib/content';
import { pushEndpoint } from '@/lib/visitor';
import { authorize, db, json } from '@/lib/backend';
import { RequestError, errorResponse } from '@/lib/http';
export async function GET(request: Request) {
  try {
    const { token } = await authorize(request),
      q = new URL(request.url).searchParams;
    if (q.get('resource') === 'device') {
      const endpoint = q.get('endpoint') || '';
      if (!pushEndpoint(endpoint)) throw new RequestError('Choose a supported device.');
      return json(
        await db('/rest/v1/rpc/website_device_enabled', token, {
          method: 'POST',
          body: JSON.stringify({ endpoint }),
        }),
      );
    }
    if (q.get('resource') === 'references') {
      const media = q.get('id') || '';
      if (!/^[0-9a-f-]{36}$/i.test(media)) throw new RequestError('Choose valid media.');
      return json(
        await db('/rest/v1/rpc/website_media_references', token, {
          method: 'POST',
          body: JSON.stringify({ media }),
        }),
      );
    }
    if (q.get('resource') === 'summary')
      return json(
        await db('/rest/v1/rpc/website_workspace_summary', token, { method: 'POST', body: '{}' }),
      );
    const resource = q.get('resource'),
      page = Number(q.get('page') || 0),
      query = q.get('query') || '';
    if (
      !['content', 'media', 'enquiries'].includes(resource || '') ||
      !Number.isInteger(page) ||
      page < 0 ||
      page > 100000 ||
      query.length > 100
    )
      throw new RequestError('Choose a valid page and search.');
    const result = await db<{ rows: Content[]; total: number }>(
      '/rest/v1/rpc/website_workspace',
      token,
      {
        method: 'POST',
        body: JSON.stringify({
          p_resource: resource,
          p_page: page,
          p_query: query,
          p_status: q.get('status') || 'All',
          p_kind: q.get('kind') || 'All',
          p_scope: q.get('scope') || '',
          p_assignee: q.get('assignee') || 'All',
        }),
      },
    );
    if (resource === 'content') result.rows = await publicationState(result.rows, token);
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
