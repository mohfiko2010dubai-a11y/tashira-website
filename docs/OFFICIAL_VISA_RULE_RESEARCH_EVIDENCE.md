# Official Visa Rule Research Evidence

Status: `RESEARCH_EVIDENCE_ONLY`  
Reviewed: 2026-08-27  
Activation: **not authorized**

This register records facts found in current UAE-government sources. It is not an active Rule Registry import and must not be used to make an automatic customer eligibility decision until the exact rule content, scope, effective dates, and authority classification pass the existing proposal/review/activation workflow.

## Source hierarchy used

1. Federal Authority for Identity, Citizenship, Customs and Port Security (ICP).
2. General Directorate of Identity and Foreigners Affairs – Dubai (GDRFA Dubai).
3. The Official Platform of the UAE Government (`u.ae`) as a government summary and routing source.

Commercial travel sites, blogs, airline summaries, search-result snippets, and supplier statements are excluded from authoritative rule evidence.

## Verified route-level evidence

| Evidence ID | Route / subject | Verified government statement | Safe research status | Source |
|---|---|---|---|---|
| UAE-GDRFA-TOURIST-SINGLE-2026-01 | Dubai single-entry tourist visa | The route supports 30- or 60-day visits. Stated requirements include a personal photo, passport copy, passport validity of at least six months, onward/exit ticket, and UAE-valid medical insurance. An origin-country identity card is additionally listed for Iraq, Pakistan, Iran, and Afghanistan. | `VALIDATED_FOR_REVIEW`; not active | [GDRFA Dubai service](https://www.gdrfad.gov.ae/en/services/f9e586fe-0642-11ec-0320-0050569629e8) |
| UAE-GDRFA-GCC-RESIDENT-2026-01 | GCC resident entry visa | Visitor stay does not exceed 30 days and is extendable once. Stated evidence includes photograph, passport including outer cover, and GCC residence evidence showing profession and validity. Passport validity must be at least six months; GCC residence validity at least one year; profession is subject to authority evaluation. | `VALIDATED_FOR_REVIEW`; profession outcome remains `HUMAN_REVIEW_REQUIRED` | [GDRFA Dubai service](https://www.gdrfad.gov.ae/en/services/ee043e4a-5c61-11ea-0320-0050569629e8) |
| UAE-UAE-GCC-RESIDENT-2026-01 | GCC resident eVisa summary | The entry permit is valid for 30 days from issue, permits a 30-day stay, and can be extended once for 30 days. Passport and GCC residence validity conditions match the GDRFA service summary. | `CORROBORATED_FOR_REVIEW`; not active | [Official UAE platform](https://u.ae/en/information-and-services/visa-and-emirates-id/residence-visas/evisa-for-gcc-residents) |
| UAE-ICP-GCC-COMPANION-2026-01 | Companion of a GCC citizen | ICP describes a 60-day visa for companions of GCC citizens and requires passport, photograph, GCC residence evidence, and GCC-citizen identity evidence. The GCC citizen host must be present on arrival. | `VALIDATED_FOR_REVIEW`; relationship/host evidence must remain applicant-scoped | [ICP service](https://icp.gov.ae/services-details/?serviceid=68e352af5ae59b00117383f8) |
| UAE-UAE-TOURIST-5Y-2026-01 | Five-year multiple-entry tourist visa | Available to all nationalities on self-sponsorship; 90 days per visit, with a further 90-day extension described. The government summary lists a USD 4,000 six-month balance, UAE-valid health insurance for 180 days, and onward/return ticket. | `VALIDATED_FOR_REVIEW`; financial-evidence policy and exact authority service mapping require approval | [Official UAE platform](https://u.ae/en/information-and-services/visa-and-emirates-id/tourist-visa) |
| UAE-UAE-ENTRY-BASELINE-2026-01 | General entry baseline | GCC citizens do not need a visa. Other passport holders may qualify for visa on arrival or may need advance permission. Passport validity should be at least six months, and country lists may change; the government page directs users to verify before travel. | `VALIDATED_BASELINE`; nationality outcome must remain versioned and source-specific | [Official UAE platform](https://u.ae/en/information-and-services/visa-and-emirates-id/Visa-information/do-you-need-an-entry-permit-or-a-visa-to-enter-the-uae) |
| UAE-ICP-RESIDENCE-VOA-2026-01 | Residence-based visa on arrival expansion | ICP announced conditional 14- or 60-day visa-on-arrival eligibility for nationals of Indonesia, Vietnam, Thailand, Philippines, Kenya, and South Africa (and their families) who hold valid residence in specified countries. This is conditional, not nationality-only eligibility. | `VALIDATED_FOR_REVIEW`; exact residence-document and family conditions must be modeled, never inferred | [ICP announcement](https://icp.gov.ae/media-center/icp-expands-eligibility-for-uae-entry-visa-for-nationals-of-certain-countries/) |

## Priority-nationality research state

| Nationality | Evidence that is safe to encode now | State until governed review |
|---|---|---|
| Egypt | Generic tourist/GCC-resident route evidence only; no nationality-specific eligibility conclusion was established in this research pass. | `NOT_RESEARCHED` for nationality overlays |
| India | A GDRFA India residence-based arrival service is discoverable, but its exact current conditions were not fully captured from the service record in this pass. | `HUMAN_REVIEW_REQUIRED` for special arrival route; generic route remains separately reviewable |
| Pakistan | GDRFA explicitly lists an origin-country identity card for the reviewed single-entry tourist route. No broader nationality-specific eligibility conclusion is established. | document overlay `VALIDATED_FOR_REVIEW`; eligibility overlay `NOT_RESEARCHED` |
| Philippines | ICP supports a conditional residence-based arrival outcome for specified foreign residence; nationality alone is insufficient. | `VALIDATED_FOR_REVIEW` only when the residence condition is explicitly proven |
| Bangladesh | No nationality-specific official eligibility evidence was established in this pass. | `NOT_RESEARCHED` |
| Iraq | GDRFA explicitly lists an origin-country identity card for the reviewed single-entry tourist route. | document overlay `VALIDATED_FOR_REVIEW`; eligibility overlay `NOT_RESEARCHED` |
| Iran | GDRFA explicitly lists an origin-country identity card for the reviewed single-entry tourist route. | document overlay `VALIDATED_FOR_REVIEW`; eligibility overlay `NOT_RESEARCHED` |
| Afghanistan | GDRFA explicitly lists an origin-country identity card for the reviewed single-entry tourist route. | document overlay `VALIDATED_FOR_REVIEW`; eligibility overlay `NOT_RESEARCHED` |
| Lebanon | No nationality-specific official eligibility evidence was established in this pass. | `NOT_RESEARCHED` |

## Conflict and activation controls

- Route duration, entry-validity duration, permitted stay, extension, and number of entries remain separate fields.
- GDRFA/ICP route evidence must be scoped to the responsible authority and cannot be generalized silently across authorities.
- A source conflict must return `RULE_CONFLICT`; absence of sufficient evidence must return `HUMAN_REVIEW_REQUIRED` or `NOT_RESEARCHED`.
- Operational policy may add workflow requirements but cannot override official eligibility.
- Fees shown by authorities are evidence of authority charges only; they do not modify TASHIRA pricing, supplier cost, payment, or invoice values.
- Nothing in this file activates a rule, catalog definition, feature flag, provider, or customer-facing outcome.
