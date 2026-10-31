# Media, PWA, notifications, enquiry desk and analytics upgrade

This package is for the PUBLIC WEBSITE content project. The private NGO application is unchanged. No deployment or live database migration was performed for you.

## 1. Apply database upgrades

Confirm you selected the Supabase project used by `AHF_CONTENT_SUPABASE_URL`. In its SQL Editor, run:

```sql
select to_regclass('public.content_items'), to_regclass('public.website_media');
```

If either is null, install the previous website migrations 001–006 first in the correct project. Do not create an empty replacement table or run website migrations in the private management database. If 001–006 are already installed, apply only these new files once, in order:

1. `supabase/007_media_install.sql`
2. `supabase/008_notifications.sql`
3. `supabase/009_visitor_analytics.sql`
4. `supabase/010_enquiry_desk.sql`

Refresh the Supabase API schema if a newly created RPC is temporarily missing:

```sql
notify pgrst, 'reload schema';
```

## 2. Images and video

Uploads now inspect file signatures, including files whose browser MIME is blank. Supported formats: JPEG, PNG, WebP and PDF up to 10 MB; MP4 up to 20 MB. MP4 must use a recognised MP4 container brand; codec playback still depends on the device. Export iPhone HEIC/MOV as JPEG/MP4, or host a large video on YouTube/Vimeo and paste its share URL. Tracking parameters are removed from supported share links. Links to private, region-blocked or embedding-disabled external videos may not play for visitors.

The Storage bucket is private. Uploads show real transfer progress followed by server processing. Failed registration checks for an already-saved record before cleaning up the new file. Errors identify expired sign-in, unsupported formats, bucket/migration configuration and interrupted connections.

New images are selected automatically in the draft cover picker. Private photos/videos may be attached to drafts; they still require rights/guardian consent review and approval before submitting or publishing content. Use Media & consent, enter alt text/captions and permission references, submit review, then have a DIFFERENT administrator/publisher approve. The same account cannot approve its own submission. Only current approved media is publicly served; MP4 range requests support video seeking.

Test with a real small photo and MP4 on your deployed staging domain. A local byte-validation test does not verify your Supabase credentials, bucket or physical phone camera settings.

## 3. Install the admin PWA

Deploy over HTTPS, visit `/holyghost`, then use the browser install action. iPhone/iPad: open the website in Safari → Share → Add to Home Screen → open the installed AHF Admin app. Other supported browsers show an Install admin button when they offer the installation prompt, or an install action in their menu.

The PWA caches only its offline notice and icons. It does not cache authenticated HTML, staff APIs, enquiry records or sensitive documents. It provides an honest offline screen rather than pretending unsaved work has synced. Sign-in remains required, and stored credentials have not been added to persistent offline storage.

## 4. Configure VAPID push

From the `ahf-public` folder, generate your own public-website keys:

```sh
node scripts/push-keys.mjs
```

Add these runtime variables/secrets to the public Cloudflare Worker:

```text
AHF_VAPID_PUBLIC_KEY=YOUR_GENERATED_PUBLIC_KEY
AHF_VAPID_PRIVATE_KEY=YOUR_GENERATED_PRIVATE_KEY
AHF_VAPID_SUBJECT=mailto:YOUR_CONFIRMED_FOUNDATION_EMAIL
AHF_PUSH_DISPATCH_SECRET=YOUR_GENERATED_DISPATCH_SECRET
```

Do not paste private keys into chat, frontend source or Git. Use a separate key pair from the private management application. After sign-in/MFA, open Overview, Settings or Notifications, choose Enable device notifications, then Test notification. Permission is requested only after pressing the button. On iPhone/iPad, use the installed Home Screen app (iOS/iPadOS 16.4+). Push can arrive while the app is closed, subject to browser/OS permission, connectivity, battery restrictions and delivery policies; it is not a guaranteed alarm service.

Notifications cover new enquiries, assignments, content/media review changes and due follow-ups. Lock-screen text is generic: no beneficiary names or enquiry messages. The private inbox shows the latest 100 notifications; its page refreshes every 20 seconds while visible. Role changes and inactive profiles stop newly claimed device deliveries. Sign-out tries to remove this device subscription and unsubscribes it in the browser.

