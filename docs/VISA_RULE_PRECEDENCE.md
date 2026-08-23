# TASHIRA Visa Rule Precedence and Conflict Contract

Status: Phase C deterministic domain contract  
Activation: inactive; not connected to current customer flows  
Production impact: none

## Precedence

Matching rules are evaluated in this exact order:

1. `BASE_ROUTE`
2. `NATIONALITY_OVERLAY`
3. `RESIDENCE_OVERLAY`
4. `GCC_OVERLAY`
5. `AGE_MINOR_OVERLAY`
6. `FAMILY_OVERLAY`
7. `OPERATIONAL_OVERLAY`

Later matching official overlays refine earlier official decisions. Input/database order never controls the result: rules are sorted by layer, stable rule ID and version before evaluation and evidence output.

## Authority boundary

Only `OFFICIAL` rules may decide eligibility. `OPERATIONAL`, `CONDITIONAL` and `INTERNAL` rules may add requirements or conditional documents, but their eligibility effect must be `NO_CHANGE`. An active non-official rule attempting to decide eligibility produces `RULE_CONFLICT`; it is never ignored or allowed to override an official result.

## Conflict boundary

The engine returns `RULE_CONFLICT` and requires human review when:

- matching official rules at the same precedence layer produce different eligibility states;
- more than one version of the same stable rule is effective for the evaluation time;
- a non-official rule attempts to change eligibility.

The engine does not silently choose a source, authority, version or rule in these cases. Required and conditional documents are additive in V1; document-removal semantics are intentionally not supported until an explicit conflict-safe model is reviewed.

## Unresolved profiles

If no researched base-route rule matches, the result is `HUMAN_REVIEW_REQUIRED` with reason `UNRESOLVED_PROFILE`. If matched rules contain no official eligibility decision, the result is also human review with reason `NO_AUTHORITATIVE_DECISION`. Missing regulatory coverage is never inferred by AI or application defaults.

## Evidence output

Every result includes:

- matched stable rule IDs;
- matched rule ID/version pairs;
- source authorities;
- per-rule layer, classification, authority and reason;
- final eligibility state;
- deciding reason;
- deduplicated required documents;
- deduplicated conditional documents and their reasons;
- manual-review reason where applicable.

## Effective dates

Rules match only when `effectiveFrom <= evaluatedAt < effectiveTo`, or indefinitely when `effectiveTo` is null. Overlapping effective versions of the same rule fail as a conflict.

## Current limitation

This milestone uses synthetic fixtures only and does not claim validated regulatory coverage. It is a pure service contract and is not connected to forms, chatbot, payment readiness, application status, Production data or active Rule Registry rows.
