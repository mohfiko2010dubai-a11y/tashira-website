# TASHIRA Business Rules Implementation Report

## Server-authoritative pricing

Pricing is versioned in MySQL by service, processing type, effective window, costs, markup, selling price, promotional price, minimum price, and currency. Application submission resolves an active rule on the server and creates an immutable application price snapshot. Stripe intent creation and Stripe verification read that snapshot; client-supplied amount and currency hints are ignored.

No active pricing rule is invented automatically. Approved opening pricing data must be loaded in staging through the versioned admin API or an owner-reviewed data migration.

## Company and finance settings

Company identity, VAT registration state, TRN, VAT rate/effective date, registration threshold, warning levels, invoice prefix/sequence, base currency, and exchange rate are versioned settings. New versions are appended; historical snapshots and invoices remain unchanged.

## Multi-applicant and documents

The normalized application/applicant model supports one application with multiple applicants. Documents retain applicant ownership. The full application form submits every applicant, while one payment, invoice, and timeline remain application-level.

Document lifecycle events are append-only and record upload, replacement, deletion, replacement requests, validation, and rejection without copying document content. Physical document deletion remains a separately authorized storage action.

## Recovery and email

Magic-link and OTP primitives use random secrets, SHA-256 hashes at rest, constant-time verification, expiry, attempt, and consumption fields. Delivery is provider-independent and disabled by default. Transactional email has typed template contracts and a disabled default provider; production delivery was not enabled.

## Risk and manual review

Risk levels are LOW, MEDIUM, HIGH, or CRITICAL and are derived from disclosed weights for retries, failures, trusted device/IP signals when available, velocity, and applicant count. Assessments are append-only, advisory, and never auto-reject. Device and IP factors remain zero until a reviewed privacy-safe signal exists.

Dispute notes and manual-review requests are immutable timeline events. Stripe webhook events remain visible in the same evidence timeline.

## Payment UX

Stripe Elements remains the payment-data boundary. Postal-code collection is disabled through Stripe's supported `hidePostalCode` option. No ZIP value is fabricated.
