# REPLY 05 — closure, housekeeping and actual reboot verification

Verified 2026-10-03. Production remains CLOSED to new applications and new payments. Existing paid orders remain accessible. This report does not clear the launch or claim Phase 1 complete.

## Protected customer backup — done before cleanup

Six files belonging to paid LIVE applications 40 and 41 were fingerprint-checked and moved to `/srv/tashira-production-recovery/isolation-20261003`, owned by `tashira-prod`, directories 0700 and files 0600. This is outside every cleanup traversal. Originals and backup SHA-256 values were checked again after cleanup. No customer document was deleted. Binlogs were left untouched.

The original backup was already outside the staging tree. The larger historical staging archives could not all be certified as staging-only: database/config/storage archives and any uncertain material were preserved. Only positively identified generated deployment artifacts and caches were removed.

## Disk and prevention

Before: 96% used, 4.6 GiB available. Final: 25% used, **73 GiB available** (`df -h /`, 96 GiB volume).

- Three complete generated staging rollback backups retained; daily automatic pruning and an asynchronous successful-deploy hook share the existing deploy lock.
- Current staging build and revisions referenced by those backups retained. Old generated Git/dependency caches removed. Build trees containing storage retain that storage; uncertain material is not deleted.
- Stopped `/root/.pm2` and root npm cache removed. No root PM2 invocation afterward.
- Build user's generated npm cache pruned by the deployment cleanup service.
- `/etc/logrotate.d/tashira-per-user`: daily, maxsize 50M, 14 rotations, compression, copytruncate, separate `su` identities. Debug validation and an actual rotation passed.
- `tashira-disk-check.timer`: every five minutes; WARNING at 80%, CRITICAL at 90%; journal and `/var/lib/tashira-maintenance/disk-status`. A simulated 91% emitted the critical journal entry without replacing real disk status.
- **External disk notification remains unconfigured:** owner destination/channel requested and not yet supplied. Local monitoring alone is not represented as delivered external alerting.

## Production intake closure — separate deployment

Exact production baseline `3d595412e8acab08dc4c019292892967a1fe1792` to closure-only `9e589e0e0d751f314fea1c671db469f1b7161293`. No staging feature merge, dependency upgrade, price change, key change, payment/refund creation, or document deletion.

Config `/etc/tashira-production-intake.json`, currently `{"closed":true}`, is read on requests. To reopen later, set `closed:false` atomically, keeping root:tashira-prod 0640. No deployment/restart is needed. API takes effect immediately; UI polls within 15 seconds and on focus. Missing/malformed production config fails closed. Do not reopen until launch gates clear.

Server guards: `application.create`, `wizard.startApplication`, `payment.createIntent` refuse while closed. Recovery, upload, prior payment confirmation and webhook handling remain available. Public entry notice is bilingual, including /en/apply, /ar/apply and /visa-pre-check. Admin login exposes CLOSED. New-chat intake is blocked; resumed orders remain available. Mixed tRPC batches retain independent permitted operations.

A broad Nginx API block was deliberately not used because procedures are batched. Exact entry paths are proxied to the closure-aware server; other routes retain prior handling.

Linux build with the production lockfile passed check/lint/build and **199 tests, zero skipped**. Private production-user preview tested closure and immediate toggle without restart. Public checks confirmed entry 200 and all three guarded APIs 403. Two deployment verification attempts rolled back before final success: Nginx static entry serving required exact-path forwarding; an old keepalive worker then briefly served the prior config. Fresh connections confirmed final deployment.

Rollback artifacts: `/var/backups/tashira-production-closure-20261003-final`. Rollback restores the prior open version and must not be used casually. Production Stripe environment values were compared and remained unchanged.

## Existing customers and reboot

Both actual paid orders were previously independently checked as Stripe LIVE succeeded and Regular, outside the Express window. Fresh single-use verification links were generated without emails; prior customer links were not invalidated. Browser verification opened each paid page and resumed its assistant session. Initial verification used expired short-lived links; fresh links passed. No private URLs/tokens are included here.

Actual controlled reboot occurred only after closure and a quiet window (zero orders created in the prior 30 minutes).

- Boot ID changed from `8dd16fb0-6d82-4e0d-973e-9bd7aaf92d76` to `55a7c8c8-6df7-4664-81f1-2694b79fb432`.
- Production PM2 UID 997; staging UID 999, both auto-started. Nginx and MySQL active. Root PM2 absent. Maintenance timers active.
- Six existing documents fetched over HTTP after reboot, each SHA-256 matched its backup.
- Both actual paid order pages and resumed assistant sessions loaded in the browser after reboot.
- Production closure persisted; production entry and staging public page returned 200.

Evidence: `reply05-evidence/final.json`, `browser-before-reboot.json`, `browser-after-reboot.json` (sanitized).

## Remaining boundaries

The duplicate-label fix remains deployed on staging a9d6956. The old production baseline has neither the shared document-results component nor the newer wizard, so there is no safe isolated component patch to transplant. Promoting those features is a separate reviewed release, not part of this closure change.

Phase 1 is not implemented by this infrastructure change. Its task pack has been read: residence-age gate, nationality/product availability, sold versus submitted product controls, actual Stripe fees and transactionally allocated immutable invoice/credit-note series. Production remains closed. External alert destination is outstanding; no claim that all REPLY 05 items or launch requirements are complete.
