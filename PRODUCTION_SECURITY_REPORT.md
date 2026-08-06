# TASHIRA Production Security Report

## Executive assessment

**Overall Production Security Score: 58%**

Phase 4 removed the most immediate frontend-only admin trust, protected privileged APIs, closed direct filesystem document URLs, rate-limited sensitive boundaries, hardened staff password storage, and made Stripe TEST confirmation server-verifiable. The application is materially safer but is not production-ready because anonymous customers have no approved ownership identity/capability for applications and related objects.

This is a repository and isolated-test assessment. Production configuration, live data, filesystem permissions, Stripe webhook settings, proxy behavior, and secret rotation were not inspected or changed.

## Authentication readiness — 72%

Completed:

- Admin password verification occurs only on the server.
- Admin sessions are signed, HttpOnly, SameSite=Lax, secure outside localhost, and expire after eight hours.
- Missing/short session secrets fail closed.
- All admin routes query the server as the source of truth.
- Staff opaque tokens are verified against a server-side session and active MySQL staff account.
- Staff passwords use salted scrypt; valid legacy hashes upgrade automatically.

Remaining:

- Shared admin password does not provide individual identity, MFA, revocation, or per-admin audit attribution.
- Staff token persists in localStorage and is susceptible to XSS theft, although possession is verified server-side.
- Staff sessions are process-local and disappear on restart.
- Customer authentication is not defined.

## Authorization readiness — 55%

Protected server-side:

- Application lists, analytics, status changes, and supplier assignment.
- Supplier and staff administration.
- Admin chat sessions, conversation access, replies, and read-state updates.
- Wizard pending/incomplete lists.
- Document listing, preview-token generation, status changes, deletion, and replacement.
- Admin invoice regeneration and drive listing.

Open authorization gaps:

- `application.getByReference`, wizard updates, tracking, invoices, and payment initiation are reference-based public flows.
- Upload endpoints accept an application ID without an authenticated customer owner.
- Chat history is keyed by a caller-supplied session ID.
- Direct invoice view/download routes remain reference/invoice-number based.

These cannot be safely closed until the customer ownership/recovery design is approved.

## Stripe readiness — 68%

Completed in TEST mode:

- Non-test secret keys are rejected.
- The browser amount and currency are ignored for trust decisions.
- Amount is read from the MySQL application record and converted to cents server-side.
- Currency is fixed server-side to USD.
- Intent creation uses an application-scoped Stripe idempotency key.
- Duplicate payment rows are avoided for the returned intent.
- Confirmation retrieves the PaymentIntent directly from Stripe and verifies ID, succeeded status, USD currency, expected/received amount, and metadata reference.
- Payment must belong to the same application before state changes.
- Repeat confirmation avoids duplicate invoice insertion.

Remaining:

- A signed Stripe webhook is not yet the canonical asynchronous source.
- DB application/payment/invoice writes are not one transaction.
- Refund, dispute, cancellation, delayed payment, and reconciliation policies are not defined.
- Server amount is trusted from the stored application total; the underlying pricing catalog remains client-originated when the application is first created.

## Document security — 64%

Completed:

- Canonical filesystem root and traversal-safe resolution.
- Filename sanitization, MIME allowlisting, decoded-size verification, and 100 MB limit.
- Signed URLs expire after 15 minutes and are HMAC verified before file access.
- Signed URLs can only be requested through admin/staff authorization.
- Delete/replace/list/status procedures require staff/admin authorization.

Remaining:

- Customer upload ownership is not enforced.
- Magic-byte/file-signature and malware scanning are absent.
- File and MySQL metadata operations are not atomic.
- Replacement deletes the old file before all new metadata work is complete.
- Production permissions, backup, restore, and retention were not runtime-verified.

## Session security — 60%

- Admin cookies are HttpOnly, secure outside localhost, SameSite=Lax, signed, and expiring.
- Staff sessions use cryptographically random tokens and expire after eight hours.
- Session and rate-limit stores are in memory and are not shared across processes.
- Admin sessions cannot be individually revoked without secret rotation or expiry.
- A shared persistent session store is recommended for multi-process production.

## API security — 57%

- Explicit admin and staff/admin middleware now guards privileged tRPC procedures.
- Negative authorization tests prove anonymous rejection.
- Login, chatbot, application submission, uploads, payments, and privileged APIs have bounded request rates.
- Rate limits return a retry interval.
- Public customer procedures remain susceptible to object-level authorization abuse until ownership exists.
- Request body allowance remains very large and should be reviewed with upload architecture.

## Storage security — 68%

