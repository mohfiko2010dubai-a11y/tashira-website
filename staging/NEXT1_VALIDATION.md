# Next task 1 — verify validation before rebuilding

## Baseline observed on staging

The four original reproduction cases already show working inline feedback. Synthetic reference `TSH-MU06WCEF-5CB9F0` verified empty contact, malformed email/phone, too-soon expiry and changing only expiry to 2030-01-15. First invalid input is focused and scrolled into view; descriptions link to the visible warning text; correcting fields clears the errors. The expiry helper and error both use `2027-03-13` in this run. Corrected details persist after reload. Missing documents show the existing visible guidance. Empty pre-check submission identifies and focuses its missing country fields with a live summary.

Two remaining acceptance gaps were verified before fixing:

1. Traveller field summary was 856px above its actual Save & Continue button on a 400px viewport, inside the details card. Move only the summary to the footer, retaining independent counts for each traveller and the existing field messages.
2. A synthetic family traveller with no nationality showed only a generic context error: zero invalid controls and no country focus. Reuse `useValidationFeedback` in `TravellerContext`, with unchanged nationality/residence requirements.

## Change boundaries

Only three source files: `ApplicantDataForm.tsx`, `DynamicApplication.tsx`, `TravellerContext.tsx`. No validation rules, required fields, passport dates, document engine, payment rules, dependencies or unrelated styles changed. The standalone form retains its own summary when no external footer is supplied. The footer summary is polite/live and linked to the submit button. Review/payment-blocker feedback and Save & Exit validation were inspected and already use visible feedback; unused legacy travel-group editing forms are not rendered by the current wizard (`relationshipsOnly`, `hideTravelGroups`).

## Quality

TypeScript project check, lint and production client/SSR/API build pass. 1018 tests pass, 26 environment-gated tests skipped. One first-run filesystem copy scan exceeded its existing 5s timeout under concurrent build load; unchanged tests passed after the builds ended, with no timeout changes or suppression.

## Manual reproduction

1. `/en/apply`: select nationality/residence to isolate the contact fields, leave email/phone empty and Continue. Expect two field messages, email focused and a summary by Continue. With all fields empty, the first missing country is focused instead.
2. Use `notanemail` and `123`: exact requested invalid-email copy and phone guidance appear. Correct and blur: errors clear.
3. In traveller details, fill valid name/passport number/profession, expiry `2026-10-01`, Save & Continue. Expect the exact minimum-date error beneath expiry, `aria-invalid`, focus/scroll, and a live count beside the actual footer button.
4. Change only expiry to `2030-01-15`, blur/save. Error and field-count summary clear; details save. Missing required uploads still produce document guidance as intended.
5. A family traveller with no nationality: Save & continue in the context editor highlights and focuses Nationality with an inline message and summary. Selecting nationality clears its error.

Live post-deployment evidence is appended after verification.
