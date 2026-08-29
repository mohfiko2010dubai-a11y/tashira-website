# Kimi Access Matrix

| Resource | Environment | Access | Allowed | Revocation | Status |
|---|---|---|---|---|---|
| Git branch `kimi/staging-final-recovery` | GitHub | read/write branch only | fetch/push review branch | revoke fine-grained token/App or branch access | branch prepared separately |
| `main/master` | GitHub | none | none | branch protection | prohibited |
| SSH account `kimi-deploy` | Staging host | key-only | Staging code/build/runbook commands | lock user, remove authorized key/sudoers | public key required |
| `/var/www/tashira-staging` | Staging | read/write/execute | code/build/runtime artifacts | remove ACL/group membership | prepared with least privilege |
| Staging documents | Staging | operational read/write | synthetic Staging documents only | remove group/ACL | prepared with least privilege |
| MySQL user `kimi_staging` | Staging DB | DDL/DML on `tashira_staging` only | app runtime and approved migrations | `DROP USER` / revoke grants | server secret only |
| PM2 `tashira-staging` | Staging | constrained manage | status/log/restart approved process | remove sudo wrapper | constrained command required |
| Nginx | Staging config only | constrained test/install | `nginx -t`, approved Staging block | remove sudo rule | no Production file access |
| Staging logs | Staging | read | PM2/app logs for Staging | remove group/ACL | no secrets should be logged |
| Production code/DB/docs/services | Production | none | health read only only when requested | deny by filesystem/DB/sudo scope | prohibited |
| Stripe/Resend | Staging Test only | runtime through existing secrets | no secret export | rotate/revoke provider key | no Live access |

No current GitHub credential is exported. If Kimi needs GitHub write access, the owner must create a repository-scoped fine-grained token or GitHub App limited to the Kimi branch; TLS verification stays enabled.
