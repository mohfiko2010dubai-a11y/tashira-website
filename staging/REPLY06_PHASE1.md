# REPLY 06 — system alert accepted; Phase 1 invoice candidate

2026-10-03. Production remains closed at closure-only 9e589e0. No Phase 1 migration or code deployed to production or staging in this phase.

## Disk email — complete, inbox confirmed by owner

- Destination: mohfiko2010dubai@gmail.com, explicitly authorized by owner.
- `/usr/local/sbin/tashira-disk-alert.py` is standalone Python stdlib under systemd, with independent root-only `/etc/tashira-disk-alert.json`; it does not import app code, use PM2, query MySQL or invoke the app mailer. It calls the configured email provider directly using its own copied transport configuration. Provider credential rotation must also update this system configuration.
- `tashira-disk-email.timer`: boot +2 minutes, then every five minutes. Timer enabled and active; last service Result=success.
- Warning >=80%, urgent >=90%, immediate escalation, repeats after 24 hours while breached, one recovery below80%.
- State advances only after provider acceptance; failures exit nonzero and retry on next timer. Stable pending idempotency key and payload are persisted before send.
- One test was accepted by the provider. Owner explicitly confirmed **Inbox**, not Spam. No second test sent.
- Six automated decision tests passed: thresholds, daily repeat, escalation, single recovery, falling-but-still-breached, failure/retry decision.
- Automatic review rejected a later combined hardening/retest command because it might send a second test. It did not execute; only read-only service status checks followed. No extra approval is needed for the completed alert.

Source and tests (no credentials): reply06-evidence/system-disk-alert*.py.

## Existing LIVE invoices — read-only finding

Applications 40 and41 each have one invoice record, a legacy `INV-TSH-…` number and an existing archived PDF. They are not missing invoices. Do not renumber or regenerate documents already issued. The new series is prospective; production intake remains closed so there is no third new payment while implementation is verified.

## Invoice candidate

Isolated branch `codex/phase1-invoices` from e553340; unrelated fifteen edits in the original worktree untouched.

- Migration058: InnoDB counter keyed by series/year and immutable financial-document archive (snapshot, rendered PDF bytes, SHA-256). Database triggers reject archive update/delete.
- Series: TSH / TSH-CN / TEST / TEST-CN, five-digit numbering, Dubai calendar year; overflow fails instead of wrapping. Order references remain separate.
- Existing application row lock serializes duplicate events. Counter uses SELECT FOR UPDATE; counter, PDF archive, invoice row and paid state commit in the same transaction. Rendering failure rolls back the number.
- Invoice rendering uses verified payment and canonical applicant/payer data. Existing legacy invoices retained.
- Authorized view/download endpoints serve archived bytes; they no longer regenerate an issued invoice using current prices/company content. Client replacement endpoint disabled.
- Email attachment reads the same archive, preserving existing legacy-file fallback.
- Credit-note series primitive exists; the approved refund workflow and credit-note business issuance are not completed by this change.

## Verification

Final candidate: TypeScript check PASS, lint PASS, 1178 tests PASS /26 pre-existing environment-gated skips. Client/SSR build PASS; backend build with equivalent esbuild API settings PASS; static assets and both marketing compliance scans PASS. Initial Windows banner-quoting failure was a build invocation issue, not a bypassed source failure.

Isolated MySQL8 rehearsal database `tashira_staging_invoice_rehearsal`, synthetic data only, removed after the test:

1. Injected rollback leaves unpaid state and no consumed number.
2. Twenty concurrent payments produce unique contiguous numbers.
3. Concurrent duplicate commands replay the same number.
4. Test invoice and live/test credit-note counters are independent.
5. Dubai midnight changes year at20:00 UTC.
6. Renderer failure consumes no number.
7. Archive update/delete rejected by database.

The rehearsal validates the allocation transaction, not a full Stripe-to-browser staging payment. That end-to-end check and deployment remain required before this candidate is declared shipped. Production invoices were only inventoried, not altered.

Initial suite found an old source-shape test requiring on-demand PDF regeneration. Its expectation was changed to require archived reads and prohibit regeneration, matching the new immutability requirement. No skip or assertion suppression was added. Windows shell quoting broke the esbuild banner in the initial build; client and SSR builds succeeded, and backend bundling is rerun using equivalent esbuild API settings.

## Not complete

Phase1 remains in progress: staging migration/UAT of the invoice candidate, residence-age eligibility, per-product nationality availability, submitted-versus-sold product with customer acknowledgement/refund linkage, and actual Stripe fees. No launch-clearance claim. The26 prior opt-in integration skips remain gaps and are listed verbatim with their gating variables in the reply.
