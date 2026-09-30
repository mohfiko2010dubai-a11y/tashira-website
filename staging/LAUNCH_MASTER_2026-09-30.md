# Launch Master — staging handover, 30 September 2026

**Not cleared for production.** Deployed source: `148e0817e210e01832b9468e088e27ed8c31904b`. Remaining gates: governed Stripe TEST refund execution, evidence for both 14-day products, and a complete day of SSR measurements. Production remains unchanged. Section D is deferred, D4 first.

## Implemented and verified

- A1/A2/A7, B1/B2: fresh two-traveller application passes free navigation before profiles/uploads, continue without uploads, reload, no generated names, separate Egypt 6 / Pakistan 8 required-file sets. Required files gate payment. Shared purpose persists for both travellers.
- A3/A4: exact application-open-24-hours copy; Express delta derives from catalog prices. Tests cover historic pairs and a future non-$30 difference. Historic quotes unchanged.
- A5: Regular 48 / Express 24 continuous hours from document completion; frozen Express component, durable first-completion/submission clock, proactive admin breach flag, full-fee governed refund reservation with stable idempotency. Policy bundle `legal-bundle-2026-09-30-v3`. Fourteen actual synthetic uploads verified completion only after both travellers finished; reload preserves it. Rollback database tests cover frozen fee, first-submission immutability and replay. Stripe execution remains pending below.
- A6/B4: shared purpose/residence components across form/pre-check; companion and family-visit handoff verified.
- B3: private application EN/AR titles verified in server responses. All tested HTML remains private, no-store.
- B5: SSR document results with strict public query allowlist, reciprocal metadata, copy-link and WhatsApp action. PK/SA returns eight files/six cards; invalid country input produces empty selection state. Share URLs contain no applicant data.
- B6–B9: stay duration vs entry validity, exact GCC H1 and old headline as subheading, GCC application preset, seven-row comparison table. Arabic mobile pricing at 390px has no page overflow.
- B9a: 90-day inactive at catalog/quote/payment layers, audited reversible admin switch. Both speeds rejected withdrawn product; admin toggle roundtrip restored inactive. Four historical 90-day test orders retained. Five current products have dated primary-source evidence and 90-day reminder; both 14-day products remain unverified. See PRODUCT_VERIFICATION_2026-09-30.md. Service availability alone does not prove supplier access.
- B10/B11: shared optional-flight notice excluded from gates/counters; no visible duplicate document-card labels. Accessible leaf labels retained.
- B12/B13: Arabic file, validation and traveller counters cover six plural categories with explicit Arabic digit formatting; Arabic dollar wording verified.
- B14: staging robots Disallow /, real sitemap 404, exactly one X-Robots-Tag on public/private HTML and robots/sitemap. Fixed the earlier boot sitemap handler. Stage Nginx duplicate header removed after backup and configuration test; production configuration hash unchanged.
- Owner nationality decision: IR/SS/UG/CD in editable audited admin configuration; early EN/AR contact guidance and transactional payment block for any restricted traveller. Actual second-traveller IR fixture returned 412 before intent creation; restored PK. Anonymous writes denied, stale admin version rejected, admin changes restored.
- Owner fee/VAT decision: VAT unchanged. CUSTOMER_FEE_REVIEW_CHECKLIST.md rejects customer-facing numeric government-fee itemization, including Assistant, policies, invoices and templates. Arabic actually-incurred refund wording preserved.

## B15 isolation

| Boundary | Verified state |
| --- | --- |
| Database | Staging tashira_staging / tashira_staging_app; production tashira_db. Same physical host/MySQL server, distinct databases. |
| Storage | /var/www/tashira-staging/storage/documents vs /var/www/tashira/storage/documents; distinct verified realpaths. |
| Stripe | TEST key prefixes and actual synthetic intent livemode=false verified. No LIVE operations. |
| Email | Both staging email modes forced disabled before API import. No real-customer email enabled. |
| Cookies | Host-only customer-cookie implementation, Secure, HttpOnly, SameSite=Lax, Path=/; no parent-domain Domain attribute. Staging creation cookie verified. |

Migrations 055–057 applied only after staging identity checks and guarded backups. No production database/storage/process changes. Fifteen unrelated worktree files remain byte-identical. Inactive staging Git packs deduplicated while retaining objects and refs.

## Quality evidence

Final guarded deployment: TypeScript, lint, full tests and build PASS. **1170 tests passed / 26 existing gated skips; 277 test files passed / 11 skipped.** Static assets and marketing-claim gates pass. Local/public health 200.

Separate deployed browser/API/admin UAT covers family flow, catalog, guarantee clock, public EN/AR result sharing, companion handoff, pricing, nationality administration and checkout gating; no page errors reported. Final smoke verifies seven routes, titles, private/no-store, single robots header, sitemap 404 and all 15 preservation hashes. Sanitized evidence is under launch-master-evidence/. Private sessions and payment secrets are excluded.

## Remaining: actual Express refund

Synthetic application TSH-8E3BE61318E04C81B58DBE538CDC983C paid **$430 TEST** for two Express travellers through actual payment APIs. Its completion time was deliberately seeded 25 hours earlier on this marked test fixture, with a QA timeline event; this is synthetic test setup, not ordinary workflow behavior.

Admin shows the breach. Claim created case 76770e90-3c3c-4469-97a7-352a470f3a1a for **$60**, excluding the $370 base. Repeated claim returns the same case. Status remains **PENDING_APPROVAL**, not refunded.

Owner action: in staging application Payments, Approve with admin password entered inside the site, then Execute Stripe refund with reauthentication. Existing refund security requires this; do not share passwords in chat or bypass it. Afterwards verify Stripe refund, ledger, final status and retry behavior before clearing A5.

## Remaining: product evidence and full-day performance

Owner must supply supplier/service-code evidence for ordinary 14-day single and multiple entry. References to a nationality-specific 14-day visa on arrival do not verify these products. No unsupported cancellation claim published.

Latest dated SSR coverage: 2026-09-30 06:59:21–08:17:51 UTC, **63 samples / 1.31 hours**, not a full day; 849 older undated entries excluded. Total p95 678ms, React p95 59ms, data-wall p95 78ms. Worker startup has only five samples, median 407ms / maximum 459ms. Catalog/CMS individual metrics now present; article call has no samples. Quantiles from different sample sets must not be added.

Previous zero-dated result was a reader error: safe-log entries must be unwrapped. No optimization, caching or worker pooling added. Each SSR request creates a worker; residual time cannot be called only first-visitor cold start. Server metrics exclude external DNS/TLS/network and cannot explain the reported 50-second incident. Staging is not established as production-equivalent capacity. Collect a dated full day and adequate route samples before tuning.
