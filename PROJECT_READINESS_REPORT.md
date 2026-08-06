# TASHIRA Production Readiness Report

## Executive summary

**Overall readiness: 32%**

The repository now passes TypeScript, ESLint, unit tests, build, and review-branch CI. Static tracing and isolated filesystem tests confirm the intended server-filesystem storage path and identified/fixed the original chatbot upload path mismatch. The application is **not production-ready** because authorization is absent from most API procedures, payment completion trusts client input instead of Stripe, document access is public, and several customer journeys cannot resume safely.

This assessment is based on repository analysis and local isolated tests only. It does not claim that production runtime behavior, MySQL contents, filesystem permissions, Stripe configuration, email delivery, or external webhooks were verified. No production connection was made.

## Readiness scorecard

| Area | Readiness | Assessment |
|---|---:|---|
| Chatbot | 52% | Conversation advances, validates common fields, and creates a partial application; family applicants and durable resume are incomplete. |
| Chatbot upload | 62% | Canonical filesystem path fixed and progression now waits for upload success; authorization, replacement, deletion, ownership, and resume remain absent. |
| Visa application | 55% | Main form handles visa/residence/applicants/pricing and normalized applicant inserts; document persistence occurs only after payment and is optional/manual. |
| Documents | 28% | Filesystem adapter and MySQL metadata exist; public access, non-atomic operations, incomplete retry/replacement, and unrestricted deletion prevent readiness. |
| Payments | 18% | Stripe intent UI exists, but amount and success are client-controlled and no server-side Stripe verification/webhook is enforced. |
| Admin | 15% | Screens and reports exist; routes and underlying APIs lack effective server authorization. |
| Authentication | 18% | User OAuth and staff login primitives exist; admin authentication is client-side and staff tokens are not attached to protected API requests. |
| Security | 12% | Critical broken access control and payment trust issues exist, plus credential-like deployment artifacts require rotation/audit. |
| Performance | 55% | Build succeeds, but the main client chunk is approximately 3.44 MB before gzip and routes are eagerly loaded. |
| UX | 48% | Core flow is understandable, but payment/document sequencing, retry, resume, and status feedback are inconsistent. |
| Production readiness | 20% | Quality gates are green, but critical security and transaction-integrity gates remain open. |

## Validation method and limitations

- Traced frontend state, tRPC calls, router procedures, MySQL schema, filesystem adapter, payment flow, guards, and admin pages.
- Ran TypeScript, ESLint, 14 unit tests, and production build locally.
- Added isolated filesystem tests using a temporary directory; no production documents were accessed.
- Did not use real customer data, MySQL production data, Stripe, email, WhatsApp, OAuth, production filesystem, or a production server.
- Runtime claims below are marked as verified locally, statically supported, or unverified.

## Chatbot functional audit

### Conversation and state transitions

The UI wizard follows: traveler type → count → residence → visa → processing → applicant identity → travel/contact data → three uploads → review/terms → payment link. Basic name, email, phone, passport, and date validation exists.

Findings:

- The successful single-applicant path is statically coherent.
- The wizard starts a MySQL application after the first name. If that insert fails, the UI continues without an application ID, leaving later data unsaved and uploads impossible.
- Intermediate update mutations are fire-and-forget; their failures do not block progression or surface a retry state.
- Family count affects price, but the chatbot collects only one applicant and does not create normalized `applicants` rows. This remains a blocked production/schema decision.
- Wizard state and messages exist only in React memory. Closing/reloading the page loses progress; there is no durable resume token or state restoration.
- Reference numbers are random six-digit client values without collision retry.
- Date validation checks parseability, not passport validity horizon or arrival business rules.

### Chatbot document upload

Original issue status: **the root cause existed and was fixed on the review branch**.

Root cause:

- The wizard wrote files under a process-working-directory path while persisting a different `applications/{id}/{type}/{file}` path in MySQL. `/storage/*` served the configured production storage root, so uploaded files could be recorded but not found.
- The UI moved to the next required document on a timer without waiting for the mutation to succeed.

Safe fix completed:

- Wizard uploads now use the shared local filesystem adapter.
- MySQL `storagePath`, physical path, preview URL, and deletion path use the same canonical relative path.
- Upload-step progression runs only after successful mutation completion.
- Failed selections remain on the same step and may be selected again.
- Path traversal outside the configured storage root is rejected.
- Four filesystem/path tests were added; the full suite now has 14 passing tests.

