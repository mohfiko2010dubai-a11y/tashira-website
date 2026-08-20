# TASHIRA Production Configuration Checklist

No value below is approved by this document. Record approvals without placing secrets in Git.

- Approved pricing rules, currencies, supplier/internal costs, markup, promotions, and minimum selling prices.
- Approved company legal identity, address, contacts, registration details, invoice prefix, and numbering.
- Approved VAT state. Keep VAT disabled unless registration status, TRN, rate, effective date, and invoice treatment are explicitly approved.
- Approved invoice identity/wording and policy bundle/version.
- `PUBLIC_APP_URL` points to the production HTTPS origin.
- Stripe LIVE activation is separately approved; keys, account capability, webhook secret, and events are verified without printing values.
- Resend production sender/domain is verified and delivery is explicitly enabled only after approval.
- Retention periods, deletion authority, legal-hold authority, and backup retention are approved.
- Production MySQL identity and least-privilege grants are verified.
- `/var/www/tashira/storage/documents` ownership, persistence, free space, backup, and restore evidence are verified.
- `/var/www/tashira/.env` has required production names, contains no staging values, and is changed to mode `600` only in the approved window.
- Exact release and rollback SHAs are recorded.
- GitHub's protected `production` environment requires a named manual approver and contains a previously verified `SERVER_KNOWN_HOSTS` entry; never derive trust with runtime `ssh-keyscan`.
- The 5 ambiguous and 34 potentially-real records remain preserved; cleanup is separate.
- Root cron, PM2 `webhook`, and `tashira-webhook.service` disable evidence is recorded before the release enters `main`; only the approved manual GitHub workflow remains afterward.
- Verified on-host and encrypted/access-controlled off-host backups exist with matching SHA-256 manifests.
