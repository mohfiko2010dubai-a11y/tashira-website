# Named access transition and recovery

## Owner decision — 8 October 2026 (supersedes MFA instructions below)

The owner explicitly requested username/password-only sign-in for named staff and administrators. Authenticator enrollment and codes are no longer required. Existing encrypted MFA records are preserved but not read during login. Password validation, active-account checks, named roles/audits, login rate limits, secure HttpOnly cookies and idle expiry remain enforced. A successful named administrator password login records the transition verification. Legacy login cutover still requires its existing separate authorization; this change does not disable it.

A lost phone no longer prevents sign-in. For a lost password, verify the owner's identity through the trusted recovery channel and obtain specific recovery authorization; do not create or send a password on their behalf. Keep the same account ID and audit history. Existing invitations must not reset an established account. The historical MFA reset/enrollment procedure below is not applicable while password-only policy is in force. Deployment remains staging-only; production is unchanged.

## Historical MFA transition procedure

Applies to isolated staging only. Production accounts are created manually by the owner; never copy these seed identities or credentials into production.

The three owner-authorized identities are admin+staging-owner@tashiraev.com (admin), admin+staging-agent1@tashiraev.com and admin+staging-agent2@tashiraev.com (staff/AGENT). Accounts start inactive with the unusable marker `!SETUP_REQUIRED!`. No password is generated. Setup capabilities contain 256 random bits; only SHA256 hashes are stored, expire after24 hours, and are consumed transactionally. Password creation activates the account but grants no session: successful authenticator enrolment and verification is still mandatory.

Before deploying the transition candidate, back up the current source/runtime and database, verify the exact staging path/database/user with the existing synthetic-seed guard, and apply067. Set staff_auth_transition singleton1 to the exact nominated owner id with legacy_enabled1. No entry means shared access is disabled. This temporary record preserves the existing administrator password/cookie path at /admin/login while named setup is tested. Do not change the current shared password or its session epoch during enrolment.

Owner completes all three invitations and signs in with their own passwords and authenticator. A successful MFA challenge for the nominated administrator records named_admin_verified_at. A staff login cannot satisfy that prerequisite. Verify the named admin reaches applications and approvals. Only then, after owner confirmation, update legacy_enabled0 and legacy_disabled_at=UTC_TIMESTAMP(), with a WHERE condition requiring named_admin_verified_at IS NOT NULL. Verify the old password and old cookies are refused. Do not re-enable the transition automatically on errors or restarts.

If initial enrolment fails, keep using the retained existing administrator access. An expired invitation is reissued only to the same recorded account/inbox after confirming the account is still inactive and has the unusable marker. Invalidate earlier links before issuing a replacement; never overwrite an established password using an invitation.

If a device is lost after cutover: the owner contacts the server operator through a trusted channel. With server access, verify staging DB identity and exact account id/email, take a private backup, record the recovery authorization, set ONLY that account inactive, clear its mfa_secret and mfa_last_counter, and revoke its active sessions/challenges by a controlled app restart. Preserve the existing password hash and all history. Re-enable the same account only when the owner is ready to sign in with their existing password and enrol a new authenticator; immediately verify completion and named audit identity. Never delete the account, disable global MFA, print authenticator secrets, or generate an owner password. If the password is also lost, keep the account inactive and obtain explicit authorization for a separate recovery operation.

Rollback before cutover: restore the pre-transition application release and its configuration using the recorded deployment backup; leave the additive schema and inactive identities intact. Do not restore an old database over new audit/history or customer records.
