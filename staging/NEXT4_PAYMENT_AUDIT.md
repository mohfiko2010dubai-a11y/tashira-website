# NEXT TASK 4 — payment audit (report first)

Date: 2026-09-14 (Dubai). Audited deployed revision: `39dd933f8a43370e442adc733f2a3747cc1e174a`.

**Decision: do not launch.** Q1, Q5 and Q6 contain reproduced integrity defects. Q11 denied access in the tested customer endpoints, with an incorrect legacy 500 response. No application behavior, deployment, migration or production data was changed during this audit. Approval is required before remediation.

Source paths below are relative to this repository, at the audited revision. Evidence is in `staging/next4-payment-audit/`. Synthetic browser/API tests ran against isolated staging. No new charge was made for this audit; the existing latest Stripe TEST charge was inspected read-only.

## 1. Who computes the Stripe amount? NOT CLEAN

`api/payment-router.ts:31–84` accepts legacy optional amount/currency hints but ignores them. It reads `getApplicationPriceSnapshot(app.id)`, requires USD, and builds:

```ts
const serverAmountUsd = Number(priceSnapshot.totalPrice);
const amountCents = Math.round(serverAmountUsd * 100);
await createStripeTestIntent({
  amountCents,
  referenceNumber: app.referenceNumber,
  idempotencyKey: `tashira-application-${app.id}`,
});
```

`api/lib/stripe.ts:createStripeTestIntent` sends that amount to Stripe in USD. `api/lib/pricing-engine.ts` quotes from server pricing rules, applies the promotional/selling price and price floor, and multiplies by applicant count. `api/application-router.ts` initially derives that count from the applicants array and saves the price snapshot. No client discount is applied to Stripe.

However, the purchased service can change without updating the price:

- `api/dynamic-interview-router.ts:351` → `api/lib/customer/mysql-customer-interview-write-repository.ts:addApplicant` adds a traveller without repricing. Live synthetic test: **2 travellers/$370 became 3 travellers/$370**.
- `api/wizard-router.ts:202:updateApplication` permits an owner to change product/speed without repricing. Live test changed a regular 30-day family order to **90-day Express, still $370**.
- `api/lib/application-readiness.ts` checks that a snapshot exists, not that its count/product/speed match the current application.

These are demonstrated pricing-state inconsistencies, not a completed underpriced charge. They defeat a clean Q1 answer despite the server-generated Stripe amount.

## 2. Does it always equal the wizard total? NOT GUARANTEED

`src/pages/DynamicApplicationStart.tsx` uses server quotes for count and regular/Express options; its Express delta is the difference between those quotes. `src/pages/PaymentPage.tsx` calls `resolvePaymentDisplayAmount(app)`, reading the application total, whereas Stripe reads the immutable price snapshot. `api/lib/application-projection.ts` returns application totals without joining that snapshot.

The audit matrix covered all **16 active product/speed pairs × counts 1, 2 and 10 = 48 cases**. With an unmodified, consistent application, display and Stripe request totals matched. This used real quote/request-building functions with mocked external transport, not 48 Stripe charges.

The mutations in Q1 invalidate an “always” claim. Additionally, `wizard.submitApplication` updates application totals/payment state before `saveApplicationPriceSnapshot` can reject a mismatch, without a transaction covering both. This can split the display projection from the charged snapshot.

## 3. VAT: NO TAX ADDED AT CHECKOUT

Every tested product, both speeds and the three counts used the snapshot total directly; Stripe request creation contains no additional tax calculation. The displayed total is intended to be the charged total, subject to Q2's consistency defects.

The current staging business settings are **`vat_registered = no`, `settings_vat_rate = 0.0000`**. Therefore it would be inaccurate to claim the implementation currently extracts an included 5% VAT. `api/lib/payment-finalization.ts` takes the invoice VAT rate from business settings, or zero when not registered. `api/lib/invoice-pdf.ts` does not establish a complete VAT extraction calculation. The accountant must confirm tax configuration/invoicing; no tax policy was changed.

## 4. Currency and statement descriptor

