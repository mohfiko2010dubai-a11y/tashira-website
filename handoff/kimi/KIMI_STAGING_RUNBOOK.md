# Kimi Staging Runbook

## Identity

- URL: `https://staging.tashiraev.com`
- SSH: `kimi-deploy@168.231.85.149`, port `22`, key-only after public key installation.
- App: `/var/www/tashira-staging`
- Documents: `/var/www/tashira-staging/storage/documents`
- DB: `tashira_staging` through dedicated `kimi_staging` credentials supplied by a server-side secret file, never chat/Git.
- PM2: `tashira-staging`
- Listener: `127.0.0.1:3002`

## Preflight

```text
whoami
pwd
git rev-parse HEAD
git status --short
node -v
npm -v
pm2 describe tashira-staging
curl -fsS http://127.0.0.1:3002/api/health
```

Prove the path, DB name and PM2 name before mutation. Stop if any Production path, DB or process appears.

## Build and quality

```text
npm ci
npm run check
NODE_OPTIONS=--max-old-space-size=6144 npm run lint
npm run test
npm run build
node staging/build-native.mjs
```

The native Staging build is mandatory because it validates injected Staging public configuration.

## Migration

1. Create a verified root-owned Staging DB backup.
2. Verify `SELECT DATABASE()` returns `tashira_staging`.
3. Review the exact forward/rollback pair.
4. Apply only the approved next migration in numerical order.
5. Verify schema/integrity and keep all new flags OFF.

`kimi-deploy` must use the approved wrapper/sudo command; direct Production MySQL access is forbidden.

## Deploy and rollback

```text
git fetch origin kimi/staging-final-recovery
git checkout --detach <exact-approved-sha>
node staging/deploy-native.mjs
pm2 describe tashira-staging
curl -fsS http://127.0.0.1:3002/api/health
curl -fsS https://staging.tashiraev.com/
```

Rollback: restore the last approved exact SHA and run the same native deploy. Restore DB/documents only from a verified Staging backup and only when the migration rollback plan requires it.

## Logs and Nginx

Use the constrained commands documented in `KIMI_ACCESS_MATRIX.md`: read Staging PM2 logs, test Nginx, and install only the approved Staging server block. Never reload or modify Production configuration through an unrestricted shell.

## Browser smoke/E2E

- `/apply`
- `/staff/login`
- `/staff/operations/dashboard`
- `/staff/operations/applications`
- synthetic individual/family create, resume, upload, review, payment readiness and visa delivery.
- wrong-team, anonymous, finance isolation and cross-applicant denial.

## Backup evidence

Server copy: `/var/backups/tashira-staging/PRE_KIMI_2026-08-29`. See `PRE_KIMI_BACKUP_MANIFEST.md` outside Git for hashes/restoration order.

## Production exclusion

Do not use `/var/www/tashira`, database `tashira`, PM2 process `tashira`, Production Nginx files, Stripe Live or Resend Live. Verify public Production health read-only before and after a Staging deployment.
