# Document storage

## Intended active architecture

Production documents are intended to use the production server filesystem:

```text
/var/www/tashira/storage/documents
```

MySQL stores document metadata. Supabase-related code and variables are legacy/inactive unless runtime verification proves otherwise. Do not migrate to Supabase or another provider without explicit approval.

## Runtime verification

Before storage changes, verify active imports in `api/storage-router.ts`, `STORAGE_ROOT`, resolved paths, PM2/Docker runtime, volume mappings, service ownership, permissions, disk space, backup coverage, and restore readiness. Do not expose environment values.

## Authorization

- Require server-verified customer ownership or staff/admin permission.
- Do not expose permanent public document URLs.
- Prefer short-lived authorized download responses or signed capabilities.
- Log access metadata without recording document contents.

## Upload validation

- Enforce conservative size and count limits.
- Stream uploads rather than Base64 where possible.
- Inspect file signatures, normalize MIME type, sanitize filenames, and canonicalize paths.
- Scan for malware before availability.
- Prevent path traversal using resolved-path containment.

## Consistency and replacement

- Store the replacement successfully before removing the original.
- Use transactions or compensating operations to keep files and MySQL metadata aligned.
- Make retries idempotent.
- Never bulk move, rename, overwrite, or delete production documents without explicit authorization and verified backups.

## Persistence and recovery

- Docker must mount the document path as a persistent volume; never rely on an ephemeral container layer.
- Define backup schedule, encryption, retention, restore tests, legal retention, and secure deletion.
- Monitor disk usage, permissions, missing/orphaned files, and backup freshness.