Remaining gaps:

- No file signature/content validation; MIME type and size are client-provided in the wizard path.
- Filename sanitization is inconsistent between storage routers.
- No customer ownership/session binding exists for upload, preview, download, replacement, or deletion.
- Both passport copy and cover use the same `passport` type, so requirements and replacement cannot distinguish them.
- No replacement/delete UI exists in the chatbot.
- No resume after interruption.
- MySQL insert and filesystem write are not transactional; a DB failure can orphan a file.
- Production filesystem permissions and the expected `/var/www/tashira/storage/documents` volume were not runtime-verified.

## Visa application audit

- Nationality, visa selection, residence category, single/family applicants, processing choice, contact fields, and review data are collected.
- Pricing is calculated in the browser from static option data. The API accepts totals and exchange rate from the client rather than calculating them from a server-owned price catalog.
- The normalized form creates `applications` and `applicants`, but application and applicant inserts are not wrapped in a transaction; partial records are possible.
- Required HTML fields exist, but cross-applicant completeness and document requirements are not validated server-side.
- Selected files remain browser-memory objects until after payment succeeds and the customer manually clicks upload. Closing the modal or refreshing loses them.
- No durable draft/resume flow exists.

## Document lifecycle audit

### Upload

- Local filesystem storage is the active adapter in `api/lib/local-storage.ts`.
- Generic form uploads use a two-call process: write file, then create MySQL metadata. Failure of the second call leaves an orphan file.
- The wizard combines write and metadata insert in one API call, but cleanup is absent when metadata insert fails.

### Preview and download

- The adapter returns `/storage/{relativePath}` and the server serves that file.
- The URL is described as signed but has no signature or expiry enforcement.
- Anyone who knows or obtains a path can fetch the document because `/storage/*` has no authentication/authorization middleware.

### Delete and replace

- Admin deletion removes the DB row before deleting the file. A storage failure produces an orphan inaccessible through the UI.
- Generic replacement deletes the old file before the new upload succeeds, creating data-loss risk.
- All related procedures are public and do not verify application ownership or admin/staff role.

### MySQL synchronization

- Metadata fields support provider, bucket, path, size, type, and status.
- Schema defaults still identify Supabase even though active code uses local storage; this can mislabel new records.
- Referential integrity is not declared in the Drizzle schema.

## Payment audit

Critical findings:

- `payment.createIntent` accepts amount, currency, and reference number from the browser. It does not derive the amount from a trusted server-side application price.
- It can create multiple pending payment intents and rows for the same application; no idempotency key or duplicate-payment guard exists.
- `payment.confirm` is public and marks an application paid using caller-supplied identifiers without retrieving/verifying the PaymentIntent from Stripe.
- It does not prove the PaymentIntent belongs to the reference, amount, currency, or application.
- There is no Stripe webhook as the authoritative payment-success source.
- Invoice insertion may duplicate a unique invoice number on repeated confirmation; the exception is swallowed.
- Payment/application/invoice updates are not transactional.
- The UI displays a test-mode notice regardless of runtime Stripe mode and claims confirmation email delivery although no email send is present in this flow.

Required design decision: make server-verified Stripe webhooks canonical, derive amounts from server-owned pricing/application data, use idempotency, and define transaction/reconciliation behavior. This must be approved and tested with Stripe test mode before production.

## Admin dashboard audit

The repository includes applications, detail, invoices, chat, VAT, supplier, staff, and report/export screens. Their queries generally map to existing API routes and schema fields.

Blocking findings:

- `/admin/*` routes are rendered without `AdminGuard`.
- `useAdminAuth` compares a browser-exposed environment value and includes a fallback password in frontend code; localStorage is the only session marker.
- Application lists, analytics, status changes, supplier assignment, staff CRUD, chat sessions/replies, documents, VAT/report data, and invoice operations are public tRPC procedures.
- `AdminGuard` itself allows any authenticated OAuth user and does not enforce `role === admin`.
- Staff page guards do not protect APIs; the staff token is not included in application API requests.
- Client-side spreadsheet exports increase bundle size and may expose all fetched PII on compromised clients.

No safe partial guard change was made because the server authorization model and role ownership must be defined first; UI-only guards would create a false sense of security.

## Authentication audit

