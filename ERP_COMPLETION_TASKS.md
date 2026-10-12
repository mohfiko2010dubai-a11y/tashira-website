# One-click filing correction and customer visa access — 2026-10-12, acceptance pending

Owner screenshot showed documents_received still required a manual under_review transition for authority filing. Allow proof-backed paid documents_received -> visa_processing through the existing atomic executor; remove the redundant status form from the supplier/submission tab. The button keeps evidence, pricing, authorization, audit, version and payment guards and opens visa delivery. Updated the mandatory DB acceptance to start from documents_received (86 total unchanged).

Customer tracking previously omitted delivered visas. Added shared Arabic/English visa cards to tracking and the customer portal with traveller identity, saved instructions, validity and guarded download/retry. Processing step no longer implies government approval. Local check/lint/test/build passed1558 unit tests +13 build checks. Staging deployment, mandatory DB CI and actual browser acceptance pending. No production or owner-case mutation. New paid Stripe TEST fixture266 prepared for exact-state acceptance.

# Screenshot workflow tasks CLOSED on staging — 2026-10-12

Deployed runtime aedbb6f6d89f4c2a2bcf33adda2020b061358561. CI38236398653 Verify and mandatory database integration both SUCCESS (86 tests, zero skipped). Local and server check/lint/test/build passed1553 unit tests +13 build checks. Earlier integration run executed all86 successfully but its inventory assertion still expected84; corrected assertion and success summary to86 without weakening any failure/skip guard. Backup /var/backups/tashira-staging/erp-workflow-final-aedbb6f-1791801167780; private/public health200; no migration; production unchanged.

1. CLOSED: documents are in a scrollable review dialog, one selected document-review form, actual filename and latest stored review outcome, compact count of recorded reviews. Upload refreshes both case read model and capabilities. Review audit outcome is separate from upload/eligibility readiness; no regulatory validation was invented.
2. CLOSED: visa delivery only lists/uploads visa documents; other attachments remain in the document file.
3. CLOSED: confirmed payment is not requested again. A missing payment and a missing visa-receipt stage have separate messages, with status actions on the same screen; payment and delivery server guards stay enforced.
4. CLOSED: supplier/direct submission advances to visa_processing and opens delivery while awaiting the result. Supplier evidence remains SUPPLIER_SENT. Later actual authority proof can be appended while processing, with exact evidence time and audit, no rewind or duplicate status mail. Ownership, stale supplier pricing, replay/conflict and rollback checks preserved.

Browser acceptance: actual Stripe TEST paid family cases263 (supplier),264 (direct),265 (supplier then later authority confirmation). Each passed employee upload/review/save, real BASHIR640AED hidden cost, automatic visa-tab opening, shared follow-up queue, two scanned deliveries, completed queue, manager cost visibility, employee finance403 and exactly one closure. No browser page errors. Case265 specifically proved the saved filename/outcome label and the later-authority button. Reopening all3 confirmed one persisted review in the compact view and dialog open/close. Harness adjusted to wait for Radix close animation and compare evidence ENUM values as a set; no application gate bypassed.

Independent read-only checks confirm all3 completed/paid/TEST, two distinct applicant deliveries each with matching scanned byte hashes, and temporary QA accounts inactive. Case263 retains no fabricated authority timestamp;264 has actual direct-proof timestamp;265 has both evidence kinds and authority timestamp with exactly one supplier-submission email job. Synthetic references/images only, no actual authority submission or real inbox-delivery claim. Owner request TSH-680472 was not mutated. Local unrelated dist/boot.js preserved SHA256 FD544988685D8C1A81295ACF50D33B4D38494C5E56CDC81F697BDA296CD36EED.

Screenshots: tmp/erp-compact-documents-263.png, tmp/erp-followup-review-dialog.png, tmp/erp-followup-submitted-delivery.png, tmp/erp-followup-workflow-visa-delivery.png. Operator guide updated. This closes the four screenshot workflow notes; existing external mailbox/WhatsApp, deposit-email acceptance, accounting and explicit production-transfer gates below remain open.

# Preserve later authority confirmation — 2026-10-12, acceptance in progress

