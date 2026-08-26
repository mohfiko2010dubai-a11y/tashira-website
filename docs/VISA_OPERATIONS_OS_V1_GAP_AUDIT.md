# Visa Operations OS V1 — Master-Scope Gap Audit

Verified baseline: feature branch `codex/visa-operations-os-v1`, Staging Step 3. This matrix reports implemented evidence honestly; provider contracts are not classified as live integrations.

| Module | State | Tested | Staging verified | Remaining V1 work |
|---|---|---:|---:|---|
| Visa Rule Registry | DONE | Yes | Schema/runtime | Populate only reviewed official rules |
| Eligibility Engine / precedence | DONE | Yes | Persistence | Real rule content remains human-approved |
| Immutable evaluations | DONE | Yes | Yes | None in engineering scope |
| Family Engine / readiness | DONE | Yes | Read Model | Customer activation remains off |
| Dynamic Questions / Requirements / Documents | PARTIAL | Yes | Persistence | Customer review UI and deterministic plan complete behind closed flags; approved production catalogs/runtime wiring remain |
| AI Document Pre-Screening | EXTERNAL DEPENDENCY | Yes | No | Provider-independent classification/extraction validation is complete; live AI provider credentials/adapter remain, human remains final authority |
| Human / Document Review | DONE | Yes | Persistent MySQL | Restricted pilot/UAT only |
| Assignment / State Machine / Re-evaluation | DONE | Yes | Persistent MySQL | Restricted pilot/UAT only |
| Typing Pack | PARTIAL | Yes | No | Integrity-bound draft framework complete behind a closed flag; owner-approved templates/output renderer remain |
| Authority Query Workflow | PARTIAL | Yes | No | Deterministic append-only lifecycle complete behind a closed flag; authority-specific submission adapter/procedure remain |
| Visa Delivery Workflow | PARTIAL | Yes | Existing statuses | Authorized ownership/scan-gated delivery package complete behind a closed flag; secure runtime adapter/UAT remain |
| Supplier Management | PARTIAL | Existing app | Read-only identity | Operations-specific SLA/escalation controls |
| Supplier Cost / Finance Separation | DONE | Yes | Yes | Finance-only activation review |
| Effective Cost History | PARTIAL | Existing snapshots | No | Finance policy and supplier-cost history integration |
| Multi-Team RBAC | DONE | Yes | Yes | Production grants require owner approval |
| Audit Trail | DONE | Yes | Yes | Monitoring/retention decision |
| Operations Dashboard / Manager Dashboard | PARTIAL | Yes | Case workspace only | Finance-free deterministic manager aggregates complete; persistent read provider and dashboard UI remain |
| Case Workspace | DONE | Yes | Yes | Controlled UI browser sign-off |
| Customer Pre-Check | PARTIAL | Yes | No | Safe guidance contract and rate-limited Active/validated/source-verified MySQL runtime API are complete behind a closed flag; approved rules dataset, progressive UI and scoped Staging UAT remain |
| Trust Center | PARTIAL | Existing legal UI | Existing app | Final legal owner review |
| Customer Portal Timeline | PARTIAL | Yes | Existing timeline | Canonical finance-free portal projection, UI and authenticated application-scoped read-only runtime API complete behind a closed flag; customer route registration and scoped Staging UAT remain |
| Visa Assistant | PARTIAL | Yes | No | Evidence-priority grounding supports authenticated applicant/travel/scheduler/document answers; runtime adapter and approved knowledge content remain |
| Authenticated Case Chat / Handoff | PARTIAL | Yes | Existing app | Audited handoff payload and triggers complete; runtime conversation adapter remains |
| Email Automation | PARTIAL | Yes | Existing app | Complete canonical V1 event/dedup ledger exists; persistent runtime/provider dispatch remains |
| Inbound Email / Employee Reply | PARTIAL | Contract only | No | Mailbox/provider credentials and adapter |
| Support Inbox | PARTIAL | Yes | No | Unified thread state/concurrency/idempotency/internal-note workflow complete; persistent store, API and UI remain |
| Regulatory Watcher / Change Center | PARTIAL | Yes | No | Controlled review/impact model complete and cannot auto-activate; official-source connector, persistence and authorized UI remain |
| Feature Flags | DONE | Yes | Yes | Production activation is a separate owner gate |
| Legacy Compatibility | DONE | Yes | Yes | Explicit re-evaluation only |
| Operations Analytics | PARTIAL | Yes | No | Finance-free workload, SLA, turnaround, rework and supplier operational aggregates complete; persistent provider/UI and owner KPI thresholds remain |

## Honest completion

Core case-operations foundation is approximately **78% complete**. Full Master Program V1 is approximately **61% complete** because customer-facing, supplier/authority, support-provider, analytics and approved regulatory content remain incomplete. No percentage includes Production activation.

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
