# TASHIRA Payment and Chargeback Readiness Report

## Customer Timeline readiness

The review branch defines an append-oriented `application_timeline_events` table with immutable UUID event identifiers and MySQL server timestamps. It records application, applicant, document, operational, checkout, Stripe, payment, invoice, policy, and evidence-package events. Timeline rows are readable by authorized staff/admin users and by the customer capability that owns the exact application reference. Customer responses omit internal actor references, payment row identifiers, session references, failure categories, and evidence hashes.

Admin Application Details includes a dedicated Timeline tab. The customer tracking/resume page shows the authorized application's timeline. Staff/admin users can add only an allowlisted set of operational events; arbitrary event names are rejected.

## Payment Event Recording readiness

The checkout records safe lifecycle signals only: checkout opened, payment UI ready, payment started/retried, sanitized failure category, page closed, and best-effort abandonment. The server records PaymentIntent creation, verified success/failure transitions, webhook receipt/signature verification, 3DS requirements observed through Stripe webhooks, payment confirmation, and invoice generation.

Events retain Stripe identifiers as references where useful. Raw Stripe webhook bodies and Stripe objects are not stored. Failure details are reduced to an allowlist such as `card_declined`, `authentication_failed`, `processing_error`, `network_error`, `cancelled`, or `unknown`.

## Checkout Abandonment tracking

The browser marks checkout entry, payment start, retries, terminal completion, page close, and a best-effort abandonment event when a started checkout closes before confirmation. It uses application events rather than screenshots, keystrokes, DOM capture, or session replay. Browser shutdown can prevent a final network request, so abandonment is an operational indicator rather than guaranteed proof.

These events support later calculation of checkout conversion, abandonment, retry rate, and elapsed time to payment. No analytics aggregation was added in this phase.

## Evidence integrity controls

Admin users can generate a minimized JSON chargeback manifest containing application state, payment identifiers and states, invoices, document metadata, and the timeline. It excludes document paths, document contents, original filenames, contact details, card data, and raw Stripe payloads. The server calculates a SHA-256 checksum over the generated manifest and records generation and download events with server timestamps and actor type.

The checksum is an integrity indicator only. It is not proof of customer identity, consent, delivery, or cardholder authorization. Timeline rows have UUIDs, no application update/delete API, and restrictive foreign keys. Database-trigger enforcement remains an explicit production rollout decision.

## Privacy and retention considerations

Necessary fields are limited to application/payment identifiers, event name, source, actor class, server timestamp, attempt number, resulting state, policy version, sanitized failure category, and optional short operational summary. Evidence manifests use document type, size, state, and timestamp—not content or filesystem paths.

The system must not store card numbers, CVC, expiry dates, Stripe iframe content, typed payment fields, screenshots, keystrokes, full browsing recordings, raw provider errors, raw webhook bodies, secrets, infrastructure paths, or unrelated customer behavior.

Timeline access uses the same exact-application capability boundary as application/payment access. Staff/admin access remains server-authorized. Evidence generation and download are admin-only and create audit timeline entries.

No retention duration has been invented. Retention, legal holds, deletion requests, backup deletion, dispute windows, and production database immutability controls are recorded in `BLOCKED_DECISIONS.md`.

## Explicit payment-data confirmation

- No card data is recorded.
- No CVC is recorded.
- No card expiry is recorded.
- No Stripe iframe content is recorded.
- No typed payment fields or keystrokes are recorded.
- No screenshots of the payment form are recorded.
- No payment-screen or browser-session recording is implemented.

## Stripe TEST staging UAT — 2026-08-12

The isolated staging runtime now loads the Stripe publishable key from the ignored `staging/.env` file and the secret/signing keys from ignored files below `staging/secrets/`. Startup rejects non-TEST API keys. No credential value is tracked or printed.

Synthetic TEST-mode UAT verified a succeeded PaymentIntent, a declined payment, a successful retry on that application, a PaymentIntent requiring 3DS action, an abandoned pending intent, valid webhook signatures, invalid-signature rejection, and duplicate event replay. The duplicate returned an idempotent response and did not duplicate payment confirmation, invoice, or invoice timeline evidence.

For the successful case, the immutable application price snapshot, Stripe amount, payment row, and invoice amount matched. The application became paid, the payment row became succeeded, an invoice PDF was linked, and policy acceptance, PaymentIntent, webhook, payment, and invoice references were present in the timeline/evidence foundation.

The current embedded Stripe `CardElement` collects card number, expiry, and CVC inside Stripe-hosted UI. Postal code is hidden and there is no custom or fake ZIP value. Conditional provider-requested billing fields would require a reviewed migration to Stripe Payment Element; that UX migration was not mixed into the payment-integrity change.

For PAY LATER, the recommended design is an application-specific Stripe Checkout Session created server-side from the immutable price snapshot. Store the Checkout Session and PaymentIntent references against the existing application/payment, use one idempotency key per application/payment attempt, and finalize only through verified handled webhook events. Do not use a generic reusable Payment Link. Before enabling this design, implement and test `checkout.session.completed`; refund/dispute handlers should likewise precede any new event subscriptions.
