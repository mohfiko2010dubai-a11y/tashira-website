# TASHIRA Security Hardening Progress

## Current phase

Phase 4 safe repository hardening is complete. Remaining work requires an approved customer ownership model, Stripe webhook endpoint/configuration, or production secret rotation/history remediation.

## Completed security work

- Replaced frontend-only admin trust with an eight-hour, HMAC-signed, HttpOnly, SameSite=Lax server session.
- Removed the frontend admin password fallback and all localStorage admin authorization.
- Protected every `/admin/*` route with server-backed session verification.
- Added admin and staff authorization middleware and applied it to clearly privileged API procedures.
- Validated staff session tokens server-side and checked that the staff account remains active.
- Added short-lived HMAC-signed document URLs and rejected unsigned, expired, tampered, and traversal paths.
- Added per-client rate limits for login, chatbot, upload, application submission, payment, staff, and admin boundaries.
- Added structured allowlisted audit events for authentication, payment, document, and admin state-change actions without identifiers or PII.
- Forced Stripe to TEST keys, calculated intent amount from MySQL, fixed currency to USD, added idempotency, and verified the PaymentIntent directly before marking an application paid.
- Prevented duplicate payment rows/invoices for the same idempotent intent/application.
- Replaced fixed-salt SHA-256 staff hashes with salted scrypt and transparently upgrades valid legacy hashes on login.

## Remaining work

- Define authentication/ownership for anonymous customer applications, payments, documents, invoices, tracking, and chatbot sessions.
- Require that ownership credential on public reference/application-ID procedures.
- Add and configure a Stripe-signed webhook as the canonical asynchronous payment source in TEST mode before staging.
- Decide document-before-payment versus document-after-payment durable workflow.
- Move rate-limit/session state to a shared store if production runs multiple Node processes.
- Send audit events to an append-only centralized sink with retention and alerting.
- Rotate and remove credential-like historical deployment/migration content using an approved history-rewrite plan.
- Add MFA or individual administrator identities instead of one shared admin password.

## Risk assessment

- Critical risk remains around anonymous customer object ownership and public reference-based data endpoints.
- High risk remains around public invoice routes, upload attachment to arbitrary application IDs, missing Stripe webhook reconciliation, and credential-like repository history.
- Medium risk remains around process-local sessions/rate limits, proxy-header trust, audit-log durability, CSRF/security-header review, and legacy storage code.
- Low risk includes stale browser compatibility data and legacy naming/comments.

## OWASP observations

- A01 Broken Access Control: substantially reduced for admin/staff; customer object-level authorization remains open.
- A02 Cryptographic Failures: signed cookies/URLs and scrypt added; repository-history credentials still require remediation.
- A03 Injection: typed queries and path normalization are present; uploads still need magic-byte inspection.
- A04 Insecure Design: anonymous ownership and payment/document sequencing require an explicit design.
- A05 Security Misconfiguration: fail-closed secrets added; proxy trust and headers remain to be configured.
- A06 Vulnerable Components: dependency vulnerability review remains separate from functional CI.
- A07 Identification and Authentication Failures: admin/staff hardened; MFA, revocation, and customer identity remain.
- A08 Software and Data Integrity Failures: CI is green; deployment controls remain intentionally untouched.
- A09 Logging and Monitoring Failures: structured events added; centralized durable collection remains.
- A10 SSRF: fixed Stripe endpoints are used; legacy external integrations need continued allowlisting review.

## Files changed

- Authentication/session: `api/auth-router.ts`, `api/context.ts`, `api/middleware.ts`, `api/lib/admin-session.ts`, `api/lib/staff-session.ts`, frontend admin/staff hooks and guards.
- Authorization: application, chat, document, drive, invoice, staff, storage, supplier, and wizard routers.
- Storage: `api/boot.ts`, `api/lib/local-storage.ts`.
- Stripe: `api/payment-router.ts`, `api/lib/stripe.ts`.
- Controls: `api/lib/rate-limit.ts`, `api/lib/audit-log.ts`, `api/lib/password.ts`.
- Regression tests: admin session, middleware, staff session, signed storage, rate limiting, audit logs, Stripe, and password hashing.

## Commits

- `cd63c37` — `security(auth): enforce server-side admin sessions`
- `581a7e2` — `security(api): enforce admin and staff authorization`
- `d17a10f` — `security(storage): require signed document URLs`
- `b20124f` — `security(rate-limit): protect sensitive API boundaries`
- `f3c2913` — `security(logging): add structured audit events`
- `14868fe` — `security(stripe): verify test payments server-side`
- `6f5b8a5` — `security(auth): upgrade staff password hashing`

## CI status

- Local TypeScript: pass.
- Local ESLint: pass.
- Local tests: 35 passing across 12 files.
- Local production build: pass; generated output was restored and not committed.
- GitHub Actions: Phase 4 commits are being verified on `devops/deployment-safety` only.

## Required environment names

- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `STORAGE_URL_SECRET`
- `STRIPE_SECRET_KEY` (must remain a TEST key)

No environment values are included here.
