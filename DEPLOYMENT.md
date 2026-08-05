# Deployment

## Current state

Static repository inspection found multiple deployment mechanisms. They may conflict, race, or apply different dependency and restart behavior. No deployment changes are authorized by this documentation task.

For production topology, inspection commands, incident response, operational checklists, and rollback procedures, see [OPERATIONS.md](OPERATIONS.md).

### GitHub Actions

`.github/workflows/deploy.yml` connects by SSH after pushes to `main` or `master`, updates the checkout, installs dependencies when needed, builds, and restarts PM2.

### Cron polling

`scripts/cron-deploy.sh` polls GitHub, updates the production checkout, builds, restarts services, and performs a health check.

### Webhook deployment

Python and Node webhook receivers trigger repository update, build, and restart operations. Static analysis found embedded fallback secrets, public listener configurations, and a log-viewing endpoint that require security review.

### Manual scripts

Several root and `scripts/` shell files run variations of pull/reset, dependency installation, build, migration, PM2, and Nginx operations.

### Runtime

- PM2 is the intended Node process manager.
- Nginx is the intended reverse proxy/static host.
- Docker Compose defines app, MySQL, and Nginx services but must not be assumed to describe active production.

## Main risks

- Competing deployment triggers can overlap.
- Direct branch pushes can deploy without a quality or approval gate.
- Production scripts use destructive working-tree commands.
- Migration, backup, rollback, and artifact strategies are inconsistent.
- Some mechanisms run with excessive privilege.
- Docker storage persistence and database exposure require review.

## Target pipeline

The target is one controlled deployment pipeline.

### Proposed staging workflow

1. Review and approve a pull request.
2. Run `npm ci`, type-check, lint, tests, and build.
3. Build an immutable versioned artifact.
4. Review migrations and test them against staging data.
5. Deploy to staging with pinned host identity.
6. Run health, API, payment-sandbox, document, and smoke checks.
7. Record the artifact, schema version, and verification result.

### Proposed production workflow

1. Obtain explicit production approval.
2. Confirm current database and document backups and restore readiness.
3. Promote the exact verified staging artifact.
4. Apply reviewed migrations separately and safely when required.
5. Restart or roll services with minimal downtime.
6. Verify health, logs, API, database connectivity, filesystem storage, and critical customer flows.
7. Monitor errors and retain the previous artifact for rollback.

## Backup requirements

- Verify MySQL backup timestamp, integrity, retention, and restore procedure.
- Verify `/var/www/tashira/storage/documents` backup coverage.
- Record pre-deployment commit, artifact, schema version, PM2 state, and configuration identity without exposing secrets.

## Health checks

- API health endpoint returns success.
- PM2 process is stable without restart loops.
- Nginx serves frontend and proxies API correctly.
- MySQL connectivity succeeds.
- Document storage is mounted, writable by the intended service, and not publicly exposed.
- Disk space remains safe.

## Rollback

- Roll back to a known immutable artifact, not an arbitrary working-tree state.
- Database rollback must be designed per migration; never destroy production data.
- Document files must not be deleted or overwritten during rollback.
- If rollback is unsafe, stop and escalate rather than improvising.
