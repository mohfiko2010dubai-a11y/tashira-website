# TASHIRA — Phase 1 Technical Report

## Scope

This is a read-only static analysis of the TASHIRA repository. The repository is a full-stack UAE visa application platform. No production connection, deployment, commit, or push was performed. Dependencies were not installed, so builds and automated tests were not run.

Repository: `mohfiko2010dubai-a11y/tashira-website`

## Executive summary

TASHIRA uses a React/Vite frontend, a Hono+tRPC backend, MySQL through Drizzle ORM, Stripe payments, document uploads, invoicing, chat, multilingual pages, and admin/staff dashboards.

The most urgent problem is authorization. Most backend procedures, including administrative mutations, are public. Admin login is implemented in browser code with a hard-coded fallback password. Stripe payment confirmation trusts the browser rather than verifying the PaymentIntent with Stripe. These are release-blocking security risks.

The repository also has database/schema drift, competing storage implementations, multiple overlapping deployment mechanisms, embedded development credentials, tracked build output, and no meaningful automated test suite.

## 1. Architecture overview

```text
Browser
  └── React + React Router + TanStack Query + tRPC
        ├── Public website
        ├── Visa application wizard
        ├── Customer tracking
        ├── Stripe Elements
        ├── Admin/staff dashboards
        └── Chat assistant
                 │
                 ▼
        Hono + tRPC API
        ├── Kimi OAuth/session authentication
        ├── Application management
        ├── Stripe integration
        ├── Document storage
        ├── Invoice generation
        ├── Supplier/staff management
        └── Chat and external integrations
                 │
        ┌────────┼──────────────┐
        ▼        ▼              ▼
      MySQL   Local files   External APIs
```

Main entry points:

- Frontend: `src/main.tsx`
- Routes: `src/App.tsx`
- API server: `api/boot.ts`
- tRPC router: `api/router.ts`
- Database schema: `db/schema.ts`
- Build configuration: `vite.config.ts`

## 2. Frontend

Technology:

- React 19 and TypeScript
- Vite
- React Router
- tRPC React Query and TanStack Query
- Tailwind CSS and Radix/shadcn-style components
- React Hook Form and Zod
- i18next
- Stripe Elements
- Recharts and XLSX

Structure:

```text
src/
├── components/shared/   Business components
├── components/ui/       Generic UI primitives
├── data/                Country and visa data
├── hooks/               Auth, upload and UI hooks
├── i18n/                Translation resources
├── pages/admin/         Admin and staff pages
├── pages/               Public/customer pages
├── providers/           tRPC setup
├── sections/            Marketing/application sections
├── App.tsx
└── main.tsx
```

Important routes include `/`, `/visa-prices`, `/how-to-apply`, `/track`, `/pay/:referenceNumber`, `/admin/*`, and `/staff/*`.

Only `/dashboard` is wrapped in `AdminGuard`. The main `/admin/*` routes are not wrapped. Even a route guard would not be sufficient because backend authorization must be enforced independently.

## 3. Backend/API

The backend uses Hono for HTTP handling and tRPC for business APIs.

Routers:

- `auth`: current user and logout
- `application`: application creation, lookup, list, status and analytics
- `payment`: Stripe intent, confirmation and invoice lookup
- `chat`: visitor/admin chat and Kimi integration
- `wizard`: application wizard persistence
- `drive`: Google Drive integration
- `invoice`: invoice generation and retrieval
- `supplier`: supplier CRUD
- `staff`: staff login, verification and CRUD
- `storage`: upload, view URL, replacement and deletion
- `document`: document metadata

Critical issue: most business routers use `publicQuery`. Secure `authedQuery` and `adminQuery` middleware exists but is largely unused.

Other issues:

- Request body limit is 500 MB.
- Browser tRPC logging is always enabled.
- Some errors expose raw internal messages.
- Application listing creates N+1 applicant queries.

## 4. Database schema

MySQL tables:

