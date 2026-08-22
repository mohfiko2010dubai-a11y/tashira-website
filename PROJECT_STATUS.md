# TASHIRA Project Status

Last verified: 2026-08-22

## Current state

- Refund/security-deposit program: Phase 1 is implemented and verified end to end on isolated staging. Administrator re-authentication, duplicate-balance reservation, safe capability delivery/retry, Stripe TEST deposit collection, approved Stripe TEST refund execution, replay prevention, and immutable evidence all passed focused synthetic UAT. No Production migration, deployment, payment, refund, or data change occurred.
- Phase: Phase 9 — launch-blocker closure.
- Branch: `devops/deployment-safety`.
- Current verified implementation: final Payment Successful presentation on `devops/deployment-safety` (commit recorded in Git history).
- CI: local quality gates GREEN; review-branch CI is running for the final staging-UAT tool commit.
- Tests: 204/204 passing across 49 files.
- TypeScript: PASS.
- ESLint: PASS.
- Build: PASS.
- Verified launch readiness: 84%.
- Classification: C — Not Launch Candidate.

## Completed capabilities

- Refund Phase 1 now provides a unified visa-payment/security-deposit case model, available-balance protection, transparent full/percentage/fixed/actual-cost calculations, separate administrator approval and execution re-authentication, Stripe idempotency, immutable timeline/financial evidence, and an Admin Application Details workflow. This remains isolated to the review branch and is not deployed to Production.
- Security-deposit Phase 1 now supports an administrator-selected AED amount per application, a hashed 256-bit expiring customer capability, idempotent Resend delivery evidence, explicit accept/decline, an isolated Stripe PaymentIntent, authoritative amount/request verification, separate PAID evidence, and automatic refund-state integration. It remains review-branch only pending isolated staging migrations and UAT.
- Failed security-deposit email delivery can now be retried against the same request without creating a duplicate financial obligation. Each retry atomically rotates and invalidates the prior capability, uses a retry-specific provider idempotency key, records delivery evidence, and refuses concurrent or post-delivery retries. This remains review-branch only pending isolated staging migrations and UAT.
- Isolated staging migrations 009–011 are applied after a root-only database/code rollback snapshot at `/var/backups/tashira-staging/20260822T000824Z`. The canonical staging deployment passed, both Production and staging remained HTTP 200, and the staging document fingerprint remained unchanged. Synthetic UAT `TSH-DEPOSIT-UAT-1787357952121` verified one allowed-recipient deposit email, an exact AED 10.00 TEST deposit, a transparent 2% deduction, one AED 9.80 TEST refund, replay rejection, and single-instance evidence.
- Signed Stripe webhooks now finalize security deposits independently of the customer's browser return. The handler resolves ownership from the deposit request, re-retrieves the PaymentIntent, verifies exact AED amount and request metadata, records failure safely, and shares an idempotent finalizer with the customer confirmation API. Focused staging UAT `TSH-DEPOSIT-UAT-1787358318791` passed webhook finalization, duplicate-event rejection, customer confirmation replay, and the subsequent single-instance refund.

