# Passport Profile Evidence Matrix

Status: `REVIEW REQUIRED — NO REAL PROFILE ACTIVE`  
Verified: 2026-08-27

## Evidence boundary

ICAO Doc 9303 defines interoperable MRTD/MRZ structures, but it does **not** prove the complete visual layout, optional labels, generation dates or country-specific fields of every passport in circulation. Accordingly, no country row below is activatable from ICAO evidence alone.

The registry may use the ICAO TD3 contract for deterministic MRZ parsing. Country/layout profiles require an issuing-authority specification or a sufficiently governed, lawfully usable sample set. Unknown or ambiguous layout remains `UNKNOWN_PASSPORT_LAYOUT → HUMAN_REVIEW_REQUIRED`.

| Priority country | Candidate passport type/layout/version | MRZ baseline | Evidenced visual fields | Name structure | Languages/scripts | Confidence | Proposed status | Missing approval evidence |
|---|---|---|---|---|---|---|---|---|
| Egypt | Not yet versioned | ICAO TD3 candidate only | Not researched | Not researched | Not researched | None | `DRAFT_NOT_RESEARCHED` | Issuing-authority specification and approved samples |
| India | Not yet versioned | ICAO TD3 candidate only | Not researched | Not researched | Not researched | None | `DRAFT_NOT_RESEARCHED` | Issuing-authority specification and approved samples |
| Pakistan | Not yet versioned | ICAO TD3 candidate only | Not researched | Not researched | Not researched | None | `DRAFT_NOT_RESEARCHED` | Issuing-authority specification and approved samples |
| Philippines | Not yet versioned | ICAO TD3 candidate only | Not researched | Not researched | Not researched | None | `DRAFT_NOT_RESEARCHED` | Issuing-authority specification and approved samples |
| Bangladesh | Not yet versioned | ICAO TD3 candidate only | Not researched | Not researched | Not researched | None | `DRAFT_NOT_RESEARCHED` | Issuing-authority specification and approved samples |
| Iraq | Not yet versioned | ICAO TD3 candidate only | Not researched | Not researched | Not researched | None | `DRAFT_NOT_RESEARCHED` | Issuing-authority specification and approved samples |
| Iran | Not yet versioned | ICAO TD3 candidate only | Not researched | Not researched | Not researched | None | `DRAFT_NOT_RESEARCHED` | Issuing-authority specification and approved samples |
| Afghanistan | Not yet versioned | ICAO TD3 candidate only | Not researched | Not researched | Not researched | None | `DRAFT_NOT_RESEARCHED` | Issuing-authority specification and approved samples |
| Lebanon | Not yet versioned | ICAO TD3 candidate only | Not researched | Not researched | Not researched | None | `DRAFT_NOT_RESEARCHED` | Issuing-authority specification and approved samples |

## Approval checklist per real profile version

- Exact issuing country, passport type, generation/layout identifier and effective dates.
- Evidence source classification and immutable reference.
- Expected and optional visual fields; fields legitimately absent.
- Exact label aliases and scripts without translating an unlabeled name into father/mother/spouse/middle name.
- MRZ type and deterministic validation expectations.
- Extraction hints and validation rules backed by evidence.
- Multiple lawful samples where layout variability is possible.
- Separate proposer, reviewer and activator; no self-approval.
- Regression fixtures containing no real holder data.

## Authoritative baseline sources

- [ICAO Doc 9303 series](https://www.icao.int/publications/doc-series/doc-9303)
- [ICAO Doc 9303 Part 3 — common TD1/TD2/TD3 specifications](https://www.icao.int/publications/Documents/9303_p3_cons_en.pdf)
- [ICAO Doc 9303 Part 4 — machine-readable passports/TD3](https://www.icao.int/publications/documents/9303_p4_cons_en.pdf)
- [ICAO PKD overview](https://www.icao.int/icao-pkd)

## Owner/external gate

The owner must approve evidence acquisition and lawful sample handling. Until then, all real profiles stay DRAFT/NOT_RESEARCHED; only explicitly synthetic Staging profiles may be activated in TEST/STAGING.
