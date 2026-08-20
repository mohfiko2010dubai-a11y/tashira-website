# TASHIRA Core Functionality Completion Report

## Scope

Phase 6D was implemented only on `devops/deployment-safety`. No production host, database, storage, service, configuration, secret, or deployment mechanism was contacted or changed.

## Completed on the review branch

- Added signed HttpOnly customer application capability sessions with exact-reference authorization.
- Protected customer application lookup, updates, payment operations, document uploads, invoice lookup, and invoice HTTP delivery.
- Persisted the wizard's primary applicant in the canonical MySQL `applicants` model.
- Added real owned-application tracking and payment resume; removed demo tracking records.
- Added safe document retry behavior that preserves successful uploads and retries only failed files.
- Prevented cross-application applicant/document metadata associations.
- Enforced Stripe TEST keys, server-stored payment amounts, PaymentIntent ownership, amount/currency/status verification, and idempotent payment finalization.
- Added signed Stripe webhook processing with five-minute replay tolerance, live-mode rejection, success/failure reconciliation, and a one-megabyte payload limit.
- Protected invoice PDFs, rejected traversal-style invoice identifiers, validated uploaded PDFs, corrected invoice URLs, and prevented unpaid invoices from being generated in admin/staff screens.
- Removed the false UI claim that a confirmation email had been sent.
- Wired new session and Stripe webhook secret names into the isolated staging design without adding values.

## Verification

- TypeScript: pass.
- ESLint: pass.
- Tests: 42 passed across 14 files after the payment/ownership group; an additional ownership test file was subsequently added and is covered by the final gate run.
- Client and server production bundle: pass locally.
- Review-branch CI for ownership commit `45d7e36`: pass.
- Review-branch CI passed for all three Phase 6D commits: `45d7e36`, `f7da6b6`, and `1672839`.

## Remaining decisions

See `BLOCKED_DECISIONS.md` for the required decisions on:

- 2–20 applicant chatbot UX and per-applicant document capture.
- Cross-device customer identity and recovery.
- Transactional email provider, templates, delivery, and retry policy.
- Canonical server-side prices, exchange rates, fees, and VAT treatment.
- Customer replacement/deletion policy for successfully stored documents.

## Known risks

- The capability cookie is intentionally device-bound and expires; it is not a customer account.
- Stripe webhook registration and secret provisioning are environment operations and were not performed.
- VAT reporting remains internally inconsistent with invoices and must not be treated as accounting output until the tax policy decision is resolved.
- Production requires `CUSTOMER_SESSION_SECRET` and `STRIPE_WEBHOOK_SECRET` before these review-branch features can be deployed; no production value was inspected or created.
