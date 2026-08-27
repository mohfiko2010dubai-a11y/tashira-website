# TASHIRA Visa Operations OS V1 — Owner Gate

Status: **engineering closure audited; Production authorization not granted**.

This document maps the 25 owner-approved policy/program sections to repository evidence and separates completed engineering from external or owner-controlled launch gates. It does not authorize a merge, migration, deployment, feature activation, provider connection, or regulatory rule activation.

## Status vocabulary

- `ENGINEERING_COMPLETE`: implemented and covered by deterministic or integration tests.
- `COMPLETE_CLOSED`: implemented but deliberately disabled behind a feature flag.
- `EXTERNAL_OWNER_GATE`: implementation cannot be activated safely without approved content, credentials, provider configuration, or owner acceptance.
- `PRODUCTION_AUTHORIZATION_GATE`: safe engineering is complete, but Production action requires separate explicit authorization.

## Owner policy closure matrix

| # | Owner policy/program section | Status | Canonical evidence |
|---:|---|---|---|
| 1 | Submission Scheduler Policy V1 | ENGINEERING_COMPLETE | `api/lib/travel/operational-submission-policy.ts`, `submission-scheduler.ts`, Migration `037`; boundary tests cover 46/45/21/20/8/7/4/3/0 days. |
| 2 | Dashboard Alert Policy | ENGINEERING_COMPLETE | `scheduler-alert-engine.ts`, `scheduler-alert-service.ts`, Migration `025`; thresholds are policy-derived and lifecycle is `CREATED → ACKNOWLEDGED → RESOLVED`. |
| 3 | Entry Validity vs Stay Duration | ENGINEERING_COMPLETE | Travel/scheduler contracts and Migration `024` persist entry validity, stay duration, and operational policy as separate concepts. |
| 4 | Human Review Policy | ENGINEERING_COMPLETE | Eligibility, family, readiness, document pre-screening, scheduler, and travel-date tests fail closed to Human Review for material uncertainty. |
| 5 | Travel Date Change Policy | ENGINEERING_COMPLETE | `travel-date-recalculation.ts`, Migration `038`; pre-submission recalculation appends evidence, post-submission changes create Human Review without rewriting history. |
| 6 | AI Policy | COMPLETE_CLOSED | `AI_ADVISORY_BOUNDARY_V1` permits extraction/pre-screen/summary and rejects eligibility, rule activation, and final submission decisions. External AI provider selection remains gated. |
| 7 | Visa Rule Source Policy | COMPLETE_CLOSED | Source-authority policy/provider and Migrations `040–041` enforce the ICP/GDRFA/UAE-government hierarchy and reject commercial evidence as official. Actual official content still requires authorized review. |
| 8 | Ticket Policy | ENGINEERING_COMPLETE | Requirement classification supports `OFFICIAL`, `OPERATIONAL`, `CONDITIONAL`, and `OPTIONAL`; ticket requirements remain rule-driven. |
| 9 | Family Policy | ENGINEERING_COMPLETE | Family Engine and immutable applicant evaluations preserve per-applicant nationality, residence, rules, requirements, and documents. |
| 10 | Travel Party Policy | ENGINEERING_COMPLETE | Travel Party/Travel Group contracts and Migration `024` support independent groups, explicit membership, ticket links, and scheduling. |
| 11 | Minor Policy | ENGINEERING_COMPLETE | Minor/accompaniment rules use age, relationship, Travel Group, and approved rules; no parent is assumed and unsupported cases fail to Human Review. |
| 12 | Scheduler Policy Storage | ENGINEERING_COMPLETE | Governed operational policy storage, lifecycle evidence, RBAC, and immutable history are implemented by Migration `037` and the MySQL governance repository. |
| 13 | Policy Versioning | ENGINEERING_COMPLETE | Proposal/review/approval/activation/supersession creates new versions; historical scheduler snapshots retain the policy version originally used. |
| 14 | Admin Configuration | COMPLETE_CLOSED | Internal policy API/UI exposes active version, thresholds, lifecycle history, and RBAC-governed actions; Operations Employees cannot mutate policy. |
| 15 | Customer Wording | ENGINEERING_COMPLETE | Customer scheduler and requirement projections distinguish official authority from TASHIRA operational timing and avoid government guarantees. |
| 16 | GCC Resident Early Application | ENGINEERING_COMPLETE | Future travel is scheduled rather than rejected when the governed policy applies; customer-safe explanation and target scheduling are modeled. |
| 17 | Readiness Controls Submission | ENGINEERING_COMPLETE | Scheduler composition requires eligibility, documents, Human Review, family readiness, and timing; missing requirements return `BLOCKED_BY_REQUIREMENTS`. |
| 18 | Policy Change Impact | ENGINEERING_COMPLETE | Versioned recalculation creates new scheduler evidence with previous/new policy versions, reason, and actor/system evidence; history is immutable. |
| 19 | Regulatory Change Impact | COMPLETE_CLOSED | Regulatory Change Center identifies affected cases and uses governed proposal/review/approval/activation/impact-review boundaries; watcher remains OFF. |
| 20 | Deterministic Policy Tests | ENGINEERING_COMPLETE | Boundary, blocker, Travel Group, version-change, travel-date, and post-submission tests are present under `api/lib/travel/`. |
| 21 | Unified Dynamic Interview | COMPLETE_CLOSED | Single MySQL persistence adapter, authenticated API, Start/Resume, family/travel/requirements/scheduler/review projections, ownership and finance-isolation tests are complete. Final interactive browser acceptance remains an owner/tool gate. |
| 22 | Remaining Final V1 Modules | COMPLETE_CLOSED | Provider-independent AI pre-screen, Visa Assistant, Human Handoff, email architecture, Support Inbox, Regulatory Change Center, Manager Dashboard, analytics, Typing Pack, and authority boundaries exist behind closed flags. Provider/content-specific activation remains gated. |
| 23 | Owner Business Approvals | ENGINEERING_COMPLETE | Approved 45/21/7/3, alert, Human Review, travel-date, AI boundary, source hierarchy, ticket, family, Travel Party, and validity-separation decisions are represented as governed contracts, not unresolved business configuration. |
| 24 | Continuous Execution | PRODUCTION_AUTHORIZATION_GATE | All routine safe repository/local/Staging work represented in this audit is complete. Remaining actions cross explicit external, regulatory, browser, merge, or Production gates. |
| 25 | Production-ready Target | EXTERNAL_OWNER_GATE | Production readiness package, migration rehearsal, rollback chain, release verifier, and closed-state runbook are prepared. Final Production readiness cannot be declared until the gates below pass. |

