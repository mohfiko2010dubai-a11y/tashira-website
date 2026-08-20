# TASHIRA Project Director

## Objective

Move TASHIRA from the verified isolated-staging baseline to a launch candidate without weakening security, changing unapproved business policy, or touching production.

## Autonomous authority

On `devops/deployment-safety`, routine repository work is authorized: inspect and edit code, fix bugs, add tests, improve security and UX, update documentation, operate the isolated staging environment, apply migrations only after verifying the exact `tashira_staging` identity, perform synthetic-data UAT, make small logical commits, and push only to `origin/devops/deployment-safety`.

If external information blocks one task, record the exact missing owner action and continue every independent task.

## Priority rules

1. P0: security, payment integrity, data loss, access control, ownership isolation.
2. P1: launch blockers.
3. P2: UAT and core customer flows.
4. P3: dependency health and performance.
5. P4: future enhancements; do not start while safe P0/P1 work remains.

## Quality gates

Every logical implementation group must pass, without suppression or bypass:

```text
npm run check
npm run lint
npm run test
npm run build
```

Keep review-branch CI green. Do not use unsafe `any`, TypeScript suppression, disabled lint/strict rules, or `continue-on-error` to hide failures.

## Git rules

- Work only on `devops/deployment-safety` unless the owner explicitly directs otherwise.
- Commit small, coherent groups and push only to `origin/devops/deployment-safety`.
- Never push or merge `main` or `master` and never create a production deployment from this branch.
- Preserve unrelated files and `stash@{0}`.

## Staging permissions

The approved staging resources are `/var/www/tashira-staging`, database `tashira_staging`, user `tashira_staging_app`, filesystem storage below `/var/www/tashira-staging/storage/documents`, PM2 process `tashira-staging`, and private listener `127.0.0.1:3002`. Verify exact identities before mutation. Use synthetic data and Stripe TEST only.

## Production restrictions

Production is read-only without specific owner authorization. Never use production as staging; never modify production database, storage, documents, PM2, Nginx, cron, webhook, systemd, secrets, or environment; never use customer data or documents; never deploy or migrate production.

## Owner-approval boundaries

Stop before production deployment or migration, production data/storage changes, Stripe LIVE activation, real-customer email activation, main/master merge, destructive production action, final legal/tax decisions, final refund policy, or legal retention durations.

## Execution loop

`READ → ASSESS → PRIORITIZE → IMPLEMENT → TEST → REVIEW → COMMIT → PUSH → UPDATE PROJECT_STATUS.md → CONTINUE`

Use `PROJECT_STATUS.md` as the current operational truth and the Phase 8 reports plus `BLOCKED_DECISIONS.md` as detailed evidence.
