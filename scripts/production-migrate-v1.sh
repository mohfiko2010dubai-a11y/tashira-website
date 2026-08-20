#!/usr/bin/env bash
set -euo pipefail

readonly PRODUCTION_DB="tashira_db"
readonly PRODUCTION_HOST="srv1681102"
readonly PRODUCTION_PATH="/var/www/tashira"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1"; }
fail() { log "STOP: $1" >&2; exit 1; }
usage() {
  printf 'Usage: %s <migrate|verify> --approved-sha SHA --backup-manifest PATH [--rehearsal-db NAME]\n' "$0" >&2
  exit 2
}

mode="${1:-}"
shift || true
approved_sha=""
backup_manifest=""
rehearsal_db=""
while (($#)); do
  case "$1" in
    --approved-sha) approved_sha="${2:-}"; shift 2 ;;
    --backup-manifest) backup_manifest="${2:-}"; shift 2 ;;
    --rehearsal-db) rehearsal_db="${2:-}"; shift 2 ;;
    *) usage ;;
  esac
done

[[ "$mode" == "migrate" || "$mode" == "verify" ]] || usage
[[ "$approved_sha" =~ ^[0-9a-f]{40}$ ]] || fail "approved SHA is invalid"
[[ -f "$backup_manifest" ]] || fail "verified backup manifest is required"

manifest_value() {
  local value
  value="$(awk -F= -v wanted="$1" '$1 == wanted { sub(/^[^=]*=/, ""); print; exit }' "$backup_manifest")"
  [[ -n "$value" ]] || fail "backup manifest is missing $1"
  printf '%s' "$value"
}

db_backup="$(manifest_value DB_BACKUP)"
documents_backup="$(manifest_value DOCUMENTS_BACKUP)"
config_backup="$(manifest_value CONFIG_BACKUP)"
git_head_backup="$(manifest_value GIT_HEAD_BACKUP)"
current_production_sha="$(manifest_value CURRENT_PRODUCTION_SHA)"
sha_manifest="$(manifest_value SHA256_MANIFEST)"
off_host_destination="$(manifest_value OFF_HOST_DESTINATION)"
off_host_manifest_sha="$(manifest_value OFF_HOST_MANIFEST_SHA256)"
off_host_confirmed_by="$(manifest_value OFF_HOST_CONFIRMED_BY)"
off_host_confirmed_at="$(manifest_value OFF_HOST_CONFIRMED_AT)"

