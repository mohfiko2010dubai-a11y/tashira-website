# Kimi Catalogs

## Current canonical or governed catalogs

| Catalog | Source | State |
|---|---|---|
| Visa products/durations/processing/public prices | `src/data/visaData.ts` + Pricing Rules | active legacy/public data; pricing snapshot remains server authority |
| Requirement types/questions | Migrations `026–027`, `api/lib/requirements/` | versioned governance; generic seed is DRAFT |
| Applicant relationships | Family contracts/Migration `019` | `LEAD_APPLICANT`, `SPOUSE`, `CHILD`, `PARENT`, `SIBLING`, `OTHER` |
| Travel party/group | Migration `024` and travel contracts | versioned evidence and explicit membership |
| Application/payment/document statuses | `db/schema.ts`, Operations status projection | canonical enums plus customer-safe projection |
| Review outcomes/reasons | controlled-write and document-intelligence contracts | controlled enum outcomes, free-text reason required where applicable |
| Notification templates | `api/lib/transactional-email.ts` | versioned contract names/variables; provider activation separate |
| SLA/scheduler | operational policy and Supplier SLA contracts | versioned operational policy; thresholds in export |
| Countries/nationalities | form data/strings, not standalone governed import | GAP: canonical versioned country/nationality dataset required |
| Residence types/countries | application and interview contracts | type categories exist; full versioned country catalog remains a gap |
| Professions | applicant field + GCC rule evidence | no authoritative universal catalog; must not invent eligibility mapping |
| Suppliers/channels/procedures | DB/Operations modules | internal; supplier cost is finance-restricted and excluded from exports |
| VAT/currency/exchange rate | Pricing snapshots/business settings | financial governance; public export excludes internal costs |

## Export policy

`handoff/kimi/exports/` contains only non-secret, non-customer, re-importable/reference JSON. It excludes supplier costs, margins, customer records, passwords, tokens and provider secrets. Files marked `DRAFT` or `DOCUMENTED_NOT_ACTIVE` must not be activated automatically.

## Missing owner/governance work

- Approve a canonical ISO-based countries/nationalities/residencies dataset and version.
- Approve official dynamic requirement/rule content and effective dates.
- Confirm VAT/fee presentation and supplier-cost history through finance governance.
- Approve production notification/SLA/provider procedures.