- OAuth user session verification uses an authenticated tRPC procedure and an HTTP-only cookie.
- Staff passwords use unsalted-per-user SHA-256 with a fixed application salt; a password-specific adaptive KDF is required.
- Staff sessions live in server memory and disappear on restart; tokens are stored in browser localStorage.
- Staff logout contained an invalid hook invocation; this was fixed so the mutation is created at hook scope and local state is derived safely.
- Admin login is not server authentication.
- No CSRF strategy is evident for state-changing cookie-authenticated procedures.
- Login rate limiting, lockout, audit logging, session revocation, and role middleware coverage are absent.

## Security review

No secret values are reproduced in this report.

| Location | Severity | Finding and remediation |
|---|---|---|
| `api/application-router.ts`, `api/document-router.ts`, `api/storage-router.ts`, `api/supplier-router.ts`, `api/staff-router.ts`, `api/chat-router.ts`, `api/invoice-router.ts` | Critical | Sensitive reads/writes are public. Apply server-side admin/staff/owner middleware and object-level authorization. |
| `api/payment-router.ts` | Critical | Client-controlled price and unverified payment confirmation. Verify Stripe server-side/webhook, bind intent to application, amount, and currency. |
| `api/boot.ts` `/storage/*` | Critical | Customer documents are publicly retrievable by path. Require authorized download tokens or authenticated owner/admin access with short expiry. |
| `src/hooks/useAdminAuth.ts` and admin routes | Critical | Client-only admin password/session. Replace with server-side authentication and admin role authorization; remove frontend fallback credentials. |
| `vps-deploy.sql:7` | High | Credential-like plaintext migration/deployment content. Confirm whether real, rotate if ever used, remove from history safely, and replace with secret injection/prompting. |
| `setup.sh:43-49`, `docker-compose.yml:9-26`, `drizzle.config.ts:4-6` | High | Credential/configuration patterns and defaults require secret audit. Use environment injection and non-secret placeholders only. |
| `webhook-server.js:5`, `scripts/webhook-server.py:9-30`, service/setup files | High | Webhook credential-like configuration exists. Rotate real secrets if committed and keep inactive legacy mechanisms disabled. |
| `api/staff-router.ts` | High | Fixed-salt fast password hashing and memory-only sessions. Use Argon2id/bcrypt/scrypt and a persistent/revocable session store. |
| `api/lib/local-storage.ts`, upload routers | High | No magic-byte validation and inconsistent sanitization. Centralize upload policy, enforce decoded size/signature, and generate server filenames. |
| Invoice routes and logs in `api/boot.ts` | Medium | Public invoice retrieval and operational paths/reference logging. Authorize access and redact production logs. |
| `api/chat-router.ts`, wizard logs | Medium | Chat/contact/reference data can reach logs or public admin endpoints. Minimize logs and enforce access controls/retention. |
| Legacy `api/lib/supabase.ts` | Medium | Legacy provider code remains and may cause configuration ambiguity. Keep inactive, document runtime selection, and remove only after verified migration approval. |

## Performance review

- Local production build succeeds.
- Main client chunk is approximately 3.44 MB before gzip (about 714 KB gzip), plus an approximately 349 KB html2canvas chunk and 361 KB locale-related chunk.
- Routes are imported eagerly; no `React.lazy` route splitting is present.
- Admin-only `xlsx`, invoice generation libraries, charts, many locales, and animation code contribute to client cost.
- Repeated per-application applicant/supplier queries in application listing create an N+1 database pattern.
- Admin pages request up to 500 applications and then sort/filter/export client-side.
- Several large components combine state machine, rendering, networking, and validation, increasing rerender and maintenance cost.

Recommended later work (not implemented in this phase): lazy-load route groups and admin exports, isolate invoice/XLSX code, split locales, add server pagination/joined queries, profile React renders, and establish bundle budgets.

## UX review

### Landing → chatbot

- Chatbot entry is visible and guided, but progress numbering is inconsistent and state disappears on refresh.
- Errors from intermediate DB saves are hidden, so users may believe a draft exists when it does not.

### Chatbot → documents

- Success-gated progression is now correct.
- Upload has no visible byte progress, cancel, replacement, deletion, or durable resume.
- Passport cover and copy are not distinguishable in metadata.

### Visa form → payment

