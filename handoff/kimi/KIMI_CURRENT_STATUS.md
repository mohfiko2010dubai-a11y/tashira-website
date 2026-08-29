# Kimi Current Status

Verified baseline: `4e0f520b72e047e590a646774576eec2614a2e22`
Staging deployed SHA: `4e0f520b72e047e590a646774576eec2614a2e22`
Difference: none.

## Implemented and visible

- Public Dynamic Application at `/apply`, including individual/family start, visa product selection and customer ownership bootstrap.
- Governed Dynamic Interview/resume routes for application-scoped acceptance.
- Staff login and Operations navigation/dashboard/case workspace.
- Applicant-isolated read model with applicants, relationships, evaluations, requirements, documents, family readiness, supplier identity (not cost) and timeline.
- Controlled Human Review, Document Review, assignment, status transitions and re-evaluation behind scoped flags.
- Secure document preview/download/upload controls and audit evidence.
- Visa delivery UI/API with ownership, security-scan, paid and issued-state gates.
- Manager finance-free metrics and team scoping.

## Backend complete but closed or provider-independent

- Official Rule Registry lifecycle, immutable evaluation snapshots and regulatory impact.
- Requirement/Question Catalog governance and dynamic projections.
- Document Intelligence provider adapter and passport-profile governance.
- Support Inbox, inbound mail normalization, Operations email queue, Supplier SLA, Typing Pack and authority query boundaries.
- Visa Assistant and authenticated case handoff.
- Refund/security-deposit persistence and controlled workflows.

These modules are not evidence of a connected external provider. Customer-facing and provider flags remain OFF except explicit synthetic application scopes.

## Mock/Test-only

- Synthetic rule/catalog fixtures and passport profiles.
- Stripe Test cards and PaymentIntents on Staging.
- Synthetic applicants/documents/cases used by E2E.
- Provider-neutral OCR/AI adapter without paid/live provider credentials.
- Mailbox, authority and supplier adapters without live external connection.

## Not complete / owner or external gate

- Production-grade official rule and requirement dataset activation.
- External OCR/AI provider selection, DPA/residency approval and credentials.
- Live inbound mailbox/provider, authority procedures and Typing Pack templates.
- Legal retention/deletion durations.
- Owner visual acceptance/change requests and explicit Production authorization.
- Country/nationality catalog is not yet governed as a standalone canonical import; do not invent it.

## Legacy Admin comparison

- Legacy `/admin/*` functionality is retained, not removed.
- The Operations workspace is the governed case-processing surface, but it does not duplicate every legacy finance/VAT/supplier configuration page.
- Keep finance/admin screens permission-separated; do not expose their fields merely to make the Operations UI look complete.

## Migrations and quality baseline

- Latest migration: `043_operations_permission_catalog.sql` with paired rollback.
- Production-readiness verifier: PASS for migration pairs `014`–`043`, clean tree and local/remote SHA match.
- Latest recorded full gates at this SHA: TypeScript PASS, ESLint PASS, 775 tests PASS / 26 environment-gated skips, client/static/server build PASS.
- Re-run all gates before accepting any new Kimi commit.

## Runtime state

- Staging: MySQL `tashira_staging`, PM2 `tashira-staging`, port `127.0.0.1:3002`, public health 200 at handoff.
- Production: read-only health 200 at handoff; no code/data/service change performed.
- Kimi server access: locked `kimi-deploy` account and read-only `kimi_staging` database user are prepared. The SSH account remains unusable until the owner installs Kimi's Ed25519 public key. There is no general shell, `sudo`, deployment, migration, document, Production or database-write permission.
