# TASHIRA Stabilization Progress

## Phase 9 launch-blocker closure (2026-08-11)

- Initialized the lightweight project director in `AGENTS.md`, `PROJECT_DIRECTOR.md`, and `PROJECT_STATUS.md`.
- Rechecked external staging prerequisites: `staging.tashiraev.com` has no public DNS/TLS yet, and staging has no Stripe TEST or sandbox-mail credentials configured.
- Classified all 24 dependency findings and applied only compatible targeted updates, reducing the audit to 18 findings (1 low, 9 moderate, 8 high). A broad lockfile update was rejected because it produced an `npm ci` inconsistency.
- Aligned React Router imports and packages on the existing v6 runtime, removing the verified `/staff` fallback crash without changing route behavior.
- Added route-level lazy loading. The main client chunk decreased from about 3.4 MB (704 KB gzip) to about 1.19 MB (232 KB gzip); XLSX, invoice, and the 35.1 MB server bundle remain optimization targets.
- Corrected the chatbot's canonical visa code, registered payment route, and server-authoritative quoted total. Added two focused tests.
- Isolated staging is running commit `ff6faff8e01ab3afb4254a1cb6395847246e893c`; TypeScript, ESLint, 58/58 tests across 21 files, build, and GitHub Actions run `31469999903` all pass.
- Family per-applicant capture and document ownership/resume remain active product work. Public staging, Stripe TEST, mail delivery, and authenticated external UAT remain blocked on environment inputs.
- Production and `main`/`master` were not changed. The preserved stash and production-audit artifacts remain untouched.

## Phase 8 staging migration and UAT (2026-08-11)

- Reviewed and hardened migration 005, including restrictive foreign keys, indexes, long-date compatibility, rerunnable triggers, and explicit MySQL-safe constraint names.
- Provisioned an isolated native staging runtime at `/var/www/tashira-staging` using only `tashira_staging`, `tashira_staging_app`, staging filesystem storage, `tashira-staging`, and `127.0.0.1:3002`.
- Applied migration 005 only to staging and verified 22 tables, 11 foreign keys, 77 index entries, and 16 append-only triggers.
- Verified single, family/GCC, server pricing, immutable price versions, synthetic filesystem upload, timeline, checkout abandonment, risk, evidence manifest, finance/VAT calculations, and legal-hold behavior.
- Fixed local-storage metadata so new application and wizard document rows record `local/local` instead of legacy Supabase defaults.
- Current staging code commit: `c30313be87b0b6288c7a55154d09ced0571b23af`.
- Current gates: TypeScript PASS, ESLint PASS, 56/56 tests PASS, build PASS, GitHub CI PASS.
- Launch Candidate status: not yet qualified. Public staging DNS/TLS, Stripe TEST, sandbox mail/recovery, full authenticated browser UAT, owner-approved business settings, and dependency-audit triage remain blockers.
- Production and main/master remain untouched; the preserved stash remains intact.

## Current phase

Phase 7 business architecture is implemented on the review branch: server pricing snapshots, versioned company/finance settings, finance/VAT/analytics cockpit, explainable risk and health metrics, document lifecycle evidence, recovery/email abstractions, and retention/legal-hold/MySQL immutability architecture.

The second implementation group adds signed Stripe TEST webhooks, shared idempotent payment finalization, protected invoice delivery, real owned-application tracking, safe failed-document retries, and explicit staging-only secret wiring. The safe Phase 6D work is complete; remaining items require the product or production decisions recorded in `BLOCKED_DECISIONS.md`.

## Completed commits

- `d8d2125c27c8b15a524813f40aab9cb2fb3d800b` — `chore(types): remove safe unused TypeScript code`

## Current CI status

TypeScript checking and lint succeed locally. The expanded Phase 7 suite passes 53 tests across 19 files. The production build is verified before each review-branch push.

## Errors fixed by category

- Safe unused TypeScript cleanup: 29 diagnostics.
- Chatbot mutation identifiers and inferred mutation callback types: 15 diagnostics.
- Document/storage query, mutation, signed-URL, and numeric file-size types: 5 diagnostics.
- Legacy storage REST response narrowing and static-path module shadowing: 4 diagnostics.
- Canonical USD payment, invoice, and PDF field reconciliation: 8 diagnostics.
- Admin analytics, application status, applicant-count, and form-state consumers: 14 diagnostics.
- Wizard/chat enum and normalized application-column reconciliation: 4 diagnostics.

## Remaining errors

- None at the TypeScript compiler level.
- Lint: no errors or warnings remain (down from 149 errors and 4 warnings).
- Tests: 17 tests pass across 5 files, including filesystem-path, traversal, filename, MIME, and decoded-size coverage.

## Blocked decisions

- Wizard/chat partial-application persistence requires a verified mapping to the normalized `applications` and `applicants` tables.
- Payment amounts, currency, fees, VAT, exchange-rate policy, authentication policy, production schema, and production storage remain protected decision areas.
- No legal or business retention duration is approved for timeline, payment evidence, policy acceptance, evidence manifests, or customer documents. Legal holds, deletion requests, backup lifecycle, dispute windows, and database-level append-only enforcement require explicit decisions before production activation.

## Tests added

- Error normalization, cookies, and HTTP-client behavior.
- Canonical local document write/read/delete path behavior.
- Rejection of filesystem paths outside the configured storage root.
- Shared filename sanitization, MIME allowlisting, and decoded-size verification.
- Signed customer application capability-cookie verification, tamper rejection, and production cookie attributes.
- Stripe webhook signature, timestamp, tamper, and live-mode rejection coverage.
- Exact customer application-reference authorization and privileged staff/admin access coverage.
- Timeline document-event classification, strict payment-failure sanitization, and deterministic evidence-manifest checksum coverage.

## Commands run

- `npm ci` — succeeded using the committed lockfile.
- `npm run check` — succeeds.
- `npm run lint` — succeeds.
- `npm run test` — succeeds with 17 tests across 5 files; the initial run correctly failed because no test files existed.
- `npm run build` — succeeds; the generated `dist/boot.js` output was not retained as a source change.
- `npm run check -- --force` — used during local reconciliation to bypass stale incremental build metadata.

## Risks and follow-up work

- TypeScript build-mode metadata under `node_modules/.tmp` can suppress repeated local diagnostics; forced checks are used while stabilizing.
- No production system, data, deployment configuration, or secrets have been accessed.
- Critical authorization, payment verification, and document-ownership work remains blocked on approved architecture decisions; see `PROJECT_READINESS_REPORT.md`.
- `CUSTOMER_SESSION_SECRET` is now required before the ownership capability can be enabled in any runtime; no production configuration was read or changed.
- Multi-applicant chatbot collection and customer document replacement remain in the active Phase 6D queue.
- Invoice HTTP authorization and Stripe TEST webhook handling are implemented on the review branch; endpoint registration with Stripe remains an environment operation and has not been performed.
- The chatbot still collects one applicant record even when a family count is selected. Completing 2..n applicant capture requires a reviewed UX/data-flow change and remains an active decision.
- Checkout abandonment is deliberately best-effort because browsers cannot guarantee an asynchronous close event. It is an analytics signal, not proof of customer intent.
- The application exposes no timeline update/delete API and parent foreign keys are restrictive; database-trigger enforcement and migration rollout have not been applied to any environment.
- No card number, CVC, expiry, Stripe iframe content, typed payment field, screenshot, keystroke, payment-screen recording, or raw Stripe payload is recorded.
