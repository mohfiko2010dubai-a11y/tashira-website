# Reply 02 — isolation findings, 3 October 2026

Phase 1 remains blocked. Both PM2 application processes were verified with effective UID/GID 0: production `tashira` and `tashira-staging`. There is no effective filesystem security boundary between these root processes. The correctly scoped staging database account does not prevent a root runtime reading production credentials.

Staging credential probe, without reading any customer rows (`SELECT 1 FROM tashira_db.applications LIMIT 0`):

```text
SELECT command denied to user 'tashira_staging_app'@'localhost' for table 'applications'
```

```sql
GRANT USAGE ON *.* TO `tashira_staging_app`@`localhost`
GRANT SELECT, INSERT, UPDATE, DELETE ON `tashira_staging`.* TO `tashira_staging_app`@`localhost`
```

The staging process identity could open the production documents directory for listing. No entries were enumerated and no document content was read. Existing production documents directory mode is 0755, owner root; both .env files are 0600, owner root. Storage is local filesystem storage, so the credential is the process's OS identity, not an object-store API key.

## Pending execution authorization

Prepared creation of separate unprivileged system users, 0700 storage / 0600 configuration, and hardened systemd units with ProtectSystem=strict, ProtectHome=true, PrivateTmp=true, NoNewPrivileges=true and environment-specific writable data paths. Existing deployment restart mechanisms must be updated and health/rollback verified before completion. No units/users/ownership changes were executed.

Automatic approval review rejected execution because it requires explicit authorization in a trusted chat message for production and staging security changes, rather than the attached task file. A precise authorization question was sent; do not bypass this rejection or claim isolation fixed. Production root status was immediately reported to the owner. Do not change the accepted database grants.

After authorized conversion, repeat production directory/document/config denial tests as the actual staging service identity, prove production credentials cannot be obtained, and rerun the staging-credential database denial. Also verify code/config cannot be modified from inside each hardened service and that the deployment path cannot restart the applications as root.

## Independent work

Actual staging Set-Cookie response on 3 October, value redacted:

```text
tashira_creation_device=<redacted>; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax
```

No Domain attribute; host-only on staging.tashiraev.com. This is a live response, not inferred from source.

Document-result component contained duplicate single-document names in an sr-only list. Removed the duplicate text rather than merely hiding it. Pair labels remain, and document-key metadata remains for parity checks. Added EN/AR regression coverage for both the result component and the wizard; four focused tests pass. Local full check/lint/test/build verification is tracked separately. This change is not yet deployed; do not claim the live page is fixed.

Approvals dashboard and approval_pending notification must ship with the refund workflow, per Reply 01. Express decision is now +USD50; the 14-day base remains USD170. Those subsequent implementation items are not completed by this isolation investigation.

## Reply 03 follow-up

Owner attachment approves both environments, staging first, with a separate per-user PM2 daemon inside its generated hardened systemd unit. The earlier direct-node unit plan is superseded. Read-only inventory confirms TCP ports 3002 staging / 3000 production, document/invoice storage, existing root-owned logs, and staging browser-auth state. New PM2 home will be under /var/lib for ProtectHome compatibility. Production aggregates show 2 LIVE paid and 1 LIVE pending applications; no customer records were opened. Treat these as potentially real and arrange a low-traffic production change after the staging denial/upload checks.

The staging-only preparation attempt was also rejected by automatic approval review because authorization was attached-file content, not direct chat text. No server mutations were executed. Await direct chat authorization; do not retry by workaround. Record all existing ownership/modes before mutation. The new prepared script is tmp/next4-stage-isolation-prepare.mjs; it has NOT run and must be reviewed before use.

Independent duplicate-label fix: all local gates now PASS: TypeScript, lint, 1172 tests passed / 26 existing gated skips, client/server build, assets and marketing checks. Not deployed; live acceptance remains outstanding.
