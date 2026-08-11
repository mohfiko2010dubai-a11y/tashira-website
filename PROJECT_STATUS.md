# TASHIRA Project Status

Last verified: 2026-08-11

## Current state

- Phase: Phase 9 — launch-blocker closure.
- Branch: `devops/deployment-safety`.
- Current verified implementation HEAD: `5be87c691e9677b9543f2920743f38d9baa5ed8e`.
- CI: GREEN through the previous implementation; the current review-branch run is being verified.
- Tests: 71/71 passing across 23 files.
- TypeScript: PASS.
- ESLint: PASS.
- Build: PASS.
- Verified launch readiness: 84%.
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
- Family chatbot applications use stable applicant IDs and zero-based slots, isolate every document by applicant, resume from server state using a reference-only browser marker, and submit one aggregate server-authoritative quote.
- Staging migration 006 enforces unique `(application_id, applicant_index)` slots and refuses automatic duplicate resolution. Synthetic API UAT verified two applicants, six isolated documents, cross-slot rejection, resume data, and a USD 340 server quote.
- Privileged document lifecycle APIs now accept a trusted document ID instead of a client-provided storage path. Replacement uploads and validates the new file before removing the old one, updates MySQL metadata, and preserves immutable lifecycle references.
- Exact-commit staging UAT authenticated as an administrator and verified original signed-URL access, replacement content, logical deletion, refusal to sign a deleted document, and removal from active document lists.
- A permanent staging authentication verifier now confirms anonymous admin rejection, admin login/session/logout, synthetic staff creation, staff login/session verification, staff-only API access, logout invalidation, and cleanup without exposing credentials or tokens.
- Public staging is live at `https://staging.tashiraev.com` with a dedicated Let's Encrypt certificate, HTTP-to-HTTPS redirect, noindex/security headers, and a staging-only Nginx proxy to `127.0.0.1:3002`. External health and unauthenticated route-guard browser smoke tests pass.
- Synthetic browser UAT verified staff login and the real staff dashboard through public HTTPS. The temporary staff account was removed. Automated activation of the dashboard logout control was inconclusive, so no speculative application change was retained.
- Lazy-loaded routes now recover once from stale deployment chunks, fixing admin/staff pages that previously failed when a browser retained an older entry bundle. Unrelated errors are never swallowed, and four regression cases cover the classifier and loop prevention boundary.

## Active blockers

- Stripe TEST credentials, webhook registration, and end-to-end payment UAT.
- Sandbox mail transport and magic-link/OTP delivery UAT.
- Authenticated customer/admin browser UAT and manual confirmation of the staff logout control.
- Owner-approved business configuration.
- Remaining npm audit findings requiring upstream, major-version, or package-replacement decisions.
- Large XLSX/invoice chunks and the 35.1 MB bundled server artifact.

## Owner decisions/actions required

- Supply Stripe TEST-only credentials and configure the staging webhook endpoint without exposing secrets.
- Select a sandbox mail provider and synthetic recipients.
- Approve production pricing/company/VAT/exchange-rate/invoice values.
- Approve refund policy and legal retention periods.
- Review any production credential rotation and migration plan as separate authorized changes.

## Next highest-priority task

Complete synthetic authenticated customer/admin browser UAT and manually confirm staff logout behavior. Stripe TEST credentials and sandbox mail remain owner/environment prerequisites for payment and recovery UAT.
