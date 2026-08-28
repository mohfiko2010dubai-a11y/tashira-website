# TASHIRA Blocked Decisions

## Current authoritative remaining gates — 2026-08-28

The historical sections below preserve decisions and launch evidence from earlier
phases. They do not override this current gate list.

Only these Visa Operations OS V1 decisions remain open:

1. Approval and governed activation of reviewed official Visa Rule and Requirement
   Catalog content/source classifications.
2. Selection and approval of external AI/OCR, inbound-mailbox, authority/Typing
   Pack and supplier procedures/providers where live operation requires them.
3. Owner visual Staging acceptance and any resulting concrete change requests.
   Engineering Browser E2E is complete and is not tool-blocked.
4. Legal/business retention and deletion durations by evidence/data category.
5. Separate exact authorization for `main`/Production merge, backup/rehearsal,
   Migrations `014–043`, deployment, named RBAC grants and each Production feature
   activation.

Public Staging DNS/TLS, Staging authentication, Stripe Test wiring, transactional
email foundations and external Browser access have already been established in
later phases. Historical entries below that describe those items as absent are
superseded and must not be treated as current blockers.

## Visa Operations OS owner-policy decisions resolved

The owner has approved the V1 Submission Scheduler thresholds (`45/21/7/3`), dashboard alerts (`14/7/0`), fail-safe Human Review, pre/post-submission travel-date behavior, AI advisory boundary, official-source hierarchy, rule-driven ticket requirements, per-applicant family evaluation, Travel Party behavior, minor/accompaniment safety, and separation of Entry Validity from Stay Duration. These items are implemented as versioned, configurable and auditable governance and must not be reported as unresolved owner business configuration.

Remaining Visa Operations OS gates are limited to reviewed official content/source approvals, external provider or operating-procedure selection, protected Browser E2E acceptance, legal retention/deletion durations, and separately authorized main/Production actions. See `docs/VISA_OPERATIONS_OS_V1_OWNER_GATE.md`.

## Resolved during Phase 6D

The wizard now persists its primary applicant at applicant index `0` in the canonical `applicants` table. No schema migration was introduced. Production was not inspected or changed.

## Family applicant capture

The chatbot accepts an applicant count of 2–20 but its current conversation collects only one person's details and documents. Completing this safely requires an approved UX decision for iterating applicants, shared versus per-applicant fields, and per-applicant document requirements. Until then, the canonical multi-applicant web form remains the supported family flow.

## Customer recovery across devices

Customer access now uses a signed, HttpOnly browser capability. It supports safe resume and payment on the device that created the application without exposing applications by guessable reference alone. Cross-device recovery requires an approved identity-verification design (for example, verified email one-time links). A reference number alone must not become authentication.

## Transactional email provider

The repository has no selected delivery provider. The current isolated native staging runtime has no sandbox mail transport configured. Production provider credentials, sender/domain policy, retry behavior, and templates are not defined. Choose and approve a provider before enabling application, payment, document, and completion notifications. The UI must not claim an email was sent until this is implemented.

## Server-authoritative pricing and VAT

Application creation now obtains its amount from versioned server-side pricing rules and stores an immutable price snapshot; client-supplied totals are not accepted by that API. Phase 8 verified this behavior with synthetic versioned prices in staging. The opening production prices, exchange-rate policy, fee/VAT inclusivity, and effective-date rules still require owner approval.

The admin VAT screen currently assumes every paid customer total includes 5% VAT, while both invoice generators explicitly state that VAT is disabled until a TRN is obtained. The VAT report must not be treated as accounting output until registration status and tax treatment are approved and reconciled.

## Customer document replacement

Customers can safely retry failed uploads without duplicating successful files. Replacing or deleting a successfully recorded customer document needs a retention/audit policy and an atomic storage-plus-metadata design. Staff/admin replacement remains the existing supported workflow.

## Timeline, dispute evidence, and privacy retention

No approved legal or business retention period exists for application timeline events, payment journey evidence, policy-acceptance records, generated evidence manifests, or the underlying customer documents. Define retention by data category, jurisdiction, dispute window, legal hold, deletion request handling, and backup lifecycle before production activation. Do not automatically purge or retain indefinitely based on an engineering assumption.

Database-level append-only trigger enforcement also requires an operational decision: the application exposes no update/delete method for timeline rows and foreign keys restrict parent deletion, but production database privileges and trigger rollout must be reviewed before adding database triggers.

Phase 8 verified the proposed MySQL append-only triggers in the isolated `tashira_staging` database. Production rollout, backup, maintenance-user privileges, and rollback approval remain separate decisions.

## Phase 8 external launch blockers

- Provision DNS and TLS for `staging.tashiraev.com` before public/cross-device UAT. The verified staging listener is intentionally private on `127.0.0.1:3002` and was reached only through an SSH tunnel.
- Supply approved Stripe TEST credentials and a staging webhook endpoint before payment success, failure, retry, 3DS, replay, idempotency, invoice, and payment-evidence UAT.
- Select a sandbox mail provider and approve synthetic test recipients before delivery, magic-link, OTP, and cross-device recovery UAT.
- Provide approved synthetic staff credentials and a safe browser-secret handoff if authenticated staff/admin browser UAT is required. Server-side authentication and authorization smoke checks passed, but the complete authenticated dashboard matrix was not executed in the browser.
- Review the 24 dependency-audit findings reported by `npm ci` (1 low, 7 moderate, 16 high) without applying an automatic or breaking upgrade.

## Phase 7 launch decisions

- Approve the opening pricing-rule dataset: supplier cost, internal cost, markup, selling/promotional/minimum prices, currency, and effective dates. Engineering must not invent these commercial values.
- Approve company legal identity and finance settings, including VAT registration state, TRN, invoice sequence, base currency, and exchange rate source.
- Tax/legal review must define relevant sales, registration threshold inputs, VAT calculation/treatment, and effective dates. The configurable monitor intentionally does not encode legal rules.
- Define exact retention durations, legal-hold authority, deletion authorization, backup deletion behavior, and subject-request handling by category.
- Approve commercial refund policy and dispute handling rules before enabling refund execution. The current implementation records requests/events only.
- Select and approve recovery/email providers, sender identity, message wording, OTP expiry/attempt policy, and production delivery credentials. Delivery remains disabled.
- Review the disclosed risk and Business Health weights. Neither engine makes automated customer decisions.
- Review migration 005 triggers and least-privilege MySQL grants in staging before any production migration request.

## Credential rotation required

Static migration review found a credential-like MySQL password embedded in the historical comment of `db/migration.sql`. The value has been removed from the working branch, but Git history must be treated as exposed. The database owner must identify whether that credential is active and rotate it through an approved production change. Codex did not test, use, or change the credential or production database.
