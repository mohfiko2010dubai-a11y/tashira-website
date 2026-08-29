# Kimi Rule Dataset Status

Reviewed source register: `docs/OFFICIAL_VISA_RULE_RESEARCH_EVIDENCE.md` (2026-08-27). All rows below are documented research only and are not active on Production.

| ID | Route/layer | Version | Status | Authority | Effective dates | Staging active | Dynamic Form | Impact | Owner gate |
|---|---|---:|---|---|---|---|---|---|---|
| UAE-GDRFA-TOURIST-SINGLE-2026-01 | tourist base/document evidence | 1 | VALIDATED_FOR_REVIEW | GDRFA Dubai | not approved | no official activation | no | eligibility/documents | approve exact scope/effective dates |
| UAE-GDRFA-GCC-RESIDENT-2026-01 | GCC resident | 1 | VALIDATED_FOR_REVIEW; profession Human Review | GDRFA Dubai | not approved | no official activation | no | eligibility/documents | approve profession handling |
| UAE-UAE-GCC-RESIDENT-2026-01 | corroborating GCC summary | 1 | CORROBORATED_FOR_REVIEW | UAE Government Portal | not approved | no | no | evidence only | choose controlling authority |
| UAE-ICP-GCC-COMPANION-2026-01 | GCC companion/family | 1 | VALIDATED_FOR_REVIEW | ICP | not approved | no | no | eligibility/relationship/documents | approve host/relationship model |
| UAE-UAE-TOURIST-5Y-2026-01 | five-year tourist | 1 | VALIDATED_FOR_REVIEW | UAE Government Portal | not approved | no | no | eligibility/documents | approve authority mapping/financial evidence |
| UAE-UAE-ENTRY-BASELINE-2026-01 | base entry baseline | 1 | VALIDATED_BASELINE | UAE Government Portal | not approved | no | no | eligibility | source-specific country data required |
| UAE-ICP-RESIDENCE-VOA-2026-01 | residence-based arrival overlay | 1 | VALIDATED_FOR_REVIEW | ICP | not approved | no | no | eligibility/residence/family | approve exact residence conditions |

## Enhancement coverage

The engine/data contracts support Travel Party/Travelling Together, Individual/Family/Group, mixed nationality/residence, GCC resident, accompanying parent/spouse, minors, primary applicant, relationships, inside/outside UAE, flight/return ticket, accommodation, shared booking/documents, applicant-specific documents, different applicant outcomes and Dynamic Documents. Unsupported facts remain `NOT_RESEARCHED` or `HUMAN_REVIEW_REQUIRED`.

## Priority nationality overlays

- Pakistan/Iraq/Iran/Afghanistan: reviewed route supports an origin-country identity-card document overlay; broader eligibility is NOT_RESEARCHED.
- Philippines: conditional residence-based route only when residence evidence is proven.
- Egypt/Bangladesh/Lebanon: no nationality-specific official conclusion in the current research pass.
- India: special arrival-route evidence incomplete; Human Review.

No fee, supplier cost or document is invented. Source URLs and verified dates are in `exports/visa-rules.json`.
