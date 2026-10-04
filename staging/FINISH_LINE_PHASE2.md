# FINISH-LINE Phase 2 — deployed on staging, UAT not accepted

## Current checkpoint — 4 October 2026

Supersedes historical candidate notes below. Runtime1c838f26071a8e50710f5e916e1dbc7113d4e42a deployed successfully; both local and public health200. Migrations065–067 applied after backup `/var/backups/tashira-staging/2026-10-04T17-41-26-078Z-owner-access`. Database identity and exact three inactive accounts verified; no generated passwords/MFA secrets. Existing login remains enabled, named owner verification not yet recorded.

Browser verification: `/staff/setup` displays password setup guidance and refuses missing token; `/admin/login` displays named-account login plus working existing-administrator entry; anonymous `/admin/approvals` reaches login instead of404. Three one-time invitations were provider-accepted for the authorized owner/agent1/agent2 plus-addresses, expire24 hours, and store hashes only. Provider receipts retained privately on staging. Inbox delivery and password/MFA completion require owner confirmation.

Local1330 tests plus check/lint/build pass; CI37222260401 Verify and MySQL jobs pass, including26 database tests with zero skips. Initialf497b41 runtime failed on duplicate createRequire and automatically rolled back to d57a699; corrected release aliases the banner import, externalizes native sharp, and syntax-checks the final bundle. Second deployment passed all gates and actual startup. Logs retained in root tmp/owner-access-deploy.log and tmp/owner-access-retry-deploy.log.

Pending, not claimed complete: all eight named-user staff UAT scenarios; remaining role-scope verification including supplier selection and deposit/adjustment requests; owner setup/MFA for all three; mail webhook acceptance; full customer journey. Written recovery exists in STAFF_ACCESS_RECOVERY.md. Do not disable legacy access before owner ADMIN+MFA proof and confirmation. Production unchanged/CLOSED; original15 dirty files preserved.

## Historical implementation notes

Phase 1 is closed at staging d57a699. Phase 2 implementation is in progress on the isolated approved worktree. Production remains CLOSED and unchanged.

ACCOUNTS-AUTHORISATION received4 October supersedes the account blocker below. The exact owner/agent1/agent2 plus-address identities were created inactive via the existing synthetic guard, without generated passwords. Candidate adds one-time owner password setup, MFA proof for the nominated administrator, and a default-closed database-controlled transition that temporarily retains existing administrator access until the owner proves the new login. Recovery steps: STAFF_ACCESS_RECOVERY.md. Review also found application.list exposed supplier-cost fields to staff: response middleware now removes known financial keys recursively for agents, with actual-router tests; both the requesting and the other agent are denied approval. Additive067 and final candidate validation/deployment are tracked in PROJECT_STATUS.md. No legacy cutover until owner confirmation.

4 October follow-through: owner asked to continue the remaining phase instead of spending more time on the undeployed approvals link. Candidate links now retain real UUID case anchors across named login/MFA. Documents-complete email uses the shared regular48/Express24-hour copy. Obsolete queue jobs become SUPPRESSED, not falsely SENT (additive migration066, not yet applied). Partial-refund retries reserve only failed items, require approval again, aggregate earlier successes, retain uncertain provider outcomes, and record only newly completed financial events. Outcome notification keys change only when more items complete. Local execution/router regression tests cover these cases. Full validation and exact-commit hosted MySQL validation are recorded in PROJECT_STATUS.md after completion.

Runtime remains Phase1: do not deploy the named-login replacement until a tested named administrator exists. Persistent synthetic account creation was rejected by automatic approval review pending explicit approval of phase2-maker/staff, phase2-checker/admin and phase2-outsider/staff; no such accounts were created. The user's general instruction to continue independent phases has not been used to bypass that rejection. Actual authenticated browser/Stripe TEST/watermark/restart UAT remains outstanding. No production change, automatic-mail activation or further sample email sent.

4 October EMAIL-FINDINGS update: owner confirms the first batch reached Outlook Inbox and Arabic RTL works in a real client. Customer/internal layouts now separated, image dependency removed, Arabic copy/HTML anchors corrected, transport test prefix made configurable, and eight corrected samples sent. Local check/lint/build and1297 tests pass;26 MySQL tests require hosted CI. The new supplier/licence templates have renderers but no automatic producers; migration065 is not applied to staging. Full exact authentication findings, destinations and remaining limitations: [EMAIL_FINDINGS.txt](EMAIL_FINDINGS.txt). No Phase2 runtime deployment or completion claim.

## Candidate scope

- Default-deny repository-wide AST environment check; exact reasoned exceptions for infrastructure, governance authorization and offline fixtures. A new-directory mutation test verifies automatic coverage.
- Named staff/admin accounts, mandatory TOTP enrollment/verification, encrypted MFA secrets, replay rejection, 15-minute idle and 8-hour absolute sessions. Background polling does not extend idle time. HttpOnly cookies replace browser-stored bearer tokens. Shared administrator login no longer grants access. Deactivate only; immutable staff identity.
- Staff document grants bound to the named active account, 120-second expiry, case scope rechecked at retrieval, append-only view/download records, PDF/image watermarked copies, originals preserved. Unauthenticated public Drive upload router removed from registration. Original storage responses restricted to the owning customer's issued visa.
- Automatic full paid Express-component refund after the objective continuous deadline. Named maker/checker manual approval, administrator password reauthentication, original Stripe charge/remaining balance, queue oldest first, rejection reason, balance by currency, provider result/error and retry/reconciliation. Uncertain Stripe POST outcomes stay reserved pending reconciliation by immutable item metadata.
- Bilingual transactional templates, stored order language, safe plaintext/footer, durable jobs and retries, email failure dashboard, signature-verified/deduplicated delivery receipts, send/delivery/bounce timeline and bounce flag. Substitution acknowledgement remains required by the existing server/database filing guard.

