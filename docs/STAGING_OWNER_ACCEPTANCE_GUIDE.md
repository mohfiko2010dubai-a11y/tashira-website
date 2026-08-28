# TASHIRA Staging Owner Acceptance Guide

Status: **ready for owner browser acceptance on isolated Staging**.

This guide is for synthetic testing only. It does not authorize Production changes, a merge to `main`/`master`, live payments, real customer data, official-rule activation, or external-provider activation.

## Environment and access

- Customer start: <https://staging.tashiraev.com/apply>
- Track an application: <https://staging.tashiraev.com/track>
- Staff/Operations sign-in: <https://staging.tashiraev.com/staff/login>
- Legacy Admin sign-in: <https://staging.tashiraev.com/admin/login>
- Staging Owner username: `staging-owner`
- Password: set or rotate only through the staging-only hidden-input reset procedure. It must never be written in this file, Git, logs, screenshots, or reports.

The `staging-owner` identity is isolated to Staging and can be revoked after acceptance. A successful staff login opens the Operations Dashboard.

## Direct Operations links

These routes require the authenticated Staging Owner session:

- Operations Dashboard: <https://staging.tashiraev.com/staff/operations/dashboard>
- Applications: <https://staging.tashiraev.com/staff/dashboard>
- Submission Queue: <https://staging.tashiraev.com/staff/operations>
- Support Inbox: <https://staging.tashiraev.com/staff/operations/support>
- Suppliers and SLA: <https://staging.tashiraev.com/staff/operations/supplier-sla>
- Operational Policies: <https://staging.tashiraev.com/staff/operations/policies>
- Visa Rules / Regulatory Changes: <https://staging.tashiraev.com/staff/operations/regulatory-changes>

The Regulatory Change Center and customer-wide regulatory behavior remain intentionally unavailable while the Regulatory Watcher and unapproved official rule content are OFF. Feature flags and RBAC are controlled server-side; there is no public unrestricted settings URL.

## Prepared synthetic cases

- Dynamic family case: `TSH-MTD3XOV8-0F7EBB`
  - Customer status: <https://staging.tashiraev.com/applications/TSH-MTD3XOV8-0F7EBB/status>
  - Resume interview: <https://staging.tashiraev.com/apply/TSH-MTD3XOV8-0F7EBB/interview>
  - Operations workspace: <https://staging.tashiraev.com/staff/operations/TSH-MTD3XOV8-0F7EBB>
  - Expected evidence: two independent applicants (EG and PK), `SPOUSE` relationship, applicant-scoped requirements, both evaluations requiring Human Review, family `NOT_READY`, and server-derived initial team routing.
- Controlled-actions case: `OPS-1787649160315`
  - Operations workspace: <https://staging.tashiraev.com/staff/operations/OPS-1787649160315>
  - Expected evidence: synthetic passport attached to Applicant 1 only; Document Review, Human Review and `documents_received → under_review` actions; immutable Timeline entries with trusted actor, reason and server timestamp; classification `LEGACY_NOT_EVALUATED`.

Do not replace these references with real customer information. New acceptance cases must use invented names, email addresses reserved for testing, and non-real documents.

## Stripe Test data

Use only when a synthetic application reaches the server-authoritative `READY` payment gate and the page explicitly says TEST mode:

| Scenario | Test card | Expiry | CVC | Expected result |
|---|---|---|---|---|
| Successful payment | `4242 4242 4242 4242` | Any future date | Any 3 digits | Payment succeeds. |
| Declined payment | `4000 0000 0000 0002` | Any future date | Any 3 digits | Payment is declined and remains retryable. |
| 3DS authentication | `4000 0025 0000 3155` | Any future date | Any 3 digits | Stripe Test authentication challenge is required. |

Never enter a real card on Staging. Payment access must remain blocked when applicant data, policy acceptance, documents, immutable pricing, or readiness is incomplete.

## Browser acceptance checklist

Record one result for every row: `PASS`, `FAIL`, or `CHANGE REQUEST`.

| # | Scenario and steps | Expected result | Owner result |
|---:|---|---|---|
| 1 | Open the Customer start link. Choose Individual, select a visa service, enter synthetic contact details, accept the policies and continue. | One application/reference is created and the Dynamic Interview opens for Applicant 1. | |
| 2 | Answer nationality, passport country, residence and other adaptive questions. | Questions, warnings and required documents are scoped to that applicant and change deterministically from the answers. | |
| 3 | Start a second synthetic case as Family / multiple applicants and add at least two travellers with different nationalities/residences. | Each member has a trusted applicant ID, independent answers/evaluation/requirements, and explicit family relationship. No data crosses applicants. | |
| 4 | Save/leave the family case, then use its Status and Resume links. | The same application and applicants reopen; no duplicate case or applicant is created. | |
| 5 | Upload only synthetic/non-sensitive test files to the selected applicant. | Every document stays owned by the selected applicant. A missing/failed document blocks only the correct member and family readiness is deterministic. | |
| 6 | Open the same reference from Applications/Operations. Inspect Overview, Applicants, Requirements, Documents, Evaluation History, Family Readiness and Timeline. | Customer answers and applicant isolation match the customer view; historical snapshots are immutable; legacy cases are labelled, never invented. | |
| 7 | On the controlled-actions synthetic case, inspect/download the synthetic document and review it. | Review applies only to its applicant, requires a reason/version, and appends audit evidence. | |
| 8 | Perform Human Review and an allowed status transition on a synthetic case. | Only server-advertised actions appear. Invalid, stale, wrong-team or unpaid paid-only transitions fail closed. | |
| 9 | Assign/reassign a synthetic case to an authorized staff member. | The server derives team/scope from trusted RBAC, protects concurrency and records assignment history. | |
| 10 | Inspect supplier and dashboard surfaces as Owner. | Operational supplier identity is visible where allowed. Supplier cost, internal cost, margin and profit are absent unless a separate finance permission explicitly permits them. | |
| 11 | Attempt to open the staff routes while signed out or from an unauthorized identity. | Login or access-denied response; no case, document, supplier or finance data is disclosed. | |
| 12 | Attempt payment before readiness, then use Stripe Test only on a READY synthetic case. | Incomplete case has no card entry. READY case creates one Test PaymentIntent; retry/replay must not duplicate payment or invoice evidence. | |
| 13 | Switch English/Arabic and test desktop/mobile widths. | LTR/RTL, navigation, forms, tables, actions and error states remain understandable and usable. | |
| 14 | Use browser Back, hard refresh and direct deep links. | The same state returns safely; no duplicate application, applicant, controlled action or payment occurs. | |

## Expected closed or external dependencies

- Official Visa Rules and customer-wide regulatory outcomes: **OFF pending owner approval of authoritative content and sources**.
- Regulatory Watcher: **OFF**.
- External Document Intelligence/OCR provider: **not connected**; provider-neutral code and synthetic evidence only.
- Inbound mailbox, Typing Pack/authority submission and supplier integrations: **provider/procedure decision required**.
- Controlled Writes: available only in the expressly scoped Staging Owner acceptance context; not globally or customer-facing.
- Stripe: **TEST only on Staging**.
- Resend/email: never use Production/Live delivery for this acceptance; use only the explicitly approved staging recipient and configuration when a mail scenario is separately tested.

## Acceptance outcome

Owner decision:

- [ ] `PASS — acceptable for the next owner gate`
- [ ] `FAIL — blocking defect found`
- [ ] `CHANGE REQUEST — changes listed below`

Notes:

```text

```

Production modified: **NO**. Production database/documents modified: **NO**. `main`/`master` modified: **NO**.
