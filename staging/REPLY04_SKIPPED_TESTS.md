# Reply 04 — skipped test inventory

These 26 tests in 11 files were skipped by the standard deployment suite because their dedicated database integration environment variables were not enabled/provided. This is an unexecuted coverage gap, not a passing result. They exercise database persistence, access control, financial-field separation, concurrency and audit guarantees. They must use an isolated rehearsal database, never production.

| # | Test | Source | Required integration variables |
|---|---|---|---|
| 1 | returns authoritative minimized capabilities | `api\operations-write-mysql.integration.test.ts` | `OPS_EXECUTOR_DATABASE_URL` |
| 2 | never lets Operations assert payment truth for an unpaid application | `api\operations-write-mysql.integration.test.ts` | `OPS_EXECUTOR_DATABASE_URL` |
| 3 | routes an unscoped intake case only through a trusted single-team assignee | `api\operations-write-mysql.integration.test.ts` | `OPS_EXECUTOR_DATABASE_URL` |
| 4 | persists human review, audit, and restart-safe idempotency | `api\operations-write-mysql.integration.test.ts` | `OPS_EXECUTOR_DATABASE_URL` |
| 5 | rejects wrong-team and cross-applicant document writes without partial evidence | `api\operations-write-mysql.integration.test.ts` | `OPS_EXECUTOR_DATABASE_URL` |
| 6 | persists applicant-scoped document review, assignment, and controlled status | `api\operations-write-mysql.integration.test.ts` | `OPS_EXECUTOR_DATABASE_URL` |
| 7 | preserves history and appends a new re-evaluation snapshot and selection | `api\operations-write-mysql.integration.test.ts` | `OPS_EXECUTOR_DATABASE_URL` |
| 8 | rolls back business/version/action/idempotency if audit persistence fails | `api\operations-write-mysql.integration.test.ts` | `OPS_EXECUTOR_DATABASE_URL` |
| 9 | commits one of two stale concurrent writes and keeps finance fields unchanged | `api\operations-write-mysql.integration.test.ts` | `OPS_EXECUTOR_DATABASE_URL` |
| 10 | returns one commit and one deterministic replay for concurrent duplicate commands | `api\operations-write-mysql.integration.test.ts` | `OPS_EXECUTOR_DATABASE_URL` |
| 11 | fails closed while the feature flag is disabled | `api\operations-write-mysql.integration.test.ts` | `OPS_EXECUTOR_DATABASE_URL` |
| 12 | persists an immutable, replay-safe lifecycle with separated actors | `api\lib\document-intelligence\mysql-passport-profile-governance-repository.integration.test.ts` | `RUN_DOCUMENT_INTELLIGENCE_MYSQL_INTEGRATION, DOCUMENT_INTELLIGENCE_MYSQL_URL` |
| 13 | loads synthetic ACTIVE profiles in Staging but never Production | `api\lib\document-intelligence\mysql-passport-profile-governance-repository.integration.test.ts` | `RUN_DOCUMENT_INTELLIGENCE_MYSQL_INTEGRATION, DOCUMENT_INTELLIGENCE_MYSQL_URL` |
| 14 | loads synthetic governed fields only outside Production | `api\lib\document-intelligence\mysql-repository.integration.test.ts` | `RUN_DOCUMENT_INTELLIGENCE_MYSQL_INTEGRATION, DOCUMENT_INTELLIGENCE_MYSQL_URL` |
| 15 | persists immutable applicant-scoped evidence and restart-safe idempotency | `api\lib\document-intelligence\mysql-repository.integration.test.ts` | `RUN_DOCUMENT_INTELLIGENCE_MYSQL_INTEGRATION, DOCUMENT_INTELLIGENCE_MYSQL_URL` |
| 16 | fails closed for wrong-team and cross-applicant evidence | `api\lib\document-intelligence\mysql-repository.integration.test.ts` | `RUN_DOCUMENT_INTELLIGENCE_MYSQL_INTEGRATION, DOCUMENT_INTELLIGENCE_MYSQL_URL` |
| 17 | preserves ownership, optimistic concurrency, history and idempotency atomically | `api\lib\customer\mysql-customer-interview-write-repository.integration.test.ts` | `CUSTOMER_WRITE_REHEARSAL_DATABASE_URL` |
| 18 | creates immutable applicant requirements atomically and verifies exact replay | `api\lib\customer\mysql-interview-evaluation-repository.integration.test.ts` | `INTERVIEW_EVALUATION_REHEARSAL_DATABASE_URL` |
| 19 | preserves A to B to A as three immutable chronological events | `api\lib\customer\mysql-interview-answer-repository.integration.test.ts` | `INTERVIEW_ANSWER_REHEARSAL_DATABASE_URL` |
| 20 | loads persisted permissions, scope, and a scoped enabled flag | `api\lib\operations\mysql-access-provider.integration.test.ts` | `OPS_REHEARSAL_DATABASE_URL` |
| 21 | loads a legacy family with applicant-scoped documents and no financial fields | `api\lib\operations\mysql-case-read-provider.integration.test.ts` | `OPS_READ_DATABASE_URL` |
| 22 | starts from trusted application/evaluation policy and preserves replay/concurrency/audit evidence | `api\lib\operations\mysql-supplier-sla-repository.integration.test.ts` | `OPS_SUPPLIER_SLA_DATABASE_URL` |
| 23 | enforces immutable policy and append-only event evidence | `api\lib\operations\mysql-supplier-sla-repository.integration.test.ts` | `OPS_SUPPLIER_SLA_DATABASE_URL` |
| 24 | loads persisted thread/message evidence and applies replay-safe concurrent commands | `api\lib\operations\mysql-support-inbox-repository.integration.test.ts` | `OPS_SUPPORT_DATABASE_URL` |
| 25 | keeps message evidence append-only | `api\lib\operations\mysql-support-inbox-repository.integration.test.ts` | `OPS_SUPPORT_DATABASE_URL` |
| 26 | persists deduplicated lifecycle, concurrency, idempotency, RBAC and audit evidence | `api\lib\travel\mysql-scheduler-alert-provider.integration.test.ts` | `RUN_SCHEDULER_ALERT_MYSQL_INTEGRATION, SCHEDULER_ALERT_MYSQL_URL` |

For RUN_* variables the enabling value is "1"; the associated *_MYSQL_URL must also be provided. For other rows, absence of the named database URL directly selects describe.skip. No skip conditions or test assertions were changed.
