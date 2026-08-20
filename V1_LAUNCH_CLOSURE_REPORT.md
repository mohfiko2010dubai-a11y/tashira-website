# TASHIRA V1 Launch Closure Report

Last verified: 2026-08-16

## 1. V1 classification

**B — V1 BLOCKED**

The exact remaining release blocker is Stripe TEST account capability. The final fresh candidate reached server-authoritative `READY`, created a PaymentIntent, and then Stripe refused TEST confirmation before webhook finalization. Payment email, invoice, Admin paid-state acceptance, and Google conversion cannot be truthfully marked end-to-end PASS until a verified payment succeeds.

## 2. Synthetic E2E reference

`TSH-V1-1786901526429` — pending, submitted, three required synthetic documents stored. No successful payment was claimed.

## 3–8. Intake, documents, payment, invoice, and Admin

- Application intake: PASS through API and prior browser UAT for single/family flows.
- Documents: PASS for readiness ownership, three required documents on the fresh candidate, signed access, replacement lifecycle, and cross-applicant/application regression coverage.
- Secure payment: BLOCKED at Stripe TEST confirmation. Readiness gating, server pricing, webhook signatures, idempotency, retry, duplicate-payment prevention, and amount invariants pass automated tests and earlier synthetic webhook UAT.
- Invoice: automated invariant PASS; fresh final-candidate invoice is blocked because payment did not succeed.
- Admin application/documents: earlier authenticated staging UAT PASS; fresh paid-candidate acceptance is blocked by Stripe.

## 9–15. Transactional communication and recovery

- Resend: staging delivery and approved-recipient allowlist PASS. The installed sending-only key could not read domain status; owner must verify `tashiraev.com` and the intended sender in the Resend dashboard.
- Payment Successful email: implementation complete. It is emitted only after authoritative payment verification, includes reference/invoice/amount/currency/status/next steps, and does not claim government submission.
- Email idempotency: stable Resend `Idempotency-Key`, durable SENT evidence check, and webhook replay protection implemented and tested.
- Magic Link: prior end-to-end staging UAT PASS, including single use and invalid/reused rejection.
- OTP: automated expiry, attempt limit, ownership, and single-use rules PASS; prior delivery evidence exists.
- Customer resume: PASS through canonical recovery/payment route and server ownership capability.
- Document/status notification: template exists; an operator-facing trigger is deferred unless required before launch.

## 16–18. Google measurement

- Previously found tracking consisted only of placeholder GTM/GA4/Ads IDs and an unsafe frontend purchase call.
- Placeholders were removed. Google code now loads only with valid environment configuration.
- `purchase` fires only after server payment confirmation, uses the server-confirmed value/currency and stable application reference, and is session-deduplicated. It does not send applicant, passport, document, or card data.
- Owner configuration required: `VITE_GOOGLE_TAG_ID`, `VITE_GOOGLE_ADS_CONVERSION_ID`, and `VITE_GOOGLE_ADS_PURCHASE_LABEL`. Consent/legal configuration also requires owner approval.

## 19. Security gate

- No tracked Stripe/Resend/SSH secrets, staging credentials, customer documents, or environment values were introduced.
- Application, applicant, and document ownership controls remain enforced.
- A new server-side gate prevents unpaid applications entering `payment_received`, `documents_received`, `under_review`, `visa_processing`, `visa_received`, or `completed`.
- No Critical exploitable runtime vulnerability is currently identified. Remaining audit findings require reviewed major migrations or library replacement.

## 20. Tests and CI

- TypeScript: PASS.
- Tracked-source lint: PASS.
- Tests: 110/110 PASS before the final verifier addition.
- Build and static asset verification: PASS.
- CI was GREEN for analytics/payment-email commit `ada4b85`; final branch CI must be green after this report/verifier commit.

## 21. Release-critical fixes

- Idempotent authoritative Payment Successful email.
- Production email remains disabled unless explicitly enabled.
- Removed fake Google IDs and frontend-trusted purchase values.
- Added verified-payment Google conversion integration points.
- Added server-side no-payment/no-processing enforcement.
- Added a repeatable isolated-staging V1 acceptance verifier.

## 22. True remaining launch blockers

1. Owner must resolve Stripe TEST `card_payments`/charges capability and rerun the final V1 verifier.
2. Owner must confirm the Resend domain/sender status in the dashboard (the sending-only API key cannot list domains).
3. Owner must provide Google IDs/label and approve consent configuration; architecture is ready without them.
4. Final fresh paid Admin/document/email/conversion UAT must pass after item 1.

## 23. Deferred post-launch work

See `POST_LAUNCH_ROADMAP.md`.

## 24. Owner manual UAT

Manual UAT may begin for intake, documents, recovery, Admin, and unpaid gating. Final paid-journey sign-off must wait for the Stripe capability fix.
