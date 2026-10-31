# Repair verification and release handoff

**Superseded by the 28 October deep repair set:** see UPGRADE-DEEP-REPAIRS.md and
DEEP_REPAIR_STATUS.md. The following records the earlier repair handoff.

Started 25 October 2026 (Africa/Kampala). This branch builds on the seven earlier review-hardening
commits; GitHub main was still `7dfaf22` when the review began. No deployment, live migration,
public-content publication or real email/push dispatch was performed.

## Verified locally

- Node 24.22.1 and the official Node 22.20.0 binary (download archive SHA-256 verified).
- pnpm 11.25.0; frozen-lockfile installation in a separate checkout with a fresh node_modules tree.
- Typecheck, all **69 tests**, lint with no errors/warnings, formatting check and Cloudflare build.
- Original security/consent tests remain. New tests reproduce publishing errors, cover rendering,
  fixed-page duplication, server response decoding, deletion while logging is disabled, streamed
  multipart/JSON limits, session-capability rejection across logins, idempotent receipt, email backoff/lease
  ownership, exhausted push leases, service-only claims, larger batches, cross-midnight analytics,
  >1,000-record staff search, gallery batching, media references, conditional/range media responses,
  canonical metadata, safe status mapping, review navigation, same-login token rotation, account-owned
  device state/cleanup and reviewed programme/page details.
- Migrations 011–017 run twice in local PGlite to check repeatability. Existing 001–010 SQL files
  are unchanged. The local database harness does not substitute for a hosted Supabase staging test.
- Production dependency audit: **0 advisories** at verification time. Full audit: **2 low and
  2 moderate**, all for build-only fast-uri 3.1.8 through webpack schema validation. No high or
  critical findings remain. Version 3.1.9 was blocked by the repository's seven-day release-age
  policy; that safeguard was retained. See DEPENDENCY_REVIEW.md. Reassess once the patch is mature.
- Runtime builds still report Vinext's static route-classification limitations; these are warnings,
  not passed browser/runtime checks. GitHub Actions itself has not executed in this session.

## Finding-by-finding status

The numbers match the complete code-review report. “Implemented” means code and the relevant local
checks are complete; it does not imply successful delivery by a configured external service.

