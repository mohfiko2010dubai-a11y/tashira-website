# Kimi Staging Runbook

## Identity

- URL: `https://staging.tashiraev.com`
- SSH: `kimi-deploy@168.231.85.149`, port `22`, key-only with a forced command gateway.
- App: `/var/www/tashira-staging`
- Documents: `/var/www/tashira-staging/storage/documents`
- DB: `tashira_staging` through dedicated `kimi_staging` credentials supplied by a server-side secret file, never chat/Git.
- PM2: `tashira-staging`
- Listener: `127.0.0.1:3002`

## Preflight

```text
ssh -p 22 kimi-deploy@168.231.85.149 status
ssh -p 22 kimi-deploy@168.231.85.149 health
ssh -p 22 kimi-deploy@168.231.85.149 db-status
ssh -p 22 kimi-deploy@168.231.85.149 feature-flags
```

Prove the path, DB name and PM2 name before mutation. Stop if any Production path, DB or process appears.

## Git Bundle ingestion

GitHub credentials are never passed to Kimi through the server. When GitHub push is unavailable, create a bundle containing only `refs/heads/kimi/staging-final-recovery`, obtain its full SHA-256 checksum, then stream the binary bundle to:

```text
ssh -p 22 kimi-deploy@168.231.85.149 "ingest-bundle <64-character-sha256>" < <bundle-file>
```

The gateway accepts at most 100 MiB and allows 120 seconds for input. It checks the checksum, bundle structure, allowed ref, full 40-character commit, ancestry from `4e0f520b72e047e590a646774576eec2614a2e22`, prohibited files and likely secrets. It imports only into an isolated review namespace and stores an accepted backup. It does not run package scripts, update GitHub, deploy, migrate or modify the live Staging checkout.

Kimi must separately provide the full final 40-character commit SHA. The abbreviated `3f8070a` is not sufficient.

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

Migration remains owner-controlled. The Kimi gateway does not expose MySQL mutation or migration commands.

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

Logs and Nginx operations remain owner-mediated. The Kimi account has no unrestricted shell or service-management permission.

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
