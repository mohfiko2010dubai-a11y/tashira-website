#!/usr/bin/env bash
set -euo pipefail

expected_dir="/var/www/tashira-staging"
database_name="tashira_staging"
database_user="tashira_staging_app"
migration_user="tashira_staging_migrator"

if [[ "$(pwd -P)" != "$expected_dir" ]]; then
  echo "Refusing to provision outside $expected_dir" >&2
  exit 1
fi
if [[ "$(git branch --show-current)" != "devops/deployment-safety" ]]; then
  echo "Refusing to provision from a non-review branch" >&2
  exit 1
fi
if [[ -e storage/documents && "$(readlink -f storage/documents)" == /var/www/tashira/storage/documents* ]]; then
  echo "Refusing production storage linkage" >&2
  exit 1
fi

mkdir -p storage/documents storage/invoices dist/public/invoices logs backups
chmod 700 storage storage/documents storage/invoices logs backups

if [[ "${STAGING_RESET:-false}" == "true" ]]; then
  pm2 delete tashira-staging >/dev/null 2>&1 || true
  if mysql -uroot --batch --skip-column-names -e "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='${database_name}'" | grep -Fx "$database_name" >/dev/null; then
    mysqldump -uroot "$database_name" > "backups/pre-reset-$(date -u +%Y%m%dT%H%M%SZ).sql"
    mysql -uroot -e "DROP DATABASE \`${database_name}\`;"
  fi
fi

db_password_file=".staging-db-password"
if [[ ! -s "$db_password_file" ]]; then
  openssl rand -hex 32 > "$db_password_file"
  chmod 600 "$db_password_file"
fi
db_password="$(<"$db_password_file")"
migration_password="$(openssl rand -hex 32)"

cleanup_migrator() {
  mysql -uroot -e "DROP USER IF EXISTS '${migration_user}'@'localhost';" >/dev/null 2>&1 || true
}
trap cleanup_migrator EXIT

mysql -uroot <<SQL
CREATE DATABASE IF NOT EXISTS \`${database_name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${database_user}'@'localhost' IDENTIFIED BY '${db_password}';
ALTER USER '${database_user}'@'localhost' IDENTIFIED BY '${db_password}';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`${database_name}\`.* TO '${database_user}'@'localhost';
CREATE USER '${migration_user}'@'localhost' IDENTIFIED BY '${migration_password}';
GRANT ALL PRIVILEGES ON \`${database_name}\`.* TO '${migration_user}'@'localhost';
FLUSH PRIVILEGES;
SQL

mysql -uroot --batch --skip-column-names -e "SELECT DATABASE()" "$database_name" | grep -Fx "$database_name" >/dev/null
mysqldump -uroot --no-data "$database_name" > "backups/pre-005-empty-schema.sql"

npm ci
push_log="$(mktemp)"
if ! DATABASE_URL="mysql://${migration_user}:${migration_password}@127.0.0.1:3306/${database_name}" npm run db:push -- --force 2>&1 | tee "$push_log"; then
  rm -f "$push_log"
  exit 1
fi
if grep -q '^Error:' "$push_log"; then
  rm -f "$push_log"
  echo "Drizzle reported an error despite returning success" >&2
  exit 1
fi
rm -f "$push_log"
mysql -uroot "$database_name" < migrations/005_business_architecture.sql
mysql -uroot "$database_name" < migrations/006_applicant_slot_uniqueness.sql
mysql -uroot "$database_name" < migrations/007_stripe_webhook_idempotency.sql
mysql -uroot "$database_name" < migrations/008_email_template_evidence.sql
mysql -uroot "$database_name" < staging/seed-reference.sql
cleanup_migrator
trap - EXIT

write_secret_if_missing() {
  local name="$1"
  local value="$2"
  if ! grep -q "^${name}=" .env 2>/dev/null; then
    printf '%s=%s\n' "$name" "$value" >> .env
  fi
}

touch .env
chmod 600 .env
write_secret_if_missing NODE_ENV production
write_secret_if_missing HOST 127.0.0.1
write_secret_if_missing PORT 3002
write_secret_if_missing APP_ID tashira-staging
write_secret_if_missing APP_SECRET "$(openssl rand -hex 32)"
write_secret_if_missing DATABASE_URL "mysql://${database_user}:${db_password}@127.0.0.1:3306/${database_name}"
write_secret_if_missing KIMI_OPEN_URL https://unused.example.com
write_secret_if_missing ADMIN_PASSWORD "$(openssl rand -base64 24 | tr -d '\n')"
write_secret_if_missing ADMIN_SESSION_SECRET "$(openssl rand -hex 32)"
write_secret_if_missing CUSTOMER_SESSION_SECRET "$(openssl rand -hex 32)"
write_secret_if_missing STORAGE_URL_SECRET "$(openssl rand -hex 32)"
write_secret_if_missing STORAGE_ROOT "$expected_dir/storage/documents"

npm run check
npm run lint
npm run test
node staging/build-native.mjs

pm2 delete tashira-staging >/dev/null 2>&1 || true
pm2 start staging/run-native.mjs --name tashira-staging --cwd "$expected_dir" \
  --output "$expected_dir/logs/app-out.log" --error "$expected_dir/logs/app-error.log" --time

sleep 3
curl --fail --silent http://127.0.0.1:3002/api/health >/dev/null

mysql -uroot --batch --skip-column-names "$database_name" -e \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${database_name}' AND table_name IN ('pricing_rules','business_settings_versions','application_price_snapshots','retention_records');" \
  | grep -Fx 4 >/dev/null
mysql -uroot --batch --skip-column-names "$database_name" -e \
  "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema='${database_name}' AND trigger_name IN ('application_timeline_no_update','price_snapshot_no_update','legal_hold_events_no_delete');" \
  | grep -Fx 3 >/dev/null

echo "Native staging provisioned on 127.0.0.1:3002"
