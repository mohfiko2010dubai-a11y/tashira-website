# TASHIRA — Kimi Project Handoff

Baseline: `codex/visa-operations-os-v1` at `4e0f520b72e047e590a646774576eec2614a2e22`
Target: isolated Staging completion only. Production and `main/master` are outside scope.

## Business and operational objective

TASHIRA is a UAE e-visa customer and Operations platform. The V1 target is one traceable journey from an applicant-isolated Dynamic Application through document review, governed eligibility, payment readiness, Operations processing, visa delivery, audit history, and manager oversight. Official eligibility and customer requirements must be source-backed, versioned, and fail closed to Human Review when evidence is missing or conflicting.

## Architecture

- Frontend: React 19, React Router, TanStack Query/tRPC, Vite, Tailwind/Radix UI under `src/`.
- Backend/API: Hono + tRPC under `api/`; `api/boot.ts` is the server entry point.
- Database: MySQL 8 through Drizzle/MySQL2. Canonical schema is `db/schema.ts`; additive SQL is in `migrations/`.
- Contracts: reusable policy and API contracts are in `contracts/` and `api/lib/`.
- Storage: server filesystem; isolated Staging documents live below `/var/www/tashira-staging/storage/documents`.
- Runtime: PM2 process `tashira-staging`, private listener `127.0.0.1:3002`, Nginx TLS endpoint `https://staging.tashiraev.com`.

## Important code paths

- Customer application: `src/pages/DynamicApplication.tsx`, `src/pages/DynamicInterview.tsx`, `api/application-router.ts`, `api/dynamic-interview-router.ts`.
- Legacy chatbot/wizard: `src/components/shared/ChatBot.tsx`, `api/wizard-router.ts`.
- Pricing/payment: `api/lib/pricing-engine.ts`, `api/payment-router.ts`, `src/pages/PaymentPage.tsx`.
- Operations UI: `src/pages/operations/`, `src/components/operations/`.
- Operations APIs: `api/operations-*-router.ts` and `api/lib/operations/`.
- Rule engine: `api/lib/eligibility/`, `api/lib/rules/`.
- Requirements: `api/lib/requirements/`.
- Family/travel: `api/lib/family/`, `api/lib/travel/`.
- Document Intelligence: `api/lib/document-intelligence/`.
- Staging deployment: `staging/build-native.mjs`, `staging/deploy-native.mjs`.

## Database and migrations

- Core tables are defined in `db/schema.ts`.
- Operations migrations are paired forward/rollback files `014`–`043`.
- Rule, evaluation, family, controlled-write, travel, catalog, support, SLA, authority, regulatory, delivery, email, policy and Document Intelligence history are additive and largely append-only.
- Never apply a migration before proving `DATABASE() = tashira_staging` and creating a verified backup.
- Production migration requires separate owner authorization.

## Authentication and RBAC

- Customer ownership is application-scoped and server-derived.
- Staff authentication is separate from customer sessions.
- Canonical permissions and role templates are in `api/lib/authorization/permissions.ts`.
- Every Operations write derives actor, permissions and scope server-side, uses optimistic concurrency/idempotency, validates state, and appends audit evidence.
- Finance fields require explicit finance permissions and must not leak into general Operations projections.

## Customer, staff, manager and owner journeys

- Customer: `/apply` → individual/family setup → applicant-scoped Dynamic Interview → requirements/documents → save/resume → readiness → Stripe Test payment → tracking/visa delivery.
- Staff: `/staff/login` → Operations dashboard/cases → applicant-isolated documents → Human/Document Review → assignment/status/re-evaluation → timeline.
- Manager: team/scoped case visibility, workload/readiness/SLA/Document Intelligence aggregates, assignments and audit.
- Owner: complete internal acceptance scope on Staging. Production grants remain separate.

## Dynamic Form, Wizard and Chatbot

- The governed Dynamic Application is the preferred customer runtime.
- Each applicant has a trusted server ID, independent answers, evaluation, requirements and documents.
- Family relationships and travel groups are explicit; missing ownership/relationships/evaluations fail closed.
- The legacy Chatbot/Wizard remains present for compatibility and is documented separately in `KIMI_DEFECTS.md`.

## Document Intelligence and Human Review

- Provider-neutral extraction, passport profiles, MRZ TD1/TD2/TD3 validation, missing-information projection and Human Review are implemented behind closed flags.
- AI is advisory only: extraction, pre-screening and summary. It cannot decide eligibility, activate rules or submit to government.
- No paid OCR provider is connected by this handoff.

## Payments and email

- Stripe uses server-authoritative immutable price snapshots and payment readiness.
- Staging must use Stripe Test credentials only.
- Payment finalization, invoice snapshots, payer evidence, refunds/security deposits and chargeback evidence exist; no live transaction is authorized.
- Resend architecture, idempotent event evidence and secure invoice delivery exist. Staging recipient restrictions remain mandatory.

## Feature flags

Canonical flags are in `api/lib/feature-flags/feature-flags.ts`. Flags are environment and scope aware (`GLOBAL`, `TEAM`, `STAFF`, `APPLICATION`). Production Operations flags must remain OFF. Staging flags may be enabled only for explicit synthetic acceptance scopes and must be reverted after tests.

## Build, test and deploy

```text
npm ci
npm run check
npm run lint
npm run test
npm run build
node staging/build-native.mjs
node staging/deploy-native.mjs
```

The canonical Staging path is required because it injects and validates Staging public configuration. Do not use plain `npm run build` for a Staging deployment.

## Approved operational policies

Versioned governance covers deterministic rule precedence, immutable eligibility snapshots, family readiness, controlled writes, submission scheduling, travel-date changes, rule-source authority, policy change impact, regulatory proposals, Document Intelligence, Support Inbox, SLA, authority output and secure visa delivery. See `docs/VISA_OPERATIONS_OS_V1_OWNER_GATE.md` and `KIMI_VISA_RULES_ENGINE.md`.

## Non-negotiable safety

- Never touch Production code, DB, documents, PM2, Nginx, Stripe Live or Resend Live.
- Never merge/push `main/master` without separate owner authorization.
- Do not commit `.env`, credentials, customer documents, DB dumps or backup archives.
- Preserve all existing stashes.
