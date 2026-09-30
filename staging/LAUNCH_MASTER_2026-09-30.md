# Launch Master execution — 30 September 2026

Owner source supersedes TASK17/19/20. Scope is isolated staging; production remains unchanged. Section D is deferred, with D4 first. The verified document engine is not being redesigned.

## Fresh evidence

- A1/A2/A7, B1/B2: a new two-person Saudi-resident application on deployed 019017d passes free navigation before either nationality, save-and-continue from traveller 1 without uploads, reload, no generated names, EG 6 / PK 8 separate requirements, and incomplete-document payment gating. No console page errors, no payment. Family purpose persisted on both travellers; pre-check purpose still needs implementation (A6).
- A4: existing deployed quotes use the corrected catalog; a shared derived-delta helper now has tests for all eight historic price pairs and a non-$30 future pair. Historic quotes/prices were not rewritten.
- A3: source trust-strip wording changed to the exact owner-approved open-24-hours copy; source sweep finds no prohibited working-hours phrases in active customer code.
- B9a: additive migration 055 applied only to verified tashira_staging with a guarded backup. New per-product activation/verification records, 90-day inactive, immutable admin audit, quote and payment checks, public selectors reading active catalog. Owner toggle and evidence-date reminder implemented. All four historic 90-day test orders retained and marked is_test. Deployed EN/AR catalog, pricing, homepage, pre-check, wizard and neutral deep-link UAT pass. Both quote speeds reject withdrawn 90-day with 412. Admin activate/deactivate roundtrip passed and product restored inactive.
- B15 inspection: staging database tashira_staging, production tashira_db, both on the same local MySQL server/host; staging storage /var/www/tashira-staging/storage/documents; production /var/www/tashira/storage/documents (both realpaths verified distinct). Stripe TEST key prefixes confirmed without printing keys. Prior staging mail mode was Resend with one allowlisted recipient; deployed run-native runtime forces both email modes to disabled before API import. Host-only creation cookie verified: Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000; no Domain. Both environments share the physical host/MySQL server but not database or storage.
- C1: 849 historic SSR entries have no timestamp. None can establish a defensible last-24-hour sample. Candidate adds timestamps only; no caching, worker or rendering optimization. A full dated day remains pending.

## First implementation group

Commit ffc5c793d9f373c3860be0502d6664356ec853b9. TypeScript and focused lint pass; full suite 1124 passed / 26 existing gated skips. Guarded deployment PASS at 06:58:44Z; deployed browser/API/admin UAT passed with zero page errors. Fifteen unrelated worktree files preserved.

## Outstanding work, not cleared for launch

A5: approved 48-hour regular / 24-hour Express copy and real independently refundable component, durable completion/submission timestamps, breach flag and refund path. Do not publish an unsupported guarantee.
A6: shared purpose component including pre-check. A7 proof is above.
B3: private title already exists; final metadata confirmation. B4/B5: pre-check companion and shareable SSR results. B6–B9: duration/validity, audience H1, GCC entry and comparison table. B9a: official verification of remaining products, test-order marking, deployed UAT. B10–B13: optional flight item, duplicate copy and Arabic counters/currency. B14: robots still Allow and sitemap still 200; one X-Robots-Tag observed, so two fixes remain. B15: final isolation verification.
Owner decisions: configurable nationality restrictions and customer-safe government-fee-amount regression checks remain implementation work. VAT unchanged.
C1: collect a dated full day. D: after launch only.

Official evidence found: GDRFA multiple-entry tourist service https://gdrfad.gov.ae/en/services/f9e586fb-0642-11ec-0320-0050569629e8 lists 30/60 days. UAE transit page https://u.ae/en/information-and-services/visa-and-emirates-id/transit-visa lists 48/96 hours. The 14-day multiple product remains unverified; owner source/service-code requested. Absence from public sources is not proof of cancellation and no cancellation claim is published.
