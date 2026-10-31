# Aminia Hope Foundation — public website + content admin

**Current upgrade:** [28 October repair setup and required deletions](docs/UPGRADE-DEEP-REPAIRS.md).
Apply missing website-content migrations **018–022** before deploying this update.
[Finding-by-finding implementation and verification](docs/DEEP_REPAIR_STATUS.md).

**Latest repair guide:** read [Repair verification and staging checks](docs/REPAIR-VERIFICATION.md). Apply only missing migrations in order to the separate website content project. This branch adds 011–017 after the original 001–010. The [007–010 setup guide](docs/UPGRADE-007-010.md) remains useful background.

A Cloudflare-ready first website draft using AHF's official logo, supplied team photographs, updated About text, vision and mission, and a dedicated Aminia Kids section.

This is a **new application**, separate from ahf-management. The public website and protected content admin share this application and its **own content database**. No beneficiary, donor or finance database is connected here.

## Included

- Public home, About/team, nine programme entries (eight supplied areas plus Aminia Kids), programme detail pages, stories, events, impact/learning, transparency, giving, get-involved, merchandise introduction, contact, privacy and safeguarding pages.
- Responsive cream/green/gold design, real supplied team imagery, accessible navigation and form labels, server-rendered content, page titles/descriptions, robots rules and a configurable sitemap.
- Website admin at /holyghost: pages, programmes, stories, events, reports, campaigns, products, media/consent, enquiries and settings.
- Content workflow: Draft → Review → Approved → Published or Scheduled. A different authorized publisher must approve the author’s version.
- Current live snapshots remain public while new drafts are prepared. Older and future publication snapshots are not exposed to visitors. Historical drafts can be restored for a fresh review.
- Private media uploads, alt text/captions, publication-rights checks, guardian consent/reference for children’s photos, independent media review and public-access withdrawal.
- Contact/volunteer/partner/Aminia Kids/support enquiries with privacy consent, Turnstile, service-only ingress and a per-request-tag limit. Authorized coordinators can track follow-up and search all enquiries and export the current result page.
- MFA for all staff data access, PostgreSQL RLS, version conflict checks, content revision history and enquiry status audit.

**Not deployed.** No live content database credentials, staff accounts or verified contact/payment details were supplied. The unconnected website uses the provided organization copy; /holyghost offers a clearly labelled read-only preview. Forms do not report successful submission without the configured backend.

## Technology

React, TypeScript, Vinext/Vite, Cloudflare Workers and Supabase PostgreSQL/Auth/Storage. The same tested runtime and MFA components as the private project are reused. Vinext provides the Next-compatible runtime; dependency versions and the supported Worker compatibility date are pinned. Treat framework upgrades as staging changes.

The content database is a **separate Supabase project**. Do not apply these migrations to the NGO management project or use its service key here.

## Run locally

Use Node 22.18 or later and the pnpm version recorded in package.json. Run commands from the repository root containing package.json.

~~~sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .dev.vars
pnpm dev
~~~

With blank backend variables, the supplied facts render as the website draft and the content admin stays read-only. No synthetic donations, impact totals, beneficiaries or events are generated.

~~~sh
pnpm typecheck
pnpm test
pnpm build:cloudflare
~~~

The PostgreSQL tests execute the real migrations in PGlite with minimal Supabase-owned auth/storage schemas. They cover draft privacy, MFA/activity denial, independent review, publication scheduling, stale versions, preserved live snapshots, revision restoration, media consent and withdrawal, private enquiries and ingestion rate limits.

## Configure the website backend

1. Create a NEW Supabase project for public content and website staff. Disable public signup.
2. Apply supabase/001_website.sql followed by supabase/002_provided_content.sql, 003_public_workspace.sql, 004_merchandise.sql and 005_engagement.sql in order. If 001/002 are already installed, run only 003–005 once. These are for this new content project only.
3. Create approved staff Auth accounts in that project, then insert website_profiles using their actual **new content-project Auth UUIDs**. Auth IDs from the private management project do not automatically exist in this separate project.
4. Enable TOTP MFA in Supabase Auth. Staff enroll and verify through the website admin on first sign-in.
5. Configure runtime variables locally in .dev.vars and later as Cloudflare Worker secrets:

~~~text
AHF_CONTENT_SUPABASE_URL=https://YOUR_CONTENT_PROJECT.supabase.co
AHF_CONTENT_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_JWT_KEY
AHF_CONTENT_SERVICE_KEY=YOUR_CONTENT_PROJECT_SERVICE_ROLE_KEY
AHF_PUBLIC_ORIGIN=https://YOUR_CONFIRMED_DOMAIN
AHF_TURNSTILE_SITE_KEY=YOUR_SITE_KEY
AHF_TURNSTILE_SECRET=YOUR_SECRET_KEY
~~~

Use the public anon JWT key and service-role key appropriate to this REST/Auth implementation. The browser receives only the public URL/key and Turnstile site key. The service key is used only by the server-side, verified enquiry ingress.

The Turnstile widget must allow your actual site hostname. The server verifies its hostname and ahf_enquiry action. Enquiries remain disabled until the backend, Turnstile and public origin are configured. Private media is stored in the website-media bucket created by the migration; it is never a public bucket. Only approved media can be fetched by visitors. Draft attachments can remain private until review.

### Website roles

| Role | Responsibilities |
| --- | --- |
| administrator | Content administration, publishing permissions and enquiry handling; still cannot approve their own authored version |
| editor | Prepare content and private media, submit for review |
| publisher | Independently review, approve, publish/schedule, unpublish and withdraw public media |
| enquiry_coordinator | Read enquiries and record follow-up without access to editorial drafts |

Example profile provisioning (replace UUID placeholders with the accounts created in the new project):

~~~sql
insert into public.website_profiles(id,name,roles)
values ('REPLACE_WITH_CONTENT_AUTH_UUID','Sanle Esaie',array['administrator']);
~~~

Provision at least two independently authorized staff if they will author and publish through the application. All ordinary clients require active profiles and aal2 sessions. No browser can change its own roles. Profiles, role changes, recovery and deactivation are backend-owner operations.

## Working in the admin

- Home content is the page with slug home. Its title/summary/body/approved cover update the main heading, introduction and hero imagery. The About page supplies its story, vision and mission.
- Home and About are reserved system page slugs. The shared layouts, menus and core page structure remain source-controlled; this release is a structured content CMS rather than a drag-and-drop layout editor.
- Programme records, stories, events, reports, campaigns and products receive individual public URLs. The approved Aminia Kids programme cover populates its dedicated arts section.
- The editor uses plain-text paragraphs, not arbitrary HTML. This avoids allowing executable content in public pages.
- Submit a draft, have another publisher approve it, then publish now or schedule in Kampala time. Scheduling uses the database clock and on-demand rendering; it does not require a separate scheduler.
- Creating a draft or restoring a version preserves the live snapshot. Unpublishing archives all public snapshots of that item.
- Uploaded photos start private with shows_children=true. Enter accurate rights/consent information, submit it, and have another publisher approve it before selecting it as a public cover.
- Withdraw media if permission changes. That stops fresh public access immediately; already downloaded copies cannot be recalled. Replace affected page covers and arrange any further action through your own procedures.
- Enquiry follow-up changes status and private notes only. New enquiries queue acknowledgement and staff notification emails. Follow-up changes do not send free-form messages or invitations. No submission automatically becomes an internal volunteer or beneficiary record.

The interactive admin loads up to 1,000 records per collection and up to 100 revisions per selected item. Add server-side pagination before reaching that scale.

## Supplied photographs and copy

The ten uploaded originals are preserved unchanged in source-materials/. That folder is **not** a public static directory and is excluded from the deployed asset pipeline.

Only two adult team/collaboration images have been included in the draft's public assets. The children’s photographs and mixed-age outreach images have not been released into public assets. Confirm captions and publication permissions before upload/review. No guardian permission was inferred from receiving the files.

The completed vision in the supplied About text resolves the earlier placeholder about the elderly. The site uses Entebbe, Wakiso District, Katabi and Busabaga as supplied. Founding date: October 2025. Co-founder assignments are taken from the established AHF information. Telephone, email, office address, session schedules, registration completion, payment details and verified impact totals have not been invented.

The introductory collaboration story is draft editorial copy based on the supplied theme and team photographs, not a dated impact report. Review all public copy before launch. See docs/CONTENT-SOURCES.md.

## Deploy later on Cloudflare

Nothing in the build command publishes the website.

