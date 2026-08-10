# TASHIRA Staging Functional Test Report

## Executive result

- Audit date: 2026-08-10 (Asia/Dubai).
- Development branch: `devops/deployment-safety`.
- Tested fix commit: `ee6a3f9c796089c565c20f074dc5e4fdab01535b`.
- Production was not used as a staging environment and was not contacted or modified.
- Static frontend staging preview: available locally at `127.0.0.1` during testing.
- Full integration staging environment: **not available**.
- Launch readiness: **52%**.
- Production deployment recommendation: **not safe yet**.

The repository passes TypeScript, ESLint, all 35 automated tests, and a production build. Static visitor routes and important UI state changes were smoke-tested in a browser. A complete staging runtime could not be created safely because no isolated MySQL instance, staging environment file, Stripe TEST credentials, mail sandbox, or staging storage configuration was available. Docker and MySQL are not installed locally, and the checked-in Compose configuration is not suitable for secure staging without revision.

No integration flow that could only be exercised against production was attempted. Blocked flows are reported as blocked, not passed.

## Staging environment assessment

| Component | Status | Evidence |
|---|---|---|
| Node runtime | Partial | Local Node 24.13.0 was available through a bundled runtime. CI and production use Node 20, so CI remains the compatibility authority. |
| npm | Partial | npm 11.6.2 was available through a local cached installation. Lifecycle scripts could not find `node` on PATH, so the exact tools were invoked directly without changing system configuration. |
| Dependencies | Available | Existing `node_modules` was used. No package installation occurred. |
| Frontend preview | Pass | Production-built static assets served on localhost only. |
| MySQL staging | Blocked | No local MySQL service/client and no approved isolated staging database. |
| Staging environment file | Blocked | No local `.env`; only `.env.example` exists. |
| Staging storage | Blocked | No configured isolated `STORAGE_ROOT` tied to a staging backend process. |
| Stripe TEST | Blocked for E2E | No staging TEST publishable/secret/webhook credentials were provided. |
| Mail sandbox | Blocked | No staging mail provider or sink was configured. |
| Sessions | Unit-tested only | Admin and staff session behavior passes automated tests; live persistence was not exercised. |
| Docker staging | Unavailable | Docker is not installed locally. The repository Compose file contains fixed development credentials and privileged host ports and was not used. |

## Quality gates

| Gate | Result |
|---|---|
| TypeScript (`tsc -b`) | Pass |
| ESLint | Pass |
| Vitest | Pass: 12 files, 35 tests |
| Vite frontend build | Pass |
| esbuild server bundle | Pass |
| Browser console after fix | Pass: zero errors on a fresh home-page load |

The initial Vitest and preview attempts inside the filesystem sandbox were blocked while resolving configuration above the workspace. They were rerun outside that sandbox without network or production access and passed.

## Features tested

### Visitor and frontend smoke tests

| Feature | Result | Notes |
|---|---|---|
| Home page | Pass | Rendered header, hero, application form, FAQ, legal links, footer, and chatbot launcher. |
| Single applicant selection | Pass | UI changed from family state to a single applicant without a console error. |
| Non-GCC resident selection | Pass | GCC residence fields were removed from the visible form. |
| Visa prices navigation | Pass | Browser navigation reached `/visa-prices` and rendered “UAE Visa Prices”. |
| How to apply | Pass | `/how-to-apply` rendered correctly. |
| Terms page | Pass | `/terms` rendered correctly. |
| Admin login screen | Pass | `/admin/login` rendered a password field. |
| Staff login screen | Pass | `/staff/login` rendered a password field. |
| Admin guard | Pass in unauthenticated smoke test | Direct access to `/dashboard` redirected to `/admin/login`. |
| Full wizard submission | Blocked | Requires isolated API, MySQL, storage, and synthetic staging data. |
| Chatbot conversation/resume | Blocked | Mutation flow requires a staging backend and database. |
| Applicant creation | Blocked | Database write was not attempted without staging MySQL. |
| Success page | Blocked | Requires a successful staging application and Stripe TEST payment. |

### Automated security and infrastructure behavior

The 35 passing tests verify:

