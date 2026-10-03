# FINISH-LINE Phase 1 — candidate, not deployed

Owner decisions: `codex-FINISH-LINE.txt`, 4 October 2026. The refund decision is now closed: amount less the actual processing fee, disclosed before payment and in the refund policy. Earlier pending-decision notes are superseded.

## Implemented candidate

- Shared entry-date validity findings with configurable passport/residence/child thresholds. Missing entry remains unknown; never substitute application date. Date thresholds do not block form completion or checkout; malformed/missing passport dates still receive validation feedback. Conditional travel-date question, optional DOB, stored residence expiry. Staff review facts and recorded decisions.
- Approved bilingual notice in checkout/form and refund page, policy version advanced to `legal-bundle-2026-10-04-v4`.
- Versioned admin company settings, nullable VAT/TRN when unregistered, explicit provisional-field list. Intake checks active settings even if the deployment intake switch is opened. Missing/unreviewed company identity fails closed, administrative status names fields. No automatic reopening.
- Invoice render uses a company snapshot and settings version; archival PDF remains immutable and invoice row records the version.
- Time-windowed nationality/product restrictions in the admin catalogue, checked by readiness and under the checkout lock. Owner TASK25 seed adds Bangladesh and Sudan multiple-entry restrictions. Existing broad nationality restrictions remain.
- Separate submitted product and mandatory reason; proposal resets customer acknowledgement. Only an owned customer session can acknowledge the exact current version. Database trigger guards all filing-status writers. Proposal email is Phase 2; lower-price financial amendments remain deferred by FINISH-LINE.
- Actual Stripe settlement fee, currency and transaction ID stored on the payment, exposed to admin with reconciliation action. No guessed percentage or conversion. Public quote no longer returns supplier cost, markup or minimum margin.

## Verification in progress

Local TypeScript, lint and production/SSR build pass. Latest full suite before final adjustments: 1,232 pass / 26 dedicated MySQL tests skipped locally. Follow-up full run: one obsolete policy-version assertion corrected; targeted tests pass. Final CI and staging UAT are still required.

Migrations 059–061 have not been applied at this checkpoint. CI runner executes them on a disposable schema and exercises the actual filing guard before running the existing 26 no-skip integration tests.

Staging read-only identity verified: `tashira_staging`, `tashira_staging_app@localhost`, storage UID999, deployed SHA `7cdde687b8d4d2386ab97c856f17304abe621e4b`. No production mutation. Original 15 unrelated dirty files remain hash-identical.

## Remaining before calling this phase complete

Hosted CI, migration/staging deployment, browser UAT, immutable company/version invoice checks, checkout with short-validity dates, matrix and customer-consent ownership checks; seed/review company settings. Production remains closed. Phase 2 emails, approvals, staff controls and launch gates are not complete.