Requests that create enquiries or review updates try to dispatch a small push batch immediately. To send due reminders, retry failures and drain queued batches while nobody is using the app, deploy the optional **separate** Worker `deploy/push-scheduler.ts` with a `*/5 * * * *` cron trigger. Give that scheduler `PUBLIC_ORIGIN` (the website URL, no trailing slash) and `DISPATCH_SECRET` (same value as `AHF_PUSH_DISPATCH_SECRET`). Its authenticated POST to `/api/push-dispatch` also prunes expired visitor history. The endpoint is not accessible with an ordinary visitor key.

Scheduler deployment commands, when you choose to deploy:

~~~sh
pnpm exec wrangler secret put PUBLIC_ORIGIN --config deploy/wrangler.push-scheduler.jsonc
pnpm exec wrangler secret put DISPATCH_SECRET --config deploy/wrangler.push-scheduler.jsonc
pnpm exec wrangler deploy --config deploy/wrangler.push-scheduler.jsonc
~~~

Each run claims four device jobs; failed attempts retry after five minutes up to five attempts. Failed/expired subscriptions returning 404/410 are disabled. Under heavy notification volume, run the scheduler more frequently or increase measured dispatch capacity. Browser push delivery can repeat after an ambiguous failure; stable notification tags reduce duplicate displays. Confirm end-to-end delivery on your actual Android, iPhone/iPad and laptop.

## 5. Analytics after Overview

The dedicated Analytics page is restricted to active administrators with MFA. It provides live consented sessions (heartbeat in the previous two minutes), country filters, Kampala date ranges, sessions/anonymous visitors/page views, countries, daily trends, top pages, paged session history and a session-event drill-down. History pages contain 50 rows, up to 10,000 offset; drill-down shows the latest 200 events. CSV exports the current history page. Totals are computed server-side from the selected period, not from the visible table page.

Set `AHF_ANALYTICS_ENABLED=true` only when ready to enable the public consent banner. Analytics is disabled by default. Visitors can decline without losing access, and browser Do Not Track is respected. Opt-in creates a random browser visitor ID and session ID; database identifiers use a keyed hash. It records only public pathnames, action categories, timestamps, broad device/browser type, referrer HOSTNAME and Cloudflare's approximate country/region/city. It never stores raw IPs, GPS coordinates, full user agents, query parameters, form contents or identified visitor names. Country/city may be unavailable or inaccurate due to VPNs or carrier routing. Data is not linked to donation, beneficiary or enquiry records.

Privacy preferences lets a visitor stop collection and request deletion of their browser history. The browser ID is retained only if a deletion request fails, so they can retry; tracking stops immediately. Clearing local storage independently loses this deletion identifier; normal retention still applies. Analytics can miss people who decline or block scripts and can contain repeated clicks/bots; it is not a count of people helped or confirmed donations.

Visit histories are limited to 30 days. Cleanup runs when analytics records are received, on analytics dashboard reads, and through the configured scheduler dispatch endpoint. Configure the scheduler for expiry even during periods with no website traffic. Short-lived daily abuse-limit hashes are purged on later counting requests. Provider/account infrastructure may keep its own logs under your configured settings.

## 6. Enquiry desk

The list now supports open/status/type/assignee filters, priority ordering, assigned owner display and overdue follow-up labels. Open an enquiry to change priority, view the immutable activity timeline, compose a reply in your own email application, assign an owner/due time and record internal outcomes. Priority/assignment/status updates use server-side role and version checks; conflicting edits require reloading. Notes, emails and phone numbers remain private to administrator/enquiry-coordinator roles. Existing automatic acknowledgement/staff email jobs remain separate from push; configure the Resend settings from the main README.

## 7. Verify before operational use

Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, then `pnpm run build:cloudflare`. Deploy only when you choose. Complete real Supabase upload/review/playback, MFA, enquiry submission/email, consent/withdrawal, scheduler and physical-device PWA/push acceptance checks. No real staff push subscriptions, live keys or external services were available during development, so successful production delivery has not been claimed.
