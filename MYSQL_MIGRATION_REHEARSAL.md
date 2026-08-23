# MySQL Migration Rehearsal — Visa Operations OS V1

Date: 2026-08-23

Branch: `codex/visa-operations-os-v1`

Environment: local disposable Docker only

## Isolated environment identity

- Container: `tashira-ops-mysql84`
- Image: `mysql:8.4`
- Verified server version: `8.4.11`
- Network: `tashira-ops-rehearsal-net`
- Host binding: `127.0.0.1:33306`
- Databases: `tashira_ops_rehearsal_clean`, `tashira_ops_rehearsal_legacy`, `tashira_ops_rehearsal_upgrade`, `tashira_ops_rehearsal_app`
- Charset/collation: `utf8mb4` / `utf8mb4_0900_ai_ci`
- Production credentials/data/connection: **NO**
- Remote database connection: **NO**

Synthetic credentials exist only in the disposable container environment and are not stored in Git.

## Migration chain

The discovered Operations OS chain is:

`014 → 015 → 016 → 017 → 018 → 019 → 020 → 021`

The repository has no zero-to-current `001/002` SQL baseline. Rehearsal A/B therefore use the committed synthetic pre-Operations-OS fixture, while the application-startup database is created from `db/schema.ts` before applying the Operations chain.

## Results

| Gate | Result | Evidence |
| --- | --- | --- |
| Clean DB | PASS | Baseline plus `014–021` applied in order |
| Legacy DB | PASS | Same chain applied over synthetic applications/applicants/documents/payment/invoice |
| Legacy records preserved | PASS | Counts remained `2 / 5 / 5 / 1 / 1`; application/document checksums recorded during rehearsal |
| Legacy compatibility | PASS | Zero fabricated evaluations and zero fabricated relationships |
| Rule Registry | PASS | Direct ACTIVE import rejected; unapproved activation rejected; approved activation accepted; evidence mutation rejected |
| Evaluation immutability | PASS | V1 retained; V2 appended/superseded/selected; direct V1 mutation rejected |
| Family persistence | PASS | Mixed-nationality relationship graph stored applicant-by-applicant |
| Dynamic requirements | PASS | Two applicants retained different evaluation/requirement instances without leakage |
| Controlled write persistence | PASS | Version, action, audit and idempotency evidence committed together |
| Concurrency | PASS | First version-7 update succeeded; stale second update affected zero rows |
| Idempotency | PASS | Replay evidence stable; conflicting reuse rejected |
| Audit atomicity | PASS | Forced duplicate audit failure rolled back version and business event |
| Finance isolation | PASS | Supplier cost was unchanged before/after Operations commands |
| Application startup | PASS | Full Drizzle schema + `014–021`; local process healthy on `127.0.0.1:3102`, HTTP 200, then stopped |
| Feature flags | PASS | Operations flags remain closed/fail-closed by default |
| Persistent RBAC/API runtime wiring | PARTIAL | Default router now loads trusted actors, persisted permissions/scopes and fail-closed flags from MySQL; the persistent executor remains deliberately unavailable |
| Controlled Write UI | NOT STARTED | Correctly blocked until persistent RBAC/API integration passes |

## Defects found and corrected

1. Migration `016` used a unique index on a 1000-character `utf8mb4` URL, exceeding InnoDB's 3072-byte key limit. The complete URL is retained and uniqueness now uses a stored 32-byte SHA-256 digest.
2. Raw SQL could import a Rule Version directly as ACTIVE and could modify version evidence. Additive migration `021` now rejects direct ACTIVE imports, requires an APPROVED review before activation, protects immutable version content, and makes source snapshots/reviews append-only.

## Recovery and failure behavior

- Every Operations migration has a scoped rollback/recovery companion where schema rollback is safe.
- Migration `021` rollback removes only its six triggers.
- Existing DDL contains non-idempotent trigger creation. A migration ledger/guarded runner must refuse blind replay or partial-order retry; this is part of the next persistence-runtime milestone.
- No rollback or migration command in this rehearsal targets any non-disposable database.

## Next gate

The MySQL-backed access provider is now proven against the disposable database. It derives administrator/staff identity only from the trusted server context, loads current role grants and scopes from MySQL, ignores unknown permission/flag values, treats missing/malformed/inaccessible flags as disabled, and sanitizes provider errors. The default router uses this provider; no permissive or in-memory actor fallback remains.

Next, implement and prove the MySQL-backed controlled-write executor, including wrong-team/scope denial and real internal API transactions. Only after that gate passes may Controlled Write UI work begin.
