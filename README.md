# TASHIRA

TASHIRA is a full-stack platform for processing UAE visa applications. It provides public visa information, an application wizard, online Stripe payments, customer tracking, document uploads, chat assistance, invoicing, and internal admin and staff workflows.

> Production access, database changes, document-storage operations, deployment, commits, and pushes require explicit authorization. Never assume repository configuration exactly matches production.

## Technology stack

- React 19, TypeScript, Vite, React Router, Tailwind CSS
- Hono and tRPC
- Drizzle ORM and MySQL
- Stripe Elements and PaymentIntents
- Server filesystem document storage
- PM2 and Nginx in the intended production architecture

Supabase-related code is legacy or inactive unless runtime verification proves otherwise.

## Repository structure

```text
src/          Frontend application
api/          Hono and tRPC backend
db/           Drizzle schema and database material
contracts/    Shared contracts
public/       Static assets
scripts/      Existing operational scripts
docs/         Technical and operational documentation
```

## Local setup

```bash
npm ci
npm run dev
```

Create local environment configuration from `.env.example`; never commit real values.

## Required verification

```bash
npm run check
npm run lint
npm run test
npm run build
```

## Documentation

- [AI agent instructions](AGENTS.md)
- [Architecture](ARCHITECTURE.md)
- [Security](SECURITY.md)
- [Development](DEVELOPMENT.md)
- [Deployment](DEPLOYMENT.md)
- [Project memory](PROJECT_MEMORY.md)
- [Phase 1 technical report](docs/PHASE1_TECHNICAL_REPORT.md)
- [Database](docs/DATABASE.md)
- [API](docs/API.md)
- [Chatbot](docs/CHATBOT.md)
- [Stripe](docs/STRIPE.md)
- [Storage](docs/STORAGE.md)
- [Business rules](docs/BUSINESS_RULES.md)
- [Known issues](docs/KNOWN_ISSUES.md)
- [Roadmap](docs/ROADMAP.md)
- [Production audit plan](docs/PRODUCTION_AUDIT_PLAN.md)
