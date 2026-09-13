# Task 11 — step two staging acceptance

Deployed code: `c164c23219a3a9e5931aa9536d510a829791a06d`. Guarded isolated-staging deployment passed check, lint, **1011 tests**, build, client/SSR/static-asset/marketing checks and local/public health 200. **26 environment-gated integration tests remain skipped**, not claimed as run.

## Owner decisions and scope

The final owner instruction superseded the optional after-payment flight block: remove the flight-booking request. `return_ticket` was removed from the approved declarative checklist, so it no longer blocks progress or checkout. No overland checkbox or flight reminder was introduced for a removed request. Historical documents were not deleted. Transit-specific onward evidence and other nationality/residence requirements remain unchanged. This report supersedes the earlier nine-file Pakistan/Saudi list in DOCUMENT_RULES_APPROVED.md only for this approved change.

The rule evaluator, reference format, storage conversion, payment provider and recovery mechanism are unchanged. No migration, production operation, HTTP-response cache or dependency upgrade occurred. All 15 unrelated dirty files were verified byte-identical before and after this work.

## Implementation

- A single context bar replaces the nationality/residence/purpose echo blocks. Edit shows step-one context choices for the same saved application and reference; it does not create another application. Family travellers still supply their own nationality.
- Removed the non-actionable document preview. Cards upload immediately, including before passport details have been saved. A staging-only, owned-applicant API prepares immutable requirement instances from the saved context, reusing the current instance set when unchanged. This does not complete the traveller form or weaken checkout field validation.
- Passport pages and residence front/back retain separate evidence keys inside paired cards. Pakistan/Saudi has **eight file slots in six cards**. Counter uses file slots, not cards; the Saudi Muqeem/Absher alternative counts once.
- Individual upload progress, explicit failures/retry, completed states and Replace controls remain available. Completed groups collapse to reopenable summaries. Replacing a file does not inflate progress. New requirements after context edits are flagged and applicable old uploads remain received.
- Correct traveller data saves on blur independently of uploads; Save & Continue also validates/saves the data before moving to the next traveller or review. The existing recovery control uses the saved contact email.
- Exact approved bilingual subtitle, country-specific headings, concise hints, 200 ms document transitions respecting reduced motion, a quiet completion band and a 680 px centred form column.

## Actual staging browser evidence

Individual synthetic case `TSH-MU01Q2HR-4F105A`: all eight files uploaded with initially empty passport/name/profession fields; duplicate bytes rejected for the separate Saudi report; all groups collapsed when complete. Continue exposed invalid fields, then reached review and checkout after valid data was saved. Reload retained details and files. Editing Pakistan/Saudi to India/Kuwait retained two matching uploads out of six required files and exposed the new requirements; restoring Pakistan/Saudi restored all eight uploaded slots. Arabic RTL retained state and had no page errors.

The same case completed a real **Stripe TEST** payment and persisted `paid`: displayed and charged amounts both USD 185.00. This verifies this visa/speed combination only, not the deferred all-products/all-speeds Phase 3 claim test.

Family synthetic case `TSH-MU01U04M-67DE3A`: Egypt/Oman (three files), then India/Oman (four files), immediate uploads, separate details and sequential next-traveller flow, followed by review/checkout. No page errors.

Admin: the individual order displays the uploaded files; a stored image preview loaded with nonzero natural dimensions. Rule publication preview no longer lists return_ticket and still displays the Saudi alternatives. Existing admin authorization and document controls are unchanged.

Saved pre-deploy case `TSH-MU00YFC2-734B0F` loaded in the new UI. A valid profession edit saved on blur and survived reload; the existing recovery request accepted the synthetic email (this is not a claim of real email delivery). Upload and Replace succeeded and the counter remained one of eight after reload.

## Measurements and visuals

At 400 × 850, the old full page measured 6012 px. Hiding only the removed flight preview row/card gave a comparable **5782 px for the same eight required files**. The new English page is **3520 px**, a **39.1% reduction**. Arabic is 3401 px. These are full-document scroll heights, including shared header/footer; they are not just the document-card section.

Both languages: no horizontal overflow at 400 px, paired slots remain side by side, progress is in the viewport when the document heading is reached, reduced-motion document transitions are disabled. Desktop form width is 680 px. Direct desktop viewport inspection confirmed the residence slots are visible and 44 px high; full-page screenshots alone can omit offscreen compositor layers.

Evidence JSON: `staging/TASK11_UAT.json`. Local screenshots and sanitized browser results: `tmp/task11-uat/` in the parent workspace. Temporary customer authentication files were removed after verification.

## Manual reproduction

1. Open `/en/apply`, select one traveller, Pakistan, Saudi Arabia and a 30-day visit visa. Complete the existing contact fields and continue.
2. Step two shows one context bar, four detail fields and six actionable cards / eight file slots. Upload a passport page before filling the detail fields: the counter advances.
3. Finish the eight files. Proof may be Muqeem OR Absher; the report must be a different file. Groups collapse and can be reopened; Replace keeps the count stable.
4. Continue with empty/invalid details: inline errors and focus appear. Enter valid details and a passport beyond the displayed six-month minimum, then continue to review and the existing payment page. No flight booking is requested.
5. Edit the context, change nationality/residence and verify preserved common uploads plus newly required files. Reload or switch to `/ar/` and verify saved state. Repeat with family travellers to see the next-traveller flow.

Phase 3 remains on hold. Production remains unchanged.
