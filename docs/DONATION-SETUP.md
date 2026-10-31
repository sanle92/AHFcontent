# Donation page work in progress

This source adds editable, publicly displayed bank and merchant details. It does not connect DPO
checkout or record or verify donations. The website clearly shows online checkout as unavailable.
Never interpret visits, messages or a return URL as a successful payment.

Before testing, back up the **website-content** project and apply missing migrations through 022,
then 023_donation_details.sql. Never apply website SQL to the private management database. Do not
rerun earlier non-idempotent migrations. Refresh the PostgREST schema cache after migration.

In Settings, choose the website settings editor. An active administrator with MFA can enter public
bank details and MTN/Airtel merchant details. Save, submit for review, and have a different
publisher approve before publishing. Only complete bank or merchant cards show publicly. Confirm
account ownership, recipient and payment instructions independently before publishing. Edits
are retained in revisions, so enter no passwords, private keys or sensitive identity documents.

Still required: implement and review DPO hosted checkout, a durable private transaction ledger,
request throttling, callback and server-side verification against DPO including amount, currency,
merchant and unique reference, idempotency and reconciliation, donor privacy/retention, pending and
failed flows, and DPO sandbox tests. Confirm eligibility, currencies, merchant onboarding and
service identifiers with DPO before activation. No live transaction or provider test has run.

## DPO ledger foundation (not activated)

Migration 024 adds a private minimal transaction ledger and a service-only confirmation function.
The local verifier checks paid result codes, amount and currency; it is not connected to a DPO API,
checkout or callback. Do not enable donations or mark payments confirmed using this code alone.
Server-to-server verification and reconciliation must be implemented and sandbox-tested first.
Migration 024 has not been applied to a live project.

## DPO server client (still disabled)

The source now includes a fixed-endpoint DPO create/verify client with bounded responses and mocked
local tests. Nothing invokes it from a public route. A verification uses `VerifyTransaction=0`;
the final provider acknowledgement, durable idempotent ledger workflow, callback, reconciliation,
abuse protection and DPO sandbox validation remain necessary before accepting payments. Do not
set production credentials or enable donations until those pieces have been independently verified.

## Reservation workflow (still disabled)

Migration 026 adds service-only reservation and provider-token binding primitives. Reusing a
reference cannot create a new provider transaction; mismatches are rejected. The local orchestration
returns a reconciliation state if creation or binding is uncertain. These helpers are not connected
to public routes. Callback handling, reconciliation, abuse controls and DPO sandbox testing remain
required. Do not activate live donations from this work-in-progress package.

## Verification and acknowledgement helpers (still disabled)

The local reconciliation helper checks the provider first, records a matching payment through an
injected ledger function, and only then sends DPO's acknowledgement. Failures before recording are
not acknowledged; an acknowledgement failure is returned separately for retry. These are isolated
helpers, not a running payment service. In particular, there is no durable acknowledgement queue,
public checkout, callback endpoint, or reconciliation scheduler. DPO may report a converted
currency: the current exact-currency check deliberately sends such cases for manual review.
Provider response formats, merchant ownership and all callback scenarios must be verified with
DPO-issued sandbox credentials before this can safely be enabled.
