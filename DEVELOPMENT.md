# Development

## Branch workflow

- Start from an up-to-date `main` branch only when fetching is authorized.
- Use a focused `codex/<topic>` branch unless the user specifies another name.
- Keep changes scoped to one objective.
- Do not commit, push, or open a pull request without explicit authorization.
- Never mix generated files, secrets, local data, or unrelated changes into a commit.

## Starting a task

1. Read `AGENTS.md` and `PROJECT_MEMORY.md`.
2. Inspect `git status` and preserve unrelated changes.
3. Read the relevant frontend, API, schema, migrations, and documentation.
4. Identify authorization, payment, PII, storage, database, and deployment impact.
5. Verify assumptions locally. Production inspection requires separate approval.
6. Define proportional verification before editing.

## Coding standards

- Use explicit TypeScript domain types and avoid undocumented `any`.
- Validate external input with Zod.
- Enforce authorization on the server.
- Keep pricing, VAT, currency, and status rules server-side.
- Use decimal-safe monetary handling and transactions for multi-record writes.
- Preserve accessibility, translation keys, and RTL behavior.
- Use UTF-8 and do not expose raw internal errors.
- Do not manually edit generated `dist/` output.

## Verification

```bash
npm ci
npm run check
npm run lint
npm run test
npm run build
```

Run checks proportionate to the change. Do not install dependencies or execute modifying commands during read-only tasks. Add tests for authorization, pricing, Stripe webhooks/idempotency, document ownership/validation, application state, invoicing, and migrations.

## Completion report

Report:

- Files changed
- Behavior changed
- Security and PII implications
- Database and environment implications
- Checks run and results
- Checks not run and why
- Deployment status
- Remaining risks

Never claim a check, commit, push, migration, or deployment succeeded unless verified.
