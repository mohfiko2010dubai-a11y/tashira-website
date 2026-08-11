# TASHIRA Project Status

Last verified: 2026-08-11

## Current state

- Phase: Phase 9 — launch-blocker closure.
- Branch: `devops/deployment-safety`.
- Current verified implementation HEAD: `ff6faff8e01ab3afb4254a1cb6395847246e893c`.
- CI: GREEN; GitHub Actions run `31469999903` succeeded.
- Tests: 58/58 passing across 21 files.
- TypeScript: PASS.
- ESLint: PASS.
- Build: PASS.
- Verified launch readiness: 67%.
- Classification: C — Not Launch Candidate.

## Completed capabilities

- Isolated native staging with separate checkout, MySQL database/user, filesystem storage, logs, port, and PM2 process.
- Migration 005 reviewed, hardened, applied only to `tashira_staging`, and verified with 16 append-only triggers.
- Server-authoritative versioned pricing and immutable price snapshots.
- Single and multi-applicant canonical application model.
- Filesystem document upload with ownership checks and lifecycle/timeline evidence.
- Signed customer application capability, admin/staff authorization foundations, risk engine, evidence manifest, finance/VAT cockpit, retention, and legal holds.
- Stripe TEST-only verification/webhook foundation and transactional-email/recovery abstractions.
- Safe dependency updates reduced the audit from 24 to 18 findings without force-upgrading incompatible packages.
- Router packages are aligned on React Router 6, eliminating the verified `/staff` fallback crash.
- Route-level lazy loading reduced the main client chunk from about 3.4 MB to about 1.19 MB.
- The chatbot now sends canonical visa-service codes, links to the registered `/pay/:referenceNumber` route, and displays the server-authoritative quote.

## Active blockers

- Public staging DNS/TLS.
- Stripe TEST credentials, webhook registration, and end-to-end payment UAT.
- Sandbox mail transport and magic-link/OTP delivery UAT.
- Full authenticated customer/admin/staff browser UAT.
- Family chatbot per-applicant details/documents and resume state.
- Privileged document replace/delete/signed URL browser UAT.
- Owner-approved business configuration.
- Remaining npm audit findings requiring upstream, major-version, or package-replacement decisions.
- Large XLSX/invoice chunks and the 35.1 MB bundled server artifact.

## Owner decisions/actions required

- Provision or delegate DNS for `staging.tashiraev.com` and approve staging TLS exposure.
- Supply Stripe TEST-only credentials and configure the staging webhook endpoint without exposing secrets.
- Select a sandbox mail provider and synthetic recipients.
- Approve production pricing/company/VAT/exchange-rate/invoice values.
- Approve refund policy and legal retention periods.
- Review any production credential rotation and migration plan as separate authorized changes.

## Next highest-priority task

Complete the family chatbot ownership-safe multi-applicant flow. In parallel, public DNS/TLS, Stripe TEST credentials, and sandbox mail remain owner/environment prerequisites for external authenticated UAT.