Visa application payments are **USD** (`api/lib/stripe.ts:createStripeTestIntent`). The separate security-deposit helper uses AED and is not the visa fee.

Read-only Stripe TEST account/charge inspection returned:

- Statement descriptor: **TASHIRA E-VISA**.
- Card descriptor prefix: **TASHIRA**.
- Latest TEST charge currency: **usd**; calculated descriptor: **TASHIRA E-VISA**; `livemode: false`.

The request builder does not override the descriptor; it inherits account configuration. This verifies recognizable TASHIRA branding in TEST, not a LIVE bank statement or an exact descriptor consisting only of the word TASHIRA.

## 5. Explicit recorded acceptance? MODERN PATH YES; LEGACY PATH UNSAFE

`src/components/customer/PolicyAcceptance.tsx` provides an unchecked checkbox with Terms/Privacy/Refund links. `src/pages/PaymentPage.tsx` calls `payment.acceptPolicies`. `api/payment-router.ts:20` requires literal `accepted: true`, the current policy version, and access to the application. `api/lib/application-timeline.ts` persists the application ID and policy version; the timeline schema supplies the timestamp. The current bundle version is `legal-bundle-2026-08-19-v2` (`contracts/constants.ts`). Readiness requires a corresponding acceptance event.

But `api/application-router.ts:108` automatically inserts `POLICY_ACCEPTED` for a legacy/non-dynamic creation path (also under its environment condition), without an explicit acceptance field. A synthetic create sent `accepted: false`; that unrecognized field was discarded and **an acceptance event was nevertheless recorded**. Evidence includes the timestamp and version in `final-reads.json`. `api/wizard-router.ts:285:submitApplication` also accepts a version without a required literal acceptance boolean and can record acceptance.

Consequently the presence of an event does not prove explicit acceptance across all paths. Also, the payment acceptance record does not preserve a policy content hash/immutable text archive. A combined version string exists, but its permanent mapping to the exact displayed policy text needs to be made defensible. No automatic-acceptance behavior was changed pending approval.

## 6. Webhook signature and idempotency? SIGNATURE YES; RETRY SAFETY INCOMPLETE

`api/boot.ts` reads the raw webhook body and verifies it before effects. `api/lib/stripe-webhook.ts` verifies HMAC-SHA256 over `timestamp.payload`, uses timing-safe comparison, a 300-second tolerance, and checks TEST/LIVE consistency. Existing tests cover valid, tampered, stale and wrong-mode events.

The de-duplication key is **Stripe `event.id` → `stripe_webhook_events.event_id` primary key**. `api/lib/stripe-webhook-idempotency.ts` inserts a processing claim and skips processed duplicates.

Two defects prevent approval:

1. Reclaiming a failed/stale event does a read followed by an unconditional update by event ID. There is no atomic compare-and-swap/lock. The concurrency probe reproduced **two simultaneous retries both returning `process`**.
2. `api/lib/payment-finalization.ts:recordStripeTestPaymentFailure` can write `failed` over an already-paid application/payment. The test reproduced that late-failure regression. Stripe does not guarantee event order.

An in-progress duplicate is acknowledged immediately. If its original worker crashes, recovery is not guaranteed by that acknowledgement; no durable reconciliation/reaper was found. Finalization's read/write and notification effects are not one atomic operation. Invoice uniqueness helps one effect but does not make the whole operation exactly-once.

