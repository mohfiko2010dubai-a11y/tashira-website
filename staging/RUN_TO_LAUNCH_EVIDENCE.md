# Run-to-launch evidence — 7 October 2026

This is an evidence ledger, not launch acceptance. Production remains closed.

## Final staging follow-up receipt

- Deployed source `d4b769a399dc80b525e48a486c3a2afd21724276` on 7 October 2026. Hosted CI `37538246088` passed both jobs, including all 26 mandatory MySQL tests with zero skips. Local final check/lint/build passed and 1398 unit tests passed; the guarded database tests were verified separately rather than counted as local unit passes.
- Server built that exact commit before switching. Rollback backup: `/var/backups/tashira-staging/run-launch-staff-1791324706049`. Local and public health returned 200. Migration and clock activation were not rerun; mail allowlist unchanged.
- Final browser reload preserved synthetic draft 228's name, passport, expiry, profession and all three uploaded documents. The unpaid application no longer displays a service deadline.
- Anonymous staging calls returned 401 for application details, visa-change quote and service clock, and 403 for the manual decision queue. Production intake read-only response remains `closed: true`.
- All 15 unrelated dirty files remain unchanged. No payment/refund or new email was sent during this deployment.
- Named live permission and refund acceptance remain blocked by the two agent accounts' incomplete MFA enrollment. The pending launch gates below remain pending.

## Verified candidate and deployment

- Source3768365ee5c5568ea05f2ab57254eade2cae6d57; hosted CI37536454106 succeeded in both jobs, including26 MySQL integrations, zero skips. The runner fails on skips.
- Local and staging candidate check/lint/test/build passed:1397 unit tests; guarded26 DB tests run separately.
- Migration068 passed on isolated MySQL with immutable quote/decision guards, reference-required exact settlement, agent refusal/named-admin decision, filing guard, refusal preserved after original-product exception, document request/response and activation/idempotency tests.
- Deployed from e018c38 to isolated staging only. Backup `/var/backups/tashira-staging/run-launch-1791323706932`; schema has all12 new triggers; clock activation2026-10-06T21:55:12.041Z; overdue threshold24 hours. No historical pauses inferred. Local/public health200.
- Browser reload of the owner's synthetic draft retained its saved traveller data and all3 documents and showed the Arabic service-clock explanation. This is a smoke check, not the required PK/SA bilingual journey.
- Production closure configuration read-only check returned `{"closed":true}`. This alone does not prove every reopen guard or company-policy prerequisite.

## Named-account dependency

Read-only exact-account query: owner ADMIN active/MFA enrolled/verified; agent1 and agent2 active but MFA not enrolled or verified. Owner asked to complete enrollment. Passwords and secrets were not generated/read/displayed. Legacy access unchanged; written recovery remains in STAFF_ACCESS_RECOVERY.md. Live8-assertion account UAT and financial-dashboard journey are pending, not passed.

## Real-delivery authentication evidence

Read from the already-open mail-tester result and expanded Source view, not inferred from DNS. Message received4 October2026 at16:28:18UTC. Test URL: https://mail-tester.com/test-hz8sq5plo. Score5.6/10. This historical message predates the corrected image-free template; it proves sending-domain authentication, not current-template scoring or the new journey's inbox delivery.

Verbatim received headers:

```text
Authentication-Results: mail-tester.com; dmarc=pass (p=none dis=none) header.from=tashiraev.com
Authentication-Results: dkim.mail-tester.com;
	dkim=pass (1024-bit key; unprotected) header.d=tashiraev.com  header.i=@tashiraev.com  header.a=rsa-sha256 header.s=resend header.b=c2F9pWRz;
	dkim=pass (1024-bit key; unprotected) header.d=amazonses.com  header.i=@amazonses.com  header.a=rsa-sha256 header.s=zh4gjftm6etwoq6afzugpky45synznly header.b=jjYzK/+7;
	dkim-atps=neutral
Received-SPF: Pass (mailfrom) identity=mailfrom; client-ip=23.251.234.51; helo=e234-51.smtp-out.ap-northeast-1.amazonses.com; envelope-from=010601a107bea22f-9cee5436-f371-4073-8da4-445909e3c621-000000@send.tashiraev.com; receiver=<UNKNOWN>
```

From domain tashiraev.com exactly matches the first DKIM signing domain. Envelope send.tashiraev.com aligns with tashiraev.com under relaxed SPF alignment. DMARC passed. Score penalties include the old image-heavy test body, uppercase test markers and a shared-IP blocklist finding; do not turn this into an inbox guarantee.

## Still required before gate report

Live named-account assertions; rejected-first then executed TEST refund by agent/admin through UI; live breached versus paused Express cases; both complete PK/SA customer journeys with exactly-once language/amount/invoice mail evidence; filing rejection before customer acknowledgement in the live journey; owner company/policy/reopen checks. No launch-complete claim.
# Staff landing and missing role repair — 2026-10-08

