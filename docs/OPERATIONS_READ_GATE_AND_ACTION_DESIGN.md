# Operations Read Gate and Controlled Action Design

Status: read-only gate implemented; action layer design only
Feature flag: `OPERATIONS_CASE_READ_MODEL`, closed by default
Production impact: none

## Canonical read model

The Operations Case Read Model is assembled only after resource-scope authorization. It returns the case summary, applicant-scoped current and historical evaluation evidence, exact rule versions, re-evaluation changes/reason, applicant-scoped requirement and document readiness, deterministic family blockers/actions, current relationship evidence, operational supplier identity when authorized, and audit-safe timeline events.

Applicant identity is present on every evaluation, requirement and document projection. A document outside the case applicant set is rejected. Legacy cases are explicitly `LEGACY_NOT_EVALUATED`; the adapter never invents rule history or a specific family relationship.

Operations roles may read the rule version used as evidence, but have no rule mutation permission. Supplier cost fields require `supplier.read_financial`; operational supplier access alone cannot expose effective cost, internal cost, margin or profit.

## Read-only gate

The service exposes only a query. It cannot change eligibility, rules, requirements, relationships, supplier, status, documents or evaluation selection. It is unavailable unless the environment-scoped `OPERATIONS_CASE_READ_MODEL` flag is explicitly enabled.

The corresponding read-only Case Workspace renders, in order: Case Overview, Applicants and family relationships, Requirements, Documents, Evaluation History, Family Readiness and customer actions, Timeline, and Supplier. It accepts the authorized read-model DTO and has no buttons, callbacks or mutation client. It renders nothing while the same feature flag is closed. Supplier rendering uses an explicit operational-field allowlist even if a finance-capable DTO is supplied.

## Controlled action layer design

The five action-domain commands are implemented as inactive contracts, not API endpoints. Each command is separate and never extends the read query:

| Command | Required permission | Required controls | Immutable evidence |
| --- | --- | --- | --- |
| Request human review | `case.transition` | permitted case scope, reason code | review-request event |
| Review requirement | `document.review` | applicant/instance ownership, current evaluation | requirement event |
| Review document | `document.review` | applicant/document ownership, current document version | document-review event |
| Assign case | `case.assign` | manager team/department scope | assignment event |
| Transition status | `case.transition` | explicit state machine and readiness precondition | transition event |
| Request re-evaluation | `rule.review` | reason, selected route, current snapshot ownership | new evaluation run; never overwrite |

Every command must use a unique idempotency key, optimistic concurrency/version precondition, server timestamp, actor identity, authorization decision, before/after references, reason and audit event. Commands must reject stale evaluation or requirement IDs and must not infer cross-applicant ownership.

The inactive implementation enforces these controls centrally and keeps finance fields immutable. Human review and document review validate controlled outcomes and case prerequisites; assignment supports assign/claim/reassign with team and workload checks; status uses the enumerated transition map only; re-evaluation evaluates server-supplied registry rules into a new immutable snapshot and append-only selection. Idempotency is scoped per application and is checked before replay-sensitive state validation.

No HTTP mutation handler, client button, database adapter or enabled feature flag exists. A future persistence adapter must execute case-version update, audit append and re-evaluation snapshot/selection append in one database transaction.

## Activation sequence

1. Keep all action flags closed.
2. Implement one command at a time with pure authorization and invariant tests.
3. Add append-only persistence and rollback-reviewed migrations without applying them.
4. Add API mutation handlers only after query visibility UAT passes.
5. Enable only in isolated staging for synthetic cases after separate approval.

Customer behavior, Production, pricing, payments, Stripe, Resend and existing application status flows are outside this design milestone.
