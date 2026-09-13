# Task 12 — document pre-check

The public pre-check now uses the existing governed ISO country picker and the wizard's approved `requiredDocuments` union. It no longer calls the legacy eligibility pre-check API to produce a competing document list or eligibility outcome. That API and all rule definitions remain unchanged.

The result and wizard share card labels, hints and identity/residence/supporting grouping. PK/SA/30-day tourism has eight files in six cards; the optional after-payment flight note is informational, outside the count, and does not add a requirement or payment gate. No document upload is added to the pre-check.

Removed age, ticket status and duplicate GCC checkbox. Age is not an input to the approved document union; the legacy eligibility engine can support age rules, but this page is now a document checklist with the existing guidance disclaimer. No new question: visit products default to tourism, transit products to transit, visibly stated. The owner was asked whether to add a purpose selector; pending a different answer, the no-new-question requirement is followed.

CTA carries ISO nationality/residence, visa ID and purpose via route parameters. Wizard derives GCC status, uses existing supported visa IDs and purpose validation, and saves the answers through its existing server-validated application creation. No personal details or document data enter the URL. Saved application routes and storage are unchanged.

Header height is 89px (88px content plus border). Shared scroll padding and clearance for previously unoffset routes prevent heading clipping. Wizard progress sticks below the header. No changes to the header component or unrelated dirty work.

## Local validation

- TypeScript project build, lint, production client/SSR/API build and asset/marketing checks pass.
- 1018 tests pass; 26 environment-gated integration tests skipped.
- Actual result/wizard markup parity tests compare all eight file codes and six card keys; union parity additionally covers Oman, India/Kuwait/family purpose and transit.
- Chrome production preview: EN/AR, 400px no horizontal overflow, empty-submit feedback, result scroll/focus, exact four-answer handoff, sticky desktop skeleton.
- All 16 fixed public routes × EN/AR × 400/1440px (64 checks): initial headings and scroll-to-heading anchors clear the header.
- Staging deployment and live verification are recorded below when complete.

## Manual acceptance

Open `/en/visa-pre-check` or `/ar/visa-pre-check`. Choose Pakistan and Saudi Arabia, then 30 Days Visa. Submit: eight files in six grouped cards, with optional flight separately. Click the application CTA: all four choices are present. Enter synthetic contact details and continue: the same eight document slots appear. Repeat with Oman and observe only Oman residence requirements. On mobile the result follows the form; on desktop the initial skeleton is sticky. Empty submission visibly identifies both missing countries.
