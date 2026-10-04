# FINISH-LINE Phase 2 — candidate, not accepted

Phase 1 is closed at staging d57a699. Phase 2 implementation is in progress on the isolated approved worktree. Production remains CLOSED and unchanged.

## Candidate scope

- Default-deny repository-wide AST environment check; exact reasoned exceptions for infrastructure, governance authorization and offline fixtures. A new-directory mutation test verifies automatic coverage.
- Named staff/admin accounts, mandatory TOTP enrollment/verification, encrypted MFA secrets, replay rejection, 15-minute idle and 8-hour absolute sessions. Background polling does not extend idle time. HttpOnly cookies replace browser-stored bearer tokens. Shared administrator login no longer grants access. Deactivate only; immutable staff identity.
- Staff document grants bound to the named active account, 120-second expiry, case scope rechecked at retrieval, append-only view/download records, PDF/image watermarked copies, originals preserved. Unauthenticated public Drive upload router removed from registration. Original storage responses restricted to the owning customer's issued visa.
- Automatic full paid Express-component refund after the objective continuous deadline. Named maker/checker manual approval, administrator password reauthentication, original Stripe charge/remaining balance, queue oldest first, rejection reason, balance by currency, provider result/error and retry/reconciliation. Uncertain Stripe POST outcomes stay reserved pending reconciliation by immutable item metadata.
- Bilingual transactional templates, stored order language, safe plaintext/footer, durable jobs and retries, email failure dashboard, signature-verified/deduplicated delivery receipts, send/delivery/bounce timeline and bounce flag. Substitution acknowledgement remains required by the existing server/database filing guard.

## Verification status

Earlier candidate: 1277 local tests passed; 26 MySQL tests require the dedicated CI database. Full build completed. Further authentication/queue edits are undergoing repeat gates. New migrations 062–064 and additional MySQL invariants are not deployed or verified yet. Browser, real Stripe TEST, watermark delivery, worker restart and concurrency UAT remain outstanding. No claim of Phase 2 completion.

## Mail prerequisite identified by read-only staging inspection

Actual staging runtime has no Resend API key or webhook signing secret. Public DNS has root SPF for Hostinger, send-subdomain SPF for Amazon SES, a Resend DKIM record, and DMARC p=none. These records are not proof of successful authentication or inbox placement. Awaiting owner-provided secure configuration location, monitored company sender, and an owned Outlook recipient. Gmail/Yahoo destinations were already supplied. No customer mail activated; no production credentials copied.

Real Gmail/Outlook/Yahoo inbox placement and authentication headers are mandatory before closing this phase. Provider acceptance/delivery is insufficient. Signature implementation follows https://docs.svix.com/receiving/verifying-payloads/how-manual and is checked against its published reference vector.
