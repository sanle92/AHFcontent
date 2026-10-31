# Website architecture

This repository serves Aminia Hope Foundation’s public website and the `/holyghost` content
workspace. It uses a dedicated Supabase content project, separate from the private NGO management
system. Beneficiary case files, donor records and financial transactions do not belong here.

## Request flow

Cloudflare Workers runs the Vinext/Next-compatible application. `worker/index.ts` adds trusted
Cloudflare location headers, route-specific caching and security headers before returning responses.
The location headers replace incoming values; existing visitor consent and retention rules still apply.

Public server pages call `publishedForPath` in `lib/backend.ts`. React’s request-scoped cache shares
one result between metadata and rendering. Queries select the route’s content kinds and slugs from
`published_content`; detail pages additionally load their related published records. No public query
uses the service key. The database view exposes approved, due publication snapshots.

Staff browser requests use `hooks/use-staff-api.ts` with the current bearer token. API routes verify
the authenticated Supabase user, MFA assurance (`aal2`) and active profile. PostgreSQL RLS and
security-definer RPCs enforce permissions, ownership, workflow and optimistic version checks.
UI visibility is only an additional convenience. `hooks/use-admin-session.ts` refreshes sessions and
cancels stale refresh results; `components/mfa-gate.tsx` handles the second factor.

Public enquiries use bounded JSON validation, same-origin checks, consent, honeypot and Turnstile
verification before the service-only ingress RPC. Database rate limits remain authoritative. Errors
expose controlled messages rather than database or JSON parser details. Email and push dispatchers
claim leased jobs, send them, and record completion; secrets and job tables stay server-side.

## Roles

| Role | Responsibility |
| --- | --- |
| `administrator` | Website content administration, publishing, enquiries and analytics; independent approval still applies |
| `editor` | Prepare content and upload/submit media within database ownership rules |
| `publisher` | Independently review, approve, schedule, publish or withdraw permitted content and media |
| `enquiry_coordinator` | Review enquiries, assignments, follow-up and permitted correspondence |

Profiles are provisioned in the content project by an authorized operator. There is no public signup
or role promotion API. Combining roles never bypasses the requirement for a different reviewer.

## Publishing and media

Content follows Draft → Review → Approved → Published or Scheduled. Returned content can be
edited and resubmitted. Editing a live item creates a draft while its existing public snapshot remains
available. Immutable revisions support restoration into a new draft requiring review.

Media follows its own review process. Uploading or choosing draft media does not publish it.
Rights, guardian consent and references for children’s imagery are checked in the database, and an
independent reviewer must approve it. The private preview uses short-lived Storage signed URLs;
`/media/[id]` checks the approved public-media RPC and proxies the private object, including Range,
ETag and conditional requests. Withdrawal prevents new origin authorization immediately, while
previously cached media may remain available for up to **300 seconds**.

The admin coordinator retains shared state and dialog focus/keyboard handling. Focused content,
media and enquiry components live in `components/admin/`. Analytics remains in
`components/analytics-panel.tsx`; notification and device installation components are separate.

## Caching and headers

Public HTML advertises `s-maxage=60, stale-while-revalidate=300`; actual edge caching depends on
the Cloudflare cache configuration. Staff/API/authenticated/personal and React transport responses
use `no-store`. Images, icons and hashed build assets are immutable for one year; rotate their URL
when replacing a file. Media has a five-minute cache window. Never apply a blanket cache rule over
protected routes.

HTML receives a report-only CSP with per-response script nonces. Fonts are self-hosted. HSTS is
added when `AHF_PUBLIC_ORIGIN` is HTTPS. Verify the deployed site, Turnstile and approved embeds
in staging before changing report-only CSP to enforcement. This refactor does not enable enforcement.

## Configuration and migrations

`.env.example` lists all documented variables with empty values. Local `.dev.vars` is ignored.
Production secrets belong in Cloudflare Worker secrets: service-role key, Turnstile secret, Resend
key, VAPID private key and push-dispatch secret. Public configuration exposes only the intended
Supabase URL/anon key, Turnstile site key and VAPID public key through their existing routes.
Never put a service key in `NEXT_PUBLIC_*`, browser assets, source control or the private NGO app.

Apply numbered SQL migrations in order to the website content project after review. Existing
001–010 migrations are immutable; 011 tightens push host matching and centralizes retention pruning.
The scheduler and administrator analytics reads invoke pruning; keep the scheduler configured.
No build, test or CI step applies migrations to a hosted project. Database tests use local PGlite.

CI checks formatting, production dependency advisories at high severity, lint, types, tests and the
Cloudflare build with Node 22 and pnpm 11.25.0. It never deploys.

## Repair additions

Staff lists use `/api/workspace` and invoker-security database paging/search with exact RLS-filtered
totals. Bootstrap/context reads avoid loading unrelated datasets. Existing editorial response fields
remain available to legacy readers with complete paging. API error mapping lives in lib/db-error.ts;
browser decoding is shared in lib/api-response.ts. Session-bound transports reject late results.

Enquiry receipt uses an optional Idempotency-Key header and a private 24-hour mapping. Post-receipt
email/push runs through Worker waitUntil; the same protected scheduler drains due jobs using tokened
leases, retry backoff and final review states. Health data is administrator-only. Privacy deletion
works independently of logging and keeps a private, expiring deletion marker to prevent queued writes
recreating history. See REPAIR-VERIFICATION.md for migration order and remaining staging checks.

The browser session guard compares login/session identity only to fence stale UI work and preserve
same-login token refresh. It is not authentication or authorization: the server verifies Supabase
tokens, active staff profiles and aal2, and database RLS/role checks remain required. Device-enabled
and test-delivery reads are restricted to the authenticated subscription owner (migration 017).