| Review | Repair / result |
| --- | --- |
| 01 | Editorial RPC rejections are awaited inside the JSON error boundary; all mutation branches tested. |
| 02 | Shared browser decoder handles non-JSON/empty responses; staff, public enquiry and auth/config paths use it. |
| 03 | About/custom covers render their approved published asset; SSR regression tests cover About/custom/contact. |
| 04 | Same-login token rotation preserves drafts; cross-login/aal1 capabilities are rejected before/after transport. Logout clears private state and revokes only its account device. Real shared-device flow remains a staging test. |
| 05 | Forget requests reach the deletion RPC even while new recording is disabled; failures retain retry identifiers. |
| 06 | Consent changes synchronize across tabs; requests recheck consent and stop on cleanup. A private 30-day revocation marker serializes deletion against queued writes. Multi-tab browser verification remains. |
| 07 | Runtime/production audit cleared. Four build-only advisory findings remain pending the release-age window; no claim of full advisory clearance. |
| 08 | JSON and multipart streams have actual byte ceilings; extra files/fields are rejected; oversized requests return 413. |
| 09 | Existing protected scheduler drains due email with leases, backoff and review limits. Requires scheduler and Resend configuration. |
| 10 | Enquiry receipt returns promptly; background work uses waitUntil; unchanged retries use a private 24-hour idempotency mapping. |
| 11 | Push drains up to three batches of sixteen per call, with a bounded provider timeout; queue counts/last scheduler contact are visible to administrators. |
| 12 | Exhausted leases finalize; lease tokens reject stale completion, including legacy callers. |
| 13 | Tests filter the queued notice and requesting device; provider acceptance still does not prove OS display. |
| 14 | Media proxies Range/If-Range/ETag conditions and preserves 304/416; origin approval precedes conditional handling. |
| 15 | Withdrawn covers/failed images show neutral placeholders; authorized media review lists draft/published references. Withdrawal remains enforced. |
| 16 | Dirty forms warn before close; unsaved drafts cannot be submitted; media approval blockers and reviewer handoff are explicit. |
| 17 | Decimal steps and serialized update limits match validation; mutation schemas reject incomplete actions before RPC calls. |
| 18 | Existing page records override fixed-page introductions once; Home/Kids bodies, reviewed page/programme details, optional Home video/vision/mission and Home SEO are connected; optional approved faith/team pages manage those sections. Default supplied copy remains. |
| 19 | Request-scoped kind+slug reads are shared with metadata; complete reads handle backend row caps and known totals avoid extra EOF calls. |
| 20 | Private/API/RSC/personal responses remain no-store; public HTML/static/media use bounded policies. Actual edge caching still depends on Cloudflare configuration. |
| 21 | All approved assets are resolved in batches of at most 200; no tail truncation. |
| 22 | Kind+slug metadata, Home SEO, canonical Kids URL and kind-aware sitemap mapping. |
| 23 | RLS-protected server-side 50-row paging/search/exact totals; editor/enquiry context loads only on opening; legacy responses remain complete. |
| 24 | Overview action totals use the same consented visit-event pipeline as analytics; no duplicate collector enabled. |
| 25 | In-range events count across session-start boundaries; starts/active visitors/live definitions and Kampala dates are explicit. |
| 26 | Retention stays out of visit ingestion; first_seen, visit/event and publication/maintenance indexes support frequent queries. |
| 27 | Report-only CSP with script nonces, self-hosted fonts and HTTPS-only HSTS. Enforcement remains gated on staging verification. |
| 28 | New migration escapes every provider hostname; JavaScript allowlist and redirect protections remain. |
| 29 | Dispatch secret uses constant-time derived-byte comparison. |
| 30 | Controlled JSON errors distinguish 400/401/403/409/413/429/503; parser/database internals are not echoed. |
| 31 | Typed boundaries/runtime schemas and zero-error, zero-warning lint; no rules disabled. |
| 32 | Formatting and focused content/media/enquiry/session/API/paging modules; claim/send/finish steps are named. |
| 33 | CI pins Node 22/pnpm 11.25.0 and checks frozen install, formatting, production high-severity audit, lint, types, tests and build; never deploys. |
| 34 | Removed unused starter scaffolding/Drizzle/resolver dependencies, kept required preview scripts, one lockfile, blank .env.example and root-path documentation. |

## Import the branch

The Git bundle contains `repair/complete-review`, including the seven ordered hardening commits
and subsequent fixes. Nothing was pushed to GitHub. In an existing clone, first save any local
work, then import and review the branch without resetting main:

```sh
git fetch /path/to/AHFcontent-complete-repair.bundle repair/complete-review:repair/complete-review
git switch repair/complete-review
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
pnpm run build:cloudflare
```

For a new local checkout instead:

```sh
git clone --branch repair/complete-review /path/to/AHFcontent-complete-repair.bundle AHFcontent-reviewed
```

## Apply in staging before production

1. Back up the **website content** database and Storage objects. Never apply these migrations to the
   private NGO management project. Check which migrations are already applied; do not rerun old
   non-idempotent migrations. Review and apply only missing 011–017 in order, then refresh the API
   schema cache. None were applied to a hosted project by this work.
2. Install/build this branch with the pinned pnpm version. Keep service keys, Turnstile/Resend/VAPID
   secrets and dispatch secret in Worker secrets, outside browser assets and git.
3. Configure the existing scheduler to call the protected dispatch endpoint every five minutes.
   It now handles both email and push. Check Settings for recent scheduler contact and queue age.
4. Use two separate active staff accounts. Verify password → MFA, role visibility, rejection of
   self-approval, version conflict, save → review → independent approval → publish/schedule/archive.
5. On phone/tablet/desktop, upload JPG/PNG/WebP/PDF/MP4 and exercise byte limits and unsupported
   HEIC/MOV messages. Verify draft privacy, approved covers, Kids galleries, MP4 seeking and lightbox.
6. Withdraw media and check references/placeholders, conditional requests and expiry of cached
   copies. **Approved media may remain cached for up to 300 seconds.** Public HTML advertises
   s-maxage=60 and stale-while-revalidate=300; verify the deployed Cloudflare cache rules.
