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

## A–D: family navigation and shared context

Implemented free traveller navigation: tabs remain available before all uploads are complete. Save & Continue saves the current valid profile and moves to the next traveller; missing fields produce explicit feedback and focus. Document completion remains a payment gate. Server questions are matched by applicant id, including the next traveller's nationality. All interview substeps remain step 2.

Trip purpose is collected once in both single and family mode and assigned to every initial applicant. Synthetic family UAT with Visiting family confirms both profiles retain that non-default value. Draft legal names are empty. Legacy generated names are removed at projection/list boundaries and rejected by readiness and invoice identity validation.

An actual two-traveller family in staging (Egypt + Pakistan, Saudi residence) was completed through the UI: free navigation before uploads, progression with zero files and at five of six files, nationality-specific recomputation (6 Egyptian / 8 Pakistani), all 14 required links uploaded, review, and Stripe TEST payment of USD 370. Payment success survives browser refresh. No live payment was made.

Admin UAT confirms both synthetic legal names, paid status, and stored files. There are 15 stored test files but 14 required links: an earlier attempt reused a synthetic image for both Saudi proof and separate Absher report and was correctly rejected by the anti-reuse guard. Distinct synthetic images completed both requirements. A separate test-harness timeout followed automatic collapse of a completed document group; verification was corrected to use the actual upload count rather than a hidden row. Neither issue was bypassed in product code.

Fixtures retained on staging (synthetic only):
- Paid family: TSH-C12F6556EB0C43779731E47F6DB79A1C, application 205.
- Visiting-family purpose: TSH-04529F872B204BE8BC74DD73A39A2574.

## F, H, I: private titles, useful photo guidance, Arabic currency

Private interview routes get EN/AR titles in server HTML and after hydration, plus noindex/nofollow without private canonical identifiers. The public fallback is not accidentally marked private. Photo cards use the shared approved hint (whole face visible, no filters) rather than a duplicate label override. Arabic money reads e.g. `185.00 دولار`; amounts continue to come from server pricing.

## G: observed loading delay

A read-only sample of the last 8 MiB of each staging application log found 53 `/apply` SSR render records, maximum 875 ms. These records do not identify the cause of the owner's one 50-second browser stall: no matching timestamp/browser network trace was supplied. No worker or cache tuning was applied. Six fresh desktop Chrome contexts (3 EN, 3 AR), after final deployment/build completion, returned HTTP 200. Ready form/price: 2.902–3.132 seconds; navigation TTFB: 793–894 ms; Server-Timing SSR: 426–521 ms; individual observed browser tRPC batches: 128–155 ms. This is an unthrottled client-to-staging sample, not six cold server boots, production p95, or proof that rare stalls cannot recur. SSR duration is aggregate, not a React/data-call breakdown. Historical 50-second cause remains undetermined. See `task17-evidence/load-timings.json`.

## Final deployment verification

Final source `1747f9e2d1fffba5b72c54787f39762a405ae185` deployed through the guard: TypeScript, lint, 1,102 tests, client/SSR/API builds and marketing checks passed; 26 existing gated skips remain. Local/public health HTTP 200. Final browser smoke verifies EN/AR server and hydrated private titles, noindex, the photo hint after opening the completed Identity group, and no horizontal overflow at 390px. Authenticated invoice download returns HTTP 200 and a valid PDF header. The paid order and admin were verified on the immediately preceding family build; the final 3-file follow-up only changes the photo-copy override, private metadata scope and their tests. Production untouched; 15 unrelated worktree files preserved. TASK15 Express refund guarantee is a separate outstanding task, not implemented by the USD 30 fee correction.
