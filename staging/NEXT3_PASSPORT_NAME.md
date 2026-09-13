# NEXT TASK 3 — Passport name

Deployed `39dd933f8a43370e442adc733f2a3747cc1e174a` to isolated staging. Existing server/client Latin-name validation already rejected other scripts and accepted punctuation and lowercase. Retained that rule. Changed only the bilingual label/helper/error copy and added a nonblocking single-word reminder linked to the field's helper and announced politely. No uppercase normalization, required-field changes, dependency changes or unrelated restyling.

## Validation

Check, lint, client/server/API build and full regression suite pass: 1029 tests, 26 unchanged environment-gated skips. Added the owner's exact names to the existing shared-rule tests.

Live mobile browser: Arabic `محمد علي` rejects with `اكتب الاسم بالحروف اللاتينية كما هو مطبوع في جوازك.` and focuses the invalid field. Arabic Latin-letter/middle-name helper remains visible. `MOHAMMED ALI`, `Mohammed Ali`, `O'BRIEN-SMITH`, `AL-SAYED` and `Sukarno` each save to the server and survive reload with exact case/punctuation. Single-word entries show a notice but remain valid and save. Switching to English displays the exact English helper, notice and rejection message. No browser page errors. Synthetic reference: TSH-MU08R3CC-315BDA.

## Manual check

Open `/ar/apply`, complete step 1, and inspect the name field on step 2. Enter the Arabic example and Save & Continue: linked guidance appears. Replace it with each Latin example, complete other details and blur/save; reload to verify preserved text. `Sukarno` shows a question, not a validation error. Switch to `/en/` for the English copy.

Required document/payment gates remain unchanged. Production and fifteen unrelated dirty files untouched. Before deployment, removed only reproducible node_modules from two obsolete isolated staging build directories (1,613,881,344 bytes freed); sources, active runtime, backups and documents preserved. Staging guard health checks both 200.
