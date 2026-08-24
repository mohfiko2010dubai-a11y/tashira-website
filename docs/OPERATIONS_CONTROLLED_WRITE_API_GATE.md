# Operations Controlled Write — Executor and API Gate

Status: PASS on the isolated disposable MySQL 8.4 rehearsal environment. All capabilities remain disabled by default behind `OPERATIONS_CONTROLLED_WRITES`; no write UI is active.

## Approved actions

The internal API exposes only:

1. Human Review
2. Document Review
3. Assignment, Claim and Reassignment
4. Enumerated Status Transition
5. Re-evaluation Request

The MySQL executor delegates every decision to the existing deterministic controlled-action contracts. Persistence does not duplicate transition, scope, ownership or review logic.

## Transaction boundary

Each accepted command runs in one database transaction. The case/document version change, immutable business action event, append-only audit event and persistent idempotency result commit together. Re-evaluation additionally appends the new immutable evaluation run, rule matches and selection event within that transaction. Any required write failure rolls the complete command back.

## Authorization and isolation

- Actor identity, active permissions, scopes and feature flags are reloaded from trusted server-side MySQL state.
- Client-supplied roles, permissions, teams and hidden fields are rejected.
- Case team and assignment eligibility are checked at execution time.
- Document review verifies application, applicant and document ownership and uses an independent document version.
- Assignment requires an explicit persisted workload limit; missing capacity configuration fails closed.
- Responses contain only status, application ID, resulting version and audit-event reference.
- Supplier/internal cost, margin, markup, profit and Stripe financial data are neither selected nor returned.

## Concurrency and idempotency

- The case row is locked and advanced only from the caller's `expectedVersion`.
- Document review also advances its own expected document version.
- A stale command returns `CONCURRENCY_CONFLICT`; no last-write-wins behavior exists.
- Idempotency is stored in MySQL and survives executor recreation.
- The same key and payload returns the original deterministic result; the same key with different payload fails closed.

## Safe error contract

Known failures map to deterministic unauthenticated, forbidden/out-of-scope, not-found, precondition, invalid-transition, concurrency and idempotency errors. Unexpected persistence details are reduced to `PERSISTENCE_FAILURE`; raw SQL/database errors are never returned through the API.

## Rehearsal evidence

- MySQL image/version: MySQL 8.4.11, local container only.
- Network exposure: `127.0.0.1:33306`; no remote database connection.
- Clean and legacy migration chains: `014–023` PASS.
- Real executor/API integration: 8/8 PASS.
- Full repository suite with both MySQL integrations enabled: 365/365 PASS.
- Rule/evaluation history, applicant isolation, transaction rollback, concurrency, restart-safe idempotency, RBAC and finance non-mutation: PASS.

No migration was applied to staging or Production. Production, main/master, Stripe, Resend, pricing, payments and invoices were not modified.
