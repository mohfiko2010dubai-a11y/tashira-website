# TASHIRA Production Go-Live Runbook

This runbook requires a separately approved maintenance window. It does not itself authorize production access, migration, deployment, cleanup, or secret changes. Rollback application commit: `b8ef154a4ab1aa8f5669702671b7d47a819a917c`.

## Stop rule and approvals

Record the maintenance approver, operator, exact release SHA, backup and off-host destinations, approved production configuration, and rollback owner. Stop after any nonzero command, identity mismatch, unexpected count, checksum failure, schema assertion failure, boot failure, or health-check failure. Never continue despite an error.

## 1. Prechecks

```bash
set -euo pipefail
test "$(hostname)" = "srv1681102"
cd /var/www/tashira
test "$(pwd -P)" = "/var/www/tashira"
test "$(git branch --show-current)" = "main"
git status --short
git rev-parse HEAD
mysql --batch --skip-column-names -e 'SELECT DATABASE()' tashira_db
curl -fsS http://127.0.0.1:3000/api/health >/dev/null
curl -fsS https://tashiraev.com/ >/dev/null
```

Stop on unexpected Git state, identity, or health. Preserve all production records, including the 5 ambiguous and 34 potentially-real records.

## 2. Enter maintenance and quiesce legacy deployment

Freeze writes at the approved boundary. Save the exact legacy state before disabling it:

```bash
TASHIRA_CHANGE_ROOT="/var/backups/tashira/change-$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 700 "$TASHIRA_CHANGE_ROOT"
crontab -l > "$TASHIRA_CHANGE_ROOT/root.crontab.before"
pm2 jlist > "$TASHIRA_CHANGE_ROOT/pm2.jlist.before"
cp -a /root/.pm2/dump.pm2 "$TASHIRA_CHANGE_ROOT/pm2.dump.before"
systemctl is-enabled tashira-webhook.service > "$TASHIRA_CHANGE_ROOT/webhook.enabled.before" || true
systemctl is-active tashira-webhook.service > "$TASHIRA_CHANGE_ROOT/webhook.active.before" || true
crontab -l | grep -v '/var/www/tashira.*origin/main' | crontab -
pm2 stop webhook
pm2 delete webhook
pm2 save
systemctl stop tashira-webhook.service
systemctl disable tashira-webhook.service
! crontab -l | grep -q '/var/www/tashira.*origin/main'
! pm2 describe webhook >/dev/null 2>&1
! systemctl is-active --quiet tashira-webhook.service
pm2 stop tashira
test "$(pm2 pid tashira)" = "0"
```

The final two commands freeze application writes before backup. The currently verified legacy mechanisms are a root cron poller, PM2 process `webhook`, and `tashira-webhook.service`; all must be absent/inactive before the release enters `main`. Confirm no deployment is running. These commands are prepared only; do not run them before the approved window.

If the change is abandoned before migration, the incident owner may separately approve restoring the captured legacy state:

```bash
crontab "$TASHIRA_CHANGE_ROOT/root.crontab.before"
cp -a "$TASHIRA_CHANGE_ROOT/pm2.dump.before" /root/.pm2/dump.pm2
pm2 resurrect
systemctl enable --now tashira-webhook.service
pm2 restart tashira
```

Do not restore these competing mechanisms after a successful go-live; the canonical steady state is the protected manual GitHub workflow only.

## 3. Backup, verify, and copy off-host

```bash
TASHIRA_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TASHIRA_BACKUP_ROOT="/var/backups/tashira/$TASHIRA_STAMP"
install -d -m 700 "$TASHIRA_BACKUP_ROOT"
umask 077

git rev-parse HEAD > "$TASHIRA_BACKUP_ROOT/git-head.txt"
git status --porcelain > "$TASHIRA_BACKUP_ROOT/git-status.txt"
mysqldump --single-transaction --quick --routines --triggers --events \
  --hex-blob --set-gtid-purged=OFF tashira_db |
  gzip > "$TASHIRA_BACKUP_ROOT/tashira_db.sql.gz"
tar --acls --xattrs -czf "$TASHIRA_BACKUP_ROOT/documents.tar.gz" \
  -C /var/www/tashira storage/documents
tar -czf "$TASHIRA_BACKUP_ROOT/private-config.tar.gz" \
  -C /var/www/tashira .env ecosystem.config.cjs
chmod 600 "$TASHIRA_BACKUP_ROOT/private-config.tar.gz"

(cd "$TASHIRA_BACKUP_ROOT" && sha256sum \
  tashira_db.sql.gz documents.tar.gz private-config.tar.gz git-head.txt \
  > SHA256SUMS && sha256sum -c SHA256SUMS)
gzip -t "$TASHIRA_BACKUP_ROOT/tashira_db.sql.gz"
tar -tzf "$TASHIRA_BACKUP_ROOT/documents.tar.gz" >/dev/null
tar -tzf "$TASHIRA_BACKUP_ROOT/private-config.tar.gz" >/dev/null
```

Copy the entire directory to an approved off-host destination. Acceptable destinations include another access-controlled host, an encrypted S3-compatible bucket, or secured owner-controlled offsite storage. Require encryption in transit/at rest, least privilege, retention controls, and matching SHA-256 verification.

After independent off-host verification, create a root-only `$TASHIRA_BACKUP_ROOT/MANIFEST.env`:

