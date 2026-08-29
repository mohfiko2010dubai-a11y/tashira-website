# PRE-KIMI Backup Manifest

Created: 2026-08-29 (Asia/Dubai)
Git branch: `codex/visa-operations-os-v1`
Git SHA: `4e0f520b72e047e590a646774576eec2614a2e22`
Backup tag: `backup/pre-kimi-handoff-2026-08-29`

## Artifacts

| Artifact | Location | Bytes | SHA-256 | Verification |
|---|---|---:|---|---|
| `TASHIRA_PRE_KIMI_2026-08-29.bundle` | Windows backup directory | 20,890,419 | `29C74E45F198A55C7B457B7AE7CB432D3C310EC62FB33673792F45F003411634` | `git bundle verify` PASS |
| `TASHIRA_CODE_PRE_KIMI_2026-08-29.zip` | Windows backup directory | 24,651,098 | `DDF7E2AA8376639F3C2C0AB337FBEF1880A09CC202B390B49A21F7EF036F9FF9` | ZIP open/read PASS; 1,053 entries; no actual `.env`, node_modules or storage documents |
| `TASHIRA_STAGING_DB_PRE_KIMI_2026-08-29.sql.gz` | Staging server backup directory | 128,518 | `FCAC26C4DA3E0EB8D07058B5384593BB7AC54D73998E2B484728A4FD852F411E` | gzip PASS; isolated temporary DB restore and protected-count comparison PASS |
| `TASHIRA_STAGING_DOCUMENTS_PRE_KIMI_2026-08-29.tar.gz` | Staging server backup directory | 25,787,062 | `B1FCECDE6F5BDE5D78020105C595317DC1B91EAC3FC0B0C1A3FE2EA9D5A89F48` | tar listing PASS |
| `TASHIRA_STAGING_CONFIG_PRE_KIMI_2026-08-29.tar.gz` | Staging server backup directory | 3,086 | `55529519851F5A652D81FA56722E4D82EBC88DCA9D347CD5FD0978922BA86ED4` | tar listing PASS; names/metadata only, no secret values |

Windows backup directory: `C:\Users\ADMIN\OneDrive\Documents\TASHIRA_BACKUPS\PRE_KIMI_2026-08-29`
Staging server backup directory: `/var/backups/tashira-staging/PRE_KIMI_2026-08-29`

The sensitive DB/document/config archives remain on the root-only Staging backup directory until the owner gives the additional direct confirmation required by the local transfer safety layer. The Git Bundle and code ZIP are already present locally.

## Staging evidence

- Deployed SHA: `4e0f520b72e047e590a646774576eec2614a2e22`
- DB: `tashira_staging`
- MySQL: `8.0.46-0ubuntu0.24.04.3`
- Latest migration: `043_operations_permission_catalog.sql`
- Protected counts at backup: 84 applications; 102 applicants; 130 document rows; 33 payments; 24 invoices.
- Document filesystem: 123 files; 26,611,962 bytes before archive.
- Staging and Production public health were HTTP 200 after backup.

## Restore order

1. Restore/clone the Git Bundle and check out the exact tagged SHA.
2. Verify all artifact SHA-256 values.
3. Restore the DB dump into a new isolated database first; compare tables/counts before any replacement.
4. Restore `documents/` with permissions preserved only to the isolated Staging storage path.
5. Review the sanitized configuration archive, then supply secrets through the approved server-side secret mechanism.
6. Use the canonical native Staging build/deploy and verify local/public health.
7. Keep all sensitive feature flags OFF until scoped acceptance is approved.

Example Git restore:

```text
git clone TASHIRA_PRE_KIMI_2026-08-29.bundle TASHIRA-RESTORE
git -C TASHIRA-RESTORE checkout backup/pre-kimi-handoff-2026-08-29
```

DB/document restore commands must be executed through the constrained Staging runbook; never point them at Production.

## Revoke Kimi

Lock/remove the `kimi-deploy` SSH account or its authorized key/forced-command entry; revoke/drop the read-only MySQL user `kimi_staging`; revoke the repository-scoped GitHub token/App; retain backup/audit evidence. No Kimi sudo rule exists.

## Production exclusion

No Production code, DB, documents, PM2, Nginx, Stripe Live, Resend Live, `main/master` or stash was modified while creating these backups.
