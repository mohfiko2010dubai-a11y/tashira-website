# TASHIRA Blocked Decisions

## Resolved during Phase 6D

The wizard now persists its primary applicant at applicant index `0` in the canonical `applicants` table. No schema migration was introduced. Production was not inspected or changed.

## Family applicant capture

The chatbot accepts an applicant count of 2–20 but its current conversation collects only one person's details and documents. Completing this safely requires an approved UX decision for iterating applicants, shared versus per-applicant fields, and per-applicant document requirements. Until then, the canonical multi-applicant web form remains the supported family flow.

## Customer recovery across devices

Customer access now uses a signed, HttpOnly browser capability. It supports safe resume and payment on the device that created the application without exposing applications by guessable reference alone. Cross-device recovery requires an approved identity-verification design (for example, verified email one-time links). A reference number alone must not become authentication.

## Transactional email provider

The repository has no mail transport dependency or selected provider. Staging exposes Mailpit SMTP, but production provider credentials, sender/domain policy, retry behavior, and templates are not defined. Choose and approve a provider before implementing application, payment, document, and completion notifications. The UI must not claim an email was sent until this is implemented.

## Server-authoritative pricing and VAT

The form and chatbot contain client-side price tables, while application creation still accepts calculated totals from the browser. Stripe intent creation correctly uses the stored server amount, but the authoritative product/fee/VAT catalogue is not represented server-side. Confirm the canonical prices, exchange-rate policy, fee/VAT inclusivity, and effective-date rules before replacing client totals.

The admin VAT screen currently assumes every paid customer total includes 5% VAT, while both invoice generators explicitly state that VAT is disabled until a TRN is obtained. The VAT report must not be treated as accounting output until registration status and tax treatment are approved and reconciled.

## Customer document replacement

Customers can safely retry failed uploads without duplicating successful files. Replacing or deleting a successfully recorded customer document needs a retention/audit policy and an atomic storage-plus-metadata design. Staff/admin replacement remains the existing supported workflow.

## Timeline, dispute evidence, and privacy retention

No approved legal or business retention period exists for application timeline events, payment journey evidence, policy-acceptance records, generated evidence manifests, or the underlying customer documents. Define retention by data category, jurisdiction, dispute window, legal hold, deletion request handling, and backup lifecycle before production activation. Do not automatically purge or retain indefinitely based on an engineering assumption.

Database-level append-only trigger enforcement also requires an operational decision: the application exposes no update/delete method for timeline rows and foreign keys restrict parent deletion, but production database privileges and trigger rollout must be reviewed before adding database triggers.
