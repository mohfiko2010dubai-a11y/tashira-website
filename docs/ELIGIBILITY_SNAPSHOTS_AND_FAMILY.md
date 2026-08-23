# Eligibility Snapshots and Family Aggregation

Status: inactive Phase C/D domain foundation  
Feature flag: `VISA_RULES_EVALUATION`, closed by default  
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

Aggregate state fails safely in this order: `RULE_CONFLICT`, `HUMAN_REVIEW_REQUIRED`, `INELIGIBLE`, then `ELIGIBLE`.

## Current limitations

The repository implementations in this milestone are in-memory domain test adapters. SQL persistence contracts exist in migrations `017` and `018`, but no migration has been applied and no existing API/UI route uses them. Relationship graphs and dynamic question/requirement persistence are the next Phase D slice.
