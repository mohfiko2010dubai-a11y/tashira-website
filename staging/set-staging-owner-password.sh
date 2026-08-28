#!/usr/bin/env bash
set -euo pipefail

expected_directory="/var/www/tashira-staging"
if [[ "$(pwd -P)" != "$expected_directory" ]]; then
  echo "ERROR: staging identity check failed" >&2
  exit 1
fi

if [[ ! -f staging/secrets/admin_password ]]; then
  echo "ERROR: staging admin secret is unavailable" >&2
  exit 1
fi

read -r -s -p "Enter new staging-owner password: " password
printf '\n'
read -r -s -p "Confirm new staging-owner password: " confirmation
printf '\n'

if [[ -z "$password" || "$password" != "$confirmation" ]]; then
  unset password confirmation
  echo "ERROR: passwords are empty or do not match" >&2
  exit 1
fi
if (( ${#password} < 16 )) || [[ "$password" =~ [[:space:]] ]]; then
  unset password confirmation
  echo "ERROR: use at least 16 characters without spaces" >&2
  exit 1
fi

printf '%s' "$password" | node staging/reset-staging-owner-password.mjs
unset password confirmation

