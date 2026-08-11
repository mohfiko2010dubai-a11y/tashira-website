# TASHIRA Staging Migration Report

Date: 2026-08-11

Branch: `devops/deployment-safety`

Deployed staging commit: `c30313be87b0b6288c7a55154d09ced0571b23af`

## Result

Migration 005 was reviewed, corrected, applied, and verified only in the isolated `tashira_staging` database. It was not applied to production. Production MySQL, storage, PM2 process, Nginx, cron, webhook, and application checkout were not modified.

## Static review

The review covered table definitions, data types, defaults, unique constraints, indexes, foreign keys, retention/legal-hold dates, price versioning, finance data, applicant/document relationships, append-only triggers, Drizzle compatibility, idempotency, and rollback.

Corrections made on the review branch:

- Added missing `RESTRICT` foreign keys and supporting indexes.
- Replaced inappropriate long-lived `TIMESTAMP` fields with `DATETIME` where retention, recovery, effective, or expiry dates may exceed the MySQL timestamp range.
- Made table creation and trigger recreation safe for reviewed reruns.
- Added explicit short foreign-key names compatible with MySQL's 64-character identifier limit.
- Added a guarded staging migration runner that refuses any database other than `tashira_staging` and any user other than `tashira_staging_app`.
- Added an explicit rollback script marked destructive and permitted only for disposable staging after separate authorization.
- Added migration safety tests.

No `DROP TABLE`, `TRUNCATE`, or cascading-delete behavior exists in the forward migration.

## Isolation proof

| Resource | Verified staging value |
|---|---|
| Checkout | `/var/www/tashira-staging` |
| Branch | `devops/deployment-safety` |
| Commit | `c30313be87b0b6288c7a55154d09ced0571b23af` |
| Database | `tashira_staging` |
| Database user | `tashira_staging_app` |
| Storage | `/var/www/tashira-staging/storage/documents` |
| PM2 process | `tashira-staging` |
| Listener | `127.0.0.1:3002` |
| Access used for UAT | Local SSH tunnel at `127.0.0.1:43002` |

The production PM2 process `tashira` remained online with its existing PID while staging was provisioned and restarted. Docker is not installed. No production data or documents were copied.

## Application and schema verification

- Clean Drizzle schema push: PASS (`No changes detected` on the final rerun).
- Migration 005 execution: PASS.
- Application startup on staging-only listener: PASS.
- Tables in staging schema: 22.
- Foreign keys: 11.
- Index entries: 77.
- Append-only triggers: 16.
- Required trigger pairs exist for price snapshots, risk assessments, timeline events, deletion audits, document lifecycle, financial events, legal-hold events, and outbound-email events.
- Negative update against a synthetic price snapshot: blocked with `price snapshots are immutable`.
- Negative delete against a synthetic timeline event: blocked with `application timeline is append-only`.

## Synthetic reference data

Staging contains only clearly marked synthetic/reference settings and UAT records. The company identity, address, contact details, VAT state, registration threshold, warning levels, prices, and exchange rate are placeholders and are not approved legal, tax, or commercial facts.

Pricing snapshot UAT proved that an application created under rule version 1 retained USD 165.00 after a version 2 rule at USD 170.00 became active. The new application used version 2. The historical row was neither rewritten nor recalculated.

## Issues found and fixed

1. Drizzle's generated recovery foreign-key name exceeded MySQL's identifier limit. Explicit short names fixed the clean provisioning failure.
2. Filesystem uploads were correct, but newly inserted document metadata inherited the legacy `supabase` defaults. Commit `c30313b` now explicitly records provider and bucket as `local` in both application and wizard upload paths. A post-fix synthetic upload verified `local/local` metadata and staging filesystem persistence.
3. A credential-like value existed in a historical migration comment. It was removed from the branch. Whether it is active and requires production rotation remains an owner-controlled production decision; it was never tested or used.

## Rollback position

The rollback SQL is intentionally not automatic and was not executed. For staging, the provisioner can back up and rebuild only the exact `tashira_staging` database when `STAGING_RESET=true`. Any production migration or rollback requires an independently approved backup, maintenance window, privilege review, and production change plan.
