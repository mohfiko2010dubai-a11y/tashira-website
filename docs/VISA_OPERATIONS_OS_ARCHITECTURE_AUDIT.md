# TASHIRA Visa Operations OS V1 — Architecture Audit

Status: Phase A discovery complete  
Audit baseline: `21288ad37f00f6c1c1b4b7df03ddc6a99a8de959`  
Feature branch: `codex/visa-operations-os-v1`  
Production impact: none

## Executive conclusion

TASHIRA is an established React/Vite, Hono/tRPC, Drizzle and MySQL application. It already has reusable foundations for applications, multiple applicants, applicant-owned documents, payment and invoice evidence, customer recovery, timelines, suppliers, pricing snapshots, refunds and security deposits. The Operations OS must extend these foundations; a rewrite would add risk and break the existing customer, payment and evidence flows.

The main architectural gap is not basic application intake. It is the lack of a versioned visa-rules domain, deterministic eligibility and requirement engines, enterprise RBAC and scoped work management. Current authorization distinguishes administrator, staff and customer access, but staff are effectively homogeneous. Current application status changes are a short enum with a payment gate, not a complete transition model. Supplier identity and confidential finance data are carried through some of the same application responses and UI views, so the requested Operations/Finance separation must be enforced server-side before new operational interfaces are built.

## Current architecture

### Runtime and delivery

- Client: React 19, React Router 6, Vite and TypeScript.
- API: Hono hosts tRPC routers and direct HTTP endpoints.
- Persistence: MySQL through Drizzle ORM.
- Documents: server filesystem, defaulting to `/var/www/tashira/storage/documents`; signed HMAC URLs expire after 15 minutes. Supabase code remains legacy and is not the active production assumption.
- Payments: Stripe PaymentIntents and signed webhook processing with durable event claims.
- Email: provider-neutral transactional interface with Resend adapter, environment-specific recipient restrictions and append-oriented delivery evidence.
- Deployment: a manual GitHub Actions production workflow requires an exact main SHA, protected environment, verified backup/migrations, pinned SSH host identity and explicit PRELIVE/LIVE mode. This program does not modify or invoke it.
- CI: non-deploying checks on review branches and pull requests run `npm ci`, TypeScript, lint, tests and build.

### API composition

The root router currently exposes authentication, applications, payments, chat, wizard, drive, invoices, suppliers, staff, storage, documents, timeline, business, retention, risk, recovery, refunds and security deposits. This is a usable modular boundary. New Operations OS domains should be added as routers and services rather than expanding the already-large application router.

### Existing data model that can be reused

- `applications`: customer contact, service selection, aggregate prices, supplier fields, operational/payment states and LIVE/TEST classification.
- `applicants`: stable application ownership and a unique `(application_id, applicant_index)` slot.
- `documents`: application and applicant ownership, type, storage metadata and lifecycle status.
- `application_timeline_events`: immutable-style event ID, source, actor, state and evidence metadata.
- `pricing_rules` and `application_price_snapshots`: versioned commercial pricing and immutable application quote snapshots. These are not visa eligibility rules.
- `payments`, `invoices`, `stripe_webhook_events`, `financial_events`: payment and evidence boundaries that must remain unchanged.
- `suppliers`: basic supplier directory; costs currently also live on the application and pricing snapshot.
- `staff_users`: credentials and active state, but no roles, teams, departments, scopes or permissions.
- retention, legal hold, recovery, email, refund and security-deposit tables: mature adjacent controls that should remain isolated from the Operations OS migrations.

## Capability findings

| Domain | Current state | Reuse | Material gap |
| --- | --- | --- | --- |
| Multi-applicant intake | Stable applicant IDs and unique slots | High | No relationship graph or per-applicant rule evaluation |
| Document ownership | Application/applicant ownership and signed access | High | Fixed document taxonomy; no rule-derived requirement instance or AI review record |
| Customer resume | Signed customer capability and recovery | High | Resume is not driven by dynamic rule/form state |
| Timeline/evidence | Application, document, payment and finance evidence | High | No general enterprise audit ledger for RBAC/rules/assignment/read access |
| Pricing | Server-authoritative and versioned | High | Must remain separate from regulatory rule registry |
| Eligibility | Readiness/payment checks only | Medium | No deterministic route/profile engine, overlays, conflicts or rule snapshot |
| Workflow | Short application status enum and payment gate | Medium | No explicit transition registry, queues, assignment, SLA, handover or submission record |
| Staff authorization | Admin cookie and staff token | Medium | No enterprise RBAC, scopes, separation of duties or revocable persisted sessions |
| Suppliers | Basic directory, assignment and VAT/cost fields | Medium | Operations and confidential finance projections are not strongly separated |
| Chatbot | Intake, family slots, quote and admin conversations | Medium | Some in-memory session state; no shared visa rules grounding or scoped employee AI tools |
| Email | Outbound provider abstraction, idempotency and evidence | High | No inbound email ingestion, thread/case assignment or support queue |
| Regulatory change | None | Low | No monitored sources, snapshots, proposals, impact analysis or approval workflow |
| Feature flags | None found | Low | No environment/scope-aware activation control |
| AI document review | None found | Low | Requires adapter, evidence, confidence and mandatory human-review boundary |

