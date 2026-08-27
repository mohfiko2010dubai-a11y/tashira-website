# Visa Operations OS V1 — Production Readiness Package

Status: **prepared, not authorized for execution**.

## Release identity

- Source branch: `codex/visa-operations-os-v1`
- Latest exact Staging implementation/runtime SHA: `4058dcd897e3719447e279feed992e392005a6f6`. Current release-candidate branch SHA `cbd8132d670d1aafe1a1ed182332eef24b17da85` adds only the read-only release-manifest verifier after that runtime deployment. No SHA is authorized for Production.
- Database chain: reviewed additive migrations `014` through `041`; re-rehearse the exact chain against an isolated restored Production-shaped copy before authorization.
- Production changes performed by this package: none.

## Required Production sequence

1. Obtain explicit owner authorization for merge, backup, migration, deployment and each feature activation.
2. Prove the target path, host, database and storage identities; fail closed on any mismatch.
3. Capture protected row counts, document fingerprint, current SHA, PM2/Nginx health and effective flags.
4. Create root-only database, document, private-config and Git backups; verify SHA-256 and restore rehearsal evidence.
5. Enter maintenance/write freeze without changing customer documents.
6. Rehearse the exact release and migrations against an isolated restored copy.
7. Apply `014`–`041` in order using the guarded wrapper. Stop on drift or failure. Migration `030` replaces the historical answer-value uniqueness rule with predecessor-linked transition uniqueness; later migrations add the separately reviewed Support Inbox, SLA, typing/authority, regulatory, visa-delivery, email-dispatch, operational-policy, travel-date evidence, optional-requirement, source-authority and rule-lifecycle governance contracts.
8. Deploy the exact approved SHA through the protected manual workflow.
9. Keep every Operations flag OFF; verify legacy/customer/payment/email regressions.
10. Enable `OPERATIONS_CASE_READ_MODEL` for named internal scopes only and verify RBAC/finance isolation.
11. Enable `OPERATIONS_CONTROLLED_WRITES` only after separate approval and named-team pilot verification.
12. Keep customer-facing Operations, AI Document Review, Support Inbox, Regulatory Watcher, Visa Assistant, case handoff and email automation flags OFF until their individual owner/external-provider gates pass.

## Latest Staging evidence

- Isolated migration rehearsal: the exact `014–041` chain is now reproducible through `scripts/rehearse-operations-migration-chain.ts`. The runner rejects non-MySQL, remote hosts, ports other than `33306`, databases outside `tashira_ops_rehearsal_*`, and any destructive run without the separate `OPS_REHEARSAL_RECREATE=YES` confirmation. It parses MySQL `DELIMITER` trigger blocks, creates a synthetic legacy baseline plus the real Migration `004` timeline dependency, applies all 28 migrations, rolls back `041→014`, then reapplies `014→041`. The verified run used local-only MySQL `8.4.11` and produced 73 tables / 101 triggers with protected synthetic counts of 2 applications / 5 applicants / 5 documents / 1 payment / 1 invoice. The subsequent persistence suite passed environment identity, legacy integrity, Rule governance, evaluation immutability, family/requirement isolation, Controlled Writes, concurrency, idempotency, transaction rollback/atomicity and finance non-mutation. No remote database or Production credential/data was used.
- Release manifest gate: native Node execution at exact branch SHA `cbd8132d670d1aafe1a1ed182332eef24b17da85` returned `PASS`, proved a clean worktree and exact local/remote feature-branch match, and produced SHA-256 evidence for all 28 ordered forward/rollback migration pairs from `014` through `041`. Run with `node --experimental-strip-types scripts/verify-operations-production-readiness.ts`; it performs no server, database, environment or secret access.
- Typing Pack output gate: applicant/evaluation/travel fields are explicitly marked for human verification; nested sensitive names, duplicate field identities, control characters and oversized output fail closed. Historical persisted pack hashes remain unchanged because the verification projection is deterministic and derived from already integrity-bound fields. The feature remains OFF and the owner-approved template/output format remains a separate gate.

- Inbound email gate: a provider-independent verified-envelope boundary is deployed without mailbox credentials or a public provider endpoint. Synthetic TEST E2E proved exact-one append-only ingestion, replay deduplication, changed-replay and wrong-team rejection, sender-address minimization and attachment exclusion. `SUPPORT_INBOX` remains OFF and no real email was processed.