## Verification status

Baseline candidate: 1277 local tests passed, with 26 MySQL integration tests exercised separately. Hosted CI37214773046 passed both jobs, including those26 tests without skips and the new MySQL audit/mail invariants. The later named-refund router and stale-proposal fixes passed8 focused tests; final candidate2e59dea passed both hosted CI37215508886 jobs: type-check, lint,1285 tests, build and the separate26 MySQL tests with zero skipped. Its guarded transport/static-secret scan also passed (bundle SHA25669ce03f0f416a5cb991991a9ee6c69133531267815917ff972d0bc662c7daee2). Browser, real Stripe TEST, watermark delivery, worker restart and concurrency UAT remain outstanding. No claim of Phase2 completion.

## Mail prerequisite identified by read-only staging inspection

Superseded by EMAIL-ADDENDUM on 4 October: admin@tashiraev.com is the configured From, Reply-to and test recipient. A sending key was found in the existing staging/secrets/resend_api_key file loaded by run-native.mjs; the earlier inspection of PM2/root .env alone was incomplete. Sending succeeds despite domains-list API returning401. A webhook signing secret remains outstanding. Automatic application mail remains disabled; only explicitly authorized synthetic test messages were sent. No production credentials copied.

The addendum replaces the three-provider gate: verify the admin inbox now; Outlook is optional later and Yahoo is dropped. Provider acceptance is insufficient for inbox placement. Signature implementation follows https://docs.svix.com/receiving/verifying-payloads/how-manual and is checked with a separately signed, randomly keyed test fixture. The previously tested public reference vector was removed because the deployment scanner correctly forbids credential-shaped literals; the scanner is unchanged.

## Actual message authentication and template sends — 4 October 2026

Checker: https://mail-tester.com/test-hz8sq5plo. An actual synthetic Arabic message sent through the existing staging key returned these results:

- SPF: "[SPF] Your server 23.251.234.51 is authorized to use 010601a107bea22f-9cee5436-f371-4073-8da4-445909e3c621-000000@send.tashiraev.com"
- DKIM: "Your DKIM signature is valid"; signing domain tashiraev.com, selector resend.
- DMARC: "Your DMARC record is set correctly and your message passed the DMARC test"; record `v=DMARC1; p=none`; result `dmarc=pass (p=none dis=none) header.from=tashiraev.com`.
- Alignment: DKIM domain equals From domain tashiraev.com; SPF send.tashiraev.com aligns under default relaxed alignment. DNS policy was not changed.
- Overall score5.6/10, not an inbox guarantee. Shared SES IP23.251.234.51 listed on Hostkarma (-1); SpamAssassin penalties included short image-heavy content and uppercase synthetic identifiers/subject. Nineteen other lists reported not listed. These findings remain visible rather than being treated as full deliverability acceptance.

All19 actual candidate templates sent in both EN/AR (38 provider-accepted messages) to admin@tashiraev.com only. Synthetic staging application225 supplied invoice data; no real payment/order action occurred. Each send has a SENT outbound event and a stable addendum-20261004-language-template idempotency key. Private evidence: /var/lib/tashira-maintenance/email-addendum-template-results.json. An initial English authentication probe was also sent to admin; one Arabic probe went to the checker. Inbox versus Spam, plaintext client rendering and Arabic RTL in the real admin mailbox remain UNVERIFIED pending an authenticated mailbox view.

Nonsecret sender/recipient settings were persisted in staging PM2 config, root .env and staging/.env; the latter previously overrode From with onboarding@resend.dev. Backups: /var/backups/tashira-staging/2026-10-04T16-24-57-037Z-email-addendum and /var/backups/tashira-staging/2026-10-04T16-34-08-348Z-email-runtime. No runtime restart or automatic-mail activation. Screenshot: root workspace tmp/email-addendum-authentication.png.

## Staging checkpoint and access prerequisite — 4 October 2026

Migrations062–064 applied only after verifying database tashira_staging and user tashira_staging_app. Private backup: /var/backups/tashira-staging/2026-10-04T15-58-07-036Z-phase-two. All six new audit/protection triggers verified through database-administrator read-only inspection; the application user cannot enumerate trigger metadata. Health remains200. Runtime remains the verified Phase1 d57a699; Phase2 application code has NOT been deployed. Original15 unrelated dirty files remain unchanged.

The first transport scanner rejected a public Svix reference key in a test. It was replaced by a random disposable key; the scanner remained unchanged and accepted4372359. Subsequent review caught and fixed the legacy actor identity in the refund router; actual-router tests now prove distinct checker acceptance, self-approval refusal, and shared-admin refusal. Stale substitution messages are no longer sent after the proposal changes or is acknowledged.

Automatic approval review rejected creation of three persistent synthetic staging accounts, including an administrator, because the exact identities/roles had not been specifically approved. No account was created (verified count0). Owner approval requested for phase2-maker (staff), phase2-checker (admin), and phase2-outsider (staff with no case access), random private credentials, mandatory MFA and deactivation after UAT. Do not work around this rejection or deploy the new login before a tested named administrator is available. This blocks account-based UAT; the mail prerequisites are independently outstanding.

The environment policy uses exact path exceptions with written reasons, including offline fixtures and governance authorization; it is not a business-file inclusion list. Changes to the exception list are reviewable.
