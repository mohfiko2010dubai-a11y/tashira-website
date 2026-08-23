# Eligibility Snapshots and Family Aggregation

Status: inactive Phase C/D domain foundation  
Feature flags: `VISA_RULES_EVALUATION`, `DYNAMIC_REQUIREMENTS`, and `FAMILY_ENGINE`, closed by default
Production impact: none

## Snapshot invariant

Every applicant evaluation has its own immutable ID, application/applicant ownership, timestamp, route, state, matched rule IDs and versions, source authorities, document requirements, warnings, manual-review reason, precedence trace, evaluator version and SHA-256 integrity reference.

A re-evaluation appends a new snapshot with a reason and optional superseded-evaluation reference. It never updates the old snapshot. Selecting the current approved evaluation is also an append-only event. Operations can therefore list history, identify changed fields and explain why a re-evaluation occurred.

The SHA-256 value is an integrity indicator, not proof of identity.

## Customer requirements

Customer-facing requirements are read from the selected current snapshot only. An unselected newer calculation cannot silently change the customer's requirement list.

## Regulatory impact

Current selections can be queried by matched stable rule ID to identify affected applications. Identifying an affected case does not run or select a new evaluation.

## Family invariant

- Exactly one lead applicant is required.
- Applicant IDs must be unique.
- Every member uses their independently selected current snapshot.
- Every document requirement remains tagged with applicant ID and evaluation ID.
- Rule versions may differ between family members.
- Missing current evaluations block aggregate readiness with human review.
- No member's rule or document set is copied into another member.

Aggregate eligibility fails safely in this order: `RULE_CONFLICT`, `HUMAN_REVIEW_REQUIRED`, `INELIGIBLE`, then `ELIGIBLE`.

## Family readiness contract

Eligibility and submission readiness are separate. Each applicant independently resolves to `READY`, `WAITING_FOR_DOCUMENTS`, `MANUAL_REVIEW_REQUIRED`, `NOT_ELIGIBLE`, `VISA_NOT_REQUIRED`, `VISA_ON_ARRIVAL`, or `CONDITIONAL`. Family readiness is never an average or percentage.

The family is `READY_FOR_SUBMISSION` only when every visa-requiring applicant is `READY`. Missing or unvalidated required documents, unresolved conditional requirements, rule conflicts, human review, route incompatibility, and ineligibility make the family `NOT_READY`. A legitimate `VISA_NOT_REQUIRED` or `VISA_ON_ARRIVAL` outcome remains visible but does not block other members.

The result identifies blocking applicant IDs and reasons, applicant-scoped customer actions, manual-review state, route warnings, and every member's evaluation ID. Requirement ownership mismatch is rejected rather than reassigned.

Migration `019` additively models append-only relationship events, evaluation-bound applicant requirement instances and events, and immutable family-readiness snapshots. It does not backfill or rewrite legacy applications. The legacy adapter selects the lowest applicant index as lead and labels every other relationship `OTHER`; it never guesses spouse/child relationships and emits an explicit review warning.

The inactive repository adapter follows the same event model: relationship corrections append revocation events, requirement progress appends chronological state events, and re-evaluation creates new evaluation-bound instances while preserving the old set. Reads require the application, applicant, and evaluation identity together.

## Current limitations

The repository implementations in this milestone are inactive domain contracts. SQL persistence contracts exist in migrations `017`–`019`, but no migration has been applied and no existing API/UI route uses them. Customer-facing dynamic behavior remains intentionally disabled.

The Operations-only canonical case read model and its future controlled-action design are documented in `OPERATIONS_READ_GATE_AND_ACTION_DESIGN.md`.
