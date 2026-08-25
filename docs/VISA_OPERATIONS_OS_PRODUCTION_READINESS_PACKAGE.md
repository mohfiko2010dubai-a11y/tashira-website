# Visa Operations OS V1 — Production Readiness Package

Status: **prepared, not authorized for execution**.

## Release identity

- Source branch: `codex/visa-operations-os-v1`
- Exact release SHA: record only after final Staging hardening commit and verification.
- Database chain: additive migrations `014` through `023`.
- Production changes performed by this package: none.

## Required Production sequence

1. Obtain explicit owner authorization for merge, backup, migration, deployment and each feature activation.
2. Prove the target path, host, database and storage identities; fail closed on any mismatch.
3. Capture protected row counts, document fingerprint, current SHA, PM2/Nginx health and effective flags.
4. Create root-only database, document, private-config and Git backups; verify SHA-256 and restore rehearsal evidence.
5. Enter maintenance/write freeze without changing customer documents.
6. Rehearse the exact release and migrations against an isolated restored copy.
7. Apply `014`–`023` in order using the guarded wrapper. Stop on drift or failure.
8. Deploy the exact approved SHA through the protected manual workflow.
9. Keep every Operations flag OFF; verify legacy/customer/payment/email regressions.
10. Enable `OPERATIONS_CASE_READ_MODEL` for named internal scopes only and verify RBAC/finance isolation.
11. Enable `OPERATIONS_CONTROLLED_WRITES` only after separate approval and named-team pilot verification.
12. Keep customer-facing Operations, AI Document Review, Support Inbox and Regulatory Watcher flags OFF until their individual gates pass.

## Rollback and recovery

- Application rollback: exact pre-change SHA only.
- Database rollback: use only the verified pre-migration backup during an approved maintenance window; never run rollback scripts blindly against a partially used schema.
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
