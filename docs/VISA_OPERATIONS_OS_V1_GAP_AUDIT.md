# Visa Operations OS V1 — Master-Scope Gap Audit

Verified baseline: feature branch `codex/visa-operations-os-v1`, Staging Step 3. This matrix reports implemented evidence honestly; provider contracts are not classified as live integrations.

| Module | State | Tested | Staging verified | Remaining V1 work |
|---|---|---:|---:|---|
| Visa Rule Registry | DONE | Yes | Schema/runtime | Populate only reviewed official rules |
| Eligibility Engine / precedence | DONE | Yes | Persistence | Real rule content remains human-approved |
| Immutable evaluations | DONE | Yes | Yes | None in engineering scope |
| Family Engine / readiness | DONE | Yes | Read Model | Customer activation remains off |
| Dynamic Questions / Requirements / Documents | DONE | Yes | API/MySQL scoped E2E | Unified applicant-scoped interview, immutable evaluations, dynamic requirements and owned document upload/link are complete behind closed flags; approved Production catalog content and activation remain owner gates |
| AI Document Pre-Screening | EXTERNAL DEPENDENCY | Yes | No | Provider-independent classification/extraction validation is complete; live AI provider credentials/adapter remain, human remains final authority |
| Human / Document Review | DONE | Yes | Persistent MySQL | Restricted pilot/UAT only |
| Assignment / State Machine / Re-evaluation | DONE | Yes | Persistent MySQL | Restricted pilot/UAT only |
| Typing Pack | PARTIAL | Yes | Staging scoped E2E | Immutable template/evaluation-bound MySQL persistence, RBAC API and replay-safe generation are complete behind an OFF flag; owner-approved templates/output renderer remain |
| Authority Query Workflow | PARTIAL | Yes | Staging scoped E2E | Scoped optimistic MySQL lifecycle, append-only events/audit and safe-reference gate are complete behind an OFF flag; authority-specific submission adapter/procedure remain |
| Visa Delivery Workflow | PARTIAL | Yes | Existing statuses | Authorized ownership/scan-gated delivery package complete behind a closed flag; secure runtime adapter/UAT remain |
| Supplier Management | PARTIAL | Yes | Staging scoped E2E | Finance-free SLA policies/snapshots, queue, RBAC API/UI, concurrency, escalation and audit are complete behind an OFF flag; approved business policy values and external supplier integration remain |
| Supplier Cost / Finance Separation | DONE | Yes | Yes | Finance-only activation review |
| Effective Cost History | PARTIAL | Existing snapshots | No | Finance policy and supplier-cost history integration |
| Multi-Team RBAC | DONE | Yes | Yes | Production grants require owner approval |
| Audit Trail | DONE | Yes | Yes | Monitoring/retention decision |
| Operations Dashboard / Manager Dashboard | DONE | Yes | API/MySQL scoped E2E | Finance-free persistent aggregates, manager-only scoped API and protected dashboard UI are complete; final human browser sign-off remains tool-blocked |
| Case Workspace | DONE | Yes | Yes | Controlled UI browser sign-off |
| Customer Pre-Check | PARTIAL | Yes | No | Safe guidance contract and rate-limited Active/validated/source-verified MySQL runtime API are complete behind a closed flag; approved rules dataset, progressive UI and scoped Staging UAT remain |
| Trust Center | PARTIAL | Existing legal UI | Existing app | Final legal owner review |
| Customer Portal Timeline | PARTIAL | Yes | Existing timeline | Canonical finance-free portal projection, UI and authenticated application-scoped read-only runtime API complete behind a closed flag; customer route registration and scoped Staging UAT remain |
| Visa Assistant | PARTIAL | Yes | No | Evidence-priority grounding supports authenticated applicant/travel/scheduler/document answers; runtime adapter and approved knowledge content remain |
| Authenticated Case Chat / Handoff | PARTIAL | Yes | Existing app | Audited handoff payload and triggers complete; runtime conversation adapter remains |
| Email Automation | PARTIAL | Yes | Existing app | Complete canonical V1 event/dedup ledger exists; persistent runtime/provider dispatch remains |
| Inbound Email / Employee Reply | PARTIAL | Contract only | No | Mailbox/provider credentials and adapter |
| Support Inbox | PARTIAL | Yes | Staging MySQL runtime verified | Persistent team-scoped store, RBAC API, internal UI, concurrency, idempotency and append-only messages/notes/audit are deployed on Staging behind an OFF flag; real Staging repository integration passes, while browser sign-off and the external mailbox provider remain |
| Regulatory Watcher / Change Center | PARTIAL | Yes | Staging scoped E2E | Immutable proposal/impact persistence, explicit RBAC review API and internal UI are complete behind an OFF flag and cannot auto-activate; official-source connector and approved content remain |
| Feature Flags | DONE | Yes | Yes | Production activation is a separate owner gate |
| Legacy Compatibility | DONE | Yes | Yes | Explicit re-evaluation only |
| Operations Analytics | DONE | Yes | API/MySQL scoped E2E | Finance-free workload, readiness, schedule, rework and supplier operational aggregates are live on isolated Staging; owner KPI thresholds remain a future tuning input |