Reference: [Stripe webhook delivery guidance](https://docs.stripe.com/webhooks).

## 7. Non-happy paths: DUPLICATE-FREE CANNOT BE CERTIFIED

Code: `src/pages/PaymentPage.tsx`, `src/lib/payment-view-state.ts`, `src/providers/trpc-client.ts`, `api/payment-router.ts`, `api/lib/payment-finalization.ts`, `api/boot.ts`.

| Scenario | Existing behavior and remaining risk |
| --- | --- |
| Payment fails | UI shows an error and permits retry; failure webhook records failed. Late/out-of-order failure can regress paid state (Q6). |
| Browser back after success | A fresh paid server state shows the success experience and createIntent rejects already-paid orders. Stale state and non-monotonic writes prevent an unconditional guarantee. |
| Refresh while processing | Component state is lost; no robust persisted-intent polling/resume flow was found. App query caching can temporarily retain old state. |
| Double click / multiple tabs | Loading state limits ordinary UI clicks. Server uses `tashira-application-${app.id}`, but has no durable exclusive intent-creation transaction and the payments table has no unique Stripe PaymentIntent ID constraint. |
| Close tab during confirmation/redirect | Webhook can finalize independently of the browser. Missing/delayed delivery lacks a complete reconciliation path; reopening can attempt intent creation again. |

`createIntent` calls Stripe creation again rather than first retrieving/reusing the persisted pending intent. Stripe can prune idempotency keys after at least 24 hours; an old still-payable intent plus a later newly created intent is not prevented durably. No duplicate charge was deliberately made during this audit.

Order creation itself lacks a logical submission idempotency key. Retrying an uncertain create with a fresh reference can create a second application. Reference uniqueness is not logical-order uniqueness.

Reference: [Stripe idempotent requests and retention](https://docs.stripe.com/api/idempotent_requests).

## 8. Server-generated concurrent-safe reference? NO

`src/pages/DynamicApplicationStart.tsx:createReference` generates `TSH-` + base-36 client time + six UUID characters in the browser. `api/application-router.ts:create` accepts and persists the client reference. The synthetic API probe successfully supplied its own reference.

`db/schema.ts` has a unique application reference index: identical references cannot both persist concurrently. There is no server generation/collision retry protecting the user experience, and it does not prevent two logically identical applications with different references.

## 9. PII in logs/errors/analytics/URLs? PROVEN LEAK

Search output: `log-scan.txt`. Synthetic reproduction: `log-probe.json` and `final-reads.json`.

- `api/application-router.ts:167` logs `getErrorMessage(error)` and returns a wrapped raw message. `api/lib/errors.ts` does not redact it. Installed Drizzle query errors include SQL and parameter values.
- A duplicate synthetic create produced HTTP 500 containing SQL and the synthetic contact email. The same synthetic email was found in the staging server error log. **This is a demonstrated PII leak, not merely a grep suspicion.**
- Additional raw-error sinks exist in wizard/payment finalization/boot. `src/components/shared/StripePaymentForm.tsx` logs an uploaded filename; filenames can contain personal data. `PaymentPage.tsx` logs caught tRPC errors in the browser.
- `api/lib/audit-log.ts` uses a restricted event payload, and explicit Google conversion events use an allowlist (`src/lib/google-conversion-decision.ts`). Those safer paths do not sanitize the raw-error paths above.
- `src/lib/google-conversion.ts` enables default page-view collection when configured. URLs containing order references or recovery tokens need exclusion/redaction before analytics; references are also present in application URLs by design. No claim is made that a passport scan's binary contents were observed in logs.
- Searches did not find Sentry, session replay, Hotjar, Clarity or PostHog integration. Absence of those integrations does not negate the confirmed server/client logging exposure.

Only synthetic data was used to induce and inspect the error. No customer passport was submitted or copied into audit evidence.

## 10. Paid, then unreadable document? PARTIAL DISCONNECTED WORKFLOW

`api/document-router.ts:147:requestReplacement` records a replacement lifecycle event and calls `api/lib/customer-notification-email.ts:sendDocumentsRequiredNotification`. It does not update the document upload status or the application state. Email failures are recorded/caught and do not cause this endpoint to report delivery failure.

The newer staff path `api/operations-write-router.ts:76:documentReview` supports UNREADABLE/NEEDS_REPLACEMENT through `api/lib/operations/controlled-actions.ts` and `mysql-controlled-write-executor.ts`. It records review/audit/control changes, but does not connect them to that replacement notification. It requires an allowed review state, so an order in payment_received needs a preceding staff transition.

`api/lib/customer/owner-document-evidence.ts` reads uploaded documents without incorporating these review outcomes. Thus a file can still appear uploaded to the customer after staff marks it unreadable. The separate pieces do not prove an end-to-end “needs a new file → customer notified → replacement → staff accepts” workflow. Payment must remain paid throughout remediation; a second charge must not be required.

## 11. Guessed reference / foreign order test

Actual live negative tests used synthetic orders and separate browser identities:

| Procedure | Anonymous | Different customer |
| --- | --- | --- |
| application.getByReference | 401 | 403 |
| wizard.getByReference | 401 | 500 (incorrect error mapping, no order returned) |
| payment.readiness | 401 | 403 |
| payment.getInvoice | 401 | 403 |
| dynamicInterview.current | 401 | 403 |

Own-order access succeeded. Opening the tracking page with the other synthetic reference showed the secure email recovery flow and did not disclose the other customer's details. Evidence: `access.json`.

Code: `api/lib/application-authorization.ts`, `api/lib/application-access.ts`, `api/middleware.ts`, `api/lib/customer-session.ts`. Customer reference access comes from a signed HttpOnly/Secure/SameSite session with timing-safe signature verification; a guessed reference alone is insufficient. Staff/admin have separate authorized access.

**No foreign-order disclosure was observed in these tested paths.** This is scoped evidence, not a claim that every endpoint in the system has undergone a complete penetration test. Fix the legacy 500 to a consistent denial.

## Staging cleanup and production isolation

**Nothing was deleted.** The initial read-only candidate plan listed 108 applications and 192 associated files, based on reserved test domains/reference markers. It retained ambiguous orders and is not a final authorized deletion list; subsequent audit probes also created synthetic applications.

Automatic approval review rejected executing the bulk plan because irreversible deletion of 108 applications/192 files based on heuristic markers exceeded adequately confirmed per-record authorization. No bypass was attempted.

A narrower attempt targeted only the explicitly named `TSH-MTYYW9IT-7747FD`. The database rejected deleting append-only applicant requirement events. The transaction rolled back; files were not deleted and no protection was disabled. A subsequent read-only plan confirmed the named application and its related rows still exist, with zero associated files. Root read-only inspection found append-only DELETE triggers; the app account's empty trigger listing was a privilege-limited result, not evidence of absent protections.

Cleanup needs a separately approved staging-only maintenance procedure and an owner-confirmed list. It must account for append-only audit protections rather than quietly disabling them. Ambiguous orders remain untouched.

Read-only isolation checks confirmed distinct staging/production DB names, DB users, storage configuration and customer-session secrets. The staging DB identity was exactly `tashira_staging` / `tashira_staging_app`, storage `/var/www/tashira-staging/storage/documents`, PM2 cwd `/var/www/tashira-staging`. `staging/run-native.mjs` enforces its staging cwd, TEST public/secret keys and `STRIPE_MODE=TEST`; inspected charge was `livemode:false`.

These checks support current separation. They are not a guarantee that a future manual database/file copy cannot import test data. No production database, storage, deployment or Stripe LIVE setting was changed. Production launch must deploy code/artifacts only and never copy staging data.

## Approval requested: proposed remediation order

1. Bind the paid product/speed/count to one authoritative server quote; transact repricing and reject stale mismatches at payment. Guard paid orders against repricing/reset.
2. Remove synthesized policy acceptance from every path; require explicit versioned acceptance and preserve the corresponding policy text/hash.
3. Persist/reuse an intent with unique DB constraints; make webhook claims/finalization atomic and paid status monotonic; add durable reconciliation.
4. Redact server/client errors, filenames and sensitive URLs; use stable safe error categories.
5. Generate references server-side and add logical create idempotency.
6. Connect unreadable review to customer replacement state, notification delivery tracking/retry and staff acceptance; retain paid status.
7. Correct the legacy access error and repeat multi-identity negative tests.
8. Run decline/retry/back/refresh/cross-tab/concurrent-webhook tests using Stripe TEST, then obtain a fresh launch decision.

Separately approve a concrete staging cleanup list/procedure. No behavioral fixes have been started under this report-first task.

## Verification limits

Four test files / 15 tests passed, including the 48-case price matrix and **tests that intentionally prove current unsafe behavior**. This does not mean the payment audit passed. No actual duplicate charge or LIVE charge was attempted. No full rebuild was needed for this report-only phase; audit probes are not deployed application code. Existing unrelated dirty files were preserved.