- Files remain on the server filesystem under the configurable canonical root.
- MySQL stores relative metadata paths; signed delivery resolves against the same root.
- Unsigned/tampered/expired paths fail.
- `STORAGE_URL_SECRET` is required and must be independent, random, and managed outside Git.
- Legacy Supabase code remains inactive/ambiguous and should not be reactivated without explicit approval.

## Rate limiting

Current limits are process-local and scoped by the best available proxy/client address header. They protect abuse in a single Node process but are not sufficient for horizontally scaled or untrusted-proxy deployments. Production must define trusted proxy headers and use a shared atomic store if more than one process handles traffic.

## Audit logging

Structured JSON security events cover admin/staff login/logout, application status changes, document upload/delete, and payment intent/confirmation outcomes. The schema intentionally excludes passwords, tokens, IPs, references, application IDs, filenames, passport data, email, phone, and other PII.

Logs currently go to standard output. Production needs an append-only centralized sink, access controls, retention, correlation IDs, alerting, and clock synchronization.

## Secrets audit

Values are intentionally not reproduced.

| Location | Severity | Recommendation |
|---|---|---|
| `vps-deploy.sql:7` | High | Treat credential-like plaintext as compromised if ever used; rotate, replace with injected secrets, and plan approved history removal. |
| `setup.sh:43-49` | High | Remove credential-like/test key defaults; use environment names/placeholders only. |
| `docker-compose.yml:9-26` | High | Verify committed defaults are non-secret; rotate real values and move them to managed secrets. Docker remains inactive per known production evidence. |
| `drizzle.config.ts:4-6` | Medium | Ensure only environment references/default-safe development placeholders exist. |
| webhook scripts/service files | High | Rotate any real webhook secret ever committed and keep inactive legacy Node webhook disabled. |
| `api/lib/supabase.ts` | Medium | Legacy service-role environment references remain; confirm inactive and do not populate unless explicitly approved. |
| frontend/admin code | Resolved | Frontend admin fallback credential and localStorage authorization were removed. |

Repository history remediation and production rotation are intentionally not attempted because they require coordination and can invalidate active systems.

## OWASP Top 10 assessment

| Category | Status | Observation |
|---|---|---|
| A01 Broken Access Control | High residual risk | Admin/staff protected; anonymous customer object ownership unresolved. |
| A02 Cryptographic Failures | Medium | Signed sessions/URLs and scrypt added; historical credential-like content remains. |
| A03 Injection | Medium-Low | Typed ORM/path normalization used; file signature scanning remains. |
| A04 Insecure Design | High | Anonymous ownership, recovery, and document/payment sequencing need design approval. |
| A05 Security Misconfiguration | Medium | Required secrets fail closed; proxy trust, headers, and production environment remain unverified. |
| A06 Vulnerable Components | Unassessed | Dependency vulnerability/SBOM review was not added to CI in this phase. |
| A07 Authentication Failures | Medium | Admin/staff improved; MFA, durable revocation, and customers remain. |
| A08 Data/Software Integrity | Medium-Low | CI/build gates pass; deployment workflow intentionally unchanged. |
| A09 Logging/Monitoring | Medium | Safe structured events exist; durable monitoring does not. |
| A10 SSRF | Low-Medium | Stripe endpoint fixed; legacy external integrations require continued review. |

## Critical issues

1. No authenticated customer ownership model for applications, documents, invoices, payments, tracking, or chatbot sessions.

## High issues

1. Public reference-based application/invoice/track endpoints can expose object data.
2. Public uploads can target a caller-supplied application ID.
3. Stripe webhook verification/reconciliation is not implemented.
4. Credential-like deployment/migration history needs coordinated rotation and removal.
5. Shared admin password lacks individual identity and MFA.

## Medium issues

1. Process-local sessions/rate limits and unverified proxy trust.
2. Missing malware/magic-byte document inspection.
3. Non-atomic DB/filesystem/payment state changes.
4. Audit logs lack durable centralized storage and alerting.
5. Security headers, CSRF threat model, and dependency vulnerability scanning need dedicated verification.

## Low issues

1. Legacy Supabase naming/code can confuse runtime ownership.
2. Browser compatibility data is stale.
3. Legacy mojibake and placeholder analytics identifiers remain.

## Required decisions before further hardening

1. Customer identity: account login, email/OTP recovery, or scoped signed capability token.
2. Which customer operations each ownership credential permits and for how long.
3. Stripe webhook route, signing secret management, retry/reconciliation policy, and allowed state transitions.
4. Admin individual identities/MFA and shared session store.
5. Secret rotation/history-rewrite coordination.
6. Trusted reverse-proxy configuration and shared rate-limit store.

## Launch recommendation

Do not deploy or merge into a production-deploying branch yet. Complete customer object ownership and Stripe webhook reconciliation, rotate credential-like values, add negative object-access integration tests, and validate the configuration in a non-production staging environment first.