| Table | Purpose |
|---|---|
| `users` | OAuth users and roles |
| `applications` | Main visa applications |
| `applicants` | Travelers linked to applications |
| `payments` | Stripe payments |
| `invoices` | Invoice records |
| `chat_messages` | Chat history |
| `suppliers` | Processing suppliers |
| `staff_users` | Staff accounts |
| `documents` | Uploaded document metadata |

Major schema problems:

- Code uses `applications.totalAmount`, but the schema defines `totalAmountAed` and `totalAmountUsd`.
- Code uses `applications.totalApplicants`, but the field is absent from the schema.
- Relations exist mainly for applications/applicants and database foreign keys are not declared.
- Migration sources are split across `db/migration.sql`, `db/migrations/`, `migrations/`, and root `vps-*.sql` files.
- `.gitignore` ignores Drizzle's configured SQL migration output.
- Code contains fallbacks for columns that may not exist, confirming schema drift.

## 5. Authentication

### Customer OAuth

Kimi OAuth exchanges an authorization code, verifies the Kimi access token, upserts a MySQL user, then creates an HS256 session JWT in an HTTP-only cookie.

Risks:

- Session lasts one year.
- OAuth `state` is a base64 redirect URL rather than a random CSRF-bound value.
- Missing Kimi configuration can fall back to an `anonymous` identity.
- No clear CSRF protection for cookie-authenticated mutations.

### Admin

Admin login compares a password in browser JavaScript using `VITE_ADMIN_PASSWORD`, with a hard-coded fallback value, then stores a boolean in `localStorage`. The value is intentionally omitted from this documentation.

This is not secure authentication. Users can inspect the password, set the flag manually, or directly call public APIs.

### Staff

Staff passwords use SHA-256 with a fixed salt. Sessions are stored in an in-memory server map and browser `localStorage`.

Risks:

- Weak password hashing and minimum length of four.
- Sessions disappear after restart.
- No persistent revocation or audit trail.
- Staff CRUD is public.
- Business endpoints do not validate staff tokens.
- Staff logout violates React's Rules of Hooks.

## 6. Stripe flow

Current flow:

1. Browser loads an application by reference.
2. Browser calculates or reads the amount.
3. Browser sends amount and reference to `payment.createIntent`.
4. Backend creates and stores a Stripe PaymentIntent.
5. Browser confirms the card using Stripe Elements.
6. Browser calls `payment.confirm`.
7. Backend marks the application paid and creates an invoice.

Critical problems:

- The browser controls the amount.
- Server does not independently calculate the authoritative price.
- `payment.confirm` does not retrieve or verify the PaymentIntent with Stripe.
- Status, amount, currency, metadata and ownership are not verified.
- Confirmation procedure is public.
- No Stripe webhook handler exists.
- Payment/invoice writes are not transactional or idempotent.
- Duplicate confirmation can create duplicate invoice behavior.
- UI claims email confirmation, but no email service was found.

## 7. Document upload flow

Files are collected in browser memory, converted to Base64, uploaded through tRPC, written under `applications/<id>/<type>/...`, then recorded in MySQL.

Although Supabase code exists, the active router imports local storage. The default path is:

```text
/var/www/tashira/storage/documents
```

The so-called signed URL is a permanent public `/storage/...` URL.

Risks:

- Upload, view, replace and delete APIs are public.
- Passport documents are served without authentication.
- 100 MB files become about 133 MB as Base64.
- Browser MIME values are trusted; file signatures are not checked.
- No malware scanning.
- File and database writes are separate operations.
- Metadata deletion does not delete the physical file.
- Replacement deletes the old file before the new upload succeeds.
- Local storage is not persisted by Docker Compose.
- Supabase variables remain despite not being active.

## 8. Admin dashboard

Features include applications, status updates, documents, invoices, suppliers, staff, VAT, profit/cost reporting, chat, analytics and XLSX exports.

The frontend and backend do not provide a real security boundary:

- Admin pages are inconsistently guarded.
- Guards are browser-only.
- PII, invoices, documents and analytics are exposed through public procedures.
- Supplier and staff CRUD are public.

## 9. Build process

```text
npm run dev
npm run check
npm run lint
npm run test
npm run build
npm run start
```

`npm run build` creates the Vite frontend in `dist/public` and bundles `api/boot.ts` into `dist/boot.js` using esbuild.

Issues:

- `dist/` is ignored but remains tracked.
- No test files were found.
- No CI quality gate runs checks before deployment.
- Schema/code mismatches are likely build failures.
- Docker expects prebuilt `dist` rather than performing a reproducible multi-stage build.

## 10. Deployment

The repository contains several competing systems:

1. GitHub Actions SSH deployment
2. Python webhook deployment
3. Node webhook deployment
4. Cron polling every minute
5. Manual shell scripts
6. Docker Compose
7. PM2 and Nginx

Risks:

- Pushes to `main` or `master` can automatically deploy production.
- No type-check, lint, tests or approval gate.
- Multiple deploy mechanisms can race.
- Production scripts use `git reset --hard` and `git clean -fd`.
- No immutable artifact or rollback process.
- Migrations and backups are not part of the main workflow.
- SSH host identity is not pinned.
- Webhook services run as root.
- Deployment logs are publicly exposed.
- Hard-coded webhook secrets exist.
- MySQL port 3306 is published.
- Docker Compose contains hard-coded database credentials.

## 11. Environment variables — names only

### Backend

```text
NODE_ENV
PORT
APP_ID
APP_SECRET
DATABASE_URL
KIMI_AUTH_URL
KIMI_OPEN_URL
OWNER_UNION_ID
```

### Frontend/build-time

```text
VITE_APP_ID
VITE_KIMI_AUTH_URL
VITE_STRIPE_PUBLISHABLE_KEY
VITE_ADMIN_PASSWORD
```

`VITE_ADMIN_PASSWORD` should be removed.