- upload filename sanitization;
- supported MIME and decoded-size checks;
- rejection of unsupported, oversized, empty, and size-mismatched uploads;
- canonical filesystem write, resolution, serving, and deletion;
- storage path traversal rejection;
- tampered and expired signed storage URL rejection;
- server-side admin password/session behavior;
- secure HttpOnly admin cookie behavior;
- tampered and expired admin session rejection;
- opaque staff sessions and expiry;
- anonymous rejection by authorization middleware;
- verified admin and active-staff authorization;
- per-client and per-scope rate limiting;
- structured, allowlisted, PII-free audit events;
- unique salted staff password hashes and legacy-hash upgrade behavior;
- Stripe TEST-only secret-key enforcement;
- server-derived, idempotent USD PaymentIntent creation;
- server verification of payment identity, reference, amount, currency, and status;
- HTTP request serialization and error handling.

## Documents

| Requirement | Result |
|---|---|
| Upload policy | Pass in unit tests |
| Filename sanitization | Pass in unit tests |
| MIME allowlist | Pass in unit tests |
| Size limits | Pass in unit tests |
| Decoded-size match | Pass in unit tests |
| Path traversal protection | Pass in unit tests |
| Signed URL tamper/expiry | Pass in unit tests |
| Real multipart/browser upload | Blocked |
| Database document record | Blocked |
| Browser preview/download | Blocked |
| Delete with ownership verification | Blocked |
| Persistence across staging restart | Blocked |
| Magic-byte and malware scanning | Not implemented/verified |

The previously reported browser upload issue cannot be declared fully resolved without an isolated backend, real staging filesystem, database records, restart, retrieval, and retry tests.

## Payments

| Requirement | Result |
|---|---|
| Server TEST-key boundary | Pass in unit tests |
| Server-derived amount/currency | Pass in unit tests |
| Idempotent intent creation | Pass in unit tests |
| Confirmation verification | Pass in unit tests |
| Missing publishable-key behavior | Pass in browser after fix |
| TEST PaymentIntent against Stripe | Blocked |
| Card confirmation | Blocked |
| Successful payment | Blocked |
| Failed payment | Blocked |
| Cancelled payment | Blocked |
| Stripe signed webhook | Blocked/not configured |
| Invoice creation and duplicate behavior | Blocked for E2E |

No LIVE Stripe key or endpoint was used. No payment was attempted.

## Admin

| Requirement | Result |
|---|---|
| Login screen | Pass |
| Unauthenticated guard | Pass |
| Server authorization middleware | Pass in unit tests |
| Applications | Blocked after authentication |
| Documents | Blocked after authentication |
| Chat | Blocked after authentication |
| VAT | Blocked after authentication |
| Invoices | Blocked after authentication |
| Dashboard | Guard pass; content blocked |
| Staff | Blocked after authentication |
| Reports | Blocked after authentication |
| Search/filtering | Blocked after authentication |
| Authenticated logout/session expiry | Unit-tested partially; E2E blocked |

## Database and storage

Database inserts, updates, reads, foreign keys, applicant records, document records, payment records, and invoice records were not tested because a staging MySQL database was unavailable. Production MySQL was never used.

Filesystem behavior is covered by isolated temporary-directory tests, but staging ownership, download, preview, cleanup, restart persistence, backup, and signed URL delivery remain unverified end to end.

## Bug fixed

### Stripe initialized globally with an empty publishable key

**Observed behavior:** Loading unrelated visitor or authentication pages emitted repeated unhandled Stripe `IntegrationError` messages because two globally imported modules called `loadStripe('')`.

**Fix:**

- Stripe.js now initializes only when `VITE_STRIPE_PUBLISHABLE_KEY` starts with the Stripe TEST prefix.
- Environments without a valid TEST publishable key render a clear “Stripe TEST payments are not configured” message instead of initializing Stripe.
- LIVE publishable keys are not enabled by this staging code path.

**Files:**

- `src/pages/PaymentPage.tsx`
- `src/components/shared/StripePaymentForm.tsx`

**Commit:** `ee6a3f9c796089c565c20f074dc5e4fdab01535b` — `fix(payments): guard missing Stripe test configuration`

**Verification:** TypeScript, lint, all 35 tests, build, and a fresh browser load passed; browser console errors fell from repeated Stripe errors to zero.

## Regression status

| Area | Status |
|---|---|
| Static visitor UI | Pass |
| Navigation/legal pages | Pass |
| Applicant/residence form state | Pass for sampled UI transitions |
| Authentication guards | Pass unauthenticated; authenticated E2E blocked |
| Chatbot | Not regression-cleared |
| Wizard persistence/submission | Not regression-cleared |
| Uploads | Unit-cleared; E2E not regression-cleared |
| Payments | Unit-cleared and missing-config UI fixed; Stripe E2E not cleared |
| Admin functions | Not regression-cleared |
| MySQL integration | Not regression-cleared |
| Invoice/VAT | Not regression-cleared |