```text
DB_BACKUP=/var/backups/tashira/<stamp>/tashira_db.sql.gz
DOCUMENTS_BACKUP=/var/backups/tashira/<stamp>/documents.tar.gz
CONFIG_BACKUP=/var/backups/tashira/<stamp>/private-config.tar.gz
GIT_HEAD_BACKUP=/var/backups/tashira/<stamp>/git-head.txt
CURRENT_PRODUCTION_SHA=<SHA recorded before the release checkout>
SHA256_MANIFEST=/var/backups/tashira/<stamp>/SHA256SUMS
OFF_HOST_DESTINATION=<approved non-local destination reference>
OFF_HOST_MANIFEST_SHA256=<verified sha256 of SHA256SUMS>
OFF_HOST_CONFIRMED_BY=<named approver>
OFF_HOST_CONFIRMED_AT=<UTC ISO-8601 timestamp>
```

Stop unless local and off-host checksums and restore-rehearsal evidence pass.

## 4. Merge the exact reviewed release without automatic deployment

Only after the legacy cron and both webhook supervisors are disabled and backup gates pass, the owner may separately approve merging the exact reviewed release commit into `main`. Confirm that the resulting `origin/main` contains that exact SHA and that the new `deploy.yml` is manual-only. Do not merge before this point: the currently active cron would otherwise fetch and deploy the change automatically.

## 5. Run the immutable migration wrapper

Use a clean checkout at the exact approved release SHA. The fixed order is 004 → 005 → guarded applicant-index alignment → 006 → 007 → 008.

```bash
cd /var/www/tashira
git fetch --no-tags origin main
git cat-file -e "$APPROVED_RELEASE_SHA^{commit}"
git merge-base --is-ancestor "$APPROVED_RELEASE_SHA" origin/main
git checkout --detach "$APPROVED_RELEASE_SHA"
test "$(git rev-parse HEAD)" = "$APPROVED_RELEASE_SHA"

scripts/production-migrate-v1.sh migrate \
  --approved-sha "$APPROVED_RELEASE_SHA" \
  --backup-manifest "$TASHIRA_BACKUP_ROOT/MANIFEST.env"
```

The wrapper validates identity, backup evidence, schema, constraints, and preserved row counts after every step. Never run `migrations/005_business_architecture.rollback.sql` on production.

## 6. Approved configuration and exact-SHA deployment

Load only owner-approved production pricing, company, invoice, VAT, policy, retention, Stripe LIVE, webhook, public URL, and Resend settings. Do not reuse staging values or print secrets.

Invoke `Manual Production Deployment` with the exact 40-character SHA, verified manifest path, `VERIFIED_COMPLETE`, and backup confirmation. GitHub's protected `production` environment must require a named approver and a pre-verified `SERVER_KNOWN_HOSTS` secret; do not trust a key collected during deployment. The workflow verifies ancestry and schema, installs locked dependencies, builds, records the SHA, applies `.env` mode `600`, restarts PM2 `tashira` only, and checks health.

The workflow independently refuses to proceed if the production cron entry, PM2 `webhook`, or `tashira-webhook.service` is still active.

## 7. Focused verification and monitoring

```bash
test "$(cat /var/www/tashira/.deployment/deployed-sha)" = "$APPROVED_RELEASE_SHA"
test "$(stat -c %a /var/www/tashira/.env)" = "600"
pm2 status tashira
curl -fsS http://127.0.0.1:3000/api/health >/dev/null
curl -fsS https://tashiraev.com/ >/dev/null
```

Run only approved schema, admin-login, application-read, pricing-read, and invoice-read smoke checks. Monitor application, PM2, Nginx, MySQL, disk, and errors through the maintenance window. Keep cron removed and `tashira-webhook.service` disabled; retain only manually approved GitHub Actions. End maintenance only after stable monitoring.

## Rollback

### Failure before migration

Make no database change. Abort. Restart the unchanged `tashira` application and restore legacy mechanism state only if the incident owner explicitly directs it, then verify health.

### Partial migration or migration failure

Stop immediately and preserve schema metadata/logs. MySQL DDL auto-commits, so restore the verified backup. Never use the staging-only destructive rollback.

```bash
pm2 stop tashira
mysql -e 'DROP DATABASE tashira_db; CREATE DATABASE tashira_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci'
gunzip -c "$TASHIRA_BACKUP_ROOT/tashira_db.sql.gz" | mysql tashira_db
cd /var/www/tashira
git checkout --detach "$(cat "$TASHIRA_BACKUP_ROOT/git-head.txt")"
```

These destructive incident commands require separate approval and a confirmed backup checksum.

### Migration succeeds but release fails to boot

Restore the verified database backup, then restore the application:

```bash
cd /var/www/tashira
git fetch --no-tags origin main
git checkout --detach b8ef154a4ab1aa8f5669702671b7d47a819a917c
npm ci
npm run build
pm2 restart tashira --update-env
```

### Data-integrity failure

Stop writes, preserve a forensic snapshot, restore the verified DB backup and rollback commit, restart only `tashira`, and rerun health checks.

### Filesystem-integrity failure

Preserve the damaged tree before restore:

```bash
pm2 stop tashira
mv /var/www/tashira/storage/documents \
  "/var/www/tashira/storage/documents.failed.$(date -u +%Y%m%dT%H%M%SZ)"
tar --acls --xattrs -xzf "$TASHIRA_BACKUP_ROOT/documents.tar.gz" -C /var/www/tashira
pm2 restart tashira --update-env
```

Verify health and document ownership before ending the incident.
