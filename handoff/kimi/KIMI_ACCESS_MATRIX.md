# Kimi Access Matrix

| Resource | Environment | Access | Allowed | Revocation | Status |
|---|---|---|---|---|---|
| Git branch `kimi/staging-final-recovery` | GitHub | read/write branch only | fetch/push review branch | revoke fine-grained token/App or branch access | branch prepared separately |
| `main/master` | GitHub | none | none | branch protection | prohibited |
| SSH account `kimi-deploy` | Staging host | locked, key-only, forced command | `status`, `health`, `db-status`, `feature-flags` only | remove authorized key or lock/remove user | account ready; Kimi Ed25519 public key required |
| `/var/www/tashira-staging` | Staging | read-only identity through forced command | inspect exact deployed SHA only | remove authorized key | no shell or filesystem mutation |
| Staging documents | Staging | none | none | not applicable | intentionally denied |
| MySQL user `kimi_staging` | Staging DB | `SELECT` and `SHOW VIEW` on `tashira_staging` only | read-only diagnosis | `DROP USER` / revoke grants | credential stored server-side only |
| PM2 `tashira-staging` | Staging | none | none | not applicable | owner-controlled deployment only |
| Nginx | Staging | none | none | not applicable | owner-controlled only |
| Staging logs | Staging | none | none | not applicable | use owner-mediated sanitized evidence |
| Production code/DB/docs/services | Production | none | health read only only when requested | deny by filesystem/DB/sudo scope | prohibited |
| Stripe/Resend | Staging Test only | runtime through existing secrets | no secret export | rotate/revoke provider key | no Live access |

No current GitHub credential is exported. If Kimi needs GitHub write access, the owner must create a repository-scoped fine-grained token or GitHub App limited to the Kimi branch; TLS verification stays enabled.

The server account intentionally has no general shell, `sudo`, deployment, migration, write, document, Production, or cross-database access. Code changes are submitted through `kimi/staging-final-recovery`; deployment remains an owner-controlled gate.
