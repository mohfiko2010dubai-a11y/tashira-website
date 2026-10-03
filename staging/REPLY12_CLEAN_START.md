# REPLY 12 — clean-start candidate (2026-10-03)

REPLY12 supersedes REPLY11: owner confirms all orders were his tests, including LIVE-mode charges. No forward migration or pre-series import. First genuine invoice is TSH-INV-00001; initialise counters to zero. Production must remain closed.

Production database archive has been restored into an isolated verification schema: all23 table counts match. The storage tar round trip preserves17 files. Four existing referenced invoice PDFs match the archive; eight legacy test application references already point to missing files (5,7,8,9,10,11,28,29). These pre-existing omissions are recorded, not reconstructed. The private manifest and original dump retain the evidence. Original production data remains untouched.

Candidate changes: intake defaults closed without explicit readable configuration; new application/payment/deposit creation is guarded, with prior confirmation/recovery retained. Form/chat entry and payment screen show the closure. Removed two-invoice legacy-seed function; isolated rehearsal starts at00001. Boot now verifies contiguous counters, canonical numbers, archive byte hashes and invoice associations before listening. Old unnumbered TEST-runtime fixtures are excluded from association checking; LIVE runtime checks every invoice. The zero check is a separate deployment assertion, never the permanent boot condition.

Local check/lint and1197 tests pass (26 database-gated tests belong to the dedicated CI job). Focused17 regression tests pass. Build, isolated MySQL rehearsal, staging deployment and clean production deployment still pending. No refund executed; owner approval is pending after presenting the complete two-charge LIVE list. Do not report Phase1 or launch complete.
