# Clock/settlement binding rules — 2026-10-07

Owner source: C:/Users/ADMIN/Downloads/codex-CLOCK-AND-SETTLEMENT.txt.
- Derive elapsed time from timestamped pause/resume events; never persist a running elapsed counter.
- Pause on successful documents-request/quote SENT or difference payment-link ISSUED, not a later status write. Correlate each wait with a unique request/version key; resume retries are no-ops.
- Existing orders retain prior elapsed time. New pause rule applies from a recorded deployment activation timestamp forward; never infer historic pauses from creation/status.
- Surface waits older than configurable threshold in admin, oldest first. No customer live countdown; show date/time and explain deadline changes.
- REFUSED remains filing-blocking, never treated as SETTLED; keep paused until approved outcome resolution. All four owner-defined outcomes go through approvals with reason and written insistence/risk evidence when choosing original product.
- Manual settlement requires direction, exact amount/currency, quote/version, Stripe reference, named actor/time and approvals. Payment-link creation alone is not evidence that funds arrived. On approved completed settlement unblock/resume and send adjustment_issued naming what/why. Automated charge/refund work stays deferred.

Implemented this round: pure event-log projection with duplicate/out-of-order resume handling, activation filtering, and configurable oldest-first overdue-wait projection. Six added tests. Local check/lint/build pass;1385 tests pass with26 existing MySQL integration skips (not exercised). This is NOT bound to database events/mail receipts/admin UI yet; no operational clock/settlement completion claim. Migration068 and26 no-skip MySQL CI remain prerequisites to any deployment. Staging and production unchanged.

# Owner scope supersedes automatic settlement plan — 2026-10-07

Source: C:/Users/ADMIN/Downloads/codex-VISA-CHANGE-SCOPE.txt. Stop automated amendment collection/refund/webhook work until post-launch Phase5/TASK22. Keep quote/acknowledgement and unused separate invoice function; it uses the next number of the existing canonical invoice series, never a suffix.

Pre-launch remaining scope:
1. Customer refusal -> REFUSED (not settled), filing stays blocked. Queue a reasoned agent decision: full refund/cancel; refund less processing fee; keep open/another product; original product only with written customer insistence and recorded risk. Every outcome passes the approvals queue. Do not silently permit original-product filing just because the quote was refused.
2. Manual difference settlement with payment/refund reference recorded on order and auditable actor. No automatic new Stripe integration. Do not mark settled merely from acknowledgement.
3. Pause submission clock for requested documents, amendment acknowledgement and customer payment; resume on response. Persist each pause/resume with reason on timeline. Customer-holding time is excluded; overlapping reasons must not be double-counted; a pre-existing breach must not be erased by a late pause.
4. Test migration068 on MySQL and run all26 guarded MySQL tests with mandatory no-skip CI before staging deployment. Staging remains e018c38 until verified replacement deployment.
5. Return to Phase2: three named accounts/eight assertions, mobile approvals with Stripe balance and remaining refundable amount, paused-clock Express auto-refund, logged/watermarked/short-lived document access, real-delivery SPF/DKIM/DMARC and mail-tester evidence. Full customer journey only after these.

Local validation: check/lint/build passed;1379 tests passed and26 MySQL integration tests skipped (not exercised in this phase). No claim of database-gate completion.

Current new code is only the backward-compatible clock calculation accepting explicit wait intervals and seven edge-case tests. Existing runtime does not pass pause intervals yet, so the pause requirement is NOT implemented end-to-end. Refusal/approvals/manual settlement/timeline persistence and DB gates remain pending. No deployment/migration/Stripe operation/provider send. Older automation next-step lists below are superseded.

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