7. Test Turnstile hostname/action/token expiry. Submit a real test enquiry using an authorized
   test recipient; interrupt/retry an unchanged form and verify one receipt and one outbox pair.
   Test Resend rejection/recovery, accepted-versus-delivered status and manual review cases.
8. Test push on Android, desktop and iPhone/iPad Home Screen installation, including closed app,
   blocked permissions, logout/shared-device account switching, disabled/expired subscriptions and
   queues larger than one batch. OS/browser settings can suppress popups after provider acceptance.
9. Test consent decline, allow, cross-tab withdrawal, delete while recording is disabled, service
   outage/retry and idle-session behaviour. Confirm visit-history retention and deletion markers.
10. Inspect report-only CSP messages and real Turnstile/YouTube/Vimeo playback. Enforce CSP only
    after these configured checks pass. Confirm HSTS on the intended HTTPS domain/subdomains.
11. Confirm foundation contacts, registration wording, safeguarding channels, public-story consent,
    retention procedures, verified giving recipients and account/MFA recovery. These are approved
    operational inputs, not facts this code can invent or automatically publish.

Local Worker preview remains blocked by this environment's network-interface system error
(`uv_interface_addresses`, ERR_SYSTEM_ERROR), including Node 22 and loopback binding. That prevents
claiming a completed browser/real-device pass here. No preview failure was worked around by weakening
security or modifying framework/native code.

## Boundaries

The existing merchandise section remains a catalogue/enquiry flow, not paid checkout or inventory.
Full email conversations, new payment services, private NGO operations and new tracking services are
outside this repair. No detailed beneficiary records or children's contact data were added. Approved
public content and current private access rules remain the source of truth.

### Source-media access boundary

Original review photographs remain tracked under source-materials as requested by the original
project setup. They are excluded from deployed web assets, but repository readers can obtain them
from git independently of website RLS/consent checks. Confirm their authorization and repository
visibility. This review does not establish consent for repository sharing. No originals were deleted
and no remote visibility/history was changed; a website fix cannot revoke existing git copies.

## Programme cover follow-up

The programme listing and Home programme cards previously omitted the cover field entirely. They
now render selected programme covers; the detail page retains its cover. Approved metadata is used
on the programme listing/detail views, and withdrawn media remains unavailable. Cover selection and
new uploads immediately request the existing authenticated private preview. Newly uploaded options
remain selected even before a list refresh, removal marks the form dirty, and stale preview requests
cannot replace a later selection. Saving is blocked while the cover upload is still in progress. Regression tests cover these paths.
No SQL migration is added.

To make a new cover public: select/upload it and save the programme draft; complete the image's
rights/consent fields in Media & consent and obtain independent media approval; then submit the saved
programme for independent review and publish the approved version. Selecting a file alone does not
replace the live snapshot. Check the media is Approved and the programme is Published, rather than
Draft, Review, Approved-but-unpublished, or Scheduled for the future. Previously documented public
cache windows still apply. These changes have not been deployed or verified against a live project.


## Saved cover after submission — 26 October 2026

A regression test now reproduces the reported sequence: an image is visible, the actual content
editor's Submit for review handler is clicked, and the version change rebuilds the form. Previously
the new CoverPicker retained the saved cover ID but reset its signed preview URL to empty and never
requested another preview. The test failed on that exact missing-image assertion before this fix.

The picker now automatically requests an authenticated private preview on mount, including after
save, review and reopening. Read-only reviewers can also view/reload the preview; editing remains
locked while submitted. A stable callback avoids repeated signing on unrelated form updates. Loading
and errors are visible, retry refreshes the short-lived URL, and changed/unmounted previews ignore
late responses. The existing upload/selection regression test now runs effect setup/cleanup instead
of omitting effects. No test was removed and no preview URL is persisted in content or local storage.

Additional local SQL assertions check that the cover ID survives Draft → Review → Approved →
Published and that reviewing a later draft preserves the existing public cover. Media approval,
rights/consent, MFA, independent review and public access rules remain enforced. No SQL migration
or API response change is needed. Hosted Supabase and real browser/device verification still remain
staging checks; this update is supplied as source and has not been deployed.