| Field | Command |
| --- | --- |
| Build | pnpm run build:cloudflare |
| Deploy | pnpm run deploy:cloudflare |
| Local production preview after build | pnpm run preview |

~~~sh
pnpm exec wrangler login
pnpm run build:cloudflare
pnpm exec wrangler secret put AHF_CONTENT_SUPABASE_URL --config dist/server/wrangler.json
pnpm exec wrangler secret put AHF_CONTENT_SUPABASE_ANON_KEY --config dist/server/wrangler.json
~~~

Add the remaining variables with the same secret-put command, entering values at the prompt. Set your actual HTTPS domain and the same AHF_PUBLIC_ORIGIN without a trailing slash. Configure that origin in Supabase Auth and Turnstile. Then deploy when you decide:

~~~sh
pnpm run deploy:cloudflare
~~~

The generated config is dist/server/wrangler.json; the Worker name is ahf-public. Private runtime values, generated builds and dependency folders are excluded from the source archive. The sitemap is available at /sitemap.xml once a valid HTTPS public origin is configured.

## Before operational launch

Confirm public wording, image permissions, contact details, registration wording, privacy/retention information and a safeguarding reporting channel. The privacy and safeguarding pages are provisional editorial text awaiting your approval.

Complete live Supabase sign-in/MFA, Storage upload and consent review, two-person publishing, Turnstile/enquiry submission, account revocation, domain/HTTPS and physical-device checks. Back up the database and uploaded file bytes, and test restoring both.

No managed Supabase credentials or real staff sessions were available here, so those integrations are not claimed as verified. The local database tests and build do not replace staging acceptance.

Direct online payments, paid merchandise checkout, newsletters, automatic invitations and automatic private-system imports are not enabled. Stories/campaigns can link to approved Pillar.io, Spotfund and GoFundMe campaign URLs. Merchandise uses order enquiries. No fundraising accounts or checkout arrangements are invented. The existing private management system remains a separate application.

## Expanded public workspace (October 2026)

The staff route is **/holyghost**; /admin returns 404. Access still requires a current staff profile and MFA. Existing staff profile IDs and roles do not change when the route changes.

- Overview: pending content/media reviews, open/overdue enquiries, upcoming events, campaigns needing a check, and failed email jobs.
- Aminia Kids studio: scoped albums, programmes, events, stories, campaigns and shared reviewed media. Choose the Aminia Kids workspace in content forms. The existing main Aminia Kids programme is also included by slug. Editorial roles retain their existing permissions; this is not a new child-record or school administration database.
- Portfolio: approved photo IDs, ordered galleries, captions, native full-screen dialog and click-to-load YouTube/Vimeo videos. Album covers are optional. Videos are registered as private review records. Staff must confirm rights and guardian consent independently before publication. Originals remain on the external hosting provider; withdrawing a website embed does not delete that provider's copy.
- Forms: programme stages/objectives/activities, related programmes/campaigns, support status, platform links, dated progress updates, event status/end/capacity/registration, report metadata, product variants/availability/fulfilment/proceeds and SEO descriptions. Paragraph content remains plain text.
- Our work: programme focus areas are not presented as proven outcomes. Set a programme stage when activities are confirmed.
- Shop for Hope: supplied T-shirt and mug concepts are labelled enquiries, with no fabricated prices/stock/payments. Migration 004 only inserts these concepts if they do not exist; it never overwrites editorial changes.
- Settings: use “Manage foundation details” to edit the page with slug site-settings. Save, submit, have a different publisher approve, then publish. Confirmed contacts/social links and email acknowledgement wording use the approved snapshot. Integration status exposes booleans only; secrets remain in Cloudflare settings. The settings page has no public route and is omitted from the sitemap.
- Enquiries: search, CSV, staff assignment, Kampala follow-up times, internal notes/status, email attempt history and retry. No applicant is automatically enrolled. Use adult contact details for Aminia Kids. Merchandise requests should include product, variant, quantity and fulfilment preference.
- Editorial calendar shows recorded event dates, scheduled publications and pending review/campaign checks. Event pages provide an ICS download; no invitations are sent. If an event end time is missing, the calendar clearly labels a one-hour placeholder. Confirm the actual venue and end time before publishing.
- Campaign check buttons perform bounded HEAD checks to allowlisted fundraising hosts. A successful HTTP response is not verification of the recipient, legitimacy or campaign status. Some platforms block automated requests; review those manually. Targets and raised totals are manually maintained and labelled accordingly.

