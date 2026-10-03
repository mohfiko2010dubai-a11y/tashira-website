# FINISH-LINE Phase 1 — staging verified

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

Local TypeScript/lint/production and SSR build pass. Latest full suite: 1,240 pass, 26 dedicated MySQL tests run separately by hosted CI. CI37156176697 and CI37156759641 both jobs pass, including the zero-skip MySQL gate and actual substitution filing trigger.

Migrations 059–061 applied only to identity-verified staging after private backup `/var/backups/tashira-staging/2026-10-03T21-45-04-248Z-finish-line`. Deployed staging110d751. No production mutation.

Verified staging cases:

- Approved company identity stored as version2 with phone provisional; exact named refusal and public intake closure verified. Separately labelled synthetic versions3–5 support TEST UAT; these are not production settings or an approval of the real phone.
- Settings activate immediately; changed passport threshold changes computed review facts. Old invoice PDF hash, snapshot and settings version remain byte-identical. Review decision appears in the order timeline.
- Actual Stripe TEST payment with short-validity passport creates immutable TEST-INV-00005/settings version3; actual fee3600 AED minor units matches the provider. Replay issues no additional invoice. No LIVE payment or customer email.
- Initial confirmation returned500 after payment committed. Candidate7868a10 separates settlement-fee retry from the customer's successful payment; webhook retries until actual fee is reconciled. Explicit pending-fee regression tests pass. Fresh deployed confirmation test remains outstanding.
- Dynamic GCC flow saves short passport/residence dates and optional DOB, flags child review, uploads distinct synthetic document leaves and reaches checkout READY. Initial UAT harness attempts omitted sequential questions/grouped leaves; corrected harness follows the client protocol.
- Actual SQL filing blocked without consent; anonymous/admin sessions cannot acknowledge; stale proposal rejected; exact customer-owned version accepted; sold product unchanged.
- Sudan multiple-entry restriction shown in Arabic and checkout rejected412 before Stripe; single-entry warning clears. Activation timestamp corrected via versioned admin API to Dubai midnight (20:00 UTC); audit retained.
- PDF rendered and visually inspected; company header and archived identity correct. Tight payment-reference spacing corrected for subsequent invoices; issued PDFs remain immutable.

Original15 unrelated dirty files preserved. Current synthetic evidence and sessions remain private under `/var/lib/tashira-maintenance/finishline-*`.

## Final deployed verification — 4 October 2026

Staging deployed d57a69911bd0de898a7868903e4456bd40d10c22. CI37157724442 both jobs SUCCESS, including the dedicated 26 MySQL tests with zero skipped. Deployment repeated check/lint/tests/build and returned local/public health200. No production mutation.

Fresh synthetic GCC traveller payment: first confirmation returned success while the provider balance transaction was pending. Immutable TEST-INV-00006 records company settings version5; replay returns the same invoice and invoice count remains1. A subsequent confirmation, after the provider transaction became available, stored the actual fee3600 AED minor units, exactly matching Stripe. This explicitly verifies both pending and available settlement paths; it does not claim an observed automatic webhook retry for this charge. Webhook retry behavior is covered by the implementation and regression tests.

Rendered the new archived PDF: company identity, total185USD, settings snapshot and corrected payment-reference spacing inspected. Archive SHA256 a2d3e485598fffd67c1034a4914dc5bfe59f532e5f673a4fea153f9de8341c56. Admin settings UI shows history and6/3/12 thresholds. Original15 unrelated dirty files remain unchanged.

Phase1 implementation and staging verification complete. Phase2 emails, approvals, staff controls and launch gates are not complete. Production remains closed. Dedicated phone still needs real owner confirmation before reopening; no flag was silently cleared in production.
