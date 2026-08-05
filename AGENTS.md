# AGENTS.md

## Project

TASHIRA is a full-stack UAE visa application platform.

Primary stack:

- React 19
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Hono
- tRPC
- Drizzle ORM
- MySQL
- Stripe
- Server filesystem document storage

Repository structure:

- `src/` contains the frontend.
- `api/` contains the backend.
- `db/` contains database definitions and migrations.
- `contracts/` contains shared frontend/backend contracts.

## Production architecture

- Production uses MySQL hosted on the production server.
- Production uploaded documents are stored on the server filesystem.
- The expected production document path is:

  ```text
  /var/www/tashira/storage/documents
  ```

- Supabase-related code and environment variables are legacy or inactive unless current runtime verification proves otherwise.
- Do not assume Supabase is active.
- Do not migrate database data or document storage to Supabase without explicit approval.

## Safety rules

- Never deploy to production unless the user explicitly requests deployment.
- Never connect to the production server unless the user explicitly authorizes the connection.
- Never push, merge, or create a pull request unless explicitly requested.
- Never create a commit unless explicitly requested.
- Never run destructive Git commands against the workspace without explicit approval.
- Never run database migrations against production without explicit approval and a verified backup.
- Never print, log, commit, or expose secret values.
- Environment-variable names may be documented; their values must remain private.
- Never put Stripe secret keys, service-role keys, database passwords, private keys, access tokens, or webhook secrets in browser code.
- Treat passport data, identity documents, contact details, chat history, payment data, and application records as sensitive PII.
- Do not use production customer data in tests or fixtures.
- Treat `/var/www/tashira/storage/documents` as production-sensitive data containing customer documents and PII.
- Never delete, move, rename, replace, or overwrite production database files or uploaded documents without all of the following:
  1. Explicit user authorization.
  2. Verified current backups.
  3. A tested recovery procedure.
  4. Exact source and destination path validation.
- Never modify production storage configuration based only on repository comments, legacy code, or environment examples.
- Never expose, copy, or use production customer documents outside the authorized scope.
- Do not migrate data or storage providers without explicit approval.

## Required pre-change review

Before changing code:

1. Read the relevant frontend page or component.
2. Read the corresponding tRPC router.
3. Read the relevant database schema and migrations.
4. Identify authentication and authorization requirements.
5. Identify external-service effects.
6. Confirm whether the change affects payments, documents, PII, production deployment, or schema state.
7. Check the working tree and preserve unrelated user changes.

## Architecture boundaries

### Frontend

- `src/pages/` contains route-level pages.
- `src/pages/admin/` contains admin and staff interfaces.
- `src/sections/` contains major public-page and application-form sections.
- `src/components/shared/` contains business-level reusable components.
- `src/components/ui/` contains generic UI primitives.
- `src/hooks/` contains reusable React hooks.
- `src/providers/trpc.tsx` configures API access.
- `src/i18n/` contains translation configuration and catalogs.

Do not place secrets or authoritative business decisions in frontend code.

### Backend

- `api/boot.ts` is the HTTP server entry point.
- `api/router.ts` composes tRPC routers.
- `api/middleware.ts` defines authorization middleware.
- `api/*-router.ts` files expose domain procedures.
- `api/lib/` contains infrastructure helpers.
- `api/queries/` contains database access helpers.

All administrative, staff, payment, document, invoice, supplier, chat-management, and PII-bearing operations must be authorized on the server.

Client-side route guards are usability controls, not security boundaries.

## Authentication and authorization

- Do not implement authentication using only `localStorage`.
- Do not embed passwords in Vite environment variables.
- Do not use client-side guards as the only protection.
- Passwords must use Argon2id or bcrypt with appropriate parameters.
- Sessions must be server-verifiable, revocable, expiring, and transmitted securely.
- Use HTTP-only, secure cookies where appropriate.
- Protect cookie-authenticated mutations against CSRF.
- Apply least-privilege authorization to every procedure.
- Validate ownership when customers access applications, invoices, or documents.
- Add rate limiting to authentication and sensitive public endpoints.

## Stripe rules

- The server is authoritative for prices, currency, VAT, discounts, and payable totals.
- Never accept a final payment amount solely from the browser.
- Verify PaymentIntents directly with Stripe.
- Process final payment state through signed Stripe webhooks.
- Verify amount, currency, metadata, application identity, and payment status.
- Use idempotency keys.
- Store webhook event IDs to prevent replay.
- Use database transactions for payment, application, and invoice updates.
- Never mark an application paid based only on a client callback.
- Never log full Stripe objects or sensitive payment data.

## Database

- Production uses MySQL hosted on the production server.
- `db/schema.ts` is the intended application schema, but it may differ from the live production database.
- `db/migrations/` should contain the canonical ordered migration history.
- Do not introduce ad hoc root-level production SQL scripts when a migration can represent the change.
- Never assume Docker Compose database configuration represents production.
- Before any database-related change, verify:
  - The active `DATABASE_URL` configuration without exposing its value.
  - The target host and database identity.
  - The live schema version.
  - The canonical migration history.
  - Backup availability and recoverability.
- Never migrate, reset, truncate, import, overwrite, or delete production data without explicit authorization and verified backups.
- Production schema changes require:
  1. A reviewed migration.
  2. A non-production test.
  3. Compatibility analysis.
  4. A verified backup.
  5. A rollback or recovery plan.
  6. Explicit production approval.

