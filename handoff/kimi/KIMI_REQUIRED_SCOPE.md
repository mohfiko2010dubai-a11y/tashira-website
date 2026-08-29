# Kimi Required Scope — Final Staging Acceptance

The delivery criterion is a browser-executable, end-to-end Staging journey, not backend code alone.

## Customer

- Real Dynamic Form in the customer journey, not a developer-only screen.
- Individual, Family and Group/travel-party journeys.
- Multiple applicants with independent nationality, residence, route, answers, requirements and documents.
- Explicit relationships, lead applicant and shared versus applicant-specific evidence.
- Save, exit and resume the same application.
- Document Intelligence and Human Review without AI eligibility decisions.
- Payment readiness, Stripe Test payment, invoice and customer timeline.

## Staff

- Professional dashboard and searchable/filterable case list.
- Applicant-scoped document preview/download/upload/review.
- Request missing/replacement documents and record attributable notes.
- Assignment/claim/reassignment, controlled status transitions and re-evaluation request.
- Deposit, payment and refund visibility/actions under correct permissions.
- Visa upload, approval, secure delivery and audit evidence.
- Operations staff must not be hard-coded View Only; capabilities come from RBAC and scoped flags.

## Manager and owner

- Team/scoped workload, readiness, SLA, manual-review and document-intelligence metrics.
- Employee/team/role/permission administration with least privilege.
- Complete immutable timeline/audit review.
- Owner/Admin retains legacy Admin functionality and finance separation.

## UX and compatibility

- Search, filters, breadcrumbs and reliable back navigation.
- Responsive English/Arabic experience with correct LTR/RTL.
- Clear empty/loading/error/permission states; no blank screens.
- Preserve existing Admin, payment, invoice, email, storage and legacy application compatibility.

## Browser acceptance

From an external browser, prove: create synthetic individual and family applications; per-applicant adaptive questions; save/resume; upload; same data in Operations; staff actions and audit; manager oversight; Stripe Test success/decline/3DS; secure invoice/visa access; unauthorized/wrong-team/cross-applicant denial. Record PASS/FAIL/CHANGE REQUEST in `docs/STAGING_OWNER_ACCEPTANCE_GUIDE.md`.

## Prohibited

No Production, `main/master`, Stripe Live, Resend Live, real customer data, fabricated official rules, or unapproved feature activation.
