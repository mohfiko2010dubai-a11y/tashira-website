# Kimi Scope Acceptance Matrix

Branch `kimi/staging-final-recovery`. Each item lists where it lives and the
evidence type. "Browser E2E" rows are pending the staging SSH gate; everything
else is verified locally at the listed commit.

## Customer journey

| Scope item | Implementation | Local evidence | Browser E2E |
|---|---|---|---|
| Dynamic Form visible in real journey | `/apply` → `DynamicApplicationStart`, `/apply/:ref/interview` → `DynamicApplication` (src/App.tsx:77-78) | Route + component tests (`customer-journey-ui.test.ts`, Dynamic* tests) | Pending SSH |
| Individual / Family / multi-applicant | `applicantCount` 1–20, applicant-indexed persistence, per-applicant interviews | Router + journey tests | Pending SSH |
| Save & Resume | `wizard.getProgress`, resume metadata, `/recover`, `/applications/:ref/status` portal | Journey tests | Pending SSH |
| Payment (Stripe Test) | `/pay/:referenceNumber` — server price snapshot only (P1 fix), readiness gate | `payment-display-amount.test.tsx`, pricing tests | Pending SSH |
| Invoice | `invoice-router.ts`, InvoiceViewer/Generator | `invoice-data-consistency.test.ts` | Pending SSH |

## Staff operations (not View Only)

| Scope item | Implementation | Evidence |
|---|---|---|
| Operations dashboard | `/staff/operations/dashboard` → `OperationsManagerDashboard` via `OperationsShell` | `OperationsManagerDashboard.test.tsx` |
| Case workspace | `/staff/operations/:referenceNumber` → `OperationsCaseWorkspace` | `OperationsCaseWorkspace.test.tsx` |
| Controlled writes (status, assignment, review, notes) | `OperationsControlledWritePanel` + `operations-write-router.ts` | `operations-write-router.test.ts`, `OperationsControlledWritePanel.test.tsx` |
| Documents preview/upload/review | `DocumentManager`, `document-router.ts`, `document-intelligence-router.ts` | Router tests |
| Deposit / manual payment / refund | `security-deposit-router.ts`, `refund-router.ts`, payment router | Router tests |
| Visa upload / approve / send | `operations-visa-delivery-router.ts` + `VisaDeliveryPanel` | `operations-visa-delivery-router.test.ts` |
| Support inbox / supplier SLA / policies / regulatory changes | Dedicated workspaces under `/staff/operations/*` | 4 workspace test files |
| RBAC (capabilities, not hard-coded view-only) | `api/lib/authorization/permissions.ts` role templates + scoped flags | `policy.test.ts`, `staging-owner-operations-scope.test.ts` |
| Audit / timeline | `audit-log.ts`, `application-timeline.ts` | `audit-log.test.ts` |

## Manager / Owner

| Scope item | Implementation | Evidence |
|---|---|---|
| Manager dashboard (finance-free metrics, team scoping) | `operations-read-router.managerDashboard` + UI | `operations-read-router.test.ts` |
| Owner/Admin full access + legacy admin retained | `/admin/*` — 10 pages (applications, invoices, finance, VAT, suppliers, staff, chat, cockpit) | AdminGuard routes, page presence |
| Rules & catalog management | `rule-governance-router.ts`, `catalog-governance-router.ts`, regulatory/policy workspaces | Governance router tests |

## Platform

| Scope item | Implementation | Evidence |
|---|---|---|
| Arabic/English + RTL/LTR | i18n resources (ar/en + 24 locales), `dir` switching via `documentDirection()` (fixed to cover ar/ur/fa/he incl. region variants) | `rtl.test.tsx` (new) |
| Visa Rules Engine | Rule registry lifecycle, immutable evaluation snapshots, precedence, evidence (per handoff docs) | Eligibility/governance tests |
| Catalogs | Catalog governance router + JSON exports in `handoff/kimi/exports` | `catalog-governance-router.test.ts` |
| Build integrity | esbuild minification restored + sourcemaps | Minified build PASS + headless browser smoke (no TDZ) |

## Quality gates at HEAD

- TypeScript: PASS
- ESLint: PASS
- Tests: 784 passed / 26 env-gated skips (780 + 4 new RTL tests)
- Client+server minified build: PASS
