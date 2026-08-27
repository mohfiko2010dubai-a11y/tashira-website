# Visa Operations OS V1 — Production Readiness Package

Status: **prepared, not authorized for execution**.

## Release identity

- Source branch: `codex/visa-operations-os-v1`
- Latest exact Staging implementation/runtime SHA: `a140ac9a6e98f20a1077a5574e69a4be276112cf`; later documentation-only commits do not change this runtime evidence. No SHA is authorized for Production.
- Database chain: reviewed additive migrations `014` through `040`; re-rehearse the exact chain against an isolated restored Production-shaped copy before authorization.
- Production changes performed by this package: none.

## Required Production sequence

1. Obtain explicit owner authorization for merge, backup, migration, deployment and each feature activation.
2. Prove the target path, host, database and storage identities; fail closed on any mismatch.
3. Capture protected row counts, document fingerprint, current SHA, PM2/Nginx health and effective flags.
4. Create root-only database, document, private-config and Git backups; verify SHA-256 and restore rehearsal evidence.
5. Enter maintenance/write freeze without changing customer documents.
6. Rehearse the exact release and migrations against an isolated restored copy.
7. Apply `014`–`040` in order using the guarded wrapper. Stop on drift or failure. Migration `030` replaces the historical answer-value uniqueness rule with predecessor-linked transition uniqueness; later migrations add the separately reviewed Support Inbox, SLA, typing/authority, regulatory, visa-delivery, email-dispatch, operational-policy, travel-date evidence, optional-requirement and source-authority governance contracts.
8. Deploy the exact approved SHA through the protected manual workflow.
9. Keep every Operations flag OFF; verify legacy/customer/payment/email regressions.
10. Enable `OPERATIONS_CASE_READ_MODEL` for named internal scopes only and verify RBAC/finance isolation.
11. Enable `OPERATIONS_CONTROLLED_WRITES` only after separate approval and named-team pilot verification.
12. Keep customer-facing Operations, AI Document Review, Support Inbox, Regulatory Watcher, Visa Assistant, case handoff and email automation flags OFF until their individual owner/external-provider gates pass.

## Latest Staging evidence

- Source authority gate: Migration `040` is applied after verified backup `/var/backups/tashira-staging/20260827T102332Z-source-authority-040-predeploy`; its append-only triggers reject update/delete tampering. Existing source/rule history is unchanged and no authority decision was fabricated. Consequently, the Active Rule provider returns no `OFFICIAL` rule until an authorized reviewer records a policy-versioned approval under the owner-approved authority hierarchy.
- Source review API gate: the internal API requires `REGULATORY_WATCHER`, trusted actor RBAC, expected-latest-event concurrency and replay-safe command identity. Staging E2E recorded one synthetic `REJECTED` event and zero approvals; replay/conflict and commercial-as-official rejection passed while the flag remained OFF.
- AI authority gate: `AI_ADVISORY_BOUNDARY_V1` permits extraction/pre-screen/summary only and rejects eligibility decisions, rule activation and final submission outcomes.

- Unified Interview authenticated read API: start/resume/current question/eligibility/requirements/upload requirements/scheduler/review all use one canonical persisted state path.
- Scoped synthetic E2E: PASS for lifecycle equivalence, anonymous denial, application ownership and finance isolation.
- Quality gates: TypeScript PASS; full ESLint PASS; 659 tests PASS with 19 documented environment-gated skips; client/static/server build PASS.
- Runtime: PM2 `tashira-staging` online; local/public Staging HTTP 200; read-only Production HTTP 200.
- Closed state after E2E: all customer-facing Operations scopes OFF; Controlled Writes OFF. The previously authorized internal Read Model global scope and Team-only Travel/Scheduler/Rule test scopes remain enabled; they do not make an unreviewed source authoritative.
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
