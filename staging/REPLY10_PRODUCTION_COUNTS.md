# REPLY 10 — production row-count decision gate

Read-only consistent InnoDB snapshot: 2026-10-03T19:05:05.387Z. Production remains closed at 9e589e0e0d751f314fea1c671db469f1b7161293. No migration, clean schema, seed, invoice, customer-data export or production mutation.

| Table | Rows |
| --- | ---: |
| applicants | 35 |
| application_price_snapshots | 2 |
| application_risk_assessments | 0 |
| application_timeline_events | 53 |
| applications | 42 |
| business_settings_versions | 1 |
| chat_messages | 37 |
| customer_recovery_challenges | 4 |
| deletion_audit_events | 0 |
| document_lifecycle_events | 3 |
| documents | 17 |
| financial_events | 0 |
| invoices | 11 |
| legal_hold_events | 0 |
| outbound_email_events | 4 |
| payments | 42 |
| pricing_rules | 16 |
| retention_policies | 0 |
| retention_records | 0 |
| staff_users | 2 |
| stripe_webhook_events | 2 |
| suppliers | 1 |
| users | 0 |

## Interpretation

42 applications: 2 LIVE paid, 1 LIVE pending, 25 TEST paid, 14 TEST pending, according to stored application classifications. These labels do not independently prove the Stripe mode of every historical payment. Payment rows total42 (28 succeeded,14 pending); do not infer a one-to-one state match from these aggregate counts. Eleven invoice rows are not the same as two currently LIVE invoices. No row was discarded or reclassified.

Orders40/41 each retain one applicant,three documents,one invoice,one payment. Six documents/two invoices are therefore only a subset of production contents. Pricing rules16, business settings1, staff2, supplier1, timeline53, chat37, recovery4 and email4 are additional state. Row counts alone cannot establish that any of it is reconstructible or safe to omit.

Recommendation: favour a rehearsed forward migration preserving all existing rows over a selective import of only the two paid orders. A clean-schema route remains possible only with an explicit complete mapping/retention decision covering all23 tables, not four records. Neither route is started; owner requested this decision round first.

## Startup guard clarification before implementation

At cutover require TSH-INV=2, both original mappings and matching PDF hashes, and TSH-CN=0. On later ordinary boots, requiring the invoice counter to equal2 forever would prevent restart after the first legitimate invoice00003. Proposed ongoing invariant: both legacy mappings stay intact, counters agree with their immutable archives, and no counter falls below its initialized baseline. Missing or inconsistent evidence prevents startup. This is a proposed clarification, not a deployed guard.

Closure must be integrated default-closed into the unified staging candidate before any production upgrade; missing/unreadable/malformed configuration remains closed. This work and startup guard implementation remain pending this preflight decision. The accepted real-production-copy rehearsal is authorized for the chosen route, but no dump/restore was taken prematurely.

