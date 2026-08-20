#!/usr/bin/env bash
set -euo pipefail
umask 077

env_file=/var/www/tashira/.env
test "$(id -u)" -eq 0
test "$(pwd -P)" = "/var/www/tashira"
test -f "$env_file"
test "$(stat -c '%U:%G' "$env_file")" = "root:root"

read_confirmed() {
  local label="$1" result_var="$2" first second
  read -r -s -p "Enter ${label}: " first
  printf '\n'
  read -r -s -p "Confirm ${label}: " second
  printf '\n'
  if [[ -z "$first" || "$first" != "$second" || "$first" == *[[:space:]]* ]]; then
    unset first second
    echo 'ERROR: empty, mismatched, or whitespace-contaminated input rejected' >&2
    exit 2
  fi
  printf -v "$result_var" '%s' "$first"
  unset first second
}

read_confirmed 'LIVE publishable key' publishable_key
read_confirmed 'LIVE secret key' secret_key
read_confirmed 'LIVE webhook signing secret' webhook_secret

if [[ "$publishable_key" != pk_live_?* || "$secret_key" != sk_live_?* || "$webhook_secret" != whsec_?* ]]; then
  unset publishable_key secret_key webhook_secret
  echo 'ERROR: LIVE credential class validation failed' >&2
  exit 3
fi
if [[ "${publishable_key,,}${secret_key,,}${webhook_secret,,}" == *placeholder*
  || "${publishable_key,,}${secret_key,,}${webhook_secret,,}" == *replace_with*
  || "${publishable_key,,}${secret_key,,}${webhook_secret,,}" == *example* ]]; then
  unset publishable_key secret_key webhook_secret
  echo 'ERROR: placeholder credentials rejected' >&2
  exit 4
fi

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/var/www/tashira/.env.before-stripe-live-${timestamp}"
cp --preserve=all -- "$env_file" "$backup"
chown root:root "$backup"
chmod 600 "$backup"

temp_file=$(mktemp /var/www/tashira/.env.stripe-live.XXXXXX)
cleanup() {
  unset publishable_key secret_key webhook_secret
  rm -f -- "$temp_file"
}
trap cleanup EXIT
chmod 600 "$temp_file"
chown root:root "$temp_file"

publishable_written=0
secret_written=0
webhook_written=0
mode_written=0
while IFS= read -r line || [[ -n "$line" ]]; do
  case "$line" in
    VITE_STRIPE_PUBLISHABLE_KEY=*)
      if [[ "$publishable_written" -eq 0 ]]; then
        printf 'VITE_STRIPE_PUBLISHABLE_KEY=%s\n' "$publishable_key" >> "$temp_file"
        publishable_written=1
      fi
      ;;
    STRIPE_SECRET_KEY=*)
      if [[ "$secret_written" -eq 0 ]]; then
        printf 'STRIPE_SECRET_KEY=%s\n' "$secret_key" >> "$temp_file"
        secret_written=1
      fi
      ;;
    STRIPE_WEBHOOK_SECRET=*)
      if [[ "$webhook_written" -eq 0 ]]; then
        printf 'STRIPE_WEBHOOK_SECRET=%s\n' "$webhook_secret" >> "$temp_file"
        webhook_written=1
      fi
      ;;
    STRIPE_MODE=*)
      if [[ "$mode_written" -eq 0 ]]; then
        printf 'STRIPE_MODE=LIVE\n' >> "$temp_file"
        mode_written=1
      fi
      ;;
    *) printf '%s\n' "$line" >> "$temp_file" ;;
  esac
done < "$env_file"

[[ "$publishable_written" -eq 1 ]] || printf 'VITE_STRIPE_PUBLISHABLE_KEY=%s\n' "$publishable_key" >> "$temp_file"
[[ "$secret_written" -eq 1 ]] || printf 'STRIPE_SECRET_KEY=%s\n' "$secret_key" >> "$temp_file"
[[ "$webhook_written" -eq 1 ]] || printf 'STRIPE_WEBHOOK_SECRET=%s\n' "$webhook_secret" >> "$temp_file"
[[ "$mode_written" -eq 1 ]] || printf 'STRIPE_MODE=LIVE\n' >> "$temp_file"

unset publishable_key secret_key webhook_secret
mv -f -- "$temp_file" "$env_file"
trap - EXIT
chown root:root "$env_file"
chmod 600 "$env_file"

test "$(grep -c '^VITE_STRIPE_PUBLISHABLE_KEY=pk_live_.' "$env_file")" -eq 1
test "$(grep -c '^STRIPE_SECRET_KEY=sk_live_.' "$env_file")" -eq 1
test "$(grep -c '^STRIPE_WEBHOOK_SECRET=whsec_.' "$env_file")" -eq 1
test "$(grep -c '^STRIPE_MODE=LIVE$' "$env_file")" -eq 1
test "$(grep -Ec '^(VITE_STRIPE_PUBLISHABLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|STRIPE_MODE)=' "$env_file")" -eq 4
test "$(stat -c '%a' "$env_file")" = 600

echo 'STRIPE_LIVE_CONFIGURATION=READY'
echo 'TEST_LIVE_ISOLATION=PASS'
echo 'ENV_BACKUP=PASS'
echo 'ENV_MODE=600'