## Honest completion

Core case-operations foundation is approximately **85% complete**. Full Master Program V1 is approximately **68% complete** because external supplier/authority, AI/support providers, approved policy/rule content and Production activation remain incomplete. No percentage includes Production activation.

## Unified Interview runtime update — 2026-08-26

- Exact Staging runtime SHA: `e0a2aa5fe574033651b1bbd784251d36d8839ce9`.
- Migrations `029` and `030` are applied only to isolated Staging. Migration `030` preserves legitimate repeated answers as predecessor-linked immutable transitions.
- Scoped synthetic E2E passed authorization, applicant isolation, owned document upload/link, readiness transition, idempotency, cross-application denial and finance isolation.
- All GLOBAL/APPLICATION customer flags returned to OFF. Browser UI E2E remains blocked by the desktop Browser plugin before tab creation; API/MySQL E2E is complete.
- Verified pre-`030` backup: `/var/backups/tashira-staging/20260826T152550Z-answer-transitions-030-predeploy`.

## Operations Manager analytics update — 2026-08-26

- Exact Staging runtime SHA: `83a03203287a27c3f34b908a51853ac12db476c3`.
- Team-scoped manager API E2E passed exact scope aggregation, manager permission, employee/anonymous denial, finance non-disclosure and direct SPA route/static-asset verification.
- Protected counts and document metadata fingerprint remained unchanged; temporary staff identities and grants were removed.
- Existing Staging feature scopes were preserved. No customer-facing feature was activated.
- Verified runtime-config rollback evidence: `/var/backups/tashira-staging/20260826T154653Z-manager-dashboard-predeploy`.

## External or owner dependencies

- Official, reviewed Visa Rule Registry content and activation approvals.
- AI/OCR provider credentials and data-processing approval.
- Inbound mailbox/provider credentials.
- Authority submission/query/delivery operating procedure.
- Typing Pack templates and accepted output format.
- Operations KPI definitions, retention period and legal review.
- Separate approval for Production migration/deployment/flags.
# Requirement Catalog and Dynamic Runtime Update — 2026-08-26

- Persistent versioned Requirement and Question Catalog: implemented in additive Migration `026`.
- Governance: ACTIVE + APPROVED + effective definitions only; overlapping active versions fail closed.
- Historical evidence: requirement instances may retain exact definition/rule versions and immutable reason/classification snapshots; legacy raw codes remain readable without fabricated labels.
- Customer projection: INTERNAL definitions are excluded, OPERATIONAL wording is never represented as an authority mandate, and missing definitions force human review.
- Generic seed: deterministic DRAFT-only definitions for 12 documents and 12 question domains; it activates no requirement.
- Dynamic Application runtime: governed catalog projection, applicant isolation, travel/family sharing metadata, scheduler passthrough and Pre-Check/final-rule change evidence are complete behind closed flags.
- Local evidence: MySQL 8.4 clean/legacy migrations `014`–`026`, ESLint, TypeScript, 491 tests, production build, static assets and server bundle pass.
- Staging: verified root-only backup created; Migration `026` applied to `tashira_staging`; exact SHA `d0f91508b25a5d5b4fb320630c841fc7f58a1bc7` deployed healthy with protected counts unchanged.
- Activation remains closed: catalog tables contain no governed APPROVED definitions yet, Dynamic Requirements is globally OFF, and no customer Pre-Check/Dynamic Application/Portal scope is enabled. Synthetic activation must wait for the persistent import/review path plus an authenticated Dynamic Application API route; activating empty/incomplete runtime would fail the safety contract.
- Remaining: persistent catalog import/review API, authenticated Dynamic Application route, application-scoped synthetic seed/flags and E2E scenarios, then the remaining provider/external-data Final V1 gaps.
