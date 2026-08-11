# TASHIRA Launch Candidate UAT Report

Date: 2026-08-11

Branch: `devops/deployment-safety`

Staging commit: `c30313be87b0b6288c7a55154d09ced0571b23af`

Public staging URL: not available (DNS record and TLS are not provisioned)

Verified private staging endpoint: `127.0.0.1:3002`, accessed locally through an SSH tunnel at `http://127.0.0.1:43002`

## Executive conclusion

The isolated staging runtime, migration, server-authoritative pricing, synthetic application creation, filesystem upload, immutable evidence foundations, authorization guards, risk assessment, retention/legal hold, finance calculations, build, tests, and CI are operational.

The project does **not yet qualify as a Launch Candidate** because the public staging endpoint, Stripe TEST integration, sandbox mail/recovery, and the complete authenticated browser UAT matrix are unavailable. Overall verified launch readiness is **64%**. This is an engineering readiness estimate, not a legal, tax, payment-network, or business approval.

## UAT summary

| Area | Result | Evidence |
|---|---|---|
| Staging isolation | PASS | Separate checkout, DB/user, storage, logs, port, and PM2 process |
| Migration 005 | PASS | 22 tables, 11 FKs, 77 index entries, 16 triggers |
| Public page smoke | PASS | Home, visa prices, how-to-apply, tracking, admin login, and staff login rendered in browser |
| Single applicant | PASS | Synthetic application created with one applicant and immutable price snapshot |
| Family/multi applicant | PASS | Synthetic GCC family application created with two applicant-owned rows |
| GCC flow foundation | PASS | GCC residence fields persisted for synthetic family applicants |
| Same-device capability | PASS at API foundation | Signed customer capability enabled application-owned mutations; full interrupted browser journey remains incomplete |
| Cross-device recovery | BLOCKED | No approved sandbox mail/OTP provider |
| Server pricing | PASS | Server ignored client totals by design and quoted active rules |
| Historical pricing | PASS | Version 1 snapshot stayed USD 165.00 after version 2 became USD 170.00 |
| Document upload | PASS | 68-byte synthetic PNG persisted only under staging filesystem storage |
| Document metadata | PASS after fix | New row records `local` provider and `local` bucket |
| Document lifecycle | PARTIAL PASS | Upload and replacement-request events recorded; privileged replace/delete/signed URL matrix not completed |
| Customer timeline | PASS | Server events recorded for application, applicant, policy, submission, document, and checkout journey |
| Checkout abandonment | PASS | Opened, element-loaded, started, and abandoned events recorded; cockpit reported one abandonment |
| Risk | PASS | Admin-authorized synthetic assessment returned successfully; no automated rejection |
| Chargeback evidence | PASS at manifest level | Admin-authorized manifest returned an integrity hash |
| Legal hold | PASS | Deletion evaluation changed from `BLOCKED_LEGAL_HOLD` to `ELIGIBLE` after release; no deletion was performed |
| Admin authentication/API | PASS | Staging-only admin login, settings, cockpit, risk, evidence, and retention calls returned HTTP 200 |
| Admin/staff browser matrix | BLOCKED | No approved safe browser credential handoff or synthetic staff account |
| Finance/VAT | PASS for configured rules | AED cockpit, zero paid revenue, AED 100,000 placeholder threshold, zero progress, one abandoned checkout |
| Stripe TEST | BLOCKED | No Stripe TEST secret or webhook secret configured |
| Transactional email/recovery | BLOCKED | No sandbox mail provider configured |
| Quality gates | PASS | TypeScript, ESLint, 56/56 tests, and build |
| GitHub CI | PASS | Run 31465582204 succeeded for commit `c30313b` |

## Browser journey observations

- Home rendered the visa wizard and returned server price USD 165.00 for the seeded 14-day regular service.
- Visa prices, how-to-apply, tracking, admin login, and staff login routes rendered.
- Direct protected admin routes redirected to `/admin/login`.
- Direct `/staff/dashboard` redirected to `/staff/login`.
- Browser-style direct navigation with `Accept: text/html` returned HTTP 200 for client routes.
- Single, family, and GCC persistence were exercised through the same public application API used by the browser, with synthetic data only.

The complete visual form submission, file chooser, authenticated dashboards, session expiry, logout, filters, status changes, and every dashboard view still need execution once a public staging domain and approved synthetic credentials are available.

## Pricing and invoice readiness

Pricing is server-authoritative and snapshots are immutable. Versioning, minimum price validation, currency conversion to the configured base currency, and historical preservation passed. The seeded prices and AED conversion rate are placeholders only.

Invoice/payment equality and invoice immutability could not be proven end-to-end because no Stripe TEST PaymentIntent could be created or confirmed. No LIVE key was configured or used.

