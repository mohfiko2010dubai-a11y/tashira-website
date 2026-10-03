# REPLY 09 — production/staging gap and guarded migration proposal

Read-only inventory on 2026-10-03. No production schema/code change, backup restore, seeding, invoice issuance or live charge was performed for this review. Production remains closed.

## Decision requested by the owner: the gap is large

Production `9e589e0e0d751f314fea1c671db469f1b7161293`; staging `0492e73e056f22d06110f4163b8560a2148169a5`. There are 389 commits reachable only from staging and one reachable only from production. This is not 389 isolated features: it includes fixes, documentation, test evidence and merges.

The diff contains 1,100 paths, +103,224/-36,533 lines including generated bundles. Excluding the four generated build paths: +53,143/-3,317. Breakdown: 213 backend files, 173 frontend, 33 contracts/schema, 262 tests, 81 migration/rollback files, 214 documentation/evidence files, 34 build/CI/operations scripts, 46 public assets and 40 other paths. Full inventories are committed beside this report (`REPLY09_CHANGED_FILES.txt`, `REPLY09_COMMITS.txt`, `REPLY09_GAP_INVENTORY.json`).

Actual read-only database metadata: **23 production tables vs 117 staging tables**; 94 tables only in staging, none only in production, plus eight new columns on existing tables. The 49 forward migration files span 010–058; this is a source inventory, not proof that replaying every file blindly against production is safe. Schema defaults include formatting differences such as CURRENT_TIMESTAMP/now(), which must not be mistaken for business changes. Full metadata diff: `REPLY09_SCHEMA_GAP.json` (no customer rows).

## What else is in the gap

| Area | Main changes and paths | Upgrade concern |
| --- | --- | --- |
| Payment integrity | `api/lib/checkout-quote.ts`, `payment-state.ts`, `payment-finalization.ts`; migrations046–051: frozen displayed quotes, event ordering, webhook idempotency, explicit policy evidence, creation/payment recovery | Backfill/classify legacy state; retain existing paid orders and signed access; do not create new Stripe intents as a migration check |
| Refunds/deposits | `api/refund-router.ts`, deposit flows; migrations010–013 plus new invoice/credit-note archive058 | New backend workflows absent from production. Do not activate a staff refund screen merely because accounting integration passes |
| Customer wizard and assistant | `UnifiedApplicationForm.tsx`, traveller data/uploads, family document sharing, canonical application inside ChatBot, save/resume, validation and passport-name changes | Resume the two legacy applications without converting or losing their documents; preserve customer cookies/ownership |
| Documents/rules | `contracts/document-requirement-engine.ts`, dynamic interview/catalog/governance and eligibility code; migrations016–030,039–042,053 | Approved/draft state, rule data and flags are not supplied just by copying code; never copy the staging customer database or its synthetic records |
| Uploads | `api/lib/document-upload*`, HEIC decoding, image conversion/orientation, new `libheif-js` and `sharp` dependencies | Native runtime/build compatibility, private storage paths, old root-origin files and upload limits must be reverified under non-root production UID |
| Back office | Operations roles/scopes, controlled writes/audit, supplier SLAs, scheduling, authority output, document intelligence, support inbox and email queue; migrations014–044 | Existing staff do not automatically acquire correct roles; all feature flags, mail and background jobs need explicit environment mapping |
| Product/business policy | availability, withdrawn products, nationality controls, frozen price snapshots, service clocks and Express refund guarantee; migrations054–057 | Pricing/rules are DB data. Raw migration054 is not evidence of the final approved Express fee; review effective current policy separately, without overwriting negotiated production values |
| Rendering/languages/content | SSR and fallback, `/en`/`/ar`, route metadata/hreflang, shared public data, CMS045, RTL/font/logo and marketing copy updates | Host canonicalization, root routing, old links, cache-control, staging noindex and production indexability need environment-specific verification |
| Privacy/access | redacted logging, protected invoice/storage routes, explicit test classification and analytics controls | Preserve secret/session boundaries; keep production mail/Stripe configuration and all TEST records out of production |
| Build/deploy/extra source | MySQL CI, revised manual deploy workflow, SSR build, static/compliance guards; creative-factory POC also appears in history | Do not enable unrelated POC workflows. Existing deployment workflow is not a ready-made approval for this upgrade |
| Invoice numbering | continuous counters, immutable PDF bytes/hash, independent TEST and credit-note series, legacy mapping, retries | Seed both real legacy documents atomically before enabling allocation; do not issue a synthetic live invoice |

## Critical production-only difference

