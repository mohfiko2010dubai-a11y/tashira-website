# Reply 04 — read-only intake and disk report

Production closure is NOT applied. Existing production revision 3d595412 has no matching closure flag in source or runtime bundle. Owner clarification is pending because closing fully requires an initial implementation/deployment, while Reply 04 forbids production deployment before disk remediation. No new deletion, production configuration change or reboot was performed during this reply.

| Consumer | Approximate size |
|---|---:|
| Disk total / used / free | 96 GiB / 92 GiB / 4.6 GiB (96%) |
| Staging backups | 48 GiB |
| Old staging build trees | 30 GiB |
| Root npm cache | 3.4 GiB |
| All application trees | 3.5 GiB |
| MySQL total | 241 MiB |
| MySQL binary logs | 2741861 bytes; no purge |
| All /var/log | 178 MiB |
| Journald | 80.1 MiB |
| Old root PM2 | 5.1 MiB, logs 680 KiB |
| Production document storage | 3,371,922 logical bytes / 13 files; du 3.4 MiB |
| Staging documents | 68 MiB |

Production DB has 42 orders and 17 document rows across 7 orders, with 4,447,012 recorded file bytes. Physical storage averages 80,284 bytes across all 42 orders, or 481,703 bytes across the 7 orders with document rows. These are different denominators and include historical/test records; they are not a reliable forecast of future customer storage. Database metadata and filesystem totals differ; this report does not claim all historical document rows map one-to-one to files. The six documents for the two paid LIVE orders were independently verified in the preceding isolation acceptance.

Binlogs are enabled with a 30-day expiry (2592000 seconds). Backup/PITR dependencies have not been established, so no purge is proposed or performed. Their small size cannot materially solve the capacity issue. No document path may be deleted.

No dedicated per-user PM2 logrotate configuration currently exists. Required follow-up: configure bounded rotation for both environments, validate with logrotate debug, then verify actual service writes. This is not yet applied.

Cleanup proposal: preserve all documents, active/previous release artifacts and isolation rollback backups. First reclaim rebuildable inactive dependency caches and npm cache after exact-path/live-reference verification; inventory the 48 GiB staging backup contents before any retention decision. Do not delete backup sets or binary logs based only on age. Reboot remains blocked until closure and disk remediation pass.

The exact 26 skipped tests and per-file enabling variables are in REPLY04_SKIPPED_TESTS.md. These integration checks are not counted as passing.