## Payments and Stripe

Status: **BLOCKED for end-to-end UAT**.

- `STRIPE_SECRET_KEY`: not configured in staging.
- `STRIPE_WEBHOOK_SECRET`: not configured in staging.
- No Stripe LIVE key was used.
- Safe application events for checkout opened, element loaded, payment started, and checkout abandoned were verified.
- Success, failure, retry, incomplete, 3DS, duplicate attempt, webhook replay/idempotency, invoice generation, ZIP/postal-code behavior inside Stripe Elements, and payment evidence remain unverified externally.
- No card number, CVC, expiry, Stripe iframe content, keystrokes, screenshot, or payment-screen recording was collected.

## Documents

The active storage provider is the server filesystem. A synthetic PNG persisted under `/var/www/tashira-staging/storage/documents/applications/...`, with matching MySQL metadata and immutable upload/replacement-request evidence. No production document path was accessed.

Retry logic is covered by application behavior and unit tests. Privileged replacement, permitted deletion, signed URL preview/download, version history across an actual replacement, post-payment rules, and persistence across a host restart require the authenticated staff/admin and payment UAT prerequisites.

## Finance and VAT

The cockpit returned AED as base currency and correctly computed zero paid revenue, AED 100,000 remaining to the synthetic threshold, zero percent progress, and one abandoned checkout. With no synthetic successful payments, revenue, AOV, margin, monthly trends, and payment success rate cannot yet be validated against non-zero known values.

VAT settings are configuration, not legal advice. Legal identity, VAT registration status, TRN, rate/effective date, threshold definition, invoice prefix, and exchange-rate source require owner approval before production.

## Risk, evidence, retention, and privacy

- Risk assessment ran against synthetic activity and returned no automated customer decision.
- Chargeback evidence manifest generation returned a SHA-256 integrity indicator.
- Hashes are integrity indicators, not proof of identity.
- Timeline and price snapshot MySQL triggers rejected update/delete attempts.
- Legal hold blocked deletion eligibility; release restored eligibility. The API explicitly reported `deletionPerformed: false` and no deletion operation was invoked.
- Retention periods remain deliberately undefined pending business/legal approval.

## Email and recovery

The provider abstraction and its tests are present, but the native staging runtime has no sandbox delivery provider. Application-received, payment success/failure, documents-required, submitted, visa-issued, resume link, magic link, OTP, and cross-device recovery delivery were not sent or claimed as delivered.

## Performance smoke

Five non-aggressive local-tunnel samples produced:

- Home: average 305 ms, min 245.1 ms, max 528.6 ms.
- `/api/health`: average 241 ms, min 227.2 ms, max 250 ms.
- Client route with browser HTML negotiation: HTTP 200.
- Browser home and route rendering: PASS.

Build observations:

- Main client chunk: approximately 3.46 MB uncompressed / 717.7 kB gzip.
- Bundled server artifact: approximately 35.1 MB.
- These sizes merit code-splitting and bundle analysis, but no aggressive load test or production profiling was performed.

## Quality gates and dependency health

- `npm run check`: PASS.
- `npm run lint`: PASS.
- `npm run test`: PASS, 56 tests across 20 files.
- `npm run build`: PASS.
- GitHub Actions CI for commit `c30313b`: PASS.
- `npm ci` reported 24 audit findings: 1 low, 7 moderate, and 16 high. No automatic fix or dependency upgrade was applied.

## Bugs fixed in Phase 8

1. Missing migration indexes/FKs and unsafe date types.
2. Trigger rerun/idempotency handling.
3. MySQL foreign-key identifier length failure during clean provisioning.
4. Drizzle provisioning could appear successful despite a schema error; the guarded provisioner now fails fast.
5. Staging upload metadata incorrectly retained legacy Supabase defaults; active upload paths now record local filesystem metadata.
6. Credential-like content was removed from a tracked migration comment and escalated for owner-controlled rotation assessment.

## Remaining bugs and risks

- Full external payment behavior is unknown until Stripe TEST is configured.
- Full email/recovery behavior is unknown until a sandbox provider is configured.
- Authenticated staff/admin UI coverage is incomplete.
- Non-zero paid finance/VAT analytics are not yet exercised.
- The chatbot family conversation collects one person's details even though the canonical web application API supports multiple applicants; the UX decision remains blocked.
- Dependency audit findings and large bundles require a reviewed follow-up phase.
- Final legal, tax, pricing, refund, retention, and post-submission document rules are not approved.

## Launch verdict

**Not a Launch Candidate yet.** The verified staging and data-integrity foundation is strong, but a launch candidate requires public isolated staging, complete Stripe TEST UAT, sandbox email/recovery UAT, authenticated browser UAT, approved business configuration, and resolution or acceptance of dependency security findings.