### Email setup

Configure a verified sending domain with Resend and add these runtime variables to the public Worker:

~~~text
AHF_RESEND_API_KEY=YOUR_RESEND_SENDING_KEY
AHF_EMAIL_FROM=Aminia Hope Foundation <YOUR_VERIFIED_SENDER>
AHF_EMAIL_REPLY_TO=YOUR_CONFIRMED_REPLY_ADDRESS
AHF_ENQUIRY_NOTIFY_EMAIL=YOUR_AUTHORIZED_STAFF_ADDRESS
~~~

No emails were sent during development. This code sends only when the deployed app receives an enquiry or authorised staff retry an existing job. There is no user-editable recipient or arbitrary-email endpoint. Staff notices contain a reference and workspace link rather than the visitor's message. Confirmation email does not mean participation, an order or payment is confirmed.

A database trigger queues both messages atomically with the enquiry. Missing email configuration leaves jobs pending; API/provider failures are recorded. The admin retries pending or failed jobs, with a lease and stable Resend idempotency key. Retry dispatch is limited to six attempts and the first 23 hours after a send attempt; older ambiguous failures require manual provider-log review rather than risking duplicate email after the provider's 24-hour deduplication window. There is no background retry cron in this release. The status Accepted means the provider accepted the message; inbox delivery/bounces are not verified because delivery webhooks have not been configured.

Acknowledgement wording is copied from the approved site-settings snapshot when the enquiry is created, keeping retries consistent. Do not include sensitive information in this public wording. After changing sender/provider settings, review pending attempts before retrying.

Provider references: https://resend.com/docs/api-reference/emails/send-email and https://resend.com/docs/dashboard/emails/idempotency-keys.

### Optional engagement counts

Set AHF_ANALYTICS_ENABLED=true to enable daily aggregate counts for giving, merchandise, volunteer, partnership and Aminia Kids buttons. It is off by default and respects the browser's Do Not Track flag. There are no analytics cookies, raw IP logs or individual browsing histories in this feature. A daily-changing keyed hash of the request IP is stored only in a rate-limit table; old entries are removed on the next counting request after their day expires. Cloudflare/provider infrastructure may retain its own logs under your account settings. Counts include repeated clicks and can include bots; they are not unique visitors, donations or completed orders. Review the privacy wording before enabling it.

### Upgrade acceptance checks

Apply migrations only in the website content project, back it up first, and test:
1. Existing staff sign-in/MFA at /holyghost; /admin returns 404.
2. Two-person photo and video review, album publication, withdrawal and private consent fields.
3. Story → campaign buttons, paused/completed states, actual approved platform URLs and dated updates.
4. Event date/time, cancellation, calendar import and parent registration enquiries.
5. Product request with variant/quantity; no claim of confirmed checkout.
6. Verified Resend sender, acknowledgement/staff emails, missing config and failed retry paths. Check the real inbox and provider logs.
7. Enquiry assignment, overdue follow-up, revocation and role isolation.
8. Phones/tablets, keyboard navigation, low-data browsing and read-only backend-unconfigured state.

These live integrations require your configured staging services; the local PostgreSQL tests and build do not verify real inbox delivery or external fundraising accounts.

## Faith, homepage and mobile editor update

The sticky public header stays visible while scrolling. Home order is hero → all published campaigns → Christian faith/evangelism → personal-help stories → Aminia Kids motivation → vision → practical programme areas. Stories categorised Personal help, linked to a campaign, or containing platform giving links appear in the personal-help listings. Foundation updates remain accessible by their published individual URL. No personal appeals have been fabricated.

Apply **006_faith_copy.sql** once after 005. It proposes Christian wording in About as a draft and preserves the current public snapshot. An administrator should review the draft and follow the normal independent approval/publication workflow. The seed fallback uses the new wording. Faith does not make assistance conditional on religious participation.

Editors can upload photos inside the cover picker. New uploads stay private and can be attached to drafts immediately; review/publication requires Media & consent approval. Forms have compact fields and grouped sections for phone/tablet layouts. Clicking the backdrop or pressing Escape dismisses a form; save your draft before dismissing it. Device-specific acceptance should still be completed on your actual phone and tablet.