The one production-only commit `9e589e0` implements intake closure. Staging does **not** contain `api/lib/application-intake.ts`, `contracts/application-intake.ts`, `IntakeNotice` or their route guards. Replacing production with staging as-is removes the code enforcing `/etc/tashira-production-intake.json`; leaving that config file on disk would not protect intake. Closure must be integrated into the shared candidate and tested before any upgrade. Paid legacy access must remain available.

Recommendation: choose **(b), converge on one release**, but not a direct deployment of today's staging SHA. Prepare a shared release with the closure guard preserved, audited migrations/reference data/flags, permanent CI green, and an explicit legacy-order rehearsal. Keep production closed until all Phase1 rules are complete. No production upgrade will occur before the owner's review of this gap.

## DDL/seed atomicity: correction needed to the requested mechanism

MySQL 8 CREATE TABLE/CREATE TRIGGER perform implicit commits; wrapping migration058 and its seed in BEGIN does not make the whole operation rollbackable. Official reference: https://dev.mysql.com/doc/refman/8.0/en/implicit-commit.html . I will not claim atomic DDL+DML.

Proposed equivalent safety outcome (pending approval of the upgrade approach):

1. Before mutation, take a full production DB backup plus configuration and original PDF manifests. Restore the backup into a root-restricted isolated recovery instance, never staging; no app/mail/network execution on restored customer data. Verify complete table counts, schema, both invoice/payment records and PDF hashes. Record proof. Production modification is gated on this successful restore.
2. Keep intake closed **and quiesce payment finalization, webhooks and background writers** for the migration window. Incoming Stripe retries must be safely deferred; the existing intake flag alone does not stop webhooks.
3. Apply additive DDL while the new allocator cannot run. Verify expected columns, constraints and immutable triggers. A partial DDL application is an incomplete migration, not an enabled release.
4. In one InnoDB transaction, lock/validate the live series, register both originals at positions1/2, set TSH-INV to2, explicitly initialize TSH-CN to0, and commit the initialization marker. Original invoice rows/numbers/files remain unchanged; archive records contain the original PDF bytes/hash and explicit legacy mapping. Add the original source path to the mapping evidence so file provenance is explicit.
5. Run the same seed a second time: it must verify matching identities/bytes and leave counters2/0, not increment. Conflicting or partial evidence fails closed. Existing seed already tests idempotency; the release activation/marker guard still must be implemented and tested.
6. Deploy/start only a build whose initialization preflight proves both mappings and counters. Inspect state and open both original PDFs. **Do not create a production test order or consume00003.** No TSH-CN is issued either.

## Written rollback before execution

- Before DDL: abort and retain current production release/closure; no data mutation to undo.
- Partial additive DDL or seed failure: leave payment writers stopped and intake closed. SQL seed rolls back fully; do not restart the allocator over an empty/partial ledger. Inventory objects actually created against the preflight manifest. Either complete/revalidate the additive migration, or restore the already-rehearsed full DB backup in the maintenance window and restore the old code/config. Do not run a generic DROP script or remove document storage.
- Seed committed but release startup fails, with no new financial issues: retain immutable ledger, originals and backup; revert code/config with intake/writers still closed. Validate legacy invoice access before restoring approved read-only service.
- Any financial issue unexpectedly occurs after cutover: **never decrement a counter, delete an archive or restore an older DB over it**. Stop writers; forward repair and reconcile provider evidence. This case cannot be handled by the pre-issue rollback.

The immediate production backup/restore and migration are intentionally not executed before the owner decides the upgrade scope. This report is not a claim that the backup has been tested.

## Locked-in future TASK22 interface acceptance

Server refund accounting was verified, not a completed staff UI. When the TASK22 screen exists, repeat via the interface: double click/retry the same refund; cumulative over-refund rejected; partial refund creates one credit note for the actual amount; two staff concurrently refunding the same order cannot exceed its remaining refundable balance or duplicate the provider refund. Verify staff permissions, recorded approval, invoice series unchanged, independent credit-note numbering, and customer outcome display. API-only results do not close this gate.

## This reply's code and pipeline work

Lock ordering is now a comment convention adjacent to `lockCase` in `api/lib/operations/mysql-controlled-write-executor.ts`: application first, case controls, document controls, then idempotency/audit; financial paths use application then refund item when present then counter. Rendering/network/retry delay are outside the transaction. No business behavior changed by the comment.

Permanent CI defines an isolated MySQL service, creates a synthetic schema and invokes `scripts/run-mysql-integrations.mjs`, which rejects non-rehearsal databases and fails unless all26 tests pass with zero skips. Publishing and hosted-run evidence are recorded separately when actually observed. No main/master push or automatic production deployment is part of this work.

Remaining Phase1 rules (three-month residence gate, nationality-by-product availability, submitted_product and actual Stripe fees) remain open. No launch-clearance claim.
