# Production audit plan

This is a future read-only inspection plan. It does not authorize connection. Every proposed command is read-only and must be reviewed after SSH host identity and scope are explicitly approved. Do not display secret values.

## 1. SSH identity

- Obtain hostname/IP, port, user, local key path, and administrator-confirmed SHA256 host fingerprint.
- Compare the presented key before authentication; do not accept an unknown key blindly.

Read-only client check after approval:

```bash
ssh-keygen -F <host>
```

## 2. Repository identity

```bash
pwd
git -C /var/www/tashira status --short --branch
git -C /var/www/tashira remote -v
git -C /var/www/tashira rev-parse HEAD
git -C /var/www/tashira branch --show-current
git -C /var/www/tashira log -1 --format='%H %cI %s'
```

Compare commit and branch with the approved repository revision. Do not fetch, pull, reset, clean, or checkout.

## 3. PM2

```bash
pm2 status
pm2 describe tashira
pm2 env <process-id>
```

When reviewing environment output, record variable names and configuration presence only; redact values.

## 4. Nginx

```bash
nginx -T
systemctl status nginx --no-pager
```

Review hosts, TLS, proxy routes, document exposure, request limits, and security headers.

## 5. Docker and volumes

```bash
docker ps --no-trunc
docker compose ps
docker inspect <container>
docker volume ls
docker volume inspect <volume>
```

Confirm whether Docker is active and whether MySQL/documents use persistent volumes. Do not start, stop, exec into, or modify containers.

## 6. MySQL identity and schema

Use an approved read-only database account. Do not print the connection string.

```sql
SELECT VERSION();
SELECT DATABASE();
SHOW TABLES;
SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE();
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, ORDINAL_POSITION;
```

Do not run migrations, writes, locks, dumps that affect service, or destructive SQL.

## 7. Filesystem and document storage

```bash
readlink -f /var/www/tashira/storage/documents
stat /var/www/tashira/storage/documents
namei -l /var/www/tashira/storage/documents
du -sh /var/www/tashira/storage/documents
find /var/www/tashira/storage/documents -type f -printf '.' | wc -c
df -h /var/www/tashira/storage/documents
df -i /var/www/tashira/storage/documents
```

Do not list customer filenames or read document contents unless separately necessary and authorized.

## 8. Backups and restore readiness

Inspect backup service status, locations, timestamps, sizes, retention, encryption, and recent restore-test evidence using site-specific read-only commands. Do not expose backup contents or credentials. A backup is not considered verified solely because a file exists.

## 9. Cron and webhook deployments

```bash
crontab -l
systemctl list-timers --all
systemctl status tashira-webhook --no-pager
systemctl cat tashira-webhook
ss -lntp
```

Identify all update triggers, locks, users, ports, and script paths. Do not trigger deployments or webhooks.

## 10. Logs

```bash
pm2 logs tashira --lines 100 --nostream
journalctl -u tashira-webhook -n 100 --no-pager
journalctl -u nginx -n 100 --no-pager
```

Redact secrets, tokens, PII, document names, and customer data from notes.

## 11. Environment variable names

Confirm presence—not values—of `NODE_ENV`, `PORT`, `DATABASE_URL`, `STORAGE_ROOT`, Stripe variables, OAuth variables, integration variables, and deployment configuration. Supabase variables do not prove Supabase is active.

## Deliverable

Report verified runtime architecture, revision drift, process/network topology, database identity/schema drift, storage resolution/persistence, backup readiness, competing deployment triggers, and prioritized risks. Clearly separate verified facts from inference.
