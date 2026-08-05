# Chatbot and visa wizard

## Architecture

The customer assistant combines a frontend state machine with backend chat and wizard routers.

Main files:

- `src/components/shared/ChatBot.tsx`
- `src/sections/VisaApplicationForm.tsx`
- `api/chat-router.ts`
- `api/wizard-router.ts`
- `api/application-router.ts`
- `src/components/shared/StripePaymentForm.tsx`

## Flow

1. Collect travel party, residence, visa, processing, identity, travel, and contact information.
2. Calculate a provisional amount in the UI.
3. Create or update an application through tRPC.
4. Associate uploaded documents after an application ID is available.
5. Present a payment transition using the application reference.
6. Persist chat messages and optionally notify external services.

## Required boundaries

- Server must validate all wizard data.
- Server must calculate authoritative pricing.
- Application creation and applicants should be transactional.
- Documents must never be silently treated as uploaded before filesystem and metadata writes succeed.
- Chat text and PII require access controls, retention rules, and log redaction.

## Known issues requiring verification

- Static analysis identified schema mismatches around applicant counts and totals.
- Frontend and backend wizard logic duplicate fields, prices, and transitions.
- Some upload paths can run before a reliable application ID exists.
- Review for temporal-dead-zone (TDZ) access where callbacks or derived values reference declarations before initialization.
- Normalize tRPC mutation response formats; current branches may expect inconsistent success/error shapes.
- Verify that Unicode/Arabic response formatting has not been damaged by source encoding.

These issues are source findings, not claims about observed production behavior.

## Testing

- Every wizard state and transition.
- Invalid, missing, repeated, and out-of-order input.
- Single/family and residence categories.
- Application transaction rollback.
- Upload before/after application creation.
- Payment transition and authoritative total.
- Chat response parsing and multilingual formatting.
- Retry/idempotency and network failure behavior.
- Authorization and PII isolation.