Deployed staging runtime 659ef9b4debb7a92896a0f6b621ed803d66e9175. Staff login now lands on /staff/dashboard, not manager-only /staff/operations/dashboard. Operations dashboard loading/error keeps the shell and navigation; forbidden state explains access and offers Applications. Application-list errors no longer masquerade as an empty result.

Root cause verified from staging: both named agent accounts had zero operations roles and zero scope grants. Owner directly approved the exact assigned-only employee permissions in chat after automatic review rejected file-only authorization. The existing synthetic-seed guard verified tashira_staging/tashira_staging_app. Transaction created STAGING_NAMED_AGENT and granted both agents ASSIGNED scope with exactly case.read_assigned, case.transition, applicant.read, document.read, document.review, supplier.read_operational, rule.read. No passwords, admin/finance/approval rights, orders or production changed. Grant records cite owner authorization. Attempt using a historical inactive role rolled back without changes; no old role reactivated.

Validation: check/lint/test/build passed locally and candidate server. 1412 unit tests; local 26 DB skips are covered by mandatory CI37766967023 success including guarded MySQL integration job. Backup /var/backups/tashira-staging/staff-landing-1791457388240. Health200; anonymous application/quote/clock401, manual queue403; production intake remains CLOSED. 15 original dirty files unchanged; dist/boot.js excluded.

Browser: actual agent1 session reached Applications before deployment; no orders assigned. After deployment reload redirected to login; username filled and owner asked to enter password in UI for final live verification. Do NOT claim completed post-deploy login, staff 8-assertion UAT or launch acceptance. No synthetic order assigned this round. Existing training applications226/227/228 have is_test=0 despite their historical synthetic use: review classification before financial UAT rather than silently changing flags or exposing other orders.

# Integrated launch scope and newest owner decisions — 2026-10-08

Authority: latest direct owner instructions override conflicting older task text. Preserve compatible earlier Claude requirements and existing implementation; do not build duplicate dashboards, assignment engines or message stores. Owner requested completion toward launch today, not an unverified launch declaration. Production remains closed pending a concrete passing gate and explicit transfer authorization.

New approved scope: self-service work without manager attendance; owner selected NEXT ITEM BY PRIORITY THEN OLDEST (supersedes earlier free-pick proposal). Manager can work as an operator and retain supervisory reassignment. Include old cases as actionable follow-ups, distinct customer waiting, authority waiting and supplier waiting queues; completed work separate. Measure actionable wait, active effort and external wait separately; staff availability is explicit, not inferred from login. Per-staff counts/types/quality/time and manager-only profit must not double-count shared orders. Email/WhatsApp inbound/outbound should follow request ownership with named audit; ambiguous replies require linking, and mere arrival must not imply completion or payment. Preserve current password-only owner decision and manual amendment-settlement scope until explicitly superseded.

Reuse: controlled-actions assignCase and MysqlControlledWriteExecutor (version/idempotency/audit), existing case controls, customer-wait event log, Support Inbox repositories/UI and inbound-email foundation, manager analytics. Do not treat their presence as successful live UAT. Manager analytics currently leaves reviewMinutes/typingMinutes null. Support UI explicitly disables outgoing email; inbound ingestion is not wired to a provider route; WhatsApp platform integration not found.

Current verified prerequisites: agent1 live password login reached /staff/dashboard after659ef9b; both agents have assigned-only role/scope, but teams=0 and workload limit=NULL. A fresh read of staging company settings version5 shows all seven identity fields present and provisional_fields_json=[] (not a new legal approval or production check). DNS MX for tashiraev.com points to mx1.hostinger.com/mx2.hostinger.com. Prior outbound Resend delivery evidence remains valid for sending, not inbound. Owner says the existing test WhatsApp number is in the Business app; API onboarding/configuration still needs verification, not assumed.

Delivery sequence:
1. Integrate priority/oldest pickup and follow-up queues into existing Operations workspace; persist availability and work events; no widening employee financial or approval permissions. Prove simultaneous claim has one winner and manager may participate. Preserve old assigned cases/history.
2. Complete eight named-account assertions, mobile rejected-first/refund execution, breached versus customer-paused Express, and authenticated document audit. Use confirmed synthetic Stripe TEST cases; historical226/227/228 are marked LIVE/is_test0 despite training use, so reconcile before financial rehearsal.
3. Finish transactional-mail acceptance and connect inbound/outbound Support Inbox to the existing domain/provider without replacing MX blindly; official WhatsApp connection requires actual platform provisioning. Do not announce full integration based on app number or wa.me links.
4. Run exact PK/SA 30-day single EN/AR customer journeys; acknowledgement filing block; correct amounts/invoices/exactly-once mail; company/refund-policy/reopen checks; prepare rollback/transfer evidence.

Open decisions: do not silently defer new integrations to meet today's target; if external onboarding prevents completion, ask owner about launch scope. No production deployment or launch-complete claim. This checkpoint records reconciliation/read-only evidence, not new runtime feature completion.