- Rule lifecycle gate: Migration `041` is applied after verified backup `/var/backups/tashira-staging/20260827T105133Z-rule-lifecycle-041-predeploy`. A synthetic INTERNAL version completed DRAFT → UNDER_REVIEW → REJECTED with exactly three immutable events, changed-replay/stale-transition rejection, zero approved reviews and zero active versions. The read-only Operations projection exposes lifecycle/source evidence only to `rule.read`, returned no finance/secret fields, and provides no activation control. `REGULATORY_WATCHER` remains OFF.

- Source authority gate: Migration `040` is applied after verified backup `/var/backups/tashira-staging/20260827T102332Z-source-authority-040-predeploy`; its append-only triggers reject update/delete tampering. Existing source/rule history is unchanged and no authority decision was fabricated. Consequently, the Active Rule provider returns no `OFFICIAL` rule until an authorized reviewer records a policy-versioned approval under the owner-approved authority hierarchy.
- Source review API gate: the internal API requires `REGULATORY_WATCHER`, trusted actor RBAC, expected-latest-event concurrency and replay-safe command identity. Staging E2E recorded one synthetic `REJECTED` event and zero approvals; replay/conflict and commercial-as-official rejection passed while the flag remained OFF.
- AI authority gate: `AI_ADVISORY_BOUNDARY_V1` permits extraction/pre-screen/summary only and rejects eligibility decisions, rule activation and final submission outcomes.

- Unified Interview authenticated read API: start/resume/current question/eligibility/requirements/upload requirements/scheduler/review all use one canonical persisted state path.
- Scoped synthetic E2E: PASS for lifecycle equivalence, anonymous denial, application ownership and finance isolation.
- Quality gates: TypeScript PASS; full ESLint PASS; 694 tests PASS with 19 documented environment-gated skips; client/static/server build PASS.
- Runtime: PM2 `tashira-staging` online; local/public Staging HTTP 200; read-only Production HTTP 200.
- Closed state after the latest deployment: Controlled Writes, customer-facing Operations scopes, Typing Pack and external-provider capabilities are OFF; no Production-scoped flag exists in the Staging database. Any retained internal test scope does not make an unreviewed source authoritative.
- Production, Production database, Production documents, main/master, Stripe, Resend, pricing, payment and invoice behavior were not modified by this milestone.

## Rollback and recovery

- Application rollback: exact pre-change SHA only.
- Database rollback: use only the verified pre-migration backup during an approved maintenance window; never run rollback scripts blindly against a partially used schema. In particular, after a legitimate answer cycle such as `A → B → A`, do not blindly restore Migration `030`'s former answer-value uniqueness constraint because doing so conflicts with valid immutable history.
- Feature rollback: disable the affected scoped flag first; preserve append-only evidence.
- Documents: never overwrite or delete `/var/www/tashira/storage/documents`; verify fingerprint before and after.

## Smoke tests

- PM2 online; local/public HTTP 200; legal/customer/payment routes unchanged.
- Legacy case renders `LEGACY_NOT_EVALUATED` without invented history.
- Named Operations actor can read only permitted case/team scope.
- Wrong-team, Finance-only and unauthorized access denied.
- Supplier identity visible only where permitted; cost/margin/profit/Stripe/payout absent.
- Controlled write requires permission, scope, reason, expected version and idempotency key.
- Stale write returns `CONCURRENCY_CONFLICT`; replay returns one result/event.
- Applicant/document isolation and immutable re-evaluation history pass.
- Production DB counts and document fingerprint remain within approved migration expectations.

## Monitoring and stop conditions

Monitor health, error rate, denied access, concurrency conflicts, audit insert failures and queue age. Stop/disable the relevant flag on RBAC bypass, finance leak, cross-applicant leakage, partial transaction, document-security regression, unexpected customer behavior, health failure or schema drift.

## Owner approval points

- Merge to main/master.
- Production backup/maintenance/migration/deployment.
- Production role/scope grants and feature activation.
- Official rule content and regulatory activation.
- AI/mailbox external providers, retention policy, Typing Pack/authority workflow.
