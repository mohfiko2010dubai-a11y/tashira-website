# Operations Controlled Write — Executor and API Gate

Status: PASS on the isolated disposable MySQL 8.4 rehearsal environment. All capabilities remain disabled by default behind `OPERATIONS_CONTROLLED_WRITES`; the reviewed UI exists but is not activated on a live route.

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
- Real executor/API integration: 9/9 PASS.
- Full repository suite with both MySQL integrations enabled: 375/375 PASS.
- Rule/evaluation history, applicant isolation, transaction rollback, concurrency, restart-safe idempotency, RBAC and finance non-mutation: PASS.

No migration was applied to staging or Production. Production, main/master, Stripe, Resend, pricing, payments and invoices were not modified.

## Controlled Write UI gate

The Operations Case Workspace now has an optional controlled-write panel that is rendered only when the caller explicitly supplies both the closed feature state and canonical refresh behavior. The panel uses a server-derived capability query and the five existing mutation contracts; it does not infer authorization from the browser.

- Human Review exposes only the approved outcome enum and the current applicant/family evidence context.
- Document Review remains bound to one applicant, one document and its current document version.
- Assignment exposes only server-approved modes and in-scope staff with explicit capacity.
- Status Transition exposes only the authoritative state-machine successors returned by the server.
- Re-evaluation is available only for a current persisted evaluation and creates a new immutable snapshot through the existing API.
- Every action requires a reason and explicit confirmation, disables duplicate submission while pending and retains the same idempotency key for a retry of unchanged intent.
- Successful actions and concurrency failures support canonical case/capability refresh; persistence errors are mapped to safe operational messages.
- Legacy cases are labeled `LEGACY_NOT_EVALUATED`; no historical evaluation is fabricated.
- Capability and render tests assert that supplier costs, internal costs, margins, profit, Stripe and payout data are absent.

The UI is not registered on a live route and `OPERATIONS_CONTROLLED_WRITES` remains disabled by default. Activation, staging migration and any Production change remain separate approval gates.
