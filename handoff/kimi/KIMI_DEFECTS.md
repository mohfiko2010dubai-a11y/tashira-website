# Kimi Defect Register

This register re-checks the requested defect list against baseline `4e0f520...`; it does not repeat stale claims as current facts.

| # | Defect | Status | Current evidence / root cause | Required closure |
|---:|---|---|---|---|
| 1 | `wizard-router` writes applicant fields to `applications` | NOT CONFIRMED — fixed | `startApplication`/`updateApplication` call `persistApplicant`; application rows contain only application/contact/travel/pricing state. | Preserve applicant-table ownership tests. |
| 2 | Uses nonexistent `totalApplicants` | NOT CONFIRMED — fixed | No current reference; API uses validated `applicantCount`, while applicants are persisted by `applicantIndex`. | Keep schema/API contract tests. |
| 3 | `const w = wizard` stale closure/TDZ | CONFIRMED DESIGN RISK, no TDZ | `processInput` captures the render snapshot. It is declared after state initialization, so no TDZ; async mutation callbacks may still act on a stale render snapshot. | Refactor to a reducer/state-machine or pass explicit immutable command state; add rapid-interaction tests. |
| 4 | Wizard/Chatbot stops after name | NOT CONFIRMED at baseline | Current switch continues through applicant fields, documents, review, policy acceptance and payment link. Previous reports are stale. | Browser regression test the full legacy chatbot in both languages. |
| 5 | More than one applicant unsupported | NOT CONFIRMED — fixed | `applicantCount` supports 1–20; `applicants[]`, sequence validation and applicant-indexed persistence exist. | Browser-test 2+ applicants and retry/resume isolation. |
| 6 | PaymentPage may calculate wrong amount without pricing config | CONFIRMED presentation fallback | UI still contains hard-coded fallback prices when DB amount is missing. Server PaymentIntent uses immutable price snapshot, so charge integrity is protected, but displayed amount can disagree. | Remove fallback and fail closed to readiness/price-snapshot error; add display/server consistency test. |
| 7 | `payment-router` uses `app.totalAmount` | NOT CONFIRMED — fixed | `createIntent` uses `getApplicationPriceSnapshot()` and ignores client amount. | Preserve authoritative price-snapshot tests. |
| 8 | `minify: false` workaround | CONFIRMED | `vite.config.ts` disables minification. It is a deployment/build workaround, not a correctness fix. | Identify prior minifier failure, enable production minification in a review branch and compare lazy chunks/source maps. |
| 9 | Upload relies on `setTimeout` | PARTIALLY CONFIRMED | Chatbot uses timers for UI sequencing; object URL revocation also uses a timer. Backend upload persistence itself is awaited. | Replace correctness-significant UI timers with mutation state/events; retain only bounded resource cleanup timers. |
| 10 | `application.getByReference` vs `wizard.getByReference` conflict | CONFIRMED duplicate read surfaces | Both routes exist and both apply application access checks, but shapes/purposes can drift. | Select one canonical customer projection and keep a compatibility adapter with contract tests. |

## Priority

P1: Payment display fallback consistency.
P2: Chatbot state-machine/stale snapshot and canonical read projection.
P3: Restore minification after reproducible investigation; remove nonessential UI timers.
