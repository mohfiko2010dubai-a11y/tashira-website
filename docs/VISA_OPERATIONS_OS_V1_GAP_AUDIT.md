# Visa Operations OS V1 — Master-Scope Gap Audit

Verified baseline: feature branch `codex/visa-operations-os-v1`, Staging Step 3. This matrix reports implemented evidence honestly; provider contracts are not classified as live integrations.

| Module | State | Tested | Staging verified | Remaining V1 work |
|---|---|---:|---:|---|
| Visa Rule Registry | DONE (governance/runtime/read model) | Yes | Migrations 040–041 + RBAC API/MySQL/read-only UI E2E | Populate reviewed official content and record explicit source approvals; the API/runtime never implicitly trusts a source and no Staging source is currently approved |
| Eligibility Engine / precedence | DONE | Yes | Persistence | Real rule content remains human-approved |
| Immutable evaluations | DONE | Yes | Yes | None in engineering scope |
| Family Engine / readiness | DONE | Yes | Read Model | Customer activation remains off |
| Dynamic Questions / Requirements / Documents | DONE | Yes | API/MySQL scoped E2E | Unified applicant-scoped interview, immutable evaluations, dynamic requirements and owned document upload/link are complete behind closed flags. Explicit start/resume/current-question/eligibility/requirements/upload/scheduler/review API operations are thin projections over the same canonical persisted state and inherit the same ownership gate; approved Production catalog content and activation remain owner gates |
| AI Document Pre-Screening | EXTERNAL DEPENDENCY | Yes | No | Provider-independent classification/extraction validation is complete; live AI provider credentials/adapter remain, human remains final authority |
| Human / Document Review | DONE | Yes | Persistent MySQL | Restricted pilot/UAT only |
| Assignment / State Machine / Re-evaluation | DONE | Yes | Persistent MySQL | Restricted pilot/UAT only |
| Typing Pack | PARTIAL | Yes | Staging scoped E2E | Immutable template/evaluation-bound MySQL persistence, RBAC API and replay-safe generation are complete behind an OFF flag; owner-approved templates/output renderer remain |
| Authority Query Workflow | PARTIAL | Yes | Staging scoped E2E | Scoped optimistic MySQL lifecycle, append-only events/audit and safe-reference gate are complete behind an OFF flag; authority-specific submission adapter/procedure remain |
| Visa Delivery Workflow | COMPLETE (provider-independent) | Yes | Migration 035 + MySQL runtime | Immutable scan evidence, applicant-owned delivery persistence, RBAC preparation, customer-session access and signed-download Staging E2E complete behind a closed flag; selecting and connecting a real malware-scanning provider remains an external owner gate |
| Supplier Management | PARTIAL | Yes | Staging scoped E2E | Finance-free SLA policies/snapshots, queue, RBAC API/UI, concurrency, escalation and audit are complete behind an OFF flag; approved business policy values and external supplier integration remain |
| Supplier Cost / Finance Separation | DONE | Yes | Yes | Finance-only activation review |
| Effective Cost History | PARTIAL | Existing snapshots | No | Finance policy and supplier-cost history integration |
| Multi-Team RBAC | DONE | Yes | Yes | Production grants require owner approval |
| Audit Trail | DONE | Yes | Yes | Monitoring/retention decision |
| Operations Dashboard / Manager Dashboard | DONE | Yes | API/MySQL scoped E2E | Finance-free persistent aggregates, manager-only scoped API and protected dashboard UI are complete; final human browser sign-off remains tool-blocked |
| Case Workspace | DONE | Yes | Yes | Controlled UI browser sign-off |
| Customer Pre-Check | COMPLETE (provider-independent) | Yes | Staging scoped E2E | Safe guidance contract, rate-limited Active/validated/source-verified MySQL runtime API and responsive public UI are complete behind a closed flag; approved Production rules dataset and activation remain owner gates |
| Trust Center | PARTIAL | Existing legal UI | Existing app | Final legal owner review |
| Customer Portal Timeline | DONE | Yes | Staging scoped E2E | Canonical finance-free portal projection, registered customer route and authenticated application-scoped read-only runtime API are complete behind a closed flag; Production activation remains an owner gate |
| Visa Assistant | COMPLETE (provider-independent) | Yes | Staging scoped E2E | Authenticated application-owned runtime reuses the canonical MySQL case bundle and finance-minimized portal projection for status, requirements, travel, submission and document answers; unknown knowledge fails closed to human review. Approved knowledge content/provider and Production activation remain owner gates |
| Authenticated Case Chat / Handoff | COMPLETE (provider-independent) | Yes | Staging scoped E2E | Owned customer runtime reuses the canonical case bundle, assistant grounding and Support Inbox persistence; team/current-evaluation fail-closed gates, transactionality, replay/conflict handling and append-only audit are verified. External provider messaging remains deliberately absent |
| Email Automation | PERSISTENCE COMPLETE | Yes | Migration 036 + Staging scoped E2E | Immutable timeline-owned dispatch queue, recipient-hash minimization, append-only delivery evidence, replay/conflict behavior and provider-ledger isolation are complete behind an OFF flag. Approved trigger/template policy and external provider dispatch remain owner gates; no email was sent |
| Inbound Email / Employee Reply | PARTIAL | Contract only | No | Mailbox/provider credentials and adapter |
| Support Inbox | PARTIAL | Yes | Staging MySQL runtime verified | Persistent team-scoped store, RBAC API, internal UI, concurrency, idempotency and append-only messages/notes/audit are deployed on Staging behind an OFF flag; real Staging repository integration passes, while browser sign-off and the external mailbox provider remain |
| Regulatory Watcher / Change Center | PARTIAL | Yes | Staging scoped E2E | Immutable proposal/impact and Rule Registry lifecycle persistence, explicit RBAC APIs and a read-only lifecycle/source-evidence UI are complete behind an OFF flag and cannot auto-activate; official-source connector and approved content remain |
| Feature Flags | DONE | Yes | Yes | Production activation is a separate owner gate |
| Legacy Compatibility | DONE | Yes | Yes | Explicit re-evaluation only |
| Operations Analytics | DONE | Yes | API/MySQL scoped E2E | Finance-free workload, readiness, schedule, rework and supplier operational aggregates are live on isolated Staging; owner KPI thresholds remain a future tuning input |

## Honest completion

Core case-operations foundation is approximately **91% complete**. Full Master Program V1 is approximately **73% complete** because external supplier/authority, AI/mailbox providers, approved policy/rule/template content, final human browser acceptance and Production activation remain incomplete. No percentage includes Production activation.

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
- Operations email trigger/template matrix, provider-dispatch authorization and inbound mailbox/provider credentials. The current work authorization forbids Resend changes or real-customer delivery.
- Authority submission/query/delivery operating procedure.
- Typing Pack templates and accepted output format.
- Finance-approved effective supplier-cost history policy and access/activation review.
- Operations KPI definitions, retention period, Trust Center wording and legal review.
- Human interactive browser acceptance for the protected Operations UI; the desktop Browser plugin remains blocked by its trusted-path failure.
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
- Persistent catalog import/review governance, the authenticated Dynamic Application route, application-scoped synthetic fixtures/flags and API/MySQL E2E scenarios are complete. The explicit read-contract E2E at Staging SHA `5afea33e9e8bdf54e417c0b54f4f383e6659e55c` passed all projections, ownership and finance isolation; all customer scopes returned OFF. Remaining gaps are the provider/external-data, approved-content, interactive-browser and Production owner gates listed above.