### Payments and integrations

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
VITE_KIMI_API_KEY
VITE_KIMI_BASE_URL
WHATSAPP_API_KEY
GOOGLE_SERVICE_ACCOUNT_KEY
GOOGLE_DRIVE_FOLDER_ID
```

### Storage

```text
STORAGE_ROOT
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET
```

### Deployment

```text
SERVER_HOST
SERVER_USER
SERVER_PORT
SERVER_SSH_KEY
PROJECT_PATH
GITHUB_SECRET
WEBHOOK_PORT
APP_DIR
```

## 12. External services

- Stripe
- Kimi OAuth and Kimi Open Platform
- Moonshot/Kimi chat API
- MySQL
- Google Drive
- WhatsApp API
- Google Translate widget
- Google Ads tracking
- GitHub Actions and GitHub webhooks
- Ubuntu VPS, PM2 and Nginx
- Docker/Docker Compose
- Supabase Storage code exists but is not active
- AWS S3 dependencies exist but no active integration was found

## 13. Security observations

### Critical

1. Browser-only admin authentication with a hard-coded fallback password.
2. Public administrative and PII-bearing backend procedures.
3. Public staff-management procedures.
4. Client-controlled payment amount and unverified payment confirmation.
5. Public document upload/read/delete operations.
6. Full application data available through reference lookup.
7. Hard-coded database and webhook credentials.

### High

1. Weak staff password hashing.
2. Staff tokens in localStorage and server memory.
3. Public invoice access.
4. Weak OAuth state handling.
5. No visible CSRF protection.
6. File validation trusts browser metadata.
7. Large Base64 uploads create DoS exposure.
8. Public deployment logs and root webhook services.
9. MySQL published by Docker Compose.

### Medium

1. One-year sessions.
2. Raw internal errors may reach clients.
3. Always-on tRPC logging.
4. No audit log.
5. No rate limiting or login throttling.
6. No clear document retention/deletion policy.
7. Missing Nginx security headers/CSP.

## 14. Technical debt

- Template README and package name `my-app`.
- Schema/code drift.
- Fragmented migrations.
- Multiple deployment systems.
- Conflicting local/Supabase storage code.
- Tracked generated output.
- Duplicate payment/upload/wizard logic.
- Extensive `any` and compatibility fallbacks.
- Duplicated pricing and exchange-rate rules.
- N+1 queries.
- No tests.
- No centralized authorization policy.
- No transactional service layer.
- Encoding corruption in text/comments.
- Incomplete translation coverage.

## 15. Potential bugs

1. Missing `totalAmount` and `totalApplicants` schema fields.
2. Payment/invoice code may produce compile errors or invalid values.
3. Wizard/chat may insert nonexistent columns.
4. Invalid React hook call during staff logout.
5. Unpaid applications can potentially be marked paid.
6. Duplicate payment confirmation behavior.
7. Document deletion leaves files behind.
8. Replacement can lose the original file.
9. Chatbot uploads may occur before an application ID exists.
10. UI claims email delivery with no email integration.
11. Application `search` input is not applied.
12. Document `sortBy` input is ignored.
13. Local signed URLs never expire.
14. Docker document storage is not persistent.
15. Synchronous filesystem operations block requests.
16. GitHub Actions `PROJECT_PATH` handling is unreliable.
17. Auto-deployment methods can overlap.
18. OAuth can fall back to `anonymous` when misconfigured.
19. Application creation is not transactional.

## 16. Recommended improvements

1. Enforce all authorization on the backend.
2. Replace admin authentication with real accounts and secure sessions.
3. Use Argon2id or bcrypt for staff passwords.
4. Calculate all payment amounts server-side.
5. Verify Stripe events through signed webhooks and idempotency.
6. Reconcile schema and create one migration history.
7. Add database foreign keys, indexes and transactions.
8. Choose one document-storage backend.
9. Authenticate document access and use short-lived URLs.
10. Stream uploads, lower limits, inspect file signatures and scan malware.
11. Consolidate deployment into one controlled pipeline.
12. Add type-check, lint, tests and manual production approval.
13. Remove generated output and embedded credentials from Git.
14. Rotate committed/default credentials.
15. Centralize pricing, VAT, currency and status rules on the server.
16. Add structured audit logs and monitoring.

## 17. Prioritized stabilization roadmap

### P0 — Immediate containment

1. Restrict administrative, PII and document APIs.
2. Remove browser-only admin authentication.
3. Rotate committed database and webhook credentials.
4. Disable public deployment logs.
5. Stop trusting client payment confirmation.
6. Protect application, invoice and document retrieval.
7. Pause automatic production deployment until quality gates exist.

### P1 — Data and payment correctness

1. Reconcile the schema with production.
2. Establish a canonical migration baseline.
3. Fix amount/applicant field mismatches.
4. Centralize server pricing.
5. Implement Stripe webhooks and idempotency.
6. Add transactions, foreign keys and indexes.

### P2 — Authentication and authorization

1. Implement server-side admin/staff sessions.
2. Use strong password hashing.
3. Add role and ownership middleware.
4. Add CSRF protection and session rotation.
5. Add rate limits and audit trails.

### P3 — Document security

1. Select one storage backend.
2. Implement authenticated short-lived access.
3. Stream and validate uploads.
4. Add malware scanning.
5. Add retention, deletion and backup policies.

### P4 — Build and deployment

1. Remove tracked `dist`.
2. Add CI checks.
3. Consolidate deployment automation.
4. Pin SSH host keys.
5. Use `npm ci` and immutable artifacts.
6. Add backups, health checks and rollback.
7. Use non-root services and close public database/webhook ports.

### P5 — Maintainability

1. Add unit, integration and end-to-end tests.
2. Remove duplicated flows and `any` usage.
3. Fix encoding and translation coverage.
4. Optimize database queries.
5. Add observability.
6. Replace template documentation.

---

# Proposed AGENTS.md content

The following is a proposal only. It has not been created as `AGENTS.md`.

```markdown
# AGENTS.md