## Response caching

Staff pages, APIs, authenticated/cookie-bearing requests, error responses and React server-component transports use no-store. Anonymous public HTML advertises a shared-cache TTL of 60 seconds with 300 seconds stale-while-revalidate; scheduled publications may therefore wait for freshness/revalidation. Public assets under images/icons and hashed build assets are immutable for one year: change their filenames when replacing them. Configure your edge/CDN to honour these response directives; these headers do not create an application-wide memory cache.

Approved media advertises a five-minute browser/shared-cache window and forwards Range, If-Range and If-None-Match, preserving ETag/Last-Modified and partial responses. **Withdrawing consent or media approval can take up to five minutes to stop previously cached media being served.** Once stale, approval is checked again before returning media or a 304. Already downloaded files cannot be recalled.

## Security header rollout

HTML responses ship Content-Security-Policy-Report-Only first. Inline framework scripts receive a fresh nonce through Cloudflare HTMLRewriter; script unsafe-inline is not permitted. Style attributes retain unsafe-inline because the existing React layouts require them. Only self, the configured HTTPS Supabase origin, Turnstile and the two approved video frame hosts are allowed. Existing DM fonts are now served locally under public/fonts with their OFL licences, so rendering does not require an additional runtime origin. HSTS (one year, includeSubDomains) is set when AHF_PUBLIC_ORIGIN is HTTPS; ensure all organisation subdomains support HTTPS before rollout.

This release deliberately does not enforce CSP. Review browser console reports on a configured staging deployment, including real Turnstile and approved video playback, then promote the tested directive to Content-Security-Policy in a later release. Do not add broad wildcard or unsafe-inline script allowances to silence reports.

Migration `supabase/011_review_hardening.sql` tightens push-host matching and moves analytics
retention cleanup out of visit ingestion. Apply it after 010 in the website content project.
The existing scheduler and administrator analytics reads call `prune_website_visits`; keep the
scheduler enabled so retention cleanup continues even when no administrator opens analytics.
This repository change does not run migrations against a hosted project.

## Maintenance checks

Run these commands from the repository root:

~~~sh
pnpm format          # Format application, hooks, Worker, scheduler and tests (not components/ui)
pnpm format:check    # Check formatting without writing files
pnpm lint
pnpm typecheck
pnpm test            # Unit and local PGlite database tests; no hosted database access
pnpm run build:cloudflare
~~~

[Architecture](docs/ARCHITECTURE.md) describes request flow, roles, approvals, media and secret
boundaries. CI runs install with the frozen pnpm lockfile, lint, typecheck, tests and the Cloudflare
build on pull requests and pushes to main, with Node 22 and the pnpm version from package.json.
It does not deploy or apply migrations. Use `pnpm preview` for a local production Worker preview.

Header and cache-policy unit tests cover the report-only CSP, HTTPS-only HSTS and private/public
cache boundaries. Before enabling CSP enforcement, check the configured staging site, Turnstile
and approved YouTube/Vimeo embeds in a browser. This change leaves CSP report-only.

Migration `012_privacy_revocation.sql` makes history deletion independent of new analytics recording.
It retains only a private keyed deletion marker for 30 days so queued requests and old tabs cannot
recreate withdrawn history. The marker expires during scheduled pruning; recorded visit history is
deleted immediately. The browser preserves its deletion identifier when the service is unavailable
so the visitor can retry. No public permission to read deletion markers is granted.

### Reliable enquiry and device delivery (migration 013)

Apply `013_reliable_delivery.sql` after 012 in the website content project. Public enquiries accept
an optional `Idempotency-Key` UUID header; the browser keeps it across an unchanged form retry.
The receipt reference and response fields are unchanged. A durable enquiry is acknowledged with
email pending while Cloudflare `waitUntil` processes its outbox and push notices. Reusing a key
with different saved content is rejected. Private deduplication fingerprints expire after 24 hours.

Keep the existing five-minute scheduler configured even when device push is disabled: the protected
`/api/push-dispatch` endpoint now also drains due email. It needs the existing dispatch secret and
content service key; Resend credentials enable email, VAPID credentials independently enable push.
Email retries use backoff and stop for human review at the retry limit / provider idempotency window.
Lease tokens prevent late workers from completing a newer attempt. Push drains up to three batches
of 16 jobs per invocation; cron frequency, provider limits and device settings still affect delivery.

