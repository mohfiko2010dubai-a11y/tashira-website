# REPLY 08 — actual Stripe TEST verification, 2026-10-03

Staging candidate **0492e73e056f22d06110f4163b8560a2148169a5** is deployed. Production remains closed and unchanged at **9e589e0e0d751f314fea1c671db469f1b7161293**. This is a staging acceptance checkpoint, not completion of Phase 1 or clearance to launch.

## 1. The deadlock was an application defect

`api/lib/operations/mysql-controlled-write-executor.ts`, `lockCase`: two concurrent commands used `INSERT IGNORE` for the same case, retained shared locks and then both attempted an exclusive `SELECT ... FOR UPDATE`. This was a real InnoDB lock-upgrade deadlock, not parallel test suites contaminating one another.

The application fix acquires the application's exclusive row lock first, then inserts/locks its case, then rechecks idempotency after waiting, then reads/locks the document controls and persists the command. Test assertions were not weakened. Separate historical fixture deficiencies were also repaired; they are documented in REPLY07.

## 2. Rendering and retry behavior

- `financial-document-series.ts`: `prepareFinancialDocument` reads an advisory candidate number and renders/hashes the PDF **before BEGIN**. `issueFinancialDocument` performs SQL only: verify replay identity, lock counter, check candidate, insert immutable PDF archive, advance counter.
- `payment-state.ts`: paid state, invoice row, archive and number commit together. A stale candidate/deadlock/lock timeout rolls back; the caller waits and prepares a fresh PDF outside the transaction. No Stripe call, external storage operation or rendering occurs while the counter lock is held.
- Lock wait is bounded to 2 seconds per attempt, with up to 32 attempts and 25–500 ms backoff plus jitter. Exhaustion leaves accounting pending; confirmation/webhook retries reuse the already-paid intent. It does not create another charge. The customer UI distinguishes payment success awaiting accounting from card failure.
- Isolated MySQL stress: 20 concurrent issues, 108 candidate collisions retried, maximum measured transaction 39.48 ms in that synthetic run (includes waiting and SQL/commit, not production p95). Rollback/replay/year-boundary/archive-immutability tests pass.

## 3. Actual staging results

| Requested case | Result |
| --- | --- |
| Successful Stripe TEST payment | `TEST-INV-00001`. One invoice/one immutable archive. Printed number matches the ledger; authenticated HTTP bytes match archive SHA-256. |
| Two simultaneous Stripe TEST payments | `TEST-INV-00002` and `TEST-INV-00003`; both archives present, no duplicate or gap. |
| Deliberate decline | Stripe actually returned HTTP 402 / `card_declined` using its declining test PaymentMethod. No invoice or consumed number. |
| Abandoned payment | An unconfirmed TEST intent was cancelled without payment. No invoice or consumed number. |
| Stripe success followed by local failure | A trigger rejected archive insertion **only for the synthetic fault order**. Stripe succeeded, local confirmation failed, paid-state transaction rolled back and counter stayed unchanged. Removing the trigger and replaying twice produced exactly `TEST-INV-00004`. Trigger absence subsequently verified. |
| Refund | Actual $30 Stripe TEST refund succeeded. Deployed backend helper issued `TEST-CN-00001`; replay was idempotent and TEST-INV stayed at 4. This exercised Stripe + backend accounting, not the administrator UI. |
| Original live invoices | Applications 40/41 retain `INV-TSH-273938` / `INV-TSH-123450`. Both original PDFs opened through their authorized production HTTP sessions with SHA-256 matching on-disk originals. No regeneration, renumbering or resend. |
| Next live number 00003 | Approved mapping and next `TSH-INV-00003` pass the isolated MySQL rehearsal. **Not yet installed or exercised in production.** No live charge was made to prove a counter. |

Evidence: `REPLY08_STRIPE_RESULTS.json`. Synthetic orders are classified TEST, with example.invalid contacts; staging outbound customer mail remains disabled. Initial UAT failures were an obsolete policy-version fixture (rejected before creation) and the real upload rate limit. Fixture was corrected and requests resumed after the limit; neither validation nor rate protection was disabled. One transient SSH timeout did not affect public HTTP 200 health.

## Deployment and quality evidence

- Stage migration058 identity checked against `tashira_staging` / `tashira_staging_app`; separate backup `/var/backups/tashira-staging/2026-10-03T18-22-18-855Z-reply08-ledger/tashira_staging.sql` before additive tables/triggers.
- Guarded deployment ran typecheck, lint, 1183 unit/component tests and complete client/SSR/backend build successfully. The general test command still displays the 26 gated integration skips; the **separate actual MySQL run passed all 26 with zero skips**. These are distinct runs, not a claim that the general run executed them.
- `.github/workflows/ci.yml` defines the permanent MySQL service/job and the runner fails unless all 26 pass with zero skips. **Remote hosted CI has not yet been published/verified.** Current staging deploy wrapper does not itself invoke this additional job; the integration gate was executed separately for this candidate. This operational gap remains open.
- Stage wrapper final local/public health 200; source SHA checked after deploy. Production code/schema/legacy invoice bytes unchanged.

## Remaining work, not hidden by the passing staging tests

Production is substantially older: its payment finalizer lacks the current transaction layer, its schema lacks the newer event fields and it has no current `refund-router.ts` or Operations pool. Copying the entire staging branch would not be an invoice-only deployment. A separately built and verified production integration package is required, including its refund path, before migration058 and the owner-approved two-document mapping can be installed there.

The original 15 unrelated dirty files remain preserved. Remaining Phase 1 residence/availability/submitted-product/Stripe-fee work is not completed by this report. Production stays closed.
