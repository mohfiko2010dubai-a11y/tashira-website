# Architecture

## System overview

TASHIRA is a single-repository full-stack application. The Vite-built React SPA communicates with a Hono server through tRPC. Drizzle ORM accesses MySQL. Production documents are intended to live on the production server filesystem at `/var/www/tashira/storage/documents`.

```mermaid
flowchart TD
  U["Customer browser"] --> R["React / Vite SPA"]
  A["Admin or staff browser"] --> R
  R --> T["Hono + tRPC API"]
  T --> M["MySQL on production server"]
  T --> F["Server filesystem documents"]
  T --> S["Stripe API"]
  T --> K["Kimi services"]
  T --> G["Google Drive / WhatsApp integrations"]
  N["Nginx"] --> R
  N --> T
  P["PM2"] --> T
```

## Frontend

`src/main.tsx` mounts the application. `src/App.tsx` defines public, customer, admin, and staff routes. `src/sections/` contains the public application experience, `src/pages/admin/` contains internal views, `src/components/shared/` contains business components, and `src/providers/trpc.tsx` configures API access.

Client guards improve navigation but are not security boundaries. Authorization must be enforced by the API.

## Backend

`api/boot.ts` is the Hono entry point. It mounts OAuth, invoice, storage, health, static-file, and tRPC routes. `api/router.ts` composes domain routers for authentication, applications, payments, chat, wizard state, documents, storage, invoices, suppliers, staff, and Drive.

## Data layer

`db/schema.ts` describes MySQL tables through Drizzle ORM. Production uses MySQL hosted on the production server. Repository schema and migrations may differ from production and must be verified before change.

## Main flows

```mermaid
sequenceDiagram
  participant C as Customer
  participant UI as React
  participant API as tRPC
  participant DB as MySQL
  participant FS as Filesystem
  participant ST as Stripe
  C->>UI: Complete application
  UI->>API: Create application
  API->>DB: Store application/applicants
  UI->>API: Upload documents
  API->>FS: Store files
  API->>DB: Store document metadata
  UI->>API: Request payment
  API->>ST: Create PaymentIntent
  ST-->>UI: Confirm payment
  Note over API,ST: Target design requires signed webhook verification
  API->>DB: Finalize payment and invoice
```

## User roles

- Customers submit, pay for, and track applications.
- Staff review assigned operational information.
- Administrators manage applications, documents, invoices, suppliers, VAT reporting, staff, and chat.

All PII and internal operations require server-side authorization.

## Document storage

The intended active architecture is server filesystem storage. Expected production path: `/var/www/tashira/storage/documents`. Supabase code is legacy/inactive unless runtime verification proves otherwise. Container use requires a persistent volume.

## Runtime and deployment

The intended runtime uses Nginx as reverse proxy and static host, with PM2 managing the Node API. The repository also contains GitHub Actions, webhook, cron, manual, and Docker Compose deployment mechanisms. These may conflict and should ultimately be consolidated.

See [DEPLOYMENT.md](DEPLOYMENT.md), [docs/STORAGE.md](docs/STORAGE.md), and [docs/API.md](docs/API.md).
