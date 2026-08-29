# Kimi Visa Rules Engine

## Contract

The Rule Registry is a versioned evidence system, not a mutable lookup table. Rule sets have stable identities; every content change creates a version. Source snapshots, reviews, governance events, evaluation runs/matches/conflicts and current-selection events preserve history.

Lifecycle: `DRAFT → UNDER_REVIEW → APPROVED → ACTIVE → RETIRED`, with `REJECTED` where applicable. Imported rules cannot be directly ACTIVE. Published content and source snapshots are immutable; rollback means selecting/activating an approved version through governance, never rewriting evidence.

## Deterministic precedence

1. `BASE_ROUTE`
2. `NATIONALITY_OVERLAY`
3. `RESIDENCE_OVERLAY`
4. `GCC_OVERLAY`
5. `AGE_MINOR_OVERLAY`
6. `FAMILY_OVERLAY`
7. `TRAVEL_PARTY_OVERLAY`
8. `TICKET_TRAVEL_OVERLAY`
9. `SUBMISSION_TIMING_OVERLAY`
10. `OPERATIONAL_OVERLAY`

Official eligibility decisions may be refined only by later authoritative layers. Operational rules may add workflow guidance/requirements but cannot override official eligibility. Conflicting authoritative effects return `RULE_CONFLICT`; missing base evidence or unresolved profiles return `HUMAN_REVIEW_REQUIRED`.

Every result exposes matched rule IDs/versions, source authority, reasons, state, required/conditional documents and manual-review reason. Immutable applicant evaluation snapshots retain evaluator version, precedence trace and integrity evidence. Re-evaluation creates a new snapshot.

## Effective dates and source authority

- Effective intervals are explicit and overlap is rejected.
- Authority hierarchy: ICP, GDRFA, UAE Government Portal, other UAE government authority. Commercial/blog/forum/social sources cannot establish official eligibility.
- Retrieval snapshots retain timestamp, status and SHA-256 fingerprint.
- Official evidence register: `docs/OFFICIAL_VISA_RULE_RESEARCH_EVIDENCE.md`.

## Import, approval, activation and rollback

- Imports are schema validated and hashed.
- Separate `rule.propose`, `rule.review` and `rule.activate` permissions enforce separation of duties.
- Production activation is a separate owner gate.
- Regulatory updates identify affected active applications; they do not silently alter historical evaluations.

## Dynamic Form, documents and pricing

- Active approved rules drive questions and requirement instances per applicant through the governed Requirement Catalog.
- Shared documents require explicit family/travel scope and never leak between applicants.
- Pricing is server-authoritative but remains a separate governed engine/snapshot. Rule evidence must not silently change price.
- When evidence is incomplete, the Dynamic Form exposes safe questions/actions and routes to Human Review.

## AI boundary

AI/OCR may classify/extract/pre-screen/summarize. It cannot decide eligibility, activate a rule, approve a document, submit to government or infer unsupported identity/relationship facts.

## Current dataset state

- Staging contains Rule Registry/source/review records for synthetic/research acceptance.
- The official research register is `RESEARCH_EVIDENCE_ONLY` and activation is not authorized.
- Generic requirement/question definitions are DRAFT unless separately governed.
- Production rules/flags are unchanged and OFF.
- Detailed documented evidence is exported in `exports/visa-rules.json`; it is not an activation payload.
