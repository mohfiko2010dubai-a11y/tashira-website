# Remaining ERP completion tasks

Latest owner instruction: finish the remaining work in tested, reviewed logical phases on isolated staging. Production is not authorized. Existing compatible workflows remain authoritative.

## T1 — Scanned visa delivery — SERVER ACCEPTANCE PASSED; VISUAL CHECK IN T4
- T1.1 Preserve exact scanned bytes and validate their hash on read. Reject changed files and unsafe paths; no personal bytes/paths in logs.
- T1.2 Bounded local scanner integration with authentic engine/database, clean/infected/error/timeout outcomes, no automatic PASSED. Avoid cold-start work blocking every click.
- T1.3 Persist byte-bound scan evidence, recheck assignment after scanning, serve the authenticated customer's verified delivery only. Keep retries idempotent.
- T1.4 UI guidance, failed/unavailable retry, multi-traveller completeness, actual synthetic clean/EICAR test on staging. Run check/lint/test/build and mandatory DB integration gates before deployment.

## T2 — Financial attribution — IN PROGRESS
- T2A: correct pricing-margin currency, use stored FX once for family totals, explicitly separate historical base currencies and label quote estimates. Deployed995caae on staging; CI38095960139 including77 mandatory MySQL tests and exact-server gates passed. HTTP health/access checks passed; visual check remains T4.
- T2B1: actual immutable Stripe settlement evidence deployed6248351; CI80/21 passed, actual TEST payment GET/replay verified. Invoice/credit-note matching and actual provider refund UAT passed in T2B2; supplier/internal expense and profit definition remain T2C. Do not estimate settlement FX from invoice FX.
- T2B2: invoice/credit-note archive identity, amount, currency and PDF hash checks deployed dd936d1; actual TEST refund215 GET/replay passed.
- T2C: manager closure details open the per-case financial reconciliation. Final profit remains blocked on actual supplier/internal expense and accounting tax evidence. Attach reconciled per-case results to the existing manager-only closure attribution; reopen/reassignment must not double-count. Missing evidence stays incomplete, never zero/final profit.
- Reconcile actual paid invoices and top-ups, successful refunds/credit notes, supplier cost/VAT, actual Stripe fees and currency conversion.
- Exclude test data; distinguish missing cost or settlement from zero; preserve approved accounting policy.
- Verify reopened/reassigned case attribution and manager-only visibility. No invented final profit.

## T3 — Communications — IN PROGRESS
- T3A deployed: existing durable outbox, current case-owner authorization, immutable request/retry and recipient binding. Migration077 and CI82/21 passed. Actual synthetic reply SENT once with provider ID; inbox receipt not established.
- Reuse existing email/outbox/support ownership; preserve each application's own recipient and language.
- Configure and test genuine inbound/outbound provider connection. Hostinger MX is mailbox hosting; Resend outbound delivery webhook is not inbound mail.
- WhatsApp Business app number is not an official API connection. Record missing provider setup; do not simulate connectivity or change domain MX/production mail.
- Verify events, duplicate prevention, customer reply routing and assigned staff visibility.

## T4 — Full acceptance and handover — OPEN
- New draft TEST classification fix deployed8224e02; final family API UAT passed on runtime4f866de. Customer supplier-cost leak fixed on both getters; actual customer/staff/manager boundary checks passed.
- Synthetic staging customer/employee/manager journey: save/resume, payment, amendment/top-up invoice, partial refund, supplier dispatch/filing proof, visa delivery, tracking/email.
- Verify queue transitions, concurrency/ownership, prohibited staff financial/admin actions and historical application compatibility.
- Final real scanner/download regression and HTTP ownership tests passed; these do not replace visual acceptance.
- Authenticated visual UAT and Arabic illustrated guide. Browser infrastructure currently exits before inventory; HTTP200 is not visual acceptance.
- Final transfer checklist/rollback and exact remaining owner actions. No launch-ready claim until evidence exists.

Each phase: implement -> focused tests -> full required gates -> review -> staging deployment -> evidence -> update PROJECT_STATUS. External blocked items do not stop independent work.
