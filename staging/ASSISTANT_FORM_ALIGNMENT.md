# Assistant aligned with the current application

Owner request, 25 September 2026: the assistant explains requirements and opens the application **inside the conversation**.

## Implementation

- Guidance and document previews use `requiredDocuments`, including nationality, residence, visa, purpose and companion status. Only approved rules appear. Saudi choose-one evidence and its separate Absher report remain distinct; Pakistani additional pages and Qatar/Oman requirements come from the same rule data as the form.
- Prices are fetched through `useProcessingQuotes`; no assistant price table or independent Express amount remains. The same eight visa options are shared with step 1.
- An independent memory router in a separate React root displays the existing `DynamicApplicationStart`, `DynamicApplication` and `PaymentPage` inside the panel. It shares the authenticated session/query client and canonical validation, upload, consent and payment logic. No iframe or relaxed framing policy was introduced.
- Closing/reopening the assistant or visiting its guidance hides the form without unmounting it. A validated reference alone is stored for saved-application resume; passport/contact fields are not copied into assistant storage. Legacy saved references still work.
- New application selections (visa, residence/companion, purpose and family count) are passed into the form. Existing saved applications are resumed without applying fresh calculator choices over their data. Family nationalities remain applicant-specific.
- The obsolete server chat wizard no longer quotes old prices or collects uploads into a separate document path. Its compatibility response directs old clients to the canonical application; admin history/reply procedures remain available.
- Embedded validation focus is scoped to its own application root. The duplicate desktop wizard sidebar is hidden within the assistant panel only.

## Verification

Initial staging candidate `8044eb235a19e4d15fa74fe3141a27c775d8bbee`: check/lint/test/build and health passed. EN/AR browser tests verify 3 Egyptian non-GCC requirements, 6 Egyptian Saudi requirements, 8 Pakistani Saudi requirements, USD30 Express difference, USD400 for two 14-day Express applicants, no mobile overflow/page errors, in-chat canonical form, validation focus and retained draft on close/guidance toggles.

A synthetic application was created entirely in the assistant, profile saved and three required files uploaded. Payment readiness was INCOMPLETE before the files. Review then opened the real Stripe-hosted card element inside the conversation at USD185. No charge was created; the WhatsApp contact action was not invoked.

The final selection-preservation follow-up is `8f2bf9f204fce72dcc7a65283540d30a8f07ba82`. Local gates passed with 1,111 tests and 26 existing gated skips. The final staging guard passed check/lint/test/build (1,111 tests, 26 existing gated skips), with both health checks HTTP 200. Final EN/AR browser UAT verifies the Iraq/Qatar companion checklist (6 files), companion sponsor fields, 14-day visa and family count retained on opening the form (regular total USD340 for two), visible scoped validation, and drafts retained across close/guidance toggles. The saved synthetic application also restores its profile and all 3 uploaded documents after reload in Arabic. No visible duplicate desktop sidebar. Screenshots were visually reviewed; evidence JSON is in `assistant-alignment-evidence/`. The upload-to-Stripe flow was tested on the initial assistant candidate; the final follow-up changes prefill and layout only, and its saved-application smoke passed.

## Scope and operational notes

Only isolated staging is authorized and used. This change does not clear the separate launch/payment/admin backlog or implement the unfinished Express refund guarantee. All 15 unrelated worktree files are unchanged. Four reproducible inactive dependency caches (fc9485a, e994566, 3d8ae0b, 3647b07) were removed after checking their revisions, paths and active-runtime exclusion; source, lockfiles, application data and backups remain intact.

## Owner-requested follow-up review — 25 September 2026

Reviewed the deployed implementation rather than treating the prior test result as completion. Found and fixed two integration defects: Save & view application fell through to a link back to the initial interview instead of the status destination; and the embedded interview overwrote the host page title. Commit 019017d6538f377bb33137a268ceb8314aa814f6 displays the canonical status portal inside the assistant with return navigation, preserves the actual destination for other full-page links, and scopes the interview title to standalone use.

The server audit confirms guarded deployment PASS at 2026-09-25T12:26:20Z. Local TypeScript/lint/test passed (1111 passed, 26 existing gated skips), followed by production build PASS; immutable staging guard repeated all four gates on the final revision. The SSH output stream stalled during build output, so completion was independently confirmed from the server audit/current revision. The initial local build launcher referenced a missing npm executable; running the exact build stages directly succeeded without changing build checks.

Fresh deployed browser checks: all eight visa Express deltas USD30; deliberately aborted price requests show a visible retry action and recover; saved status opens inside the assistant and returns to the application; all three previously uploaded synthetic files persist; host page title is preserved; the final revision opens Stripe checkout at USD185 inside chat; a fresh browser holding only the saved reference cannot see the profile. No charge was created. One first price-matrix run timed out; its repeat completed all eight choices. Policy acceptance is server-acknowledged asynchronously, so the browser test waits for checked state after clicking instead of assuming synchronous acknowledgement.

This is verification of the assistant changes, not an assertion that every possible device/network combination is error-free or that all separate launch blockers are closed. No real-customer messages, production operations or order deletions.