Review-result display candidate4c59b62 passed local/server gates and CI38235407513 but is not deployed separately. Final review found that moving supplier dispatch immediately to visa_processing would otherwise remove the old later authority-proof path. Added a narrowly scoped action to append AUTHORITY_FILED evidence only to paid, processing cases with same-supplier prior SUPPLIER_SENT evidence. Existing ownership/pricing checks and checkout lock apply. Confirmation records the actual evidence time, actor/version/timeline and shared follow-up state; it does not rewind/change customer status or duplicate customer mail. Same-key replay succeeds; changed-key payload, foreign owner, missing prior submission, duplicate authority proof and audit failure are guarded. Two mandatory DB cases added (86 total). Local check/lint/tests1553 passed; final build/CI/server/visual acceptance pending.

# Screenshot tasks — deployed and tested, review-result display follow-up — 2026-10-12

Runtime a1ef357317ca9ecfc43f4de98f30b9f3cdd0fa0d passed local/server check/lint/test/build (1552 unit +13 build), CI38234255924 both jobs including84 mandatory database tests. Backup /var/backups/tashira-staging/erp-workflow-a1ef357-1791799911550. Health200, no migration, production unchanged.

Two independent actual Stripe TEST family cases263/264 passed employee and manager browser journeys: save one selected document review in dialog; BASHIR real cost640AED hidden from employee; supplier or direct filing opens visa tab and shared follow-up queue; no non-visa files in delivery; receipt, two scanned deliveries and completed queue; manager sees cost; employee finance403; one closure per case; no page errors. Independent reads confirm both completed/paid/TEST, four distinct applicant deliveries with matching scan hashes, temporary accounts inactive. Customer/authority documents and references were synthetic; no real submission or inbox delivery claim.

Visual review found the dropdown still described reviewed files as awaiting review because the read model exposed upload state only. Follow-up now projects latest applicant/document-scoped audit outcome and actual filename separately from upload/eligibility readiness. Focused17 tests pass; final gates/deployment pending for this display correction. Owner case15 unchanged.

# Screenshot workflow corrections — 2026-10-12, acceptance in progress

Owner-approved tasks: (1) compact document dialog and one selected review form, (2) visa-only delivery uploads/list, (3) distinguish existing paid state from visa receipt prerequisite without asking to confirm payment again, (4) supplier/direct submission advances to processing and opens delivery awaiting the result.

Implementation complete locally; check/lint/test/build passed:1552 unit tests and13 build checks.84 mandatory database cases and staging visual acceptance pending. Supplier dispatch atomically persists processing status, version and one customer status outbox with existing proof/timeline/work audit. Supplier evidence stays SUPPLIER_SENT and does not fabricate the authority system timestamp or stop its guarantee clock. No production change, no change to real supplier rates. Owner case TSH-680472 remains unmodified.

# Latest inbound boundary correction — 2026-10-11

Staging8e1c11f: actual message application/team rollout isolation verified and deployed.1551 unit/13 build/84 CI database tests passed. No live provider ingress activated; connected mailboxes do not provide admin@tashiraev.com access. Existing deposit and external acceptance gates below remain OPEN.

# Latest receipt correction — 2026-10-11

Deposit receipt implementation deployed as c01b181 after1546 unit/13 build and84 mandatory CI database tests. Atomic payment-linked outbox, repeat suppression, exact AED amount and Arabic/English body verified. Actual emailed deposit payment/refund and inbox acceptance remain OPEN; see PROJECT_STATUS. Production untouched.

# Current sequential acceptance — 2026-10-11 (supersedes open-task snapshots below)

