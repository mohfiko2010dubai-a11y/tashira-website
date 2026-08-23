# TASHIRA Visa Operations OS V1 — Controlled Implementation Plan

Baseline: `21288ad37f00f6c1c1b4b7df03ddc6a99a8de959`  
Branch: `codex/visa-operations-os-v1`  
Mode: feature development and synthetic tests only; Production is frozen

## Architectural principles

1. Extend the existing tRPC/Drizzle application; do not rewrite it.
2. Put deterministic decisions in pure domain services with explicit inputs, outputs and version IDs.
3. Separate regulatory rules, commercial pricing and supplier finance into distinct domains.
4. Authorize every protected operation and every sensitive data projection server-side.
5. Store immutable snapshots/evidence for decisions applied to an application.
6. Default unknown, conflicting or unresearched profiles to human review.
7. Activate new behavior through reviewed feature flags, never merely by applying a migration.
8. Preserve all current Stripe, payment, invoice, Resend, pricing and document behavior.

## Proposed modules

- `api/lib/authorization/`: permission catalog, policy evaluator, resource scopes and safe projections.
- `api/lib/rules/`: typed rule model, precedence, effective-date resolver, conflict detection and import validation.
- `api/lib/eligibility/`: deterministic profile evaluation and evidence trace.
- `api/lib/family/`: relationship graph and per-applicant aggregation.
- `api/lib/requirements/`: dynamic questions, document requirements and readiness instances.
- `api/lib/document-review/`: provider-neutral AI adapter, normalized extraction, confidence and human review.
- `api/lib/operations/`: state registry, transition guard, assignment, queues, SLA and typing pack.
- `api/lib/suppliers/`: operational profile and separately authorized finance projections.
- `api/lib/support/`: durable conversations, outbound/inbound message records and assignment.
- `api/lib/regulatory/`: source snapshots, deterministic diffs, proposals and impact analysis.
- New tRPC routers should remain thin and delegate to these services.

## Migration sequence

Migration numbers are reserved after existing migration `013`; final names may be split to keep rollback and review manageable.

| Migration | Scope | Safety property |
| --- | --- | --- |
| 014 | identities, departments, teams, roles, permissions, grants, scopes, persisted sessions | additive; no existing staff privilege change until mapping is approved |
| 015 | durable audit events and feature flags | append-only audit; flags default OFF |
| 016 | rule sources, source snapshots, rule sets, rule versions, conditions, outcomes, overlays and approvals | imported versions default DRAFT |
| 017 | application rule snapshots, evaluation runs, applicant decisions and conflicts | no update to legacy applications unless evaluated explicitly |
| 018 | applicant relationships, dynamic question definitions/answers and requirement instances | legacy applicants/documents remain valid |
| 019 | document review jobs, extracted fields, evidence, confidence and reviewer decisions | AI result never changes eligibility directly |
| 020 | workflow states/transitions, case assignments, queue items, SLA and handovers | legacy status compatibility map retained |
| 021 | typing packs, authority submissions, queries and visa delivery records | no government automation |
| 022 | supplier services/routes/SLA/capacity and effective cost history | cost access isolated by permission and snapshot |
| 023 | support threads/messages/participants/assignments and delivery events | real inbound integration remains disabled |
| 024 | regulatory monitors/snapshots/change proposals/impact reviews | watcher cannot activate a rule |

Every migration receives a forward script, rollback strategy, disposable-DB verification and schema-contract tests. Production execution is out of scope.

## Phased delivery

### Phase B — Foundations

- Define permission catalog and policy engine.
- Add roles, custom roles, teams, departments and resource scopes.
- Create durable audit primitives and feature flags.
- Create Rule Registry/source/version/approval schema and typed import format.
- Build authorization tests before exposing new UI.

Exit gate: migrations pass on a disposable database; flags are OFF; existing flows pass unchanged; staff cannot self-elevate.

### Phase C — Rule and eligibility engine

- Deterministic matching by route/profile/effective date.
- Explicit source hierarchy, rule classification and overlay precedence.
- Conflict detection and `HUMAN_REVIEW_REQUIRED` fallback.
- Store complete evaluation trace and applied version IDs.
- Seed synthetic fixtures only; no fabricated official dataset.

Exit gate: exhaustive table-driven tests for known, unknown, expired and conflicting rules.

### Phase D — Family and dynamic requirements

- Add applicant relationship graph without replacing applicant slots.
- Evaluate each family member independently.
- Aggregate blocking requirements without overwriting member results.
- Generate questions and document requirements from the same engine.
- Map legacy fixed requirements through a compatibility adapter.

Exit gate: mixed-nationality synthetic families and cross-applicant isolation tests pass.

### Phase E — AI document review

- Provider-neutral adapter and disabled fallback.
- Classification/extraction with source evidence and confidence.
- Human-review queue for uncertain or contradictory output.
- PII-minimized storage, access and logs.

Exit gate: AI outage is non-blocking for human operations; AI cannot activate rules or decide eligibility.

### Phase F — Operations workflow

- Explicit state machine and prerequisite guards.
- Team/case assignment, queues, SLA risk and handover.
- Typing pack, submission record, authority queries and visa delivery.
- Legacy status mapping.