## Project

TASHIRA is a full-stack UAE visa application platform using React, TypeScript, Vite, Hono, tRPC, Drizzle ORM, MySQL and Stripe.

- Frontend: `src/`
- Backend: `api/`
- Database: `db/`
- Shared contracts: `contracts/`

## Safety rules

- Never connect to or deploy production without explicit authorization.
- Never commit, push, merge or create a pull request unless explicitly requested.
- Never run destructive Git or database commands without explicit approval.
- Never print, log or commit secret values.
- Treat identity documents, passport data, contact details, chats, payments and applications as sensitive PII.
- Never use production customer data in tests.

## Required review before changes

1. Read the relevant frontend code.
2. Read the matching API router.
3. Read the schema and migrations.
4. Identify authorization requirements.
5. Identify payment, document, PII, schema and deployment effects.
6. Check and preserve unrelated working-tree changes.

## Authorization

- Enforce authorization on the backend.
- Client route guards are not security boundaries.
- Do not implement authentication using only localStorage.
- Do not embed passwords in Vite variables.
- Use strong password hashing and revocable server sessions.
- Protect cookie-authenticated mutations against CSRF.
- Validate customer ownership for applications, invoices and documents.
- Rate-limit authentication and sensitive public endpoints.

## Stripe

- The server controls prices, currency, VAT and payable totals.
- Never trust a browser-provided final amount.
- Verify PaymentIntents with Stripe.
- Finalize payments through signed, idempotent webhooks.
- Verify amount, currency, status, metadata and application identity.
- Use database transactions for payment/application/invoice updates.
- Never mark an application paid from only a client callback.

## Documents

- Require authorization and ownership checks.
- Never expose identity documents through permanent public URLs.
- Use short-lived signed access.
- Validate file signatures and enforce conservative limits.
- Prefer streaming over Base64.
- Canonicalize paths and prevent traversal.
- Scan files for malware.
- Keep storage and database metadata consistent.
- Store replacements before deleting originals.

## Database

- `db/schema.ts` is the canonical schema.
- Use one ordered migration history in `db/migrations/`.
- Schema changes require review, rollback analysis and non-production verification.
- Use foreign keys, indexes and transactions where required.
- Do not execute production migrations without explicit approval and backup confirmation.

## Environment variables

- Backend secrets must not use the `VITE_` prefix.
- Frontend variables must be safe for public exposure.
- Update `.env.example` with names and safe descriptions only.
- Add startup validation for required variables.

## Build verification

Preferred sequence:

```text
npm ci
npm run check
npm run lint
npm run test
npm run build
```

Do not install dependencies when the user requested read-only work. Report checks that could not run.

## Deployment

- Maintain one canonical deployment pipeline.
- Require type-check, lint, tests, build and explicit production approval.
- Use pinned SSH host keys, `npm ci`, immutable artifacts and a rollback plan.
- Do not run production services as root.
- Do not expose MySQL, webhook logs or deployment control publicly.
- Do not hard-code deployment secrets.

## Code quality

- Avoid `any`.
- Validate external input with Zod.
- Do not expose raw internal errors.
- Centralize pricing, currency, VAT and status rules.
- Use decimal-safe monetary arithmetic.
- Avoid N+1 database queries.
- Preserve accessibility, translations and RTL behavior.
- Use UTF-8 and fix encoding corruption.

## Completion report

State:

- Files changed
- Behavior changed
- Security impact
- Database impact
- Environment changes
- Checks run
- Checks not run and why
- Deployment status
- Remaining risks

Never claim that a check, commit, push, migration or deployment succeeded unless it was actually performed and verified.
```

## Audit limitation

This report is based on static repository analysis. A complete operational assessment also requires, with separate explicit authorization, a clean dependency installation, type-check, lint, tests, build, non-production database comparison, and configuration review without exposing secret values.