for artifact in "$db_backup" "$documents_backup" "$config_backup" "$git_head_backup" "$sha_manifest"; do
  [[ "$artifact" == /* && -f "$artifact" ]] || fail "backup artifact is missing"
done
[[ "$off_host_destination" != /* && "$off_host_destination" != file:* ]] || fail "off-host destination is not off-host"
[[ "$off_host_confirmed_by" != "REPLACE_ME" ]] || fail "off-host confirmation is incomplete"
[[ "$off_host_confirmed_at" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T ]] || fail "off-host confirmation timestamp is invalid"
[[ "$(sha256sum "$sha_manifest" | awk '{print $1}')" == "$off_host_manifest_sha" ]] || fail "off-host manifest checksum does not match"
(cd "$(dirname "$sha_manifest")" && sha256sum -c "$(basename "$sha_manifest")" >/dev/null) || fail "backup checksum verification failed"
gzip -t "$db_backup" || fail "database backup archive is invalid"
tar -tzf "$documents_backup" >/dev/null || fail "documents backup archive is invalid"
tar -tzf "$config_backup" >/dev/null || fail "config backup archive is invalid"
[[ "$current_production_sha" =~ ^[0-9a-f]{40}$ ]] || fail "current production SHA evidence is invalid"
[[ "$(tr -d '\r\n' < "$git_head_backup")" == "$current_production_sha" ]] || fail "Git HEAD backup does not match the recorded current production SHA"
[[ "$(git rev-parse HEAD)" == "$approved_sha" ]] || fail "checkout is not the approved SHA"
git ls-files --error-unmatch scripts/production-migrate-v1.sh migrations/004_application_timeline.sql migrations/005_business_architecture.sql migrations/006_applicant_slot_uniqueness.sql migrations/007_stripe_webhook_idempotency.sql migrations/008_email_template_evidence.sql >/dev/null || fail "migration tooling is not tracked by the approved commit"
git diff --quiet HEAD -- migrations scripts/production-migrate-v1.sh || fail "migration tooling differs from the approved commit"
git diff --cached --quiet -- migrations scripts/production-migrate-v1.sh || fail "staged migration tooling differs from the approved commit"

if [[ -n "$rehearsal_db" ]]; then
  [[ "$rehearsal_db" =~ ^tashira_rehearsal_[a-z0-9_]+$ ]] || fail "invalid rehearsal database identity"
  [[ "$(pwd -P)" == /var/www/tashira-rehearsal-* ]] || fail "rehearsal mode requires an isolated checkout"
  target_db="$rehearsal_db"
else
  [[ "$(hostname)" == "$PRODUCTION_HOST" ]] || fail "production host identity mismatch"
  [[ "$(pwd -P)" == "$PRODUCTION_PATH" ]] || fail "production path identity mismatch"
  target_db="$PRODUCTION_DB"
fi

mysql_query() { mysql --batch --skip-column-names --database="$target_db" -e "$1"; }
expect_equal() {
  [[ "$2" == "$3" ]] || fail "$1: expected $3, got $2"
}
expect_query() { expect_equal "$1" "$(mysql_query "$2")" "$3"; }

expect_query "database identity" "SELECT DATABASE()" "$target_db"

preserved_counts() {
  mysql_query "SELECT CONCAT(
    (SELECT COUNT(*) FROM applications), ':',
    (SELECT COUNT(*) FROM applicants), ':',
    (SELECT COUNT(*) FROM payments), ':',
    (SELECT COUNT(*) FROM invoices), ':',
    (SELECT COUNT(*) FROM documents))"
}
before_counts="$(preserved_counts)"

verify_004() {
  expect_query "004 table" "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='application_timeline_events'" "1"
  expect_query "004 columns" "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='application_timeline_events'" "15"
  expect_query "004 indexes" "SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='application_timeline_events' AND INDEX_NAME IN ('PRIMARY','timeline_application_created_idx','timeline_payment_idx')" "3"
  expect_query "004 foreign keys" "SELECT COUNT(DISTINCT CONSTRAINT_NAME) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='application_timeline_events' AND CONSTRAINT_NAME IN ('timeline_application_fk','timeline_payment_fk') AND REFERENCED_TABLE_NAME IS NOT NULL" "2"
  expect_query "004 composite index" "SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='application_timeline_events' AND INDEX_NAME='timeline_application_created_idx'" "application_id,created_at"
  expect_query "004 actor type" "SELECT CONCAT(COLUMN_TYPE,'/',IS_NULLABLE) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='application_timeline_events' AND COLUMN_NAME='actor_type'" "enum('CUSTOMER','STAFF','ADMIN','SYSTEM','STRIPE')/NO"
}

verify_005() {
  expect_query "005 tables" "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('pricing_rules','business_settings_versions','application_price_snapshots','financial_events','application_risk_assessments','retention_policies','retention_records','legal_hold_events','deletion_audit_events','customer_recovery_challenges','outbound_email_events','document_lifecycle_events')" "12"
  expect_query "005 foreign keys" "SELECT COUNT(DISTINCT CONSTRAINT_NAME) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL AND TABLE_NAME IN ('application_price_snapshots','financial_events','application_risk_assessments','legal_hold_events','deletion_audit_events','customer_recovery_challenges','outbound_email_events','document_lifecycle_events')" "11"
  expect_query "005 triggers" "SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME IN ('application_timeline_no_update','application_timeline_no_delete','price_snapshot_no_update','price_snapshot_no_delete','financial_events_no_update','financial_events_no_delete','risk_assessments_no_update','risk_assessments_no_delete','legal_hold_events_no_update','legal_hold_events_no_delete','deletion_audit_no_update','deletion_audit_no_delete','outbound_email_no_update','outbound_email_no_delete','document_lifecycle_no_update','document_lifecycle_no_delete')" "16"
  expect_query "005 indexes" "SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND INDEX_NAME IN ('pricing_rule_version_uq','pricing_rule_active_idx','business_settings_version_uq','business_settings_effective_idx','application_price_snapshot_uq','financial_event_application_idx','financial_event_payment_idx','risk_application_created_idx','retention_policy_version_uq','retention_subject_uq','retention_due_hold_idx','legal_hold_record_created_idx','deletion_audit_record_created_idx','recovery_application_idx','recovery_token_expiry_idx','outbound_email_application_idx','document_lifecycle_application_idx','document_lifecycle_document_idx','document_lifecycle_applicant_idx')" "19"
  expect_query "invoice VAT default" "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND COLUMN_NAME='vat_rate' AND COLUMN_DEFAULT IS NULL" "1"
  expect_query "exchange default" "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='applications' AND COLUMN_NAME='exchange_rate' AND COLUMN_DEFAULT IS NULL" "1"
}

verify_006() {
  expect_query "applicant index type" "SELECT CONCAT(COLUMN_TYPE,'/',IS_NULLABLE) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='applicants' AND COLUMN_NAME='applicant_index'" "bigint unsigned/NO"
  expect_query "applicant unique index" "SELECT CONCAT(MIN(NON_UNIQUE),':',GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX)) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='applicants' AND INDEX_NAME='applicant_application_index_uq'" "0:application_id,applicant_index"
}

verify_007() {
  expect_query "007 columns" "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stripe_webhook_events'" "8"
  expect_query "007 indexes" "SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stripe_webhook_events' AND INDEX_NAME IN ('PRIMARY','stripe_webhook_payment_intent_idx')" "2"
  expect_query "007 index columns" "SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stripe_webhook_events' AND INDEX_NAME='stripe_webhook_payment_intent_idx'" "payment_intent_id,created_at"
}

verify_008() {
  expect_query "008 table" "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='outbound_email_events'" "1"
  local enum_type
  enum_type="$(mysql_query "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='outbound_email_events' AND COLUMN_NAME='email_template'")"
  [[ "$enum_type" == *"'STATUS_CHANGED'"* && "$enum_type" == *"'RESUME_LINK'"* && "$enum_type" == *"'RECOVERY_OTP'"* ]] || fail "008 email template enum is incomplete"
}

verify_all() {
  verify_004; verify_005; verify_006; verify_007; verify_008
  expect_equal "preserved row counts" "$(preserved_counts)" "$before_counts"
}

if [[ "$mode" == "verify" ]]; then
  log "verifying completed V1 production schema"
  verify_all
  log "V1 production schema verification passed"
  exit 0
fi

expect_query "pre-migration V1 table count" "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('application_timeline_events','pricing_rules','business_settings_versions','application_price_snapshots','financial_events','application_risk_assessments','retention_policies','retention_records','legal_hold_events','deletion_audit_events','customer_recovery_challenges','outbound_email_events','document_lifecycle_events','stripe_webhook_events')" "0"
for table in applications applicants payments invoices documents; do
  expect_query "baseline table $table" "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='$table'" "1"
done
migration_dir="$(pwd -P)/migrations"

log "applying migration 004"
mysql --database="$target_db" < "$migration_dir/004_application_timeline.sql"
verify_004
expect_equal "row counts after 004" "$(preserved_counts)" "$before_counts"

log "applying migration 005"
mysql --database="$target_db" < "$migration_dir/005_business_architecture.sql"
verify_005
expect_equal "row counts after 005" "$(preserved_counts)" "$before_counts"

log "checking applicant index alignment guards"
expect_query "duplicate applicant slots" "SELECT COUNT(*) FROM (SELECT application_id,applicant_index FROM applicants GROUP BY application_id,applicant_index HAVING COUNT(*)>1) duplicates" "0"
expect_query "negative applicant indexes" "SELECT COUNT(*) FROM applicants WHERE applicant_index<0" "0"
applicant_count="$(mysql_query "SELECT COUNT(*) FROM applicants")"
applicant_min="$(mysql_query "SELECT COALESCE(MIN(applicant_index),0) FROM applicants")"
applicant_max="$(mysql_query "SELECT COALESCE(MAX(applicant_index),0) FROM applicants")"
mysql_query "ALTER TABLE applicants MODIFY COLUMN applicant_index BIGINT UNSIGNED NOT NULL"
expect_equal "applicant count after alignment" "$(mysql_query "SELECT COUNT(*) FROM applicants")" "$applicant_count"
expect_equal "applicant minimum after alignment" "$(mysql_query "SELECT COALESCE(MIN(applicant_index),0) FROM applicants")" "$applicant_min"
expect_equal "applicant maximum after alignment" "$(mysql_query "SELECT COALESCE(MAX(applicant_index),0) FROM applicants")" "$applicant_max"

log "applying migration 006"
mysql --database="$target_db" < "$migration_dir/006_applicant_slot_uniqueness.sql"
verify_006
expect_equal "row counts after 006" "$(preserved_counts)" "$before_counts"

log "applying migration 007"
mysql --database="$target_db" < "$migration_dir/007_stripe_webhook_idempotency.sql"
verify_007
expect_equal "row counts after 007" "$(preserved_counts)" "$before_counts"

log "applying migration 008"
mysql --database="$target_db" < "$migration_dir/008_email_template_evidence.sql"
verify_008
expect_equal "row counts after 008" "$(preserved_counts)" "$before_counts"

verify_all
log "V1 migration sequence completed and verified"