## True remaining gates

1. Approve and activate authoritative visa-rule and requirement-catalog content with reviewed official sources. Existing synthetic/legacy records must not be treated as official evidence.
2. Approve the external AI, mailbox/inbound-email, authority/Typing Pack, and supplier procedures or providers needed for live use. Provider-independent code remains closed and does not imply a live integration.
3. Complete protected authenticated Browser E2E/owner acceptance for the Unified Dynamic Interview and Operations workspaces. Automated API/MySQL evidence does not replace this sign-off.
4. Decide the outstanding legal retention and deletion durations recorded in `BLOCKED_DECISIONS.md`.
5. Select the exact release SHA by running `node --experimental-strip-types scripts/verify-operations-production-readiness.ts` on a clean local/remote-matched branch. Do not use a stale hard-coded SHA.
6. Separately authorize main/master merge, Production backup/rehearsal, migrations `014–042`, exact-SHA deployment, named RBAC scopes, and each feature activation.

## Release safety conclusion

- Safe engineering work audited here: complete through the closed Production owner gate.
- Customer-facing Operations activation: **OFF**.
- Controlled Writes activation: **OFF**.
- External-provider activation: **OFF**.
- Production modified: **NO**.
- Production database modified: **NO**.
- main/master modified: **NO**.
- Stripe, Resend, payment, pricing, and invoice behavior modified: **NO**.