- Production test data can now be retained as immutable evidence while being excluded from normal operations through an explicit `LIVE`/`TEST` application classification. Administrative and staff application lists, headline analytics, invoices/VAT consumers, and the finance cockpit filter to `LIVE` records server-side. Migration 009 is non-destructive and defaults every new application to `LIVE`; marking the inventoried pre-launch Production applications as `TEST` remains a separately authorized guarded database operation after deployment.
- Stripe runtime mode is now explicit and fail-closed: the protected workflow maps `PRELIVE` to `TEST` and `LIVE` to `LIVE`, boot rejects incomplete or mixed credentials, LIVE webhook signatures/events are accepted only in LIVE mode, and the existing three-event allowlist, idempotency, amounts, and payment finalization behavior remain unchanged. Local gates passed with 181 tests and a production build; no LIVE credential was configured and no payment occurred.
- Isolated native staging with separate checkout, MySQL database/user, filesystem storage, logs, port, and PM2 process.
- Migration 005 reviewed, hardened, applied only to `tashira_staging`, and verified with 16 append-only triggers.
- Server-authoritative versioned pricing and immutable price snapshots.
- Single and multi-applicant canonical application model.
- Filesystem document upload with ownership checks and lifecycle/timeline evidence.
- Signed customer application capability, admin/staff authorization foundations, risk engine, evidence manifest, finance/VAT cockpit, retention, and legal holds.
- Stripe TEST-only verification/webhook foundation and transactional-email/recovery abstractions.
- Safe dependency updates reduced the audit from 24 to 16 findings without force-upgrading incompatible packages. The direct `@hono/node-server` dependency is locked to the patched `1.19.17` release.
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
- Recovery email rendering now includes a safe clickable HTML action and clickable fallback URL while retaining the plain-text alternative; only the exact HTTPS staging recovery origin is accepted.
- Interactive staging Recovery UAT passed end to end: the approved inbox received the HTML Magic Link, the active `Resume Application` action opened the correct canonical payment screen, and reuse of the same link was rejected without granting a new session.
- The canonical recovery payment page now performs the same server-authoritative readiness gate as the primary form. Incomplete applications show grouped requirements and a `Complete Application` action instead of raw API JSON or card entry; Stripe uses the pure loader and is not initialized until readiness is `READY`. Staging browser UAT verified zero Stripe frames/elements for an incomplete application and confirmed that the completion action opens the assistant at the persisted resume step.
- Public customer tracking UAT now verifies the application reference, immutable timeline, and canonical `/pay/:referenceNumber` continuation route. The footer's Track Application link now opens `/track` instead of a dead fragment.
- Staff logout now awaits server-side session invalidation before navigation while retaining a guaranteed local cleanup path. The existing authenticated browser click still requires a final manual confirmation; no synthetic credential was entered without owner confirmation.
- Authoritative Payment Successful email delivery now runs after verified Stripe finalization, uses Resend idempotency keys and durable evidence, remains failure-isolated from payment truth, and keeps production delivery disabled until explicitly enabled.
- Fake Google IDs were removed. Verified purchase conversion now uses the server-confirmed amount/currency and stable reference, emits only after successful backend confirmation, and remains disabled until owner IDs are configured.
- Unpaid applications are now rejected server-side from operational processing states. The rule is covered by eight regression cases.
- Final V1 legal-policy remediation is deployed to isolated staging: complete equivalent English/Arabic Terms, Privacy, and Refund/Cancellation policies; explicit three-policy acceptance in the primary form and chatbot; immutable policy bundle `legal-bundle-2026-08-18-v1`; auditable `PROCESSING_STARTED` transition; qualified timing/private-provider wording; and working `/terms`, `/privacy`, `/refund`, `/contact`, and `/track` direct/hard-refresh routes. Exact-commit gates passed with 112 tests, the merged staging tree passed 120 tests and build, and CI run `32121645748` is green at `94ad1ff`.
- The owner-approved final Payment Successful presentation now uses one shared normal/chatbot component, a centered responsive desktop layout, the existing authorized inline PDF invoice route, direct secure download, paid-state tracking round-trip, clean home exit, and authoritative primary-applicant identity for newly generated invoice PDFs. Focused tests and all local quality gates pass without changing Stripe, pricing, webhook, Resend, or email behavior.
- The final V1 invoice now maps every BILL TO identity field from ordered Applicant 1, preserves full-family financial evidence from the immutable price snapshot and verified payment, and embeds the OFL-licensed Noto Naskh Arabic font for shaped RTL Arabic values without changing the English/LTR structure. Preview, download, admin access, and email attachments continue to use the same canonical server PDF.
- Checkout now separates the lead applicant from an explicitly authorized payer/cardholder, records a versioned idempotent payer-authorization timeline event, supports authorized third-party relationships, exposes safe payer evidence to Admin and chargeback manifests, and never stores card-entry data. The invoice BILL TO, server-authoritative amount, Stripe lifecycle, and applicant ownership remain unchanged.
- Canonical invoice PDFs now preserve the lead applicant under BILL TO and show the separately recorded payer under PAYMENT DETAILS across preview, download, secure email access, attachment, and Admin view. Relationship and safe Stripe card brand/last4 appear only when available; payment and chargeback evidence use the same immutable payer event without storing sensitive card data.
- Legal bundle `legal-bundle-2026-08-19-v2` now states the approved English/Arabic refund-deduction principle: only actual, disclosed and legally permitted costs may reduce an eligible refund; calculations must be transparent; duplicate/incorrect payments carry no discretionary penalty; and refundable security deposits remain separately protected. Automated refund accounting remains post-launch and unimplemented.

## Active blockers

- Interactive browser completion of the 3DS challenge and a future reviewed Payment Element migration for conditional provider-requested billing fields. Automated TEST verification reached the expected `requires_action` state, but the interactive challenge was not completed in this phase.
- Final V1 candidate `TSH-V1-1786901526429` reached READY with three documents but Stripe TEST confirmation failed before webhook completion; the fresh paid E2E remains blocked by account capability.
- Manual authenticated browser confirmation of the staff logout control. The implementation and automated session tests pass, but the browser interaction still requires explicit approval before entering a synthetic password.
- Owner-approved business configuration.
- Remaining npm audit findings requiring upstream, major-version, or package-replacement decisions.
- Large XLSX/invoice chunks and the 35.1 MB bundled server artifact.

## Owner decisions/actions required

- Approve production pricing/company/VAT/exchange-rate/invoice values.
- Review any production credential rotation and migration plan as separate authorized changes.
- Resolve Stripe TEST card-payment capability, confirm the Resend domain/sender in its dashboard, and provide Google Tag/Ads conversion IDs plus the purchase label.

## Next highest-priority task

Add refund reconciliation and customer notification for asynchronous Stripe refund outcomes, then perform focused authenticated Admin browser review without changing Production. Production remains read-only and online. Optional dependency and bundle work is deferred to `POST_LAUNCH_ROADMAP.md`.