- Documents are selected before payment but not persisted until after payment.
- The post-payment upload requires an additional click; closing the modal can leave a paid application without documents.
- Partial upload retry is not safely implemented because replaying all selections could duplicate successful files.

### Payment → confirmation

- Payment feedback and invoice actions exist.
- “Test Mode” and “confirmation email sent” messaging may be inaccurate for runtime behavior.
- No robust duplicate-submit feedback or reconciliation status is shown.

### Confirmation → admin processing

- Tracking exposes application status by reference but does not authenticate ownership.
- There is no customer document repair/resume route despite some UI copy previously implying one.
- Status labels exist, but permitted state transitions are not enforced server-side.

## Issue register

### Critical issues

1. Broken server-side access control across admin, staff, documents, chat, invoices, and application APIs.
2. Public document serving without owner/admin authorization.
3. Client-controlled Stripe amount and unverified payment confirmation.
4. Client-only admin authentication with frontend-accessible credential logic.

### High issues

1. No durable chatbot/application resume.
2. Family chatbot does not persist all applicants.
3. Non-atomic document file/metadata operations and destructive replacement order.
4. Post-payment document upload can be skipped or lost.
5. Credential-like deployment/migration artifacts require rotation and history review.
6. Weak staff password hashing and volatile sessions.
7. No server-owned pricing catalog or application-state transition policy.

### Medium issues

1. Inconsistent storage-provider comments/schema defaults.
2. Missing upload content validation and canonical filename policy.
3. Random reference collision handling absent.
4. N+1 admin queries and 500-row client processing.
5. Public tracking/invoice data can expose PII when references are guessed/shared.
6. Misleading email/test/retry messaging.

### Low issues

1. Stale Browserslist data warning.
2. Inconsistent mojibake/encoding visible in some source strings.
3. Placeholder analytics conversion identifier.
4. Legacy Supabase code and naming increase maintenance confusion.

## Remaining risks and blocked decisions

- Verify production MySQL schema compatibility before normalizing chatbot applicant persistence.
- Define customer ownership identity before protecting upload/preview/download/delete/track operations.
- Approve Stripe webhook, pricing, currency, VAT, and reconciliation rules.
- Choose canonical admin/staff identity and role model.
- Define allowed application status transitions and which roles can perform each transition.
- Confirm production storage root, filesystem owner/group/mode, backup, retention, and restore process.
- Decide whether documents are required before payment, after payment, or both with a durable handoff.

## Prioritized roadmap

### P0 — launch blockers (estimated 8–15 engineering days)

1. Implement server-side admin/staff/customer authorization and object-level ownership checks.
2. Protect `/storage/*`, tracking, invoices, chat, and all sensitive tRPC procedures.
3. Replace payment confirmation with verified Stripe webhook processing and server-owned amounts/idempotency.
4. Remove/rotate credential-like committed values and audit Git history without exposing them.
5. Add integration tests proving unauthorized access is rejected and payment spoofing cannot change state.

### P1 — transactional customer journey (estimated 6–10 engineering days)

1. Implement durable application/wizard resume with a scoped recovery token.
2. Resolve normalized family-applicant persistence.
3. Make file write + metadata lifecycle compensating/transactional and replacement non-destructive.
4. Persist documents before leaving the success flow, with safe per-file retry and deduplication.
5. Enforce server-side validation, pricing, and state transitions.

### P2 — operational confidence (estimated 4–8 engineering days)

1. Add MySQL-backed integration tests and Stripe test-mode webhook tests.
2. Add authentication rate limits, audit events, session revocation, CSRF review, and security headers.
3. Add health/readiness checks for DB, storage writability, and external payment configuration without exposing values.
4. Validate backups and restore procedures in a non-production environment.

### P3 — performance and UX (estimated 4–7 engineering days)

1. Route-level lazy loading and admin/export chunk splitting.
2. Server pagination and removal of N+1 queries.
3. Explicit progress, retry, replacement, resume, and confirmation states.
4. Correct encoding, translation coverage, and misleading copy.

## Estimated effort before production launch

**Minimum responsible estimate: 22–40 engineering days**, plus security review and staging/UAT. The range depends primarily on the chosen identity/ownership model, Stripe webhook integration, production schema compatibility, and document sequencing decision.

The application should not launch or merge to a production-deploying branch until all P0 items and their negative authorization/payment tests pass in a non-production environment.
