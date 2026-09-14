# Approved payment remediation — delta tracker

Owner approval: attachment `c3c1bd41-2cdb-4be4-8507-1c7e72125835/pasted-text.txt`. No launch until ordered items 1–6 are fixed and independently re-verified. Document replacement remains assigned to the subsequent admin work. Test orders/files must not be deleted; an explicit reviewed per-record list is required before marking a new `is_test` flag.

## Item 1 / audit finding 9 — runtime privacy boundary deployed

Staging revision: `fc9485abf65f5bec359b1175dc7044031744b092` (2026-09-14).

- Central allowlist at the console boundary discards free text, raw errors and unapproved object fields. It runs before application imports in the browser, API process and SSR worker. Structured security events and SSR route/reason/timing metadata remain available.
- tRPC error formatting removes internal exception messages, stacks and untrusted data fields and returns a correlation ID. Unexpected Stripe errors are classified as internal exceptions. Explicit business guidance without an internal cause remains visible.
- Legacy success:false error envelopes in invoice, supplier-assignment and Drive paths now use the same generic failure/correlation mechanism.
- Exact duplicate-order synthetic probe: still correctly fails, but responseContainsSyntheticEmail=false, responseContainsSql=false; correlationId present and stack absent. No order was created by this duplicate probe.
- Sanitized only `/var/www/tashira-staging/logs/app-out.log` and `app-error.log`, retaining allowlisted structured audit metadata and redacting free-text payloads. No database audit row or document file changed. Repeated the probe afterward: both runtime logs reported zero email/SQL matches and no synthetic marker.
- Scope limitation: these checks cover application runtime logs. Shared infrastructure/access logs, which may contain production traffic and cannot safely be attributed per host, have not been purged or certified by this operation. Production is untouched.
- Local check/lint/build passed; local suite 1037 passes includes three audit-only probes. The deployed clean suite excludes those temporary probes; 1034 tests passed, with 26 environment-gated skips. No dependency upgrade or disabled checks.

Initial deployment exhausted disk while copying dependencies. The guard restored the old runtime; health was 200, but Git HEAD/index needed alignment with the restored source. Removed only node_modules from four verified obsolete isolated build trees (sources/lockfiles preserved), recovered about 3 GB, repaired HEAD/index with a mixed reset, and reran the full deployment guard successfully. No orders, uploads, backups or append-only database protections were removed. The active runtime and all source commits remain preserved.

## Remaining ordered work

2. Deployed and staging-verified at 105e5c519e2c04afbc4b8c919a333c29c7420ff6. Append-only quote revisions and application row locks serialize price-affecting mutations. The payment page and Stripe read the same quote; stale displayed revision returns 409 before Stripe. Browser/API proof: family 2 to 3 = USD 370 to 555; single 30-day to 90-day to Express = USD 185 to 550 to 580. Stripe TEST readback = 58000 USD cents; repeat reuses one intent/one payment row. Historical 49 issued-intent prices preserved by migration 046; four snapshot guards verified. Full server check/lint/build and 1039 tests passed (26 existing gated skips). Removal is covered by the actual-roster unit test; there is no existing removal endpoint to claim browser coverage for. See payment-remediation-evidence/payment-price-uat.json.
3. Monotonic paid state and Stripe event-time ordering: pending.
4. Atomic webhook retry claims and permanent concurrency tests: pending.
5. Remove fabricated consent and mark historical events invalid without rewriting audit evidence; report exact count: pending.
6. Server-generated reference, server-issued creation request keys, durable intent reuse and interrupted-flow recovery: pending.
7. Document replacement chain: subsequent admin phase, as requested.
8. Preserve foreign-owner 403 instead of legacy 500: pending.

The eleven-question audit is not yet cleared. No production launch, test-record flagging, test-order deletion or destructive audit cleanup is authorized by completion of item 1.