## Security status

Automated coverage is strong for Phase 4 boundaries: admin/staff authorization, sessions, rate limiting, signed URLs, upload validation, password hashing, audit logging, and Stripe server verification all pass.

Security is not production-verified for:

- customer identity and application/document ownership;
- real session behavior across multiple application processes;
- process-local rate-limit persistence;
- end-to-end signed document delivery;
- CSRF behavior with a deployed domain;
- Stripe signed webhook verification;
- upload magic-byte and malware scanning;
- mail content and recipient safety;
- database least privilege and staging isolation.

## Performance findings

Local static-preview measurements are not representative of internet or database performance, but they provide a baseline:

- HTML: 5,412 bytes; five localhost requests completed in approximately 4.3–7.1 ms.
- Largest JavaScript bundle: approximately 3.44 MB uncompressed, 713.9 KB gzip according to the build, and approximately 29.6 ms to fetch locally.
- Vite transformed 2,218 modules.
- The main bundle remains an obvious frontend performance bottleneck and should be split by route, especially admin, spreadsheet/PDF, chart, and payment code.
- API latency, upload speed, payment latency, and database latency were not measured because their staging dependencies were unavailable.
- Browserslist data is approximately eight months old; it was reported but not updated because dependency changes were outside this phase.

## Failed or blocked tests

No automated test assertion failed. The following functional test groups are blocked by missing staging infrastructure:

1. Complete visitor application submission.
2. Chatbot start/resume/multiple-applicant/upload-retry flow.
3. Real document upload, retrieval, preview, deletion, persistence, and ownership.
4. Stripe TEST intent, confirmation, failure, cancellation, webhook, invoice, and duplicate E2E flows.
5. Authenticated Admin and Staff screens.
6. MySQL record and foreign-key validation.
7. Mail delivery through a safe staging sink.
8. API/database/upload/payment performance measurements.

## Exact staging prerequisites

Before continuing functional testing, provision an environment that has no route to production data and provide names/configuration through a secret store, never committed files:

- Node 20 runtime matching CI and production.
- A separate MySQL database with synthetic records only.
- A dedicated staging database user with least privilege.
- A dedicated empty filesystem storage root outside production paths.
- Stripe TEST publishable key, TEST secret key, and TEST webhook secret.
- Independent admin/session/storage signing secrets.
- A mail sandbox or sink that cannot contact production customers.
- A staging hostname and TLS certificate.
- A non-production PM2/process definition or equivalent runtime.
- Explicit network controls preventing access to production MySQL and document storage.
- Backup/reset procedure for synthetic staging data.

## Deployment blockers

1. No complete staging environment exists.
2. Critical user journeys have not been exercised end to end.
3. Stripe webhook behavior is not tested.
4. Customer ownership remains a business/security design decision.
5. Document upload persistence and ownership are not verified end to end.
6. Authenticated Admin/Staff business functions are not regression-cleared.
7. Production deployment still has competing mechanisms and storage-clean risk documented in the production stabilization report.

## Recommended next fixes

1. Create a dedicated staging host/runtime with isolated MySQL and filesystem storage.
2. Replace fixed Compose credentials with secret injection before using Compose for staging.
3. Remove privileged staging host-port assumptions and add staging-only volumes and health checks.
4. Configure Stripe TEST and a signed TEST webhook endpoint.
5. Seed synthetic applications, applicants, documents, payments, invoices, staff, and chat sessions.
6. Add browser E2E tests for visitor, chatbot, upload, payment, Admin, and Staff flows.
7. Add database integration tests that run only against an explicitly named disposable staging/test database.
8. Add route-level code splitting to reduce the 3.44 MB main bundle.
9. Resolve customer identity/ownership before declaring document and payment authorization production-ready.

## Launch readiness calculation

**52%**

Rationale:

- Build and static quality gates: complete.
- Security unit coverage: substantial.
- Static visitor UI and navigation: partially verified.
- Real backend staging runtime: absent.
- Core revenue and data flows: not tested end to end.
- Admin, chatbot, document, database, and invoice regression: incomplete.
- Production deployment safety still has separate critical blockers.

The repository is suitable for continued staging engineering on `devops/deployment-safety`. It is **not safe to deploy to production** based on Phase 6 evidence.

