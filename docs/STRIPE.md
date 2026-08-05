# Stripe

## Current source flow

1. Browser loads an application by reference.
2. Browser supplies amount, currency, and reference to `payment.createIntent`.
3. Backend calls Stripe and records a pending payment.
4. Stripe Elements confirms card payment in the browser.
5. Browser calls `payment.confirm`.
6. Backend marks records paid and generates an invoice.

## Current risks

- Browser controls the requested amount.
- Confirmation does not independently retrieve and verify the PaymentIntent.
- Procedures appear public in static source.
- No signed Stripe webhook handler was found.
- Finalization lacks complete transaction and idempotency guarantees.
- Schema drift affects amount fields.

## Required target flow

1. Server loads the application and confirmed business rules.
2. Server calculates amount and currency using decimal-safe logic.
3. Server creates/reuses an idempotent PaymentIntent with application metadata.
4. Browser confirms payment only through Stripe Elements.
5. Signed Stripe webhook is the authoritative completion signal.
6. Backend verifies signature, event replay, PaymentIntent status, amount, currency, and application identity.
7. One transaction updates payment/application/invoice records.
8. Repeated events return the already finalized result.

## Security rules

- Never expose `STRIPE_SECRET_KEY` or webhook secret.
- Never trust browser totals or payment success claims.
- Never log complete Stripe objects or card data.
- Restrict refund and administrative operations to explicit server-side roles.

## Business confirmation required

Before implementation, obtain approved specifications for visa prices, government fees, service fees, VAT treatment, currencies, exchange rates, discounts, refunds, invoice amounts, and rounding.