## Security findings

### Authorization

- `adminQuery` grants all administrator procedures after a signed admin session.
- `staffOrAdminQuery` grants the same procedure to any active staff session; it does not evaluate role, team, department, case assignment or resource scope.
- Staff session identity is conveyed from browser local storage through `x-staff-token`; server verification checks an in-memory session and active staff row. Enterprise work requires persisted, revocable sessions and server-side permission evaluation.
- UI guards are navigation conveniences only. New authorization must be enforced in API and service layers, with projections that omit forbidden fields.
- The current console audit logger records a small fixed set of events. It is useful for safe operational logs, but not a durable auditable authorization ledger.

### Supplier/finance isolation

Application detail/list responses can include supplier records and application-level cost, VAT, invoice and margin-related fields. Operations pages also calculate profit in the client. Merely hiding widgets would be insufficient because forbidden values could remain in the response or frontend state. V1 needs explicit operations-safe and finance-authorized DTOs, permission-aware exports/search, and service-level field selection.

### Documents and privacy

The active filesystem adapter prevents traversal and uses signed expiring URLs. Document APIs already enforce customer ownership or privileged access and preserve lifecycle evidence. New team scoping and requirement/AI metadata must not weaken those controls. Extracted passport fields must be minimized, access-controlled and excluded from general logs and list views.

### Chat and email

Chat application flow holds session state in a process-local map, which is unsuitable for durable handoff or multiple runtime processes. Existing conversation rows provide a migration path. The outbound email adapter and evidence model are reusable, but real inbound email integration is an owner gate. No secret, passport attachment or unrestricted document URL may enter support messages.

### Regulatory and AI safety

No current subsystem should be treated as authoritative regulatory data. Generative AI may classify, extract, summarize and explain, but eligibility, requirements, permissions, state transitions and finance visibility must stay deterministic. Unknown, conflicting, expired or low-confidence rule matches must produce `HUMAN_REVIEW_REQUIRED`, never a guessed answer.

## Legacy compatibility constraints

1. Existing application, applicant, payment, invoice, Stripe, email and document rows remain valid without backfill that changes meaning.
2. Existing status values continue to render and operate through an explicit compatibility mapping.
3. New rule evaluation is opt-in behind feature flags; no active customer behavior changes by migration alone.
4. Existing price rules are not repurposed as visa rules.
5. Existing documents remain accessible under their current ownership and signing rules.
6. New migrations are additive, reversible where practical and never applied to Production in this program.
7. No regulatory record becomes active from an import, crawler or AI output without review and authorization.

## Threat model priorities

1. Unauthorized supplier cost or margin disclosure through API, export, search, browser state or AI tools.
2. Cross-team or cross-applicant document access.
3. Privilege escalation through self-assigned roles or over-broad manager permissions.
4. Rules tampering, silent activation, ambiguous precedence or history rewriting.
5. AI hallucination presented as official eligibility guidance.
6. Invalid workflow transitions or authority submission without an authorized record.
7. PII leakage in logs, email, analytics or large list payloads.
8. Duplicate outbound messages or unlinked inbound replies.
9. Regulatory watcher changing active rules automatically.
10. Migration or feature activation changing existing customer/payment behavior.

## Audit evidence

- Schema audit: `db/schema.ts` and migrations `003`–`013`.
- API/auth audit: `api/router.ts`, `api/middleware.ts`, `api/context.ts`, `api/auth-router.ts`, `api/staff-router.ts`.
- Customer/admin routes: `src/App.tsx` and existing guards.
- Storage: `api/lib/local-storage.ts`, storage/document routers and tests.
- Email: provider, renderer, Resend adapter and outbound evidence paths.
- Workflow: application router, processing gate and wizard router.
- Supplier/finance: supplier, application and business routers plus admin supplier/finance views.
- Delivery: CI and manual production workflow, inspected only.
- Test baseline: 50 TypeScript test files covering existing payment, document, session, email, pricing, refund/deposit and deployment safety boundaries.

## Phase A decision

Proceed with an additive modular architecture. Phase B should implement only the authorization/audit/feature-flag and Rule Registry foundations, with no active customer rule evaluation. Production activation, Production migrations, real inbound email, live rule imports and role assignment remain explicit owner gates.
