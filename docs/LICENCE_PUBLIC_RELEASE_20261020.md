# Company licence and verification — deployed 20 October 2026

Owner explicitly authorised production and staging deployment and requested focused validation only. Licence/domain expiry notifications were explicitly cancelled. The expired-licence display safeguard remains.

## Published scope
- Linked licensed-activity statement beside the unchanged TASHIRA logo, with licence number and private-company disclaimer.
- Footer activity statement and unchanged English non-affiliation sentence; terms and disclaimers include the activity/disclaimer together.
- Server-rendered `/ar/verify` and `/en/verify`: both legal names, licence/formation numbers, legal form, issuing authority, dates, address, all six bilingual activities and issuer QR.
- Versioned company-licence settings in `company_licence_settings`; admin editor at `/admin/licence` on both sites and inside staging company settings. Renewal is a settings change.
- Invoice generator adds only a verification link; archived invoices are not rewritten.
- Licence summaries read current settings; expired dates visibly say under renewal. No expiry alert, scheduler or domain notification was created.

## Evidence and exact source
Current owner PDF: `Business_License_-_New_179123797714.pdf`, issued 02/12/2025, expires 01/12/2027. The older BUSINESS LICENSE TASHIRA.pdf was not used. Activity 7912.01 uses the full text from the current PDF rather than the abbreviated request wording.

Decoded original QR and decoded rendered QR on BOTH sites/languages match:
https://portal.meydanfz.ae/uploads/portal/user_documents/210972/Business_License_-_New_179123797714.pdf

Issuer URL returned HTTP 200 over normal verified TLS from the server. Local certificate validation had failed; it was not bypassed.

## Deployment isolation and rollback
Production base: `7cdde687b8d4d2386ab97c856f17304abe621e4b`, retaining the 14 October public Legal/document-validity overlay. Staging base: `9e135978a1a2c086ce10cc8d8b14d2fa34ec4792`. Production was NOT replaced with staging ERP/backend. The production invoice addition was adapted to its existing template; the protected licence editor route was added without importing staging-only company/finance screens.

Candidate source/build manifests:
- `/var/lib/tashira-licence-prod-20261020/manifest.json`
- `/var/lib/tashira-licence-staging-20261020/manifest.json`

Runtime/source backups:
- Production `/var/backups/tashira-licence-prod-1792497578464/runtime-source.tgz`
- Staging `/var/backups/tashira-licence-staging-1792497467364/runtime-source.tgz`

Migration081 adds only the versioned licence settings table. Approved public profile version1 was inserted in exact databases `tashira_prod_clean_20261003` and `tashira_staging`. Previous state was recorded in `licence-before.json` (table absent). No customer, invoice, supplier, price or payment rows were changed. Runtime rollback restores the backup and restarts the matching PM2 app; the additive table can remain safely unused. Server source is an intentional overlay on the recorded Git bases, so future releases must preserve this change.

Environment files, PM2 configurations, production intake configuration and production nginx hashes remained unchanged. Production intake remains as previously configured; this licence release does not claim that operational launch blockers were resolved. Local unrelated dist/boot.js SHA256 remained FD544988685D8C1A81295ACF50D33B4D38494C5E56CDC81F697BDA296CD36EED.

## Focused validation completed
- Each candidate: TypeScript check, ESLint on changed TS/TSX files, targeted Dubai-expiry-boundary test, production build including its built-in environment/static-asset/marketing checks.
- Both sites: HTTP200 and actual SSR licence data on Arabic/English home, verify, terms and disclaimers (8 routes each).
- Anonymous licence mutation rejected403 on both sites. Authenticated settings save was not exercised against production; deployed data was read successfully.
- Headless Chromium desktop1440px/mobile390px: Arabic/English verify pages, six activity rows, QR, no horizontal overflow or heading/header collision, zero page JavaScript errors.
- Actual displayed QR images decoded and matched the original licence destination for all4 site/language combinations.
- No financial workflow, charge, refund, customer email or synthetic supplier tests were run for this scope.

## Rendered public wording/asset scan
Scanned34 staging and32 production public pages, both languages, following linked guide/news/landing routes. All returned200. Full evidence retained in `docs/licence-public-scan.json`.

Matches were contextual, not claims that TASHIRA is government-approved:
- Home: “approved by the authority” and “approved by the immigration authorities”, describing decisions on applications.
- Staging privacy: “authorized submissions”, describing the service activity.
- Pre-check: “official review”, describing authority review.
- Sources page: “official UAE government channels”, describing sources.
- No “accredited” or company “Authorised Private Provider” claim found.
- Existing plain UAE flag image `https://flagcdn.com/w40/ae.png` appears in the home destination heading. It is not a new badge/crest beside the wordmark. Original logo is unchanged; no new emblem was introduced.

This is scoped verification of the licence release, not an assertion that every earlier project task is complete.
