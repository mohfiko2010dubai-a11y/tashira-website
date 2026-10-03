# REPLY07 — continuous numbering and exercised MySQL integration gates

Owner decision, 2026-10-03: preserve the original issued invoice numbers/PDFs for applications 40 and 41; record them as positions 1 and 2 in the invoice ledger; next invoice `TSH-INV-00003`. Invoice series `TSH-INV`, credit-note series `TSH-CN`, no annual reset. Test series remain separate.

## Existing delivery evidence

Read-only production query found PAYMENT_SUCCESS/SENT with a Resend provider reference for both applications (2026-08-21 07:36:43Z and 09:46:49Z). Each also has a FAILED attempt. SENT establishes provider acceptance, not inbox delivery. Original issued numbers must therefore remain unchanged. No resend performed.

## Candidate implementation and synthetic proof

- Immutable ledger import records original number, order reference, original issue time, original PDF bytes/hash and explicit legacy origin at positions 1/2.
- The counter and both entries commit together. Rollback consumes no position; altered evidence or a partial/conflicting import fails closed.
- Replaying the import verifies identities and bytes and never rewinds an advanced counter.
- Synthetic MySQL rehearsal: original bytes/numbers preserved, next number 00003, 20 concurrent issuances contiguous, duplicate issuance replay, rollback and rendering failure without gaps, continuous sequence over New Year, independent invoice/credit/test series, database rejects archive changes/deletes.
- This verifies the primitive, not a completed production import. Neither real invoice has been changed.

## All 26 formerly gated integration tests actually executed

Disposable MySQL 8.0.46 runs locally on port 33306 with its own data directory and service. Synthetic fixtures only; no production/staging database copies. The CI workflow now defines an ephemeral MySQL service and a dedicated integration job. Its runner refuses non-local/non-rehearsal targets, supplies every gate variable, and fails unless exactly 26 tests pass with zero skipped. Workflow is prepared locally, not yet published to remote CI.

Initial actual run: 20 passed, 2 failed, 4 could not start after fixture setup failures. Findings and resolutions:

1. **Actual code defect:** concurrent duplicate Operations commands deadlocked. INSERT IGNORE retained shared case locks and both transactions tried upgrading them. Acquire the application's exclusive row lock first. All 11 Operations write tests then pass, including replay, stale writes preserving finance, ownership, disabled flag and audit rollback.
2. **Incomplete disposable schema:** historical fixture lacked data classification, checkout tables, legacy applicant/storage columns and the current pricing/service-clock prerequisites. Add actual prerequisite migrations plus synthetic reference data; point both explicit repository pools and the shared application pool at the disposable DB.
3. **Missing scheduler fixture:** create an isolated synthetic travel group and schedule snapshot before running the alert lifecycle test.
4. **Time-dependent SLA fixture:** policy started at yesterday relative to the clock, but test commands use August 2026. Give the policy a fixed effective date preceding those unchanged commands. The policy-selection rule and assertions are unchanged.
5. **Timestamp tie in interview fixture:** synthetic MISSING and UPLOADED events could share a second, then random UUID order inverted the test's SQL result. Make initial synthetic MISSING explicitly precede upload. Keep exact history, ownership, concurrency and idempotency assertions. Existing production ordering handles initial requirement/upload ties separately.

Final isolated run: **26 passed, 0 failed, 0 skipped across 11 files**. No skip condition was changed or assertion disabled.

Full Linux gates in the isolated checkout: `npm run check`, `npm run lint`, `npm run test`, `npm run build` all exit 0. General suite: 1178 passed / 26 separately exercised integration cases. Client, SSR, backend, static-asset and marketing compliance checks pass. Exact integration case names/statuses are recorded in `REPLY07_MYSQL_RESULTS.json`.

## Deployment boundary

Production remains closed at 9e589e0; staging remains a9d6956. No invoice migration or application deployment in this verification phase. Required next gates: full Stripe TEST payment on staging, archive/download/email consistency, then a separately reviewed production package and transactional registration of the two existing invoices before enabling new numbering. Remaining Phase1 work and launch gates are still open.

The 15 pre-existing dirty files in the original staging checkout are hash-identical to the preserved manifest.