Exit gate: valid/invalid transition suite passes; submission requires an authorized record.

### Phase G — Suppliers and finance separation

- Operational supplier service/route/capacity model.
- Versioned effective cost history and immutable application snapshot.
- Separate operations-safe and finance-authorized API projections.
- Apply identical restrictions to exports, search and AI tools.

Exit gate: no supplier cost/margin appears for an operations-only identity at API, UI, export or AI layers.

### Phase H — Chatbot and customer portal

- Ground answers and Pre-Check in the active reviewed ruleset.
- Use authenticated case data only within customer ownership.
- Durable human handoff and escalation.
- Generate all requirement surfaces from one engine.

Exit gate: guarantee/government/unknown/cross-case safety prompts pass.

### Phase I — Email and support inbox

- Event-driven deduplicated notifications using the existing provider.
- Durable chat/email thread model and case linking.
- Synthetic inbound adapter first; real inbound write integration requires owner approval.
- Support queues, assignment and timeline evidence.

Exit gate: duplicate, failure, retry, scope and secret-leak tests pass.

### Phase J — Regulatory watcher

- Approved-source registry and snapshot adapter.
- Deterministic content fingerprint/diff.
- AI may summarize a diff, but output is always a proposal.
- Impact analysis and reviewer/owner alert.

Exit gate: no source change can modify an active rule automatically.

### Phase K — Management and analytics

- Rule Management, Regulatory Change Center, Role/Team Management and Support Center.
- Scoped employee/manager dashboards and Case Workspace.
- Pagination and permission-aware analytics.

Exit gate: UI contains no forbidden data in page payloads or client state.

### Phase L — Hardening

- Full RBAC, document, family, rules, state, supplier, chatbot, email and watcher suites.
- Disposable migration/rollback rehearsal.
- Performance, accessibility, observability and client-bundle secret scan.
- Regression suite for current customer, Stripe, invoice, Resend and document flows.

Exit gate: all quality gates green and a staging candidate report completed; no Production activity.

## Rule import and governance

The V1 import format will include stable identifiers, jurisdiction/route/profile, classification (`OFFICIAL`, `OPERATIONAL`, `CONDITIONAL`, `INTERNAL`), source URL/title/authority/retrieved timestamp/fingerprint, effective interval, conditions, outcomes, overlays, confidence and test fixtures. Import validates into DRAFT. Review creates an immutable version. Activation is a separate permissioned event and remains an owner gate for Production.

Unresearched coverage is represented explicitly as `NOT_RESEARCHED`; ambiguous profiles are `MANUAL_REVIEW_REQUIRED`. Neither AI nor seed code fills missing regulatory facts.

## RBAC model

Authorization input is `(actor, permission, resource, scope, context)`. Roles are bundles; grants are explicit and auditable. Scopes cover tenant, department, team, assigned case and own records. Deny is fail-closed. Sensitive finance and document permissions are independent.

Initial role templates:

- Operations Employee: assigned cases and allowed operational supplier identity; no cost/margin.
- Operations Manager: scoped assignment and performance; finance remains separate.
- Finance Manager: authorized finance/cost; no automatic document or operations access.
- Customer Service: scoped contact/status/conversations; no finance or authority action.
- Owner/Super Admin: configured permissions, not an unaudited bypass.
- AI Assistant: derives a capability set from the requesting actor; no independent privilege.

## State and evidence invariants

- Transitions are registry-defined and checked server-side.
- Application status history is append-only evidence.
- Applied rule/version and requirements are snapshotted per evaluation.
- Supplier cost changes do not rewrite application cost snapshots.
- Authority submission requires an authorized human record; portal automation is excluded.
- AI output records model/adapter metadata, evidence and confidence but cannot overwrite human history.

## Feature flags

Flags default OFF and may be scoped by environment, role/team and synthetic application. Planned flags include rules evaluation, dynamic requirements, AI review, operations state machine, support inbox and regulatory watcher. Stripe/payment/invoice flags are not part of this program.

## Test strategy

- Pure deterministic unit tests for permission, rules, eligibility, family aggregation and transitions.
- Repository/service integration tests against disposable MySQL.
- API projection tests proving forbidden fields are absent.
- Migration forward/rollback and legacy-row tests.
- Synthetic family/document/conversation fixtures without customer PII.
- Existing 50-file regression suite retained and expanded.
- Browser checks only after server-side authorization and API tests pass.
- No live email, Production data or real regulatory activation without explicit approval.

## Immediate Phase B slice

The safest first code milestone is:

1. permission catalog and pure policy evaluator;
2. additive RBAC/audit/feature-flag schema and migration tests;
3. Rule Registry typed model, DRAFT-only import validator and synthetic fixtures;
4. no UI and no active behavior switch until authorization tests pass.

## Estimates and approval gates

Current engineering estimate for full V1 branch implementation is approximately 90–130 focused hours, subject to disposable MySQL availability, AI provider choice, authoritative-rule research coverage and inbound-email provider decisions. This is not a completion guarantee.

Explicit owner approval remains required before Production deployment/migration, active Production rule import, real inbound email integration, Production role assignment, regulatory activation, destructive action, or any Stripe/Resend/payment change.
