import { readJsonLimited, validate, RequestError, BackendError, errorStatus } from './http.ts';
import { z } from 'zod';
export const enquirySchema = z.object({
  kind: z.enum([
    'contact',
    'volunteer',
    'partner',
    'aminia-kids',
    'support',
    'merchandise',
    'event',
  ]),
  name: z
    .string()
    .max(150)
    .refine((s) => s.trim().length >= 2),
  email: z
    .string()
    .max(254)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  message: z.string().min(5).max(5000),
  consent: z.literal(true),
  token: z.string().max(2048),
  phone: z.unknown().optional(),
  website: z.unknown().optional(),
});
export type EnquiryInput = z.infer<typeof enquirySchema>;
export function validateEnquiry(value: unknown) {
  const envelope = validate(z.object({ website: z.unknown().optional() }).passthrough(), value);
  if (envelope.website) return { honeypot: true } as const;
  return { honeypot: false, value: validate(enquirySchema, envelope) } as const;
}
interface Dependencies {
  config: () => { service: string; turnstile: string; sitekey: string; origin: string };
  verify: (token: string) => Promise<{ success: boolean; hostname?: string; action?: string }>;
  save: (value: EnquiryInput, tag: string, submissionKey?: string) => Promise<string>;
  notify: (id: string) => Promise<{ state: string }>;
}
function reply(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
export function createEnquiryHandler(deps: Dependencies) {
  return async function POST(request: Request) {
    try {
      if (
        request.headers.get('Origin') &&
        request.headers.get('Origin') !== new URL(request.url).origin
      )
        throw new RequestError('Access denied.', 403);
      const c = deps.config();
      if (!c.service || !c.turnstile || !c.sitekey || !c.origin)
        throw new BackendError('The enquiry service is not available yet. Please try again later.');
      const input = validateEnquiry(await readJsonLimited(request, 16000));
      if (input.honeypot) return reply({ ok: true });
      const value = input.value;
      const proof = await deps.verify(value.token);
      if (
        !proof.success ||
        proof.hostname !== new URL(c.origin).hostname ||
        proof.action !== 'ahf_enquiry'
      )
        throw new RequestError('Verification failed. Please refresh and try again.');
      const tag = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(
              c.service + ':' + (request.headers.get('CF-Connecting-IP') || 'local'),
            ),
          ),
        ),
        (b) => b.toString(16).padStart(2, '0'),
      ).join('');
      const key = request.headers.get('Idempotency-Key') || undefined;
      if (key && !z.string().uuid().safeParse(key).success)
        throw new RequestError('Invalid submission reference.');
      const id = await deps.save(value, tag, key);
      const email = await deps.notify(id).catch(() => ({ state: 'pending' }));
      return reply({ ok: true, reference: id, email: email.state });
    } catch (error) {
      const status = errorStatus(error, 503);
      return reply(
        {
          error:
            error instanceof RequestError || error instanceof BackendError
              ? error.message
              : 'The enquiry service is temporarily unavailable. Please try again later.',
        },
        status,
      );
    }
  };
}
