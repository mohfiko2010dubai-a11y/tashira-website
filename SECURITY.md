# Security

## Status of findings

The items below were identified through static repository analysis. They are confirmed in source code but are not automatically confirmed as active production behavior. Production verification requires separate explicit authorization.

## Current risks

### Critical

- Most sensitive tRPC procedures appear public, including administrative and PII-bearing operations.
- Admin authentication is browser-side and includes a hard-coded fallback password.
- Stripe amount and payment confirmation depend on browser input without independent Stripe verification.
- Document upload, access, replacement, and deletion lack adequate server authorization.
- Development database and webhook credentials are embedded in repository configuration/scripts.

### High

- Staff password hashing uses fast SHA-256 with a fixed salt.
- Staff sessions are held in memory and browser localStorage.
- Application references may expose PII, invoices, and documents.
- OAuth state and CSRF protections require review.
- Large Base64 uploads create denial-of-service exposure.
- Deployment services and log endpoints may be overprivileged or public.

## Mandatory backend authorization

- Default every procedure to protected.
- Define explicit customer, staff, and admin policies.
- Verify record ownership for customer application, invoice, and document access.
- Apply least privilege and deny by default.
- Treat browser route guards as presentation only.
- Log sensitive administrative actions without logging secrets or document contents.

## Authentication target

- Replace browser-only admin authentication.
- Hash staff/admin passwords with Argon2id or bcrypt.
- Use expiring, revocable server-verifiable sessions.
- Prefer secure, HTTP-only cookies where appropriate.
- Add CSRF protection, login throttling, rate limiting, session rotation, and audit records.

## Stripe target

- Calculate authoritative totals on the server.
- Verify signed Stripe webhooks.
- Verify PaymentIntent status, amount, currency, metadata, and application identity.
- Enforce idempotency and transactional database updates.
- Never finalize payment solely from a browser callback.

## PII and documents

- Treat passport documents and customer data as highly sensitive.
- Production documents are expected at `/var/www/tashira/storage/documents`.
- Require authenticated, authorized, short-lived access.
- Validate content signatures, enforce conservative limits, scan malware, and canonicalize paths.
- Define retention, deletion, backup, restore, and incident-response processes.
- Never delete, move, or overwrite production documents without explicit authorization and verified backups.

## Credentials

- Never commit or expose secret values.
- Rotate any credential committed or embedded in source before relying on it.
- Separate browser-safe variables from server secrets.
- Keep backend secrets out of `VITE_` variables.
- Record ownership and rotation dates in an approved secrets manager, not the repository.

## Error handling and monitoring

- Return stable public error codes and avoid raw database/provider messages.
- Use structured security logs with redaction.
- Add alerts for authentication abuse, payment failures, upload abuse, and administrative changes.

## Recommended target architecture

The target is a deny-by-default API with strong server sessions, explicit role/ownership policies, server-authoritative Stripe processing, signed webhook finalization, authenticated filesystem document access, comprehensive audit logs, and a controlled deployment pipeline.
