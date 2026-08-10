# TASHIRA staging runtime

This directory defines an isolated staging runtime. It must never reference production MySQL, production storage, production Stripe keys, production mail, or `/var/www/tashira`.

## Required external resources

1. A staging host with Docker Engine and Docker Compose.
2. DNS for `staging.tashiraev.com` pointing only to that host.
3. TLS certificate files at `staging/certs/fullchain.pem` and `staging/certs/privkey.pem`.
4. Stripe TEST publishable, secret, and webhook credentials.
5. Synthetic test data only.

## Local secret files

Copy `staging/.env.example` to `staging/.env`, then create these ignored files under `staging/secrets/`:

- `mysql_root_password`
- `mysql_app_password`
- `app_secret`
- `admin_password`
- `admin_session_secret` (at least 32 random characters)
- `storage_url_secret` (at least 32 random characters)
- `stripe_secret_key` (must be a Stripe TEST secret key)
- `kimi_api_key` (a staging-only chatbot key)

Never commit these files. Never reuse a production value.

## Isolation guarantees

- The database hostname is fixed in code to the internal Compose service `staging-db`.
- The database name and user must be exactly `tashira_staging` and `tashira_staging_app`.
- The migration guard refuses any other database identity.
- MySQL has no published host port.
- Document and invoice volumes use staging-only names.
- No production filesystem path is mounted.
- Mail is routed to Mailpit; its UI is bound to host loopback only.
- Stripe server startup refuses non-TEST secret keys.
- Nginx proxies only to the staging application service.

## Schema preparation

The migration container runs Drizzle `push --force` only after its staging identity guard succeeds. This is acceptable only for a new, disposable staging database. Before production deployment work resumes, the repository needs a reviewed, immutable migration chain because the existing migration history is incomplete and inconsistent with `db/schema.ts`.

## Start sequence on the staging host

From the repository root on the staging host:

```sh
docker compose --env-file staging/.env -f staging/docker-compose.yml config
docker compose --env-file staging/.env -f staging/docker-compose.yml build
docker compose --env-file staging/.env -f staging/docker-compose.yml up -d
docker compose --env-file staging/.env -f staging/docker-compose.yml ps
```

Do not run these commands on production.

## Known limitation

Mailpit is provisioned and the application receives staging SMTP names, but the current application has no implemented mail transport. Email delivery cannot be declared functional until a reviewed mail adapter is added and tested against Mailpit.
