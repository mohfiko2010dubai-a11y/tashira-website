# TASK17 QA remediation

## E — uniform Express fee (owner approved)

Owner selected USD 30 for every visa type on 2026-09-15.
Applied `054_uniform_express_fee.sql` through the isolated staging migration
guard, with its verified pre-migration backup. The sole inconsistent product
was 14-day single entry: regular USD 170, Express USD 195. Its new Express
pricing rule is version 2, USD 200. The other seven products already have a
USD 30 difference and were left unchanged. All prices remain server-sourced.

The migration appends a pricing rule. It does not update any previous rule,
application, immutable price snapshot, checkout quote revision or Stripe intent.
All 178 original application price snapshots and 64 checkout quote revisions
have identical hashes before and after the migration.

Verification on staging:

- Eight products, both speeds, traveller counts 1, 2 and 10: 48 price/display/
  Stripe-payload cases passed. Stripe HTTP was intercepted; no charge created.
- 24 regular/Express comparisons passed: USD 30 per traveller, including
  USD 60 for two travellers and USD 300 for ten travellers.
- EN and AR pricing cards show +30 for the 14-day product; clicking Express
  displays USD 200. The initial browser locator assumed the wrong product
  label; rerun used the actual radio controls and passed.
- Evidence: `task17-evidence/express-matrix.json`, `express-browser.json`,
  `historical-price-integrity.json`, and `migration.txt`.

Quality checks: TypeScript and lint passed. The initial full suite had one
unchanged filesystem-scan test time out at 5 seconds (1,093 others passed).
A full rerun with one worker, unchanged assertions and timeouts, passed all
1,094 tests; 26 existing gated skips remain. Client/SSR/API builds, static
asset validation and both marketing compliance checks passed.

Application code on staging remains dd57d4ef798cc3ea1241cd31f61668e5a9200240;
this is a versioned database price correction, with no application restart.
Production is untouched.

## Remaining TASK17 work

A–D (family navigation, step indicator, shared trip purpose and placeholder/
nationality recomputation), F (private interview title), H (photo hint), and I
(Arabic currency presentation) remain open; this price correction does not
claim they are complete.

G: a read-only sample of the last 8 MiB of each staging application log found
53 `/apply` SSR render records, maximum 875 ms. This sample does not establish
the cause of the reported 50-second browser stall: it lacks correlated browser
network/interactive timings. No worker or cache tuning was applied.