## Document storage

- The intended production storage provider is the server filesystem.
- The expected production path is:

  ```text
  /var/www/tashira/storage/documents
  ```

- Supabase storage code must be considered legacy or inactive unless runtime configuration proves it is currently used.
- Do not assume comments referring to Supabase describe the active implementation.
- Do not migrate documents to Supabase or another provider without explicit approval.
- Before changing document storage, verify:
  - The active storage implementation imported by the API.
  - `STORAGE_ROOT`.
  - The resolved production filesystem path.
  - Docker or container volume mappings.
  - Filesystem ownership and permissions.
  - Available disk space.
  - Backup coverage and restore procedures.
  - Whether existing documents must remain accessible across deployments.
- Ensure container deployments mount production document storage as a persistent volume.
- Never store production documents only inside an ephemeral container filesystem.
- Document endpoints require authorization and ownership or role checks.
- Never expose passport or identity documents through permanent public URLs.
- Prefer short-lived signed URLs.
- Validate file signatures, not only extensions or browser MIME types.
- Enforce conservative size limits.
- Stream uploads when possible; avoid large Base64 request bodies.
- Sanitize filenames and canonicalize storage paths.
- Prevent path traversal using resolved-path containment checks.
- Keep file storage and database metadata consistent.
- Do not delete an existing file until its replacement has been stored and verified.
- Add malware scanning before documents become available.
- Define retention, deletion, backup, and audit policies.
- Treat document moves, renames, migrations, and bulk cleanup as destructive production operations requiring explicit approval and verified backups.

## Business logic

- Keep visa pricing, exchange rates, VAT treatment, processing fees, and status-transition rules on the server.
- Avoid duplicating pricing tables across components and routers.
- Monetary values must use decimal-safe representations.
- Do not use floating-point arithmetic for authoritative payment calculations.
- Validate status transitions explicitly.
- Use database transactions for multi-record operations.
- Avoid N+1 query patterns.

## Environment variables

Backend variables must not use the `VITE_` prefix.

Frontend variables must contain only values safe for public browser exposure.

When adding or changing an environment variable:

1. Update `.env.example` with the name and a safe description.
2. Never include a real value.
3. Update deployment configuration.
4. Add startup validation.
5. Document whether it is required, optional, frontend, backend, build-time, or runtime.

## Runtime verification

Before making database or storage changes, verify active runtime configuration rather than relying only on repository files.

Check, without displaying secret values:

```text
DATABASE_URL
STORAGE_ROOT
NODE_ENV
```

Also verify:

- The active storage module used by `api/storage-router.ts`.
- Whether the process runs directly under PM2 or inside Docker.
- Docker volume mappings, if Docker is active.
- The resolved production filesystem paths.
- MySQL host identity and schema version.
- Filesystem permissions and ownership.
- Backup timestamps and restore readiness.

The presence of these variables does not prove Supabase is active:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET
```

Treat them as legacy configuration unless runtime behavior proves otherwise.

## Build and verification

Preferred verification sequence:

```text
npm ci
npm run check
npm run lint
npm run test
npm run build
```

- Do not install dependencies or run commands that modify the workspace when the user requested read-only analysis.
- If dependencies are unavailable and installation is not authorized, report that verification could not be run.
- New business logic should include tests.
- At minimum, test authorization failures, application creation, pricing, payment idempotency, Stripe webhook verification, document ownership, file validation, status transitions, invoice generation, and migration behavior.

## Deployment

Use one canonical deployment pipeline.

Production deployment must include:

1. A clean, reviewed commit.
2. Type-checking.
3. Linting.
4. Automated tests.
5. A successful production build.
6. Migration review.
7. Backup confirmation when data changes.
8. Explicit production approval.
9. Health verification.
10. A rollback plan.

- Do not deploy directly from an unverified working tree.
- Do not run production services as root.
- Do not expose MySQL publicly.
- Pin and verify SSH host keys.
- Use immutable build artifacts where possible.
- Use `npm ci`, not `npm install`, in automated deployments.
- Do not expose deployment logs publicly.
- Do not hard-code webhook secrets.

## Generated files

- Do not manually edit `dist/`.
- Build output must be generated from source.
- Do not commit generated output unless the repository explicitly adopts that policy.
- Keep `node_modules/`, caches, logs, local databases, uploads, secrets, and environment files out of Git.

## Code quality

- Use TypeScript with explicit domain types.
- Avoid `any` unless there is a documented boundary reason.
- Validate external input with Zod.
- Return stable, typed error responses.
- Do not expose raw database or service errors to clients.
- Prefer small domain services over duplicating logic in routers and components.
- Keep comments accurate; remove references to services that are no longer active.
- Preserve translation keys and right-to-left behavior when changing user-facing UI.
- Use UTF-8 and correct existing encoding corruption when encountered.

## Review priorities

Review changes in this order:

1. Security and authorization.
2. Payment correctness.
3. PII and document protection.
4. Data integrity.
5. Deployment safety.
6. Runtime correctness.
7. Accessibility and localization.
8. Performance.
9. Maintainability.

## Completion report

When handing off work, state:

- Files changed.
- Behavior changed.
- Security implications.
- Database implications.
- Environment-variable changes.
- Tests and checks run.
- Checks not run and why.
- Deployment status.
- Remaining risks.

Never claim a build, test, migration, deployment, commit, or push succeeded unless it was actually performed and verified.
