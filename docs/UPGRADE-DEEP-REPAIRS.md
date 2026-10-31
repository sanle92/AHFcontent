# Deploying the 28 October 2026 repair set

This source update is based on GitHub main `93a48974a4389bb15abc6e47b10d2c3a8b0c6983`.
It has not been pushed or deployed. No hosted database migration has been run.
The public website content project stays separate from the private NGO-management system.

## 1. Replace source cleanly

Extract the ZIP into a **new empty folder**, then review it as the complete replacement source.
Do not overlay it on an older folder and assume missing files are removed. In particular,
`package-lock.json` and `public/robots.txt` must be removed; robots.txt is now an application route.
`REQUIRED-DELETIONS.txt` lists paths removed relative to the reviewed GitHub snapshot. GitHub's
Upload files operation does not itself remove older paths absent from a ZIP: apply those deletions
explicitly if using that interface. Keep deployed secrets outside source control.

Unreviewed source originals are no longer tracked or included in this ZIP. Existing local bytes
were preserved. Before removing any local copies, keep them in restricted storage. Existing git
history and the existing remote may still contain them; an authorized owner must review repository
visibility and historical sharing/consent. This repair did not rewrite history or establish consent.
`pnpm check:source-media` prevents accidentally adding those originals back to the source package.
Reviewed public image assets used by the site remain present.

## 2. Review and apply missing SQL to staging first

Back up the **website content** database and Storage bytes. Check which migrations are installed.
Original migrations 001–017 are unchanged. Do not rerun old non-idempotent migrations against an
existing project, and never apply website migrations to the private management project.

Apply missing migrations in order:

1. `018_deep_analytics.sql` — historical activity from actual in-range events; analytics reads stop pruning.
2. `019_publication_and_choices.sql` — bounded searchable choices, publication dependencies and slug redirects.
3. `020_operational_controls.sql` — diagnostics, pruning health, overdue reminders, guarded retention,
   dry-run orphan reporting, provider Retry-After handling and aggregate data-quality counters.
4. `021_bounded_publication_state.sql` — bounded current publication metadata and effective status filters.
5. `022_public_withdrawal.sql` — publisher/admin withdrawal of an old live snapshot while a new draft exists.

The new migrations are tested twice each in local PGlite; hosted Supabase remains a separate check.
The continuation fixes need no migration beyond 022; do not rerun already installed migrations.
After applying them, reload PostgREST's schema cache with `NOTIFY pgrst, 'reload schema';` or the
project's normal schema-refresh procedure. Stage schema and application changes together.

## 3. Install and validate

Use Node 22.18+ and the pinned pnpm version (11.25.0).

```sh
pnpm install --frozen-lockfile
pnpm check:source-media
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm audit
pnpm run build:cloudflare
```

Build and deploy commands remain `pnpm run build:cloudflare` and `pnpm run deploy:cloudflare`.
Preview remains `pnpm preview`. Nothing in CI applies migrations or deploys.

## 4. Existing secrets and optional controls

The blank `.env.example` documents all existing keys; no real credentials are included.
Existing Supabase, Turnstile, Resend, VAPID, public-origin and dispatch-secret configuration remains
required for those capabilities. Never place a service key in browser configuration.

- **AHF_CSP_ENFORCE:** blank/default keeps report-only CSP. Violations are counted through the
  first-party `/api/csp-report` endpoint. Only directive/day counts and bounded daily security tags
  are retained; report URLs, page contents and raw IP addresses are not stored. Validate real
  Turnstile, signed media, MFA and YouTube/Vimeo in staging before setting this to `true`.
- **AHF_ENQUIRY_RETENTION_DAYS:** blank disables retention processing. An authorized owner must
  approve a retention period first. Settings provides a preview and requires the exact phrase
  `ANONYMIZE CLOSED ENQUIRIES` before applying it. Only old, closed, unheld records without active
  email delivery qualify. Contacts/messages/notes and copied email text are anonymized; record
  references and necessary audit timestamps remain. Holds are administrator-controlled. This is
  not automatic deletion, and it does not erase provider inboxes or old backups.

Keep the existing protected scheduler on its five-minute cadence. It now creates due/overdue and
campaign-review notices even when external push credentials are absent, performs pruning and
records health. Settings warns when scheduler contact is missing or older than 15 minutes. A
separately configured monitoring path is still needed to alert when the entire app is unreachable.

## 5. Verify the reported submission problem

Use two active accounts with MFA in the same **staging website-content project**.

1. Author A uploads an image, saves a programme with it, and submits the media's rights review.
2. Leave A's programme editor open and type unsaved text.
3. Publisher B independently approves that exact media ID. Approving a different filename/ID is
   insufficient; all gallery/video references must also qualify.
4. Return to A. Focus/visible polling refreshes approval status without replacing unsaved text;
   **Refresh approval status** provides a manual recheck. Save the text, then submit the programme.
5. The private preview reloads after the version/status change. A cannot approve their own work.
6. B independently approves and publishes. Confirm public cards/detail covers and giving links.
7. Interrupt reads after a successful save and delay responses while closing/opening dialogs:
   returned writes remain applied and stale responses cannot reopen another editor.
8. Schedule a revision while an older version is live. The pending revision stays Scheduled until
   its own snapshot becomes effective. Then its badge/filter reports Published.
9. While a new draft is open, test **Withdraw public version now** as a publisher. The public
   snapshot is withdrawn and saved draft content remains available for another review.

Media can remain in browser/edge caches for up to five minutes. Public HTML advertises 60-second
shared freshness plus a stale-revalidation window. Previously downloaded copies and third-party
social caches cannot be revoked by a website media withdrawal alone.

## 6. Browser checks

Public smoke checks:

```sh
pnpm exec playwright install --with-deps chromium
pnpm test:e2e:public
```

The standard CI workflow runs these against a local unconfigured preview with no production secrets.
They check public routes, the 79px full-width header with a 1250px content cap across viewport sizes,
admin/API boundaries and the labelled read-only preview.

The opt-in **Isolated staging workflow check** is manually dispatched, uses the `staging` GitHub
environment and requires the phrase `ISOLATED STAGING`. Configure environment approval controls.
Its secrets are `AHF_E2E_STAGING_ORIGIN`, `AHF_E2E_AUTHOR_SESSION`, and
`AHF_E2E_PUBLISHER_SESSION`. The two session JSON objects must belong to distinct dedicated test
accounts, have MFA-verified access tokens, and contain `access_token`, `refresh_token`, `expires_at`.
Use fresh short-lived sessions; never paste them into source or issue comments. Tests redact token
values in CI and disable screenshots, video and tracing. No credentials were supplied or used here.

The staging test creates synthetic image/programme fixtures, opens two browser contexts, approves
media as the publisher, verifies synchronization without losing unsaved author text, checks the
post-submit preview and self-approval denial, then independently publishes and archives the test
programme. Use an isolated project with real-recipient delivery disabled. Remaining private test
media/drafts can be reviewed through the admin; the test grants no new deletion or approval powers.

This runtime cannot start the Worker preview because `uv_interface_addresses` fails. Browser tests
were enumerated and typechecked, and a run was attempted, but no successful browser or real-device
run is claimed. Validate the CI result and configured staging flow before production.

## 7. Operational decisions that code cannot supply

Confirm repository-photo permissions/history access, the retention period and legal holds, actual
provider delivery configuration, independent monitoring, recovery contacts and a database-plus-file
restore drill. Check physical Android, iPhone/iPad Home Screen and desktop notifications, including
closed-app behaviour. Confirm approved privacy wording includes minimized security diagnostics.
These are deliberate release gates, not claims that production was verified by local tests.
