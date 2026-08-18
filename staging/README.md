# TASHIRA staging runtime

This directory defines an isolated staging runtime. It must never reference production MySQL, production storage, production Stripe keys, production mail, or `/var/www/tashira`.

## Required external resources

1. An isolated native or Docker staging runtime.
2. DNS for `staging.tashiraev.com` pointing only to the approved staging entry point.
3. A valid staging-only TLS certificate.
4. Stripe TEST publishable, secret, and webhook credentials.
5. Synthetic test data only.

## Local secret files

Copy `staging/.env.example` to `staging/.env`, then create these ignored files under `staging/secrets/`:

- `mysql_root_password`
- `mysql_app_password`
- `app_secret`
- `admin_password`
- `admin_session_secret` (at least 32 random characters)
- `customer_session_secret` (at least 32 random characters)
- `storage_url_secret` (at least 32 random characters)
- `stripe_secret_key` (must be a Stripe TEST secret key)
- `stripe_webhook_secret` (must belong to the staging Stripe TEST webhook endpoint)
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

## Current native staging entry point

The approved native runtime is private on `127.0.0.1:3002`. The public entry point is only `https://staging.tashiraev.com`, using the reviewed `staging/nginx-native.conf` virtual host and a separate Let's Encrypt certificate. HTTP redirects to HTTPS, every response carries `X-Robots-Tag: noindex, nofollow, noarchive`, and staging disables browser caching so UAT always exercises the current build.

All updates to the existing native staging runtime must use this single deployment entry point from `/var/www/tashira-staging`:

```bash
node staging/deploy-native.mjs
```

It invokes the guarded `staging/build-native.mjs`, verifies that the current payment chunk contains the configured Stripe TEST publishable key, restarts only `tashira-staging`, and checks the private staging health endpoint. Plain `npm run build` is not a valid staging deployment command and fails before Vite builds when the required staging injection is absent.

MySQL remains private on `127.0.0.1:3306`. Never publish port 3002 or the database port, and never point this virtual host at production port 3000.

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
