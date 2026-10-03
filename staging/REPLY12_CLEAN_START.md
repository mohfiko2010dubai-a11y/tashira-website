# REPLY 12 — clean-start candidate (2026-10-03)

REPLY12 supersedes REPLY11: owner confirms all orders were his tests, including LIVE-mode charges. No forward migration or pre-series import. First genuine invoice is TSH-INV-00001; initialise counters to zero. Production must remain closed.

Production database archive has been restored into an isolated verification schema: all23 table counts match. The storage tar round trip preserves17 files. Four existing referenced invoice PDFs match the archive; eight legacy test application references already point to missing files (5,7,8,9,10,11,28,29). These pre-existing omissions are recorded, not reconstructed. The private manifest and original dump retain the evidence. Original production data remains untouched.

Candidate changes: intake defaults closed without explicit readable configuration; new application/payment/deposit creation is guarded, with prior confirmation/recovery retained. Form/chat entry and payment screen show the closure. Removed two-invoice legacy-seed function; isolated rehearsal starts at00001. Boot now verifies contiguous counters, canonical numbers, archive byte hashes and invoice associations before listening. Old unnumbered TEST-runtime fixtures are excluded from association checking; LIVE runtime checks every invoice. The zero check is a separate deployment assertion, never the permanent boot condition.

Local check/lint and1197 tests pass (26 database-gated tests belong to the dedicated CI job). Focused17 regression tests pass. Build, isolated MySQL rehearsal, staging deployment and clean production deployment still pending. No refund executed; owner approval is pending after presenting the complete two-charge LIVE list. Do not report Phase1 or launch complete.

## Deployment and verification completed

Production and staging now run application commit `7cdde687b8d4d2386ab97c856f17304abe621e4b`. Production uses a separate clean schema with117 tables/views, identical column definitions and136 matching triggers. The dump's single-statement trigger terminator was normalized for import; trigger bodies were compared afterward. The view references only the new schema. No old application/payment/invoice/staff records were imported.

Initial production activation rolled back after nginx's old static-shell configuration could not traverse the private release directory. Public routing now proxies to the SSR app, preserving private filesystem permissions. A second verification hit an old nginx worker during graceful reload and rolled back; fresh-connection verification after reload passed. The previous runtime, environment, database, documents, nginx/PM2 configuration and an executable rollback are preserved in the restricted server archive. The final switch and checks took about7seconds; this is not a measured outage duration.

Verified through public HTTPS: EN/AR home, prices and apply routes return200; current JS entry assets load; intake reports closed; seven catalogue products match exactly. Application, applicant, document, payment, invoice, archive and staff tables are empty. All four financial counters are0. No LIVE payment or invoice was issued to test the reset.

| Product | Regular USD | Express USD |
|---|---:|---:|
|96-hour transit|145|195|
|14-day single|165|215|
|14-day multiple|265|315|
|30-day single|185|235|
|30-day multiple|285|335|
|60-day single|295|345|
|60-day multiple|385|435|

Staging prices were aligned by appending versions, leaving existing order snapshots unchanged. Staging is explicitly open for TEST UAT via its own configuration; production remains closed, and missing configuration defaults closed everywhere. No staging credentials were copied into production. Production outbound email remains disabled.

Post-switch isolation: staging cannot list production documents, read production.env, list the restricted archive or query the clean production schema. The new production DB account cannot query staging or the old production DB. A small synthetic filesystem probe inside the actual service mount namespace passed write/read/UID verification and was removed. Per-user PM2 state was saved and the stale credential-bearing snapshot archived privately. The original15 dirty local files remain hash-identical.

Quality: check/lint/build passed;1197 tests passed; the26 gated integration cases passed in the dedicated hosted MySQL job with no skips. CI: https://github.com/mohfiko2010dubai-a11y/tashira-website/actions/runs/37148017020 . The isolated invoice rehearsal passed20 concurrent issuances, replay, rollback, archive immutability, independent credit/test series and year rollover; the first genuine series number is00001. Actual boot checks passed on the populated staging ledger and the empty clean ledger.

## Still open — not a launch approval

- Refund approval pending after the complete LIVE charge list was presented. No refund has been issued. Preserve the private charge/fee evidence for future reconciliation.
- Actual staging business settings and supplier were discovered to be explicitly synthetic. They were NOT copied. The clean business-settings and supplier tables deliberately remain empty pending owner-approved real values. Cost/minimum-price fields inherited from staging are not asserted to be verified supplier costs; commercial verification remains required.
- Remaining Phase1 TASK25 work: residence-minimum eligibility, product-specific nationality availability, submitted-product/customer acknowledgement/refund consequence and per-order Stripe fee recording. These are not claimed complete by the clean-start deployment.
- Production must remain closed until all outstanding phases and owner gates are satisfied.
