# TASK15 — documents and optional fields

Staging code: d79a8bc57b5e2a9f50869e7d1c39283661885498. Items 1–4 are implemented and verified. Items 5–6 (Express refund guarantee and working-hours copy) remain pending owner confirmation of the window, TASHIRA schedule, relevant authority and closure days. No guarantee wording, refund behaviour or production settings were changed.

## Implemented

- Qatar and Oman: independently keyed front/back files rendered as paired cards. Egypt + either country requires four files. Oman retains both ID/Resident Card names in EN/AR. Existing generic old-card evidence is retained, but cannot be assumed to prove both faces.
- Personal photo label includes white background and no glasses in EN/AR.
- Companion selection adds sponsor name and relationship on step 1 and SPONSOR_ID to every applicable traveller's existing rule union. Server creation validates both fields. Existing applications can complete or edit sponsor details; added family travellers inherit the sponsor. Customer sponsor edits use the existing checkout lock; staff/admin edits remain audited.
- Optional supporting files: maximum six links per application, serialized under an application row lock, idempotent retries, ownership checked. These never enter required-document evidence. Notes persist separately and are prominent above the admin detail tabs. Notes have an explicit Save notes action.

## Verification

- Local and staging guard: check/lint/test/build pass, 1090 passed and 26 existing environment-gated skips.
- Browser/API cases: Egypt/Qatar and Egypt/Oman have four files and paired residence uploads; Iraq/Qatar/companion has six files including home ID and sponsor ID, but only one passport page.
- A staging UAT exposed missing companion context in prepareDocumentUploads; corrected and covered by a router regression test. All six synthetic required documents subsequently linked and payment readiness became READY after explicit test policy acceptance. No Stripe intent or charge was created.
- Seven concurrent optional-link requests produced six successes and one refusal; replay succeeded without a seventh link. Notes reload correctly. Optional data leaves readiness unchanged.
- All four supplemental endpoints reject a different customer's authenticated session with 403.
- Admin notes/files visibility and Arabic mobile view verified. Family test adds a third traveller and preserves sponsor data and requirement for all three.
- Clicking the actual Arabic Save & Continue button opens Review & Pay and exposes the payment link. No payment was initiated.
- See task15-evidence/ for machine results and screenshots. Initial UI matrix used 64f3891; final required-upload check uses the corrected release above.

## Staging operations and retained data

Migration 053_application_supplements.sql adds two tables only. Verified database tashira_staging, user tashira_staging_app and staging storage root before the guarded migration. Backup: /var/backups/tashira-staging/20260914T073654Z-pre-053_application_supplements. Fifteen unrelated working files remain byte-identical. Six obsolete build dependency caches were removed after path/revision/active-runtime checks; source, lockfiles and backups retained.

Synthetic fixtures are listed in the evidence JSON. Four single-applicant fixtures were created (one repeated after a test locator failed), plus one family fixture. The seventh optional test metadata record is unlinked; six links are retained. No test rows or files were deleted or silently marked is_test. No production change, live payment or customer notification was requested.

## Remaining owner input — Express

Confirm 6 working hours, 12 clock hours or 24 clock hours; supply TASHIRA's workday start/end and working days in GST (UTC+4), and identify the relevant authority and closed days. The existing refund router currently distinguishes VISA_SERVICE and SECURITY_DEPOSIT; the requested independent EXPRESS_FEE refund component, durable completion/submission timestamps, breach flag, and Terms/Refund wording are NOT delivered in this phase. They remain part of TASK15, not waived or declared complete.