1. Products/suppliers: CLOSED on staging. 13 cards/49 real source rates, shared bidirectional editor, costs AED before VAT, no invented supplier prices.
2. Visa amendment money/accounting: actual TEST family application262 passed original payment, customer consent, USD220 top-up and separate TEST-INV-00013, then cheaper-product consent and USD220 refund/TEST-CN-00004. Original TEST-INV-00012 unchanged; hashes and owner download verified. Current51e5314 runtime deployed after CI38157061771 and all gates. Final cross-quote refund guard deployed in f1229f9 after CI38158056038 and1541 unit/13 build gates. Backup and post-deploy acceptance recorded in PROJECT_STATUS. Financial runtime subset CLOSED; email-linked deposit and genuine provider acceptance remain open.
3. Employee/manager continuous operations: SAME paid/amended/refunded application262 passed normal manager assignment, document review state, BASHIR selection, supplier dispatch proof, authority proof, two scanned synthetic visa deliveries and completed queue. Manager sees AED640 for two travellers; staff finance403; exactly one closure attribution. No real authority submission. Earlier harness date input corrected to local time and one-traveller expected cost corrected to family cost; no business guard relaxed. Actual screenshots reviewed.
4. Financial reconciliation: application262 has0 missing Stripe settlements and0 incomplete archives; both invoices and credit note MATCHED. Final profit remains null until actual expense/tax evidence and accounting basis are approved; no invented profit.
5. Deposit acceptance: real provider accepted one AED10 TEST request20683b9a-58b7-4e1b-85f5-575b0d2e2cbe for existing allowlisted synthetic application233 at admin@tashiraev.com. Replay returns same request, encrypted capability purged. Resend GET sent-message access returns401; actual recipient link must be opened to continue. Payment/refund on THIS request NOT tested; do not rerun create and send another request. Existing isolated deposit tests do not substitute for this email-linked journey.
6. Communications: internal authorization/outbox tests pass and actual outbound test acceptance exists. Genuine inbox adapter has no provider ingress caller yet; Hostinger mailbox access/ingress setup and official WhatsApp API provider are external outstanding dependencies. No MX or production mail changes; no API connectivity claimed for the Business app number.
7. Final launch: NOT cleared. Requires deposit link acceptance through payment/refund, inbox receipt and real inbound/WhatsApp routing acceptance, expense/tax/profit basis, and separate production authorization/transfer.

# Current sequence — 2026-10-11

- T1A: verified top-up and separate invoice — PASSED staging8756edd; actual TEST family consent/payment/manager approval; invoices00010/00011; customer download and anonymous denial; CI84DB passed.
- T1B: cheaper-product manual Stripe refund -> existing refund ledger/credit note -> accepted settlement and durable customer notification — IN PROGRESS.
- T2: security-deposit request/accept/payment/refund with real notification link — pending.
- T3: genuine mailbox inbound / official WhatsApp / provider receipt acceptance — external setup pending; compatible internal work continues.
- T4: continuous whole journey, final profit basis and production handover — pending; no launch clearance.

# Next sequential financial task — OPEN, not launch-cleared

1. Connect manual visa-change settlement to verified Stripe evidence and the existing separate difference-invoice issuer. The issuer currently has no runtime caller. Preserve latest owner manual approval policy and original invoice. Require provider/amount/currency/application binding, no repeated movement, atomic accounting, and recoverable email notification; test actual Stripe TEST top-up and cheaper-product refund through customer consent.
2. Complete security-deposit customer acceptance/payment/refund with the actual notification link and invoice/accounting distinction.
3. Genuine inbound mailbox and official WhatsApp integration require provider access; do not represent the Business-app number as an API.
4. Final continuous customer/employee/manager journey and production handover remain open until the above evidence and approved profit basis exist.

PASSED financial subset: actual TEST family payment260, amount matches displayed server quote, one payment after confirmation replay; TEST-INV-00009. Partial refund10USD, TEST-CN-00003, repeated creation same case / repeated execute409. Both PDF archive hashes verified. Invalid synthetic recipient generated FAILED email events; no inbox claim. Temporary accounts disabled.

# Sequential acceptance update — 2026-10-11

- Employee supplier/filing phase: PASSED authenticated visual UAT using BASHIR actual price, synthetic proof, immutable evidence and follow-up list; no additional manager approval required.
- Visa delivery phase: PASSED authenticated visual UAT, real scan, secure delivery preparation and completed queue on runtime01e511a. No real visa/payment/authority submission.
- Workspace layout: overlapping marketing header found and fixed for /staff as well as /admin. Public homepage header preserved. CI38146955312 green; exact-server and local gates passed. Backup recorded in PROJECT_STATUS.
- Finance evidence: existing TEST215/225 reconciled with no missing settlement/invoice/credit note. Legacy overview label clarified and deployed15efc08; missing supplier cost no longer means zero. This does not invent final-profit policy.
- Arabic guide: real product/supplier/filing screenshots added; no fabricated screen mockups. Final runtime15efc08 paired employee/manager visual acceptance PASSED: real cost hidden from staff and visible to manager, staff403, one closure attribution, no page errors.
- External blocked: genuine inbound mailbox connection, official WhatsApp API, approved final-profit definition and actual expense/tax evidence. Continue independent tests; do not simulate these integrations.
- Still open: continuous customer payment/amendment/refund/security-deposit/inbox journey and final launch approval. Prior component tests remain valid but do not replace that acceptance.

# Owner-priority task: products and supplier prices — COMPLETED ON STAGING

