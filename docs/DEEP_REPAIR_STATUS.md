# Deep-review repair status — 28 October 2026

Base: GitHub `93a4897`. Branch: `repair/deep-review`. Review-only findings have now been implemented
as source changes, with the operational gates below explicitly retained. No deployment or live
migration was performed. See UPGRADE-DEEP-REPAIRS.md before replacing an existing source tree.

## Verification

- 89 local tests pass, including existing consent, RLS, MFA and independent-approval tests.
- Typecheck, lint and Cloudflare build pass; formatting/source-package checks are included.
- Full dependency audit: zero advisories after the mature fast-uri 3.1.9 patch. Release-age and
  supply-chain policies remain enabled. Playwright 1.58.2 is a pinned development-only dependency.
- New migrations 018–022 run twice each in local PGlite. Existing 001–017 files are unchanged.
- Browser tests enumerate/typecheck. Public browser execution was attempted but Worker preview
  cannot start here (`uv_interface_addresses`). No hosted Supabase, provider, physical-device,
  deployed edge-cache, CSP-enforcement or GitHub Actions execution is claimed.

## Finding-by-finding implementation

| Review finding | Change / practical limit |
| --- | --- |
| 01 Approval synchronization | Authenticated readiness endpoint refreshes on focus/visibility and visible polling; manual refresh; transition rechecks current rights, consent and all references. Dirty fields are preserved. |
| 02 CI lint failure | MFA apostrophe corrected; no lint rules disabled. |
| 03 Stale editor completion | Editor operation tickets, current-operation busy handling, fenced completions and protected dialog close during outstanding mutations/uploads. |
| 04 Successful write / failed refresh | Apply returned row/version immediately; ancillary reads do not determine whether a completed save succeeded. |
| 05 Navigation views | Pathname-dependent consent collector records committed public navigation; lifecycle regression test. |
| 06 Idle sessions | Session chosen before each event, with a 30-minute gap and blocked-storage handling; current presence labelled separately from interaction. |
| 07 Custom page analytics | Shared public path validation accepts custom single-slug pages while excluding private roots and parameters. |
| 08 Historical activity | SQL 018 requires in-range events instead of a timestamp span; gap and midnight tests. |
| 09 Dashboard request ordering | Serialize periodic requests, ignore obsolete filter/unmount results; older history pages pause automatic refresh. |
| 10 History request ordering | Latest-selection request ticket and identifying session heading. |
| 11 Unbounded contexts/Home | Searchable 50-row choices retain saved and unsaved selected IDs; light related summaries; bounded Home sections and 12-campaign pagination. |
| 12 Pruning on reads | Analytics reads are side-effect free; protected cron prunes and records maintenance health. |
| 13 Scheduled/live state | Bounded publication-state RPC compares the exact current version; effective badges and filters distinguish an older live version from a pending scheduled revision. |
| 14 Giving dependencies | Server readiness plus database trigger require a published related campaign; no campaign is auto-published. |
| 15 Media errors | Actual absence/withdrawal stays 404; backend failures become controlled 503 responses; error responses stay uncached. |
| 16 Dependency deadlines | Database/auth/media operations have bounded deadlines; uncertain writes are reconciled rather than blindly retried. |
| 17 Ownership-aligned UI | Author/admin edit/submit gating, read-only notice and disabled fields; publisher previews and independent review remain available. |
| 18 Repository originals | Originals excluded from tracking/current ZIP; local bytes preserved; CI guard prevents reintroduction. Existing remote/history access still requires owner review. |
| 19 Retention lifecycle | Administrator-only preview, holds, policy cutoff and typed-confirmation anonymization; disabled by default until period is configured. No automatic file deletion. |
| 20 Analytics caps | Preserve abuse caps and expose aggregate rate/session-drop counters; no raw IPs or another tracker. |
| 21 CSP release state | First-party minimized directive counters and explicit enforcement setting. Default remains report-only until configured browser validation passes. |
| 22 Old URLs | Publication-aware aliases with collision prevention; fixed foundation URLs protected; only current public targets resolve. |
| 23 Hygiene/dependencies | One pnpm lockfile, blank env template, mature patched fast-uri; zero audit findings at verification time. |
| 24 Filter validation | Real calendar dates, ordered ranges, finite integer offsets and country/session identifiers validated. |
| 25 Cache versioning | Hashed assets immutable; mutable images/icons revalidate within five minutes. |
| 26 Brand payload | Same supplied design optimized to a 46,914-byte versioned WebP; favicon to a 10,096-byte versioned PNG; header dimensions retained. |

Additional protection: migration 022 permits only a publisher/admin with current MFA to withdraw an
older public snapshot while a newer draft exists. Saved content remains for another review.

## Continuation checks

Additional lifecycle tests reproduced and fixed two remaining late-response paths: an editor reload
could clear a different record opened afterward, and old editor-choice/revision failures could appear
in the new editor. Reload results and errors now respect the current editor generation.

Publishing now updates the displayed live timestamp immediately from the database mutation timestamp,
including the withdrawal control, instead of retaining an older timestamp or waiting for a reopen.
Preparing another draft preserves the existing live timestamp; withdrawal clears it. The workspace
and dialog receive the same resulting record. No migration, permission or publishing rule changed.

The approval hook is also tested for independent approval refresh, duplicate focus events, switched
records, version conflicts, hidden tabs and late completion after unmount. These tests supplement the
two-account browser workflow; they do not replace configured staging or real-device checks.

## Automations now implemented

- Approval status refresh and pre-transition readiness checks.
- Due/overdue enquiry notices with daily deduplication, including items older than seven days.
- Stale campaign information review notices to administrators, without invented fundraising totals.
- Lease-aware email/push retry, bounded jitter and provider Retry-After deferral; stale lease
  completion cannot overwrite newer ownership.
- Scheduled pruning, maintenance/contact health and visible missing-scheduler warnings.
- Minimized CSP diagnostics and analytics-quality counters.
- Administrator retention preview/holds/confirmed anonymization and dry-run orphan-media review.
- CI public browser smoke test and separately authorized two-account staging workflow test.

No automation approves consent, publishes unreviewed stories/media, changes staff roles, verifies a
fundraising recipient, infers donations from clicks, or deletes original files. Restore drills,
independent outage alerting, historical repository sharing, retention policy choice and live-device
checks require the owner's actual infrastructure and decisions.
