# TASHIRA Visa Operations OS V1 — Staging Migration and Activation Runbook

Status: **PLAN ONLY — NOT EXECUTED**. This document does not authorize a staging connection, migration, deployment, or feature activation.

## A. Preconditions

- Obtain explicit owner approval for the exact staging maintenance window and reviewed commit SHA.
- Confirm CI and the final local acceptance gate are green at that exact SHA.
- Confirm migrations `014` through `023` are unchanged from the rehearsed artifacts.
- Assign named migration operator, verifier, rollback operator, and Operations test users.
- Keep every Visa Operations OS flag closed before and immediately after migration.

## B. Required backups

- Create a timestamped staging MySQL logical backup and verify it can be read.
- Capture the current staging Git SHA, schema fingerprint, migration evidence, row counts, PM2 state and HTTP health.
- Create a staging application/config rollback archive without printing secrets.
- Record the staging document-store fingerprint; do not copy customer or Production documents.
- Keep backups outside the deployment tree with root-only permissions.

## C. Exact staging identity verification

Before any write, independently prove all of the following:

- Host is the approved staging host.
- application path is exactly `/var/www/tashira-staging`.
- database name is exactly `tashira_staging`.
- database user is exactly `tashira_staging_app`.
- PM2 process is exactly `tashira-staging`.
- application listener is exactly `127.0.0.1:3002`.
- public origin is exactly `https://staging.tashiraev.com`.
- Production path, database, PM2 process and document storage are not selected.

Stop immediately if any identity is missing, ambiguous or unexpected.

## D. Database version verification

Using a read-only staging session first, record `SELECT VERSION()` and confirm the server is compatible with the rehearsed MySQL 8.4 migration behavior. Record current character set/collation, migration ledger, foreign-key mode and schema fingerprint. Do not proceed on unexplained drift.

## E. Migration order

Apply additively and strictly in this order:

1. `014_operations_rbac.sql`
2. `015_operations_audit_flags.sql`
3. `016_visa_rule_registry.sql`
4. `017_eligibility_evidence.sql`
5. `018_eligibility_snapshot_contract.sql`
6. `019_family_readiness_contract.sql`
7. `020_operations_controlled_write_persistence.sql`
8. `021_rule_registry_governance.sql`
9. `022_rule_layer_persistence.sql`
10. `023_operations_write_preconditions.sql`

Never reorder, skip, edit historical migration files, or apply rollback scripts during forward migration.

## F. Migration commands

Commands must be run only after identity/backup approval and from the exact reviewed checkout. Use the established staging secret-loading mechanism; never place credentials on the command line or in logs.

```bash
cd /var/www/tashira-staging
for migration in \
  migrations/014_operations_rbac.sql \
  migrations/015_operations_audit_flags.sql \
  migrations/016_visa_rule_registry.sql \
  migrations/017_eligibility_evidence.sql \
  migrations/018_eligibility_snapshot_contract.sql \
  migrations/019_family_readiness_contract.sql \
  migrations/020_operations_controlled_write_persistence.sql \
  migrations/021_rule_registry_governance.sql \
  migrations/022_rule_layer_persistence.sql \
  migrations/023_operations_write_preconditions.sql
do
  mysql --defaults-extra-file="${STAGING_MYSQL_DEFAULTS_FILE:?approved staging defaults file required}" tashira_staging < "$migration" || exit 1
done
```

The operator must set `STAGING_MYSQL_DEFAULTS_FILE` interactively to the approved root-only staging client file. Do not create it in Git or reuse a Production client file.

## G. Pre-migration checks

- Exact SHA and clean checkout confirmed.
- Backups and hashes confirmed by a second person.
- Local/public staging health recorded.
- Database/schema identity and protected row counts recorded.
- Feature flags queried and confirmed absent or `NO`.
- Existing legacy application counts and document fingerprint recorded.
- No running migration or deployment job; automatic deployment remains disabled.

## H. Post-migration checks

- Recompute schema fingerprint and compare only expected additive changes.
- Verify every table/index/constraint/trigger required by `014–023`.
- Verify protected application/applicant/document/payment/invoice row counts are unchanged.
- Verify legacy records were not silently assigned rules, relationships, requirements or permissions.
- Verify no staff member received an implicit role or scope.
- Verify every new feature flag remains closed.
- Run read-only application startup/schema smoke checks before activation planning.

