# Known issues

These findings come from static repository analysis. “Production verification required” distinguishes source evidence from verified runtime behavior.

| ID | Severity | Area | Description | Evidence/source | Production verification required | Proposed action | Status |
|---|---|---|---|---|---|---|---|
| SEC-001 | Critical | Authorization | Sensitive administrative and PII procedures use public tRPC procedures. | `api/*-router.ts`, `api/middleware.ts` | Yes | Deny by default; add role/ownership middleware. | Open |
| SEC-002 | Critical | Admin auth | Admin authentication is browser-side with a fallback password and localStorage flag. | `src/hooks/useAdminAuth.ts` | Yes | Replace with server authentication and secure sessions. | Open |
| SEC-003 | High | Staff auth | Fixed-salt SHA-256, in-memory sessions, weak minimum passwords, public staff management. | `api/staff-router.ts` | Yes | Argon2id/bcrypt, revocable sessions, protected procedures. | Open |
| PAY-001 | Critical | Stripe | Browser supplies amount and confirmation is not verified against Stripe. | `api/payment-router.ts`, payment UI | Yes | Server pricing, signed webhooks, idempotent transaction. | Open |
| PAY-002 | High | Stripe | No Stripe webhook handler found. | API inventory | Yes | Implement signed, replay-safe webhook flow. | Open |
| DB-001 | High | Schema | Code uses `totalAmount`/`totalApplicants` absent from current Drizzle schema. | `db/schema.ts`, API/UI references | Yes | Compare production schema; create reviewed migration/code reconciliation. | Open |
| DB-002 | High | Migrations | Multiple migration locations and ad hoc SQL files exist. | `db/`, `migrations/`, `vps-*.sql` | Yes | Establish one canonical migration baseline. | Open |
| STO-001 | Critical | Documents | Storage/document operations lack adequate server authorization. | `api/storage-router.ts`, `api/document-router.ts`, `api/boot.ts` | Yes | Add role/ownership checks and private access. | Open |
| STO-002 | High | Uploads | Large Base64 uploads trust browser MIME metadata; no malware scanning. | Storage router/upload hooks | Yes | Stream, reduce limits, inspect signatures, scan. | Open |
| STO-003 | High | Consistency | Metadata delete may leave files; replace deletes old file first. | Document/storage routers | Yes | Safe replacement and compensating consistency logic. | Open |
| STO-004 | High | Persistence | Docker Compose does not clearly persist intended production document path. | `docker-compose.yml` | Yes | Verify runtime and add approved persistent volume design. | Open |
| DEP-001 | High | Deployment | GitHub Actions, cron, webhooks, and manual scripts can conflict. | `.github/`, `scripts/`, root scripts | Yes | Consolidate into one approved pipeline. | Open |
| DEP-002 | High | Secrets | Development database and webhook credentials are embedded. | Compose/setup/webhook files | Yes | Rotate active credentials; remove defaults safely. | Open |
| DEP-003 | High | Access | Webhook/log services may be public or overprivileged. | webhook service/server files | Yes | Restrict network/access and use non-root service. | Open |
| API-001 | Medium | Performance | Application list performs applicant lookup per application. | `api/application-router.ts` | Yes | Replace N+1 behavior with joined/batched query. | Open |
| API-002 | Medium | Errors | Raw provider/database messages may reach clients. | Router error handling | Yes | Stable codes, redaction, structured logging. | Open |
| CHAT-001 | Medium | Chatbot | Duplicated wizard state/pricing and potential pre-application uploads. | ChatBot, wizard/chat routers | Yes | Centralize domain flow and add state-machine tests. | Open |
| FE-001 | Medium | React | Staff logout appears to call a hook from a callback. | `src/hooks/useStaffAuth.ts` | No | Refactor mutation hook to component/hook top level. | Open |
| BUILD-001 | Medium | Build | `dist/` is ignored but tracked; no tests found. | Git index, Vitest inventory | No | Stop tracking generated output after approval; add tests/CI. | Open |
| DOC-001 | Low | Documentation | README was template boilerplate and runtime facts were fragmented. | Previous `README.md` | No | Maintain this documentation foundation. | Addressed in docs |
