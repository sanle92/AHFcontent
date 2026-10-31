import { readJsonLimited, validate, RequestError } from './http.ts';
import { z } from 'zod';
const uuid = z.string().uuid();
export const editorialBody = z
  .object({
    action: z.enum(['save', 'transition', 'restore', 'assign', 'priority', 'enquiry', 'withdraw']),
    payload: z.unknown().optional(),
    id: uuid.nullish(),
    version: z.number().int().positive().nullish(),
    target: z.string().optional(),
    note: z.string().optional(),
    scheduled_at: z.string().nullish(),
    revision_id: uuid.optional(),
    assignee: uuid.nullish(),
    due_at: z.string().nullish(),
    level: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const invalid = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (v.action !== 'save' && !v.version) invalid('A version is required.');
    if (v.action !== 'save' && v.action !== 'restore' && !v.id) invalid('A record is required.');
    if (v.action === 'save' && v.id && !v.version) invalid('A version is required.');
    if (v.action === 'restore' && !v.revision_id) invalid('Choose a revision.');
    if (
      v.action === 'transition' &&
      !['Draft', 'Review', 'Approved', 'Published', 'Scheduled', 'Returned', 'Archived'].includes(
        v.target || '',
      )
    )
      invalid('Choose a valid transition.');
    if (
      v.action === 'transition' &&
      v.target === 'Scheduled' &&
      (!v.scheduled_at || !Number.isFinite(Date.parse(v.scheduled_at)))
    )
      invalid('Choose a valid schedule.');
    if (
      v.action === 'enquiry' &&
      !['New', 'In review', 'Contacted', 'Closed'].includes(v.target || '')
    )
      invalid('Choose a valid enquiry status.');
    if (v.action === 'priority' && !['Normal', 'High', 'Urgent'].includes(v.level || ''))
      invalid('Choose a valid priority.');
    if (v.due_at && !Number.isFinite(Date.parse(v.due_at)))
      invalid('Choose a valid follow-up date.');
  });
export const mediaBody = z
  .object({
    action: z.enum(['video', 'review']).optional(),
    url: z.string().optional(),
    title: z.string().optional(),
    id: uuid.optional(),
    version: z.number().int().positive().optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
    target: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.action === 'video') {
      if (!v.url || !v.title || v.title.length < 3 || v.title.length > 180)
        ctx.addIssue({ code: 'custom', message: 'Add a video URL and title.' });
    } else if (
      !v.id ||
      !v.version ||
      !['Review', 'Approved', 'Rejected', 'Withdrawn'].includes(v.target || '')
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Choose a media record, version and review action.',
      });
  });
export const enquiryBody = z.object({
  kind: z.string(),
  name: z.string(),
  email: z.string(),
  message: z.string(),
  consent: z.boolean(),
  token: z.string(),
  phone: z.unknown().optional(),
  website: z.unknown().optional(),
});
export const visitBody = z.object({
  visitor: z.string(),
  action: z.string(),
  session: z.string().optional(),
  path: z.string().optional(),
  referrer: z.string().optional(),
  consent: z.boolean().optional(),
});
export const notificationBody = z.object({
  action: z.enum(['read', 'subscribe', 'unsubscribe', 'test']),
  id: uuid.optional(),
  subscription: z
    .object({
      endpoint: z.string(),
      expirationTime: z.number().nullable().optional(),
      keys: z.object({ p256dh: z.string(), auth: z.string() }).optional(),
    })
    .optional(),
});
export const campaignBody = z.object({ url: z.string() });
export const idBody = z.object({ id: uuid });
export const engagementBody = z.object({ action: z.string() });
export async function parseRequest<S extends z.ZodTypeAny>(
  r: Request,
  schema: S,
  limit = 512 * 1024,
): Promise<z.infer<S>> {
  let value: unknown;
  try {
    value = await readJsonLimited(r, limit);
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError('Invalid JSON request.');
  }
  return validate(schema, value);
}
