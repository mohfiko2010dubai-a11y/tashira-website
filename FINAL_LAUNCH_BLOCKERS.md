# TASHIRA Final Launch Blockers

Date: 2026-08-11
Current verdict: **not approved as a Launch Candidate**

## P0 — must be resolved before launch-candidate approval

1. **Public staging DNS and TLS**
   Provision `staging.tashiraev.com`, route it only to the isolated staging process, and validate TLS, headers, direct-route behavior, webhook reachability, and cross-device sessions. Current staging is private on `127.0.0.1:3002` and was accessed only through an SSH tunnel.

2. **Stripe TEST configuration and complete UAT**
   Provide approved test-only publishable, secret, and webhook credentials. Execute success, decline, retry, incomplete, 3DS, duplicate attempt, webhook replay/idempotency, invoice equality, price snapshot, evidence, and ZIP/postal-code tests. Confirm no LIVE key is present.

3. **Sandbox email and recovery**
   Select a test transport and synthetic recipients. Verify every transactional template, delivery failure handling, magic link/OTP expiry and attempts, same-device resume, and cross-device recovery. Do not send to real customers.

4. **Complete authenticated browser UAT**
   Seed approved synthetic admin/staff accounts or provide a secure credential handoff. Cover login/logout/session expiry, applications, applicants, documents, status changes, payments, invoices, settings, pricing, VAT, finance, dashboards, search/filtering, analytics, risk, evidence, and retention/legal-hold UI.

5. **Approved business configuration**
   Owner approval is required for final prices, costs, markup, promotions, minimums, currency, exchange-rate policy, company legal identity, VAT status/TRN/rate/effective date, threshold definition, warning levels, and invoice numbering. Current values are staging placeholders.

6. **Security dependency review**
   Triage the 24 npm audit findings reported by the clean staging install (1 low, 7 moderate, 16 high). Apply reviewed, compatible upgrades only; do not use an automatic breaking `audit fix --force`.

## P1 — required before production change approval

- Approve retention periods, legal-hold authority, deletion workflow, backup lifecycle, and subject-request handling.
- Approve refund and dispute policies and any post-submission/post-payment document replacement rules.
- Confirm and rotate the credential-like historical MySQL secret if it is active; perform the rotation only as an explicitly approved production operation with rollback.
- Produce a production migration runbook with verified backup, least-privilege grants, maintenance window, monitoring, and tested rollback criteria.
- Validate non-zero paid finance, VAT, invoice, payment success rate, margin, AOV, trend, refund, and chargeback calculations using known synthetic Stripe TEST outcomes.
- Complete privileged document replace/delete/signed URL/preview/download/version-history and restart-persistence tests.
- Review hard-coded public legal/company statements against approved records.
- Resolve or formally accept the chatbot family-detail limitation.

## P2 — stabilization follow-up

- Analyze and split the approximately 3.46 MB main client chunk (717.7 kB gzip).
- Review the approximately 35.1 MB server bundle.
- Refresh browser compatibility metadata through a reviewed dependency change.
- Add automated browser E2E coverage for the critical customer, payment, admin, document, and recovery paths.
- Add controlled query profiling after representative synthetic paid data exists; no aggressive production load testing.

## Explicit safety confirmation

- Migration 005 was applied only to `tashira_staging`.
- No production database, storage, documents, services, deployment configuration, or customer data were modified.
- No main/master commit, push, merge, or production deployment occurred.
- Stripe LIVE was not enabled or used.
- No real customer email was sent.
- The preserved stash was not applied or dropped.
