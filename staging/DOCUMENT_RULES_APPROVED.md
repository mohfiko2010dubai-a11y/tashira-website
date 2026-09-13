# Approved document rule release — 2026-09-13

Scope: owner-approved document rules and wizard wiring. Task 7 Phase 2 is retained. Phase 3 remains held until owner verification of these twelve cases. Production is untouched.

## Sources and decisions

The owner approved the PDF-derived rules in the subsequent task and approved plan additions. All current JSON rows are now approved. Draft support remains, with applicable suppression diagnostics in application admin and a build warning naming every draft (including nested rows). Unmatched conditions are returned separately from applicable suppressed rules, so Pakistan/Saudi Arabia has an empty `suppressed` list without hiding why unrelated countries did not match.

Single source: `contracts/document-requirement-rules.json`. Independent nationality/residence/visa/purpose conditions form a deduplicated union. Recursive `any_of` and `all_of` are data-driven. Saudi proof is one choice slot, with the separate Absher report additional. The server rejects reuse of the same document ID, storage object or identical file bytes for those two requirements. Existing historical links are not rewritten.

Nationality passport keys are distinct: Pakistan second page, India last page, Syria last page. Generic old second-page evidence satisfies Pakistan only; Indian/Syrian last-page hints explicitly explain the new requirement. Stable catalog definition IDs are preserved for existing codes; new codes get deterministic IDs independent of JSON row order.

Individual Step 1 collects residence type, nationality, country and trip purpose before the exact requirement-slot count. Trip purpose is included because omitting it would make the count incomplete for family visits. Visa selection changes recompute the count. The saved selections appear as editable summaries in Step 2. Family Step 1 presents a named residence-document list without a count; nationality remains per traveller. Both flows use the same rules as upload completion and payment readiness.

No schema migration: a link retains its parent requirement instance ID, while its `requirement_code` identifies the chosen leaf. The command evidence records parent code and selected document key. Historical simple links and explicit legacy aliases remain supported. Read projections recompute current slots even for old evaluations; save/upload refreshes the immutable evaluation before linking.

## Exact checklists (30-day visit, tourism)

Pakistan + Saudi Arabia, 9 slots:
`passport_page`, `pk_passport_page_2`, `personal_photo`, `return_ticket`, `home_national_id`, `ksa_iqama_front`, `ksa_iqama_back`, `ksa_residence_proof`, `ksa_absher_report`.

Egypt + Saudi Arabia, 7 slots:
`passport_page`, `personal_photo`, `return_ticket`, `ksa_iqama_front`, `ksa_iqama_back`, `ksa_residence_proof`, `ksa_absher_report`.

India + Kuwait, 7 slots:
`passport_page`, `in_passport_page_last`, `personal_photo`, `return_ticket`, `kwt_iqama_front`, `kwt_iqama_back`, `kwt_mobile_id`.

Egypt + Oman, 4 slots:
`passport_page`, `personal_photo`, `return_ticket`, `omn_residence_card`.

`ksa_residence_proof` offers `ksa_proof_muqeem` OR `ksa_proof_absher`, never two required cards. Saudi residence alone contributes four slots to every nationality.

## Automated evidence

`approved-document-rules.test.ts` explicitly covers the owner's twelve cases, draft diagnostics, compatibility, and independent applicant ownership. It additionally edits the in-memory JSON data to make Kuwait `(front AND back) OR Hawiyati`, then verifies each branch without changing engine code. Another test removes the Saudi report row and verifies exactly three residence slots without changing code. These are demonstrations only; the shipped policy remains Kuwait three mandatory documents and Saudi four slots.

`owner-document-link.test.ts` tests the actual transactional writer: parent/leaf persistence, missing/forged choice rejection, ownership, and same-file rejection before writes. Byte-level identity tests cover renamed/re-uploaded files. `document-rule-warning.test.ts` runs the build warning script with nested draft data and checks named warnings and a successful exit. Upload UI tests count seven Egyptian/Saudi cards, with two radio options inside one proof card.

Local full suite: 1004 passed, 26 skipped (database-dependent integration suites remain skipped locally). Client/SSR build, static asset verification and both marketing checks pass. Final type/lint checks and guarded staging deployment/live UAT are recorded below when completed.

## Manual acceptance

Open `/en/apply`. Choose single, GCC Resident, nationality, residence country. Compare count and labels to the lists above. Fill contact details, continue, and confirm nationality/residence/purpose are summaries with Change controls. Enter synthetic passport details, save, and compare upload-card count to Step 1.

For Saudi Arabia choose either Muqeem or Absher proof, then upload a *different* synthetic document to the separate report. Reusing the proof bytes must display a clear upload error and leave the report required. Complete all slots and Save & Continue to review. Payment remains blocked while a required slot is missing; complete documents permit the existing policy/price/payment flow. Do not charge a real card or send customer email.

Reload to verify saved data and files. Edit nationality/residence and verify applicable uploads remain received while newly applicable documents appear. Repeat in Arabic and in family mode, completing each traveller before Next traveller. Application admin must show the rule diagnostic panel and the stored documents. Use synthetic applications/files only.
