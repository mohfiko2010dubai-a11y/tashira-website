# TASHIRA Project Status

Last verified: 2026-08-13

## Current state

- Phase: Phase 9 — launch-blocker closure.
- Branch: `devops/deployment-safety`.
- Current verified implementation HEAD: `1cc8d12`.
- CI: GREEN through run 73.
- Tests: 88/88 passing across 28 files.
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
- In-place builds now retain prior content-hashed chunks so tabs opened before deployment can finish lazy imports. HTML/client routes are `no-store`, hashed assets are immutable, every generated local asset reference is verified during `npm run build`, and an explicit chunk-load fallback replaces the raw router error screen.
- Staging restored the exact previously missing `AdminApplications-1JinaxRj.js` generation, served 172 retained JavaScript assets without HTTP errors, and passed authenticated browser UAT for `/admin`, applications, a synthetic application detail, suppliers, staff management, invoices, supplier bills, VAT, finance, chat, public routes, hard refresh, and normal navigation.
- Stripe TEST keys are wired through ignored staging-only secret files with TEST-mode startup enforcement. Migration 007 adds durable webhook event claims; signed duplicate delivery is replay-safe.
- Synthetic Stripe TEST UAT passed success, decline, retry, 3DS-required, abandonment, valid/invalid signature, and duplicate-delivery scenarios. Snapshot, Stripe, payment, and invoice amounts matched; payment/invoice evidence remained single-instance.
- Payment creation now fails closed unless a server-authoritative readiness evaluator confirms required application data, current policy acceptance, a valid price snapshot, every applicant's required personal/passport fields, and flow-specific applicant-owned documents. Primary-form uploads occur before checkout. Incomplete and partial staging applications returned HTTP 412; a complete application received a Stripe TEST client secret; an incomplete family member blocked aggregate payment without cross-application data disclosure.
- Stripe TEST 3DS UAT for `TSH-372754` is blocked by the configured AE Stripe account reporting `charges_enabled: false` and `card_payments: inactive`. Redacted diagnostics confirmed matching TEST publishable/secret keys, an allowed `card` PaymentIntent, no server-side payment attempt/error, and working PaymentIntents 3DS semantics with Stripe's predefined authentication-required PaymentMethod. No code workaround or staging deployment was performed; the account owner must resolve the Stripe capability requirement before interactive 3DS retest.
- Verified payment success now unmounts checkout, refreshes canonical application state, and renders one Payment Confirmed experience. Paid applications remain on that state after refresh/back and cannot create another PaymentIntent. Stripe TEST webhook replay remained single-payment/single-invoice.
- Customer checkout now performs the authoritative readiness query before mounting payment UI. Incomplete applications remain in the form with grouped applicant requirements and a Complete Documents focus action; Stripe loading is deferred until the ready-only payment component mounts. Staging browser UAT verified no Secure Payment modal and zero Stripe card frames for an incomplete application.
- Payment-success views now discard the retained checkout scroll position and focus the programmatic success heading without causing a second scroll. The behavior applies both to the primary-form confirmation and the canonical paid payment page used after confirmation, 3DS return, refresh, and revisit.
- Staging transactional email delivery is accepted by Resend and was confirmed in the approved `admin@tashiraev.com` inbox using the sandbox sender. Provider-independent Magic Link and Email OTP recovery now issue hashed, expiring, single-use challenges behind enumeration-safe responses and rate limits; successful verification grants only the recovered application capability and routes to its canonical state.
- Outbound email evidence now records Magic Link and Email OTP under their exact template identities; migration 008 extends the append-only evidence enum without weakening its update/delete protections.
- Staging commit `04247b4` now loads only allowlisted non-secret mail settings from ignored staging configuration and the Resend key from its mode-600 secret file. Migration 008 is applied to `tashira_staging`; `/recover`, enumeration-safe unknown-email handling, and invalid-token rejection were reverified without sending mail.
- Authorized synthetic recovery UAT created an application through the canonical API, sent one Magic Link and one Email OTP to the sole approved staging recipient, and recorded two `SENT` evidence rows under the exact `RESUME_LINK` and `RECOVERY_OTP` templates without exposing either credential.

## Active blockers

- Interactive browser completion of the 3DS challenge and a future reviewed Payment Element migration for conditional provider-requested billing fields. Automated TEST verification reached the expected `requires_action` state, but the interactive challenge was not completed in this phase.
- Interactive confirmation of Magic Link/OTP receipt and single-use consumption remains pending in the approved recipient inbox.
- Authenticated customer resume/tracking browser UAT and manual confirmation of the staff logout control. Browser automation repeatedly activated the language toggle instead of the visually distinct logout control, so no speculative logout change was retained.
- Owner-approved business configuration.
- Remaining npm audit findings requiring upstream, major-version, or package-replacement decisions.
- Large XLSX/invoice chunks and the 35.1 MB bundled server artifact.

## Owner decisions/actions required

- Approve production pricing/company/VAT/exchange-rate/invoice values.
- Confirm receipt in the approved staging inbox and complete one Magic Link or OTP recovery attempt.
- Approve refund policy and legal retention periods.
- Review any production credential rotation and migration plan as separate authorized changes.

## Next highest-priority task

Complete synthetic authenticated customer resume/tracking browser UAT. Manual staff logout confirmation and sandbox mail remain owner/environment prerequisites for the remaining UAT.
