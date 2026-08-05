# Database

## Intended architecture

Production uses MySQL hosted on the production server. Drizzle ORM connects through `DATABASE_URL`. Do not assume the Docker Compose database or repository schema exactly matches production.

## Repository sources

- `db/schema.ts`: intended Drizzle table definitions.
- `db/relations.ts`: ORM relations.
- `drizzle.config.ts`: migration tooling configuration.
- Migration material exists in `db/migration.sql`, `db/migrations/`, `migrations/`, and root `vps-*.sql` files.

## Known drift

Static analysis found code references to `totalAmount` and `totalApplicants` that are absent from the current Drizzle schema. Compatibility fallbacks and ad hoc SQL files indicate migration drift. This must be verified against production before remediation.

## Production verification checklist

- Verify SSH host identity before connection.
- Identify the active `DATABASE_URL` target without displaying credentials.
- Confirm MySQL host, database name, engine version, and current schema.
- Compare live tables, columns, indexes, constraints, and migration state with repository definitions.
- Determine which migration source is authoritative.
- Verify application compatibility and data volumes.
- Verify latest backup timestamp and perform evidence-based restore-readiness review.

## Change requirements

- One canonical ordered migration history.
- Reviewed, forward-safe migrations tested outside production.
- Compatibility and performance analysis.
- Verified backup and recovery plan.
- Explicit production approval.
- Transactional execution where supported and post-migration verification.

## Prohibited actions

Without explicit authorization and verified backups, never reset, drop, truncate, import over, overwrite, migrate, or delete production data; never run schema push tools; and never use production customer data in tests.