## I. Feature flags

Flags involved:

- `VISA_RULES_EVALUATION`
- `DYNAMIC_REQUIREMENTS`
- `FAMILY_ENGINE`
- `OPERATIONS_CASE_READ_MODEL`
- `OPERATIONS_CONTROLLED_WRITES`

Migration does not authorize activation. Create explicit TEST/STAGING-scoped records only during separately approved activation steps. Never create a Production flag record from this procedure.

## J. Smoke tests

- Anonymous and unauthorized Operations access denied.
- Authorized synthetic Operations user can read only permitted synthetic cases.
- Mixed-family applicant documents/requirements remain isolated.
- Missing document blocks only its applicant and family readiness correctly.
- Supplier identity is visible where permitted; cost/margin/profit are absent.
- Controlled writes remain unavailable until their separate activation step.
- Public customer, payment, invoice, Stripe and email flows remain unchanged.

## K. RBAC verification

Test synthetic Operations Employee, Operations Manager, Finance Manager, Customer Service and Owner/Admin identities. Confirm team/scope boundaries, wrong-team denial and finance/Operations separation. Never trust client-provided role or scope headers.

## L. Legacy-case verification

Open a synthetic legacy fixture and confirm `LEGACY_NOT_EVALUATED`, no fabricated evaluation/rules/requirements and a fail-closed modern action path. Do not alter real legacy records for this check.

## M. Family-case verification

Create one synthetic four-person mixed-nationality family. Verify independent evaluation, requirements, documents and readiness; missing/replaced document recovery; manual review; immutable re-evaluation history; concurrency; idempotency; audit; and supplier finance isolation.

## N. Rollback and recovery strategy

- Prefer stop-and-restore over improvising forward repairs.
- Disable newly activated staging flags first if an activation issue occurs.
- Preserve failure evidence and database logs without secrets.
- If migration integrity fails, stop the staging application if required to prevent writes, restore the verified pre-migration staging backup, restore the exact previous SHA/config, verify protected counts/fingerprint and restart only the staging process.
- Rollback SQL files are review aids, not authorization to perform partial destructive rollback. Use them only under a separately approved recovery decision after backup review.
- Production is never part of this recovery plan.

## O. Evidence to capture

- Owner approval, operators and timestamps.
- Host/path/database/process identity.
- Exact Git SHA and migration hashes.
- Backup paths and hashes.
- Pre/post schema fingerprints and protected row counts.
- Feature-flag states before/after each step.
- Sanitized RBAC, family, legacy, concurrency, idempotency and finance-isolation results.
- Staging local/public health and PM2 status.

## P. Stop conditions

Stop on unproven staging identity, unavailable/unverified backup, version/schema mismatch, migration failure, unexpected legacy mutation, RBAC failure, finance leakage, failed critical test, unexpected enabled flag, document authorization failure, unexplained schema drift, Production target evidence, or any request to bypass a gate.

## Q. Owner approval gates

Separate explicit approval is required for:

1. staging connection and backups;
2. staging migrations `014–023` with all features OFF;
3. restricted Read Model activation;
4. restricted Controlled Write activation;
5. synthetic staging acceptance;
6. any customer-facing module activation;
7. any merge to main/master or Production action.

## Staging activation plan — not executed

### Step 1 — database only

Apply `014–023` to proven `tashira_staging`, verify integrity, keep all flags OFF, then stop for review.

### Step 2 — restricted Read Model

Enable `OPERATIONS_CASE_READ_MODEL` only for named authorized staging test users/team. Keep evaluation, family, dynamic requirements and writes closed except for the minimum separately reviewed dependencies. Verify RBAC, legacy rendering and finance isolation.

### Step 3 — restricted Controlled Writes

After Step 2 approval, enable the required domain flags and `OPERATIONS_CONTROLLED_WRITES` only for named staging Operations testers. Verify capability minimization, version conflicts, idempotency, audit and applicant isolation.

### Step 4 — synthetic end-to-end validation

Run the four-person synthetic family acceptance flow and capture sanitized evidence. Reset all test flags to OFF immediately after validation unless the owner explicitly approves a continuing restricted staging pilot.

### Step 5 — customer-facing modules remain OFF

Dynamic customer application behavior, customer portal timeline, Visa Assistant changes, email automation, Support Inbox and Regulatory Watcher remain inactive until separately implemented, reviewed and approved.