Runtime14bc2ee; CI38145494658; migration078.13 cards/49 exact approved rates. Both card directions share one editor/source. Actual order cost capture and historical snapshot protection tested. Headless authenticated visual acceptance passed on both pages, no JavaScript errors; temporary test account disabled. Unknown supplier VAT is explicitly pending and not fabricated. This acceptance does not close remaining unrelated ERP tasks below.

# Remaining ERP completion tasks

Latest owner instruction: finish the remaining work in tested, reviewed logical phases on isolated staging. Production is not authorized. Existing compatible workflows remain authoritative.

## T1 — Scanned visa delivery — SERVER ACCEPTANCE PASSED; VISUAL CHECK IN T4
- T1.1 Preserve exact scanned bytes and validate their hash on read. Reject changed files and unsafe paths; no personal bytes/paths in logs.
- T1.2 Bounded local scanner integration with authentic engine/database, clean/infected/error/timeout outcomes, no automatic PASSED. Avoid cold-start work blocking every click.
- T1.3 Persist byte-bound scan evidence, recheck assignment after scanning, serve the authenticated customer's verified delivery only. Keep retries idempotent.
- T1.4 UI guidance, failed/unavailable retry, multi-traveller completeness, actual synthetic clean/EICAR test on staging. Run check/lint/test/build and mandatory DB integration gates before deployment.

## T2 — Financial attribution — IN PROGRESS
- T2A: correct pricing-margin currency, use stored FX once for family totals, explicitly separate historical base currencies and label quote estimates. Deployed995caae on staging; CI38095960139 including77 mandatory MySQL tests and exact-server gates passed. HTTP health/access checks passed; visual check remains T4.
- T2B1: actual immutable Stripe settlement evidence deployed6248351; CI80/21 passed, actual TEST payment GET/replay verified. Invoice/credit-note matching and actual provider refund UAT passed in T2B2; supplier/internal expense and profit definition remain T2C. Do not estimate settlement FX from invoice FX.
- T2B2: invoice/credit-note archive identity, amount, currency and PDF hash checks deployed dd936d1; actual TEST refund215 GET/replay passed.
- T2C: manager closure details open the per-case financial reconciliation. Final profit remains blocked on actual supplier/internal expense and accounting tax evidence. Attach reconciled per-case results to the existing manager-only closure attribution; reopen/reassignment must not double-count. Missing evidence stays incomplete, never zero/final profit.
- Reconcile actual paid invoices and top-ups, successful refunds/credit notes, supplier cost/VAT, actual Stripe fees and currency conversion.
- Exclude test data; distinguish missing cost or settlement from zero; preserve approved accounting policy.
- Verify reopened/reassigned case attribution and manager-only visibility. No invented final profit.

## T3 — Communications — IN PROGRESS
- T3A deployed: existing durable outbox, current case-owner authorization, immutable request/retry and recipient binding. Migration077 and CI82/21 passed. Actual synthetic reply SENT once with provider ID; inbox receipt not established.
- Reuse existing email/outbox/support ownership; preserve each application's own recipient and language.
- Configure and test genuine inbound/outbound provider connection. Hostinger MX is mailbox hosting; Resend outbound delivery webhook is not inbound mail.
- WhatsApp Business app number is not an official API connection. Record missing provider setup; do not simulate connectivity or change domain MX/production mail.
- Verify events, duplicate prevention, customer reply routing and assigned staff visibility.

## T4 — Full acceptance and handover — OPEN
- New draft TEST classification fix deployed8224e02; final family API UAT passed on runtime4f866de. Customer supplier-cost leak fixed on both getters; actual customer/staff/manager boundary checks passed.
- Synthetic staging customer/employee/manager journey: save/resume, payment, amendment/top-up invoice, partial refund, supplier dispatch/filing proof, visa delivery, tracking/email.
- Verify queue transitions, concurrency/ownership, prohibited staff financial/admin actions and historical application compatibility.
- Final real scanner/download regression and HTTP ownership tests passed; these do not replace visual acceptance.
- Authenticated visual UAT and Arabic illustrated guide. Isolated authenticated Playwright now passes employee/manager operational acceptance; interactive CUA still fails. Customer financial/inbox visual acceptance remains open.
- Final transfer checklist/rollback and exact remaining owner actions. No launch-ready claim until evidence exists.

Each phase: implement -> focused tests -> full required gates -> review -> staging deployment -> evidence -> update PROJECT_STATUS. External blocked items do not stop independent work.
