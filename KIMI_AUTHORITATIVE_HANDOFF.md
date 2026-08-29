# TASHIRA — Authoritative Kimi Handoff

This document supersedes every earlier Kimi implementation handoff. Do not use
older bundles, patches, abbreviated SHAs, or the historical files under
`handoff/kimi/` as an implementation baseline.

## Canonical branch

- Branch: `handoff/kimi-authoritative-latest`
- Baseline before consolidation: `019736c749d33d9f36c0b920b618a6b0e4128f85`
- Operations foundation ancestor: `4e0f520b72e047e590a646774576eec2614a2e22`
- Final SHA: recorded in the final handoff report after all gates pass.

The branch combines the complete Visa Operations OS foundation with the
reviewed Kimi customer-journey work. Original branches remain unchanged.

## Source-of-truth decisions

- Application, applicant, relationship and document ownership: MySQL-backed
  server repositories and trusted server IDs.
- Eligibility and requirements: immutable evaluation snapshots plus governed
  rule and requirement catalogs. Missing or conflicting official evidence
  fails closed to Human Review.
- Pricing: active server `pricing_rules` and immutable
  `application_price_snapshots`; UI display data is never payment authority.
- Family: applicant-isolated evaluations and requirements aggregated through
  deterministic family readiness rules.
- Operations: authenticated server-derived RBAC and scopes; finance fields are
  excluded unless the trusted actor has finance permission.
- Storage: isolated Staging filesystem only. No customer or Production data is
  included in this handoff.

## Reviewed branch inputs

- `codex/visa-operations-os-v1`: complete Operations OS, migrations 014–043,
  dynamic interview, family, rule governance, document intelligence, controlled
  actions, dashboards and Staging tooling.
- `kimi/staging-final-recovery`: approved 8-step customer wizard, responsive
  presentation, amount display hardening and defect corrections.
- `devops/deployment-safety`: refund/deposit foundations already present in the
  Operations branch ancestry.
- `codex/visa-14-days-multiple`: its UI option is already in branch ancestry;
  the missing reproducible Staging pricing rows are corrected here.
- `codex/abandoned-reminder-recovery`: reviewed but not merged. It is an
  incomplete isolated implementation with a hard-coded Staging recovery origin
  and no approved scheduler/API integration, so it is not authoritative runtime
  code.

## Staging catalog state

- Generic requirement catalog import: `generic-requirement-catalog-v1`.
- Requirement definitions: 13 active approved synthetic/generic definitions.
- Dynamic questions: 18 active approved synthetic/generic questions.
- Visa rules: synthetic Staging-only governed rules; official customer-wide
  production rules remain an owner/content gate.
- 14 Days Multiple Entry: USD 265 regular / USD 295 express in the reproducible
  isolated-Staging seed. Supplier/internal costs in that seed are synthetic test
  values and are not Production business policy.

## Safety boundaries

- Never modify or merge `main/master` from this handoff.
- Never deploy this branch to Production without a separate exact-SHA approval.
- Never copy Production DB, documents, secrets, Stripe LIVE or Resend LIVE data.
- Preserve immutable price/evaluation/audit history.
- Keep sensitive customer/provider features scoped and closed unless a separate
  Staging acceptance step explicitly enables them.
- Do not apply or drop existing stashes.

## Required acceptance sequence

1. Verify exact branch SHA and a clean worktree.
2. Run TypeScript, ESLint, all tests and the minified build.
3. Verify static assets and scan tracked files for secrets/prohibited artifacts.
4. Prove `/var/www/tashira-staging`, database `tashira_staging`, PM2
   `tashira-staging`, and port `3002` before any Staging write.
5. Create and verify a new Staging backup.
6. Apply only reviewed additive Staging catalog/migration changes.
7. Deploy the exact SHA with `node staging/deploy-native.mjs`.
8. Run clean synthetic customer, family, document, Operations, pricing and
   Stripe TEST readiness E2E.
9. Confirm Production/main/master and both existing stashes are unchanged.

## Known external/owner gates

- Official visa-rule content and source approval for real-customer activation.
- External document-intelligence/provider selection and privacy terms.
- Legal retention/deletion durations.
- Any Production migration, deployment or feature activation.