Administrators can inspect pending/failed delivery and the last scheduler contact in Settings.
Device test results refer to the requesting subscription, not unrelated queue jobs. Provider
acceptance does not prove inbox delivery or an OS popup. No provider messages are sent by tests.

Migration `014_analytics_accuracy.sql` counts page views/actions by event time even when a session
started before the selected interval. “Sessions started” counts starts; “Active visitors” counts
visitors active during the interval; “Live now” describes the last two minutes independently of the
date filter. All displayed date boundaries use Kampala. Overview engagement uses the same consented
visit-event pipeline. The new visit/event index supports event history and per-session limits.
Approved public gallery metadata is fetched in batches of at most 200 IDs without dropping later
photos; withdrawn cover references render a neutral placeholder instead of exposing the file.

### Staff search and pagination (migration 015)

`015_workspace_paging.sql` adds invoker-security RPCs for 50-row content, media and enquiry pages,
with server-side search/filtering and exact totals. Existing table RLS, active-role and MFA checks
remain enforced. The CMS loads lightweight staff/configuration at sign-in, scoped reference choices
when an editor opens, individual enquiry mail when an enquiry opens, and bounded overview activity.
Overview counts use RLS-filtered database totals; calendar reads remain complete. Enquiry exports
are labelled as the current result page. No older records are silently excluded by a 1,000-row cap.
Legacy editorial responses keep their existing fields and use complete paged reads. Public content
and sitemap reads also continue across backend row caps; approved galleries remain consent-filtered.

### Page presentation and safe errors (migration 016)

`016_media_impact_and_legacy_leases.sql` adds an RLS-protected media-reference list and prevents
legacy dispatch completion from overwriting newer leased attempts. Media & consent shows draft
and published references before withdrawal. A withdrawn/unavailable image displays a neutral
placeholder; the public file route still enforces approval/consent and the documented cache window.
Metadata fields are read-only while media is in review or approved. No consent or approval is inferred.

Fixed page templates use a published page record's title/introduction/body/cover without appending
a duplicate article. About and custom page covers render correctly. Home body/SEO and Aminia Kids
body are connected. An optional approved page with slug `faith` manages the Home faith introduction;
an optional approved page with slug `team` manages founding-team rows using `Name | Role`, one per
line. Supplied foundation copy and team assignments remain the fallback; nothing is auto-published.

API failures keep the `{error}` shape and distinguish validation, authentication, authorization,
version conflict (409), size (413), throttling (429) and backend outage (503). Browser transports
handle empty/non-JSON responses safely. Save/submit actions expose unsaved changes and media review
requirements. Staging must still verify phone/tablet interactions and configured external services.

### Session rotation and device ownership (migration 017)

`017_device_ownership.sql` scopes device-enabled and test-delivery checks to the signed-in owner,
with the same active-role and MFA requirements. Signing out clears private workspace state and
revokes that account's device registration. Same-login token refresh preserves unsaved drafts;
late responses from an older login are discarded. The client-side session guard is a UI race
protection; Supabase token verification, RLS and MFA remain the authorization boundary.

Reviewed page vision/mission and programme objectives, activities, participation and progress
updates now render in their public templates. Aminia Kids keeps one portfolio; these changes do
not approve or publish any content.


### Deep review repair controls

`pnpm check:source-media` checks source-package hygiene. `pnpm test:e2e:public` runs browser smoke
checks after installing Chromium with `pnpm exec playwright install --with-deps chromium`.
`pnpm test:e2e:staging` is only for an explicitly authorized isolated staging project with two
independent MFA sessions; see the upgrade guide. CI never deploys or applies SQL.

Optional Worker settings: `AHF_CSP_ENFORCE=true` enforces CSP after configured browser verification;
otherwise CSP is report-only with minimized first-party diagnostic counts.
`AHF_ENQUIRY_RETENTION_DAYS` enables policy preview and explicitly confirmed anonymization of
closed, unheld enquiries; blank leaves processing disabled. Neither flag bypasses staff MFA/RLS.

Admin choices now have bounded search/pages, and Home campaigns have 12-item pages. Current selections
are retained. The private preview automatically refreshes after saving/submission and current approval
status refreshes across staff accounts. Readiness and the database both enforce publication rules.
