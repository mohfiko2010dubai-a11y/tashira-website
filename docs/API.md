# API

## Entry point

`api/boot.ts` creates the Hono server. It mounts OAuth callback handling, invoice routes, local storage serving, `/api/trpc`, health checks, production static files, and an API catch-all.

## tRPC composition

`api/router.ts` composes:

| Router | Responsibility |
|---|---|
| `auth` | Current OAuth user and logout |
| `application` | Applications, applicants, status, suppliers, analytics |
| `payment` | PaymentIntent, confirmation, invoice lookup |
| `chat` | Visitor/admin chat and external assistant |
| `wizard` | Wizard/application progress |
| `drive` | Google Drive operations |
| `invoice` | Invoice generation and metadata |
| `supplier` | Supplier management |
| `staff` | Staff authentication and management |
| `storage` | Filesystem operations |
| `document` | Document metadata |

## Authorization requirements

`api/middleware.ts` defines authenticated and admin middleware, but static analysis found extensive use of public procedures. Production behavior must be verified, but the target rule is deny by default.

- Customer procedures require authentication or a narrowly scoped signed capability plus ownership checks.
- Staff procedures require valid staff identity and explicit permissions.
- Admin procedures require server-verified admin role.
- Payment, document, invoice, supplier, chat-management, analytics, and staff-management mutations must never rely on UI guards.

## Validation and errors

- Validate all external input with Zod.
- Reject unknown or inconsistent identifiers.
- Use stable typed error codes.
- Do not return raw database, filesystem, Stripe, or provider errors.
- Redact PII and secrets from logs.
- Add request limits and rate limiting appropriate to each endpoint.

## Data integrity

- Use transactions for parent/child application creation and payment/invoice updates.
- Enforce idempotency for retryable mutations.
- Avoid N+1 list queries.
- Validate status transitions on the server.
