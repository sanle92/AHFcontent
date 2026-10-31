import { publicationState } from '@/lib/publication-state';
import { contentReadiness } from '@/lib/readiness';
import { errorResponse, RequestError } from '@/lib/http';
import type * as Rows from '@/lib/types';
import { parseRequest, editorialBody } from '@/lib/request-schemas';
import { authorize, config, db, dbAll, json, sameOrigin } from '@/lib/backend';
import { env, waitUntil } from 'cloudflare:workers';
import { mailConfig } from '@/lib/mail';
import { dispatchPush } from '@/lib/push';
async function mutation(p: Promise<unknown>) {
  const v = await p;
  waitUntil(dispatchPush().catch(() => {}));
  return json(v);
}
import { validateContent } from '@/lib/content';
export async function GET(r: Request) {
  try {
    const { token, profile } = await authorize(r);
    const q = new URL(r.url).searchParams,
      view = q.get('view');
    if (view === 'website-settings') {
      const rows = await db<Rows.ContentItem[]>(
        '/rest/v1/content_items?select=*&kind=eq.page&slug=eq.site-settings&limit=1',
        token,
      );
      return json(await publicationState(rows, token));
    }
    if (view === 'bootstrap' || view === 'editor' || view === 'enquiry' || view === 'calendar') {
      const c = config(),
        m = mailConfig();
      let items: Rows.ContentItem[] = [],
        media: Rows.MediaRow[] = [],
        enquiries: Rows.EnquiryRow[] = [],
        mail: Rows.EmailJob[] = [];
      const staff = await dbAll<Rows.Profile>(
        '/rest/v1/website_profiles?select=id,name,roles,active&order=id.asc',
        token,
      );
      if (view === 'calendar') {
        items = await dbAll<Rows.ContentItem>(
          '/rest/v1/content_items?select=*&order=id.asc&or=(kind.in.(event,campaign),status.in.(Review,Scheduled))',
          token,
        );
        const schedules = await dbAll<Rows.ScheduleRow>(
          '/rest/v1/publications?select=content_id,publish_at&archived=eq.false&publish_at=gt.' +
            encodeURIComponent(new Date().toISOString()) +
            '&order=id.asc',
          token,
        );
        items = items.map((i) => ({
          ...i,
          scheduled_at: schedules.find((s) => s.content_id === i.id)?.publish_at,
        }));
      }
      if (view === 'editor') {
        const id = q.get('id');
        if (id && !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Invalid record.' }, 400);
        const choices = await db<{
          items: Rows.ContentItem[];
          media: Rows.MediaRow[];
          has_more: boolean;
        }>('/rest/v1/rpc/website_editor_choices', token, {
          method: 'POST',
          body: JSON.stringify({ p_record: id || null }),
        });
        items = await publicationState(choices.items, token);
        media = choices.media;
      }
      if (view === 'enquiry') {
        const id = q.get('id');
        if (!/^[0-9a-f-]{36}$/i.test(id || '')) return json({ error: 'Invalid enquiry.' }, 400);
        enquiries = await db<Rows.EnquiryRow[]>(
          '/rest/v1/website_enquiries?select=*&id=eq.' + id,
          token,
        );
        mail = await db<Rows.EmailJob[]>(
          '/rest/v1/website_email_outbox?select=*&enquiry_id=eq.' + id,
          token,
        );
      }
      return json({
        profile,
        items,
        media,
        enquiries,
        mail,
        staff,
        engagement: [],
        schedules: [],
        integrations: {
          backend: !!c.url,
          email: !!(m.key && m.from),
          staffEmail: !!m.staff,
          turnstile: !!(c.turnstile && c.sitekey && c.origin),
          analytics: (env as unknown as Record<string, string>).AHF_ANALYTICS_ENABLED === 'true',
        },
      });
    }
    const list = <T>(path: string) =>
      view === 'overview' ? db<T[]>(path, token) : dbAll<T>(path, token);
    const [items, media, enquiries, mail, staff, engagement, schedules] = await Promise.all([
      list<Rows.ContentItem>('/rest/v1/content_items?select=*&order=updated_at.desc&limit=50'),
      list<Rows.MediaRow>('/rest/v1/website_media?select=*&order=created_at.desc&limit=50'),
      list<Rows.EnquiryRow>(
        '/rest/v1/website_enquiries?select=id,kind,name,email,phone,message,consent,status,internal_note,version,created_at,assigned_to,follow_up_at,priority&order=created_at.desc&limit=50',
      ),
      list<Rows.EmailJob>('/rest/v1/website_email_outbox?select=*&order=created_at.desc&limit=50'),
      list<Rows.Profile>('/rest/v1/website_profiles?select=id,name,roles,active'),
      profile.roles.some((role) => ['administrator', 'editor', 'publisher'].includes(role))
        ? db<Rows.EngagementRow[]>('/rest/v1/rpc/website_engagement_summary', token, {
            method: 'POST',
            body: '{}',
          })
        : Promise.resolve([]),
      db<Rows.ScheduleRow[]>(
        '/rest/v1/publications?select=content_id,publish_at&archived=eq.false&publish_at=gt.' +
          encodeURIComponent(new Date().toISOString()),
        token,
      ),
    ]);
    const nextEvents =
      view === 'overview'
        ? await db<Rows.ContentItem[]>(
            '/rest/v1/content_items?select=*&kind=eq.event&details->>date=gte.' +
              encodeURIComponent(new Date().toISOString()) +
              '&order=details->>date.asc&limit=10',
            token,
          )
        : [];
    const reviewItems =
      view === 'overview'
        ? await db<Rows.ContentItem[]>(
            '/rest/v1/content_items?select=*&status=eq.Review&order=updated_at.asc&limit=50',
            token,
          )
        : [];
    const c = config(),
      m = mailConfig();
    return json({
      profile,
      items: [
        ...new Map([...items, ...nextEvents, ...reviewItems].map((i) => [i.id, i])).values(),
      ].map((i) => ({
        ...i,
        scheduled_at: schedules.find((s) => s.content_id === i.id)?.publish_at,
      })),
      media,
      enquiries,
      mail,
      staff,
      engagement,
      schedules,
      integrations: {
        backend: !!c.url,
        email: !!(m.key && m.from),
        staffEmail: !!m.staff,
        turnstile: !!(c.turnstile && c.sitekey && c.origin),
        analytics: (env as unknown as Record<string, string>).AHF_ANALYTICS_ENABLED === 'true',
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(r: Request) {
  try {
    sameOrigin(r);
    const { token, profile } = await authorize(r),
      v = await parseRequest(r, editorialBody);
    if (v.action === 'save') {
      let payload;
      try {
        payload = validateContent(v.payload);
      } catch (error) {
        throw new RequestError((error as Error).message);
      }
      return await mutation(
        db('/rest/v1/rpc/save_website_content', token, {
          method: 'POST',
          body: JSON.stringify({
            payload,
            record_id: v.id || null,
            expected_version: v.version || null,
          }),
        }),
      );
    }
    if (v.action === 'transition') {
      if (v.target === 'Review') {
        const readiness = await contentReadiness(v.id!, token, profile);
        if (!readiness.canSubmit)
          throw new RequestError('Only the author or an administrator can submit this draft.', 403);
        if (readiness.blockers.length) throw new RequestError(readiness.blockers.join(' '));
      }
      return await mutation(
        db('/rest/v1/rpc/transition_website_content', token, {
          method: 'POST',
          body: JSON.stringify({
            record_id: v.id,
            target: v.target,
            expected_version: v.version,
            note: String(v.note || '').slice(0, 5000),
            scheduled_at: v.scheduled_at || null,
          }),
        }),
      );
    }
    if (v.action === 'withdraw')
      return await mutation(
        db('/rest/v1/rpc/withdraw_website_publication', token, {
          method: 'POST',
          body: JSON.stringify({ record_id: v.id, expected_version: v.version }),
        }),
      );
    if (v.action === 'restore')
      return await mutation(
        db('/rest/v1/rpc/restore_website_draft', token, {
          method: 'POST',
          body: JSON.stringify({ revision_id: v.revision_id, expected_version: v.version }),
        }),
      );
    if (v.action === 'assign')
      return await mutation(
        db('/rest/v1/rpc/assign_website_enquiry', token, {
          method: 'POST',
          body: JSON.stringify({
            record_id: v.id,
            expected_version: v.version,
            assignee: v.assignee || null,
            due_at: v.due_at || null,
          }),
        }),
      );
    if (v.action === 'priority')
      return await mutation(
        db('/rest/v1/rpc/set_website_enquiry_priority', token, {
          method: 'POST',
          body: JSON.stringify({ record_id: v.id, expected_version: v.version, level: v.level }),
        }),
      );
    if (v.action === 'enquiry')
      return await mutation(
        db('/rest/v1/rpc/update_website_enquiry', token, {
          method: 'POST',
          body: JSON.stringify({
            record_id: v.id,
            target: v.target,
            note: String(v.note || '').slice(0, 5000),
            expected_version: v.version,
          }),
        }),
      );
    throw new RequestError('Unknown action.');
  } catch (e) {
    return errorResponse(e);
  }
}
