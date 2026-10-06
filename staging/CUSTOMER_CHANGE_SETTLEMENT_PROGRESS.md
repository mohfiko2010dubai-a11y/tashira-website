# Latest candidate — 2026-10-07

Owner decision: a paid increase gets its own numbered invoice for ONLY the difference; original invoice remains unchanged. For decreases retain the existing refund/credit-note accounting model.

Implemented in the local candidate after the earlier mail checkpoint:
- Migration068: immutable visa_change_quotes, monetary checks, one payment/refund reference per quote, explicit lifecycle states and filing guard. NOT applied or MySQL-tested yet.
- Server proposal snapshot: original paid checkout amount and frozen traveller count, current replacement catalogue price, signed difference; latest settled proposal is the basis for later changes. Existing accepted unsettled proposal blocks a second proposal. Unpaid orders are directed to editing the original form.
- API and EN/AR UI: show previous/new totals and exact price difference; customer consent requires exact quote UUID plus version. Missing historical price evidence requires a fresh proposal. Equal-price consent settles without charging; nonzero consent remains ACCEPTED.
- Separate invoice issuer verifies succeeded linked payment equals positive difference, reuses its invoice on replay, uses canonical financial series and never updates original application invoice pointers. It is not yet wired to a finalizer.
- Final local check/lint/build pass;1372 tests pass and26 existing MySQL integration skips. Initial lint issue in test formatting fixed, rerun clean.

NOT READY TO DEPLOY: accepted nonzero differences have no collection/refund execution path yet. Continue with Stripe payment, webhook/finalization, invoice snapshot (label explicitly as visa-change difference), refund reservation/reconciliation, financial-status email copy, DB integration and staging UAT. No migration, deployment, Stripe operation or provider send in this phase. Staging remains e018c38. Previous checkpoint follows for context.

# Customer change settlement checkpoint â€” 2026-10-07

## Implemented locally

- Exact succeeded payment/invoice ownership lookup drives recipient, amount, currency and attachment. Caller-supplied stale fields cannot redirect mail or misstate money.
- SENT receipt scope is payment:{paymentId}. Legacy null-source receipts suppress only the earliest application invoice, preserving already-sent original receipts without suppressing later payments.
- Timeline worker selects the invoice for the event's payment, not the application's latest invoice. Missing or ambiguous records fail visibly/retryably rather than guessing.
- Arabic payment tracking links preserve language. Proposal mail opens the existing protected application consent view.
- Seven additional tests cover recipient/facts resolution, invalid invoice identity, replay, provider retry, and original-event selection when additional invoices can exist.

## Verification

check and lint passed. Full suite: 1351 passed, 26 pre-existing MySQL integration tests skipped locally (11 files). These database tests were not exercised in this phase. Final build passed, including server bundle syntax, static asset and marketing compliance checks. Original 15 dirty files verified unchanged. No migration, deployment, provider send, Stripe payment/refund, or production change.

## Still required before owner demonstration

1. Store immutable server-priced proposal/version, prior settled basis, new total and signed difference, with application-row locking and explicit accepted state.
2. Display both totals and the exact difference before customer consent; stale versions must be rejected.
3. Positive difference: separate Stripe TEST payment, replay-safe webhook finalization, separate canonical invoice, preserved original application payment/invoice.
4. Negative difference: reserve exact remaining refundable sources and use existing audited approval/execution/credit-note flow; confirm only provider-verified refunds.
5. Mark proposal settled only after financial accounting succeeds; prevent filing an unsettled replacement while preserving historical completed orders.
6. Payment-specific completion and refund emails to the stored application contact; unchanged scoped staging UAT inbox/reference allowlists.
7. End-to-end browser demonstration including authentication, cancellation/retry/replay and actual owner inbox verification.

Current staging remains e018c381be9eb7cfa5e8e5c330460c1de72e90b9. The difference-payment/refund feature is not implemented and is not ready for UAT. This checkpoint must not be represented as completion.
