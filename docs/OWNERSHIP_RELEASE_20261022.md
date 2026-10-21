# Ownership disclosure and header release — 2026-10-22 (Dubai)

## Owner decisions and deployed scope

Owner lifted the ownership hold in the pasted request of October 21 and explicitly authorized production. Registrant change is owner-confirmed, not an independently retrieved registry attestation. The exact bilingual disclosure is generated from licence settings and the request host; company settings version 3 names TASHIRA E-Visa & Tourism L.L.C-FZ. Domain host allow-list includes .com/.ae, www aliases and staging. Canonical/OG/alternate URLs now use the served origin. Initial HTML, client navigation, public/private layouts and HTML error fallback carry ownership text.

Latest direct owner correction supersedes the earlier header pairing requirement: header shows only the activity name, links to /verify, has no Licensed prefix/licence number or private-company sentence. HOME (الرئيسية) and the other navigation links are visible from the desktop/tablet breakpoint. The full footer disclosure remains. Disclaimers/verify now open with that disclosure. No government accreditation was asserted.

Order creation (form/chat) now records request hostname atomically in additive migration 082. New invoices/credit notes and customer-email footer use that saved hostname and licence settings. Admin alerts bypass the customer footer. Company phone is excluded from invoices. Financial numbering and original issued archives are unchanged. PDF ownership appendix visually reviewed. No external test email, payment or new production order was sent/created.

Production originally had zero applications and zero financial archives and still has zero after deployment. Existing staging 260 applications/27 archives preserved. Intake remains closed; environment, PM2 configuration, intake configuration and nginx hashes unchanged. Existing .ae DNS, www CNAME and valid TLS were verified; they already existed, no duplicate provisioning performed.

## Verification and rollback

- Separate candidates preserve their own production/staging baseline; no full staging backend replacement.
- Type check, scoped lint and build passed for both candidates. Focused ownership/invoice/email tests: staging 71; production 49. Adapter follow-up 11 passed, no live side effects.
- Latest header correction: scoped lint/build and rendered header checks passed both languages; visually verified on staging and https://www.tashiraev.ae/en.
- Arabic footer visually verified with isolated Latin strings. PDF .ae ownership appendix visually verified.
- Migration initial foreign-key mismatch was rejected before code deployment; corrected to the verified BIGINT UNSIGNED application key, then deployment succeeded.
- No manual verification marker bypass: the earlier tool rejection was resolved by re-running actual build gates and writing evidence only on successful completion.
- Final staging backup: /var/backups/tashira-ownership-final-staging-1792613029921
- Final production backup: /var/backups/tashira-ownership-final-prod-1792613075639
- Runtime/source rollback: restore runtime-source.tgz from the matching backup and restart its existing PM2 process. The additive origin table can remain; do not delete recorded origins.
- Candidates: /var/lib/tashira-ownership-final-{staging,prod}-20261021. Deployed Git HEADs remain their prior base; the release is an audited source/build overlay.
- Original unrelated local dist/boot.js preserved SHA256 FD544988685D8C1A81295ACF50D33B4D38494C5E56CDC81F697BDA296CD36EED.

## Explicit limits — not a claim of all-project completion

- Historical staging records have no captured request host. They keep their original behavior; no domain was fabricated or backfilled. All NEW production orders will record it, but intake is closed and no real order was used to claim end-to-end acceptance.
- Issued PDF archives retain their immutable issuance snapshot. Changing settings updates pages/new messages/new documents, not already-issued archived PDFs. Thus the original request to change EVERY historical PDF on a settings edit is not implemented.
- Production's earlier email body/language workflow remains; this release adds the ownership footer, not the newer staging email workflow. No real inbox delivery acceptance is claimed.
- Rendered term scan found approved-by/official references concerning the deciding authority or official registry, not claims of company governmental accreditation. Existing homepage flagcdn.com/w40/ae.png UAE flag remains; the initial filename-only scan missed it. This is explicitly a remaining result of the requested emblem audit, not a clean flag-free claim.
- Automated initial surface matrix covered 80 language/host/page combinations below. Additional sitemap scan covered 16 surfaces; it was not an exhaustive crawl of every dynamic CMS slug. Header/private/error checks do not certify the wider ERP release.

## Rendered public surface matrix

- https://tashiraev.com/en — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.com/en; OG https://tashiraev.com/en.
- https://tashiraev.com/en/disclaimers — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.com/en/disclaimers; OG https://tashiraev.com/en/disclaimers.
- https://tashiraev.com/en/terms — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.com/en/terms; OG https://tashiraev.com/en/terms.
- https://tashiraev.com/en/privacy — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.com/en/privacy; OG https://tashiraev.com/en/privacy.
- https://tashiraev.com/en/refund — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.com/en/refund; OG https://tashiraev.com/en/refund.
- https://tashiraev.com/en/verify — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.com/en/verify; OG https://tashiraev.com/en/verify.
- https://tashiraev.com/en/documents — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.com/en/documents; OG https://tashiraev.com/en/documents.
- https://tashiraev.com/en/visa-prices — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.com/en/visa-prices; OG https://tashiraev.com/en/visa-prices.
- https://tashiraev.com/en/login — HTTP 200; ownership/domain/legal name PASS; canonical not applicable (private/error); OG not applicable (private/error).
- https://tashiraev.com/en/missing-ownership-check — HTTP 404; ownership/domain/legal name PASS; canonical not applicable (private/error); OG not applicable (private/error).
- https://tashiraev.com/ar — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.com/ar; OG https://tashiraev.com/ar.
- https://tashiraev.com/ar/disclaimers — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.com/ar/disclaimers; OG https://tashiraev.com/ar/disclaimers.
- https://tashiraev.com/ar/terms — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.com/ar/terms; OG https://tashiraev.com/ar/terms.
- https://tashiraev.com/ar/privacy — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.com/ar/privacy; OG https://tashiraev.com/ar/privacy.
- https://tashiraev.com/ar/refund — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.com/ar/refund; OG https://tashiraev.com/ar/refund.
- https://tashiraev.com/ar/verify — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.com/ar/verify; OG https://tashiraev.com/ar/verify.
- https://tashiraev.com/ar/documents — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.com/ar/documents; OG https://tashiraev.com/ar/documents.
- https://tashiraev.com/ar/visa-prices — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.com/ar/visa-prices; OG https://tashiraev.com/ar/visa-prices.
- https://tashiraev.com/ar/login — HTTP 200; ownership/domain/legal name PASS; canonical not applicable (private/error); OG not applicable (private/error).
- https://tashiraev.com/ar/missing-ownership-check — HTTP 404; ownership/domain/legal name PASS; canonical not applicable (private/error); OG not applicable (private/error).
- https://tashiraev.ae/en — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.ae/en; OG https://tashiraev.ae/en.
- https://tashiraev.ae/en/disclaimers — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.ae/en/disclaimers; OG https://tashiraev.ae/en/disclaimers.
- https://tashiraev.ae/en/terms — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.ae/en/terms; OG https://tashiraev.ae/en/terms.
- https://tashiraev.ae/en/privacy — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.ae/en/privacy; OG https://tashiraev.ae/en/privacy.
- https://tashiraev.ae/en/refund — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.ae/en/refund; OG https://tashiraev.ae/en/refund.
- https://tashiraev.ae/en/verify — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.ae/en/verify; OG https://tashiraev.ae/en/verify.
- https://tashiraev.ae/en/documents — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.ae/en/documents; OG https://tashiraev.ae/en/documents.
- https://tashiraev.ae/en/visa-prices — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.ae/en/visa-prices; OG https://tashiraev.ae/en/visa-prices.
- https://tashiraev.ae/en/login — HTTP 200; ownership/domain/legal name PASS; canonical not applicable (private/error); OG not applicable (private/error).
- https://tashiraev.ae/en/missing-ownership-check — HTTP 404; ownership/domain/legal name PASS; canonical not applicable (private/error); OG not applicable (private/error).
- https://tashiraev.ae/ar — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.ae/ar; OG https://tashiraev.ae/ar.
- https://tashiraev.ae/ar/disclaimers — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.ae/ar/disclaimers; OG https://tashiraev.ae/ar/disclaimers.
- https://tashiraev.ae/ar/terms — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.ae/ar/terms; OG https://tashiraev.ae/ar/terms.
- https://tashiraev.ae/ar/privacy — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.ae/ar/privacy; OG https://tashiraev.ae/ar/privacy.
- https://tashiraev.ae/ar/refund — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.ae/ar/refund; OG https://tashiraev.ae/ar/refund.
- https://tashiraev.ae/ar/verify — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.ae/ar/verify; OG https://tashiraev.ae/ar/verify.
- https://tashiraev.ae/ar/documents — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.ae/ar/documents; OG https://tashiraev.ae/ar/documents.
- https://tashiraev.ae/ar/visa-prices — HTTP 200; ownership/domain/legal name PASS; canonical https://tashiraev.ae/ar/visa-prices; OG https://tashiraev.ae/ar/visa-prices.
- https://tashiraev.ae/ar/login — HTTP 200; ownership/domain/legal name PASS; canonical not applicable (private/error); OG not applicable (private/error).
- https://tashiraev.ae/ar/missing-ownership-check — HTTP 404; ownership/domain/legal name PASS; canonical not applicable (private/error); OG not applicable (private/error).
- https://www.tashiraev.com/en — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.com/en; OG https://www.tashiraev.com/en.
- https://www.tashiraev.com/en/disclaimers — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.com/en/disclaimers; OG https://www.tashiraev.com/en/disclaimers.
- https://www.tashiraev.com/en/terms — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.com/en/terms; OG https://www.tashiraev.com/en/terms.
- https://www.tashiraev.com/en/privacy — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.com/en/privacy; OG https://www.tashiraev.com/en/privacy.
- https://www.tashiraev.com/en/refund — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.com/en/refund; OG https://www.tashiraev.com/en/refund.
- https://www.tashiraev.com/en/verify — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.com/en/verify; OG https://www.tashiraev.com/en/verify.
- https://www.tashiraev.com/en/documents — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.com/en/documents; OG https://www.tashiraev.com/en/documents.
- https://www.tashiraev.com/en/visa-prices — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.com/en/visa-prices; OG https://www.tashiraev.com/en/visa-prices.
- https://www.tashiraev.com/en/login — HTTP 200; ownership/domain/legal name PASS; canonical not applicable (private/error); OG not applicable (private/error).
- https://www.tashiraev.com/en/missing-ownership-check — HTTP 404; ownership/domain/legal name PASS; canonical not applicable (private/error); OG not applicable (private/error).
- https://www.tashiraev.com/ar — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.com/ar; OG https://www.tashiraev.com/ar.
- https://www.tashiraev.com/ar/disclaimers — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.com/ar/disclaimers; OG https://www.tashiraev.com/ar/disclaimers.
- https://www.tashiraev.com/ar/terms — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.com/ar/terms; OG https://www.tashiraev.com/ar/terms.
- https://www.tashiraev.com/ar/privacy — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.com/ar/privacy; OG https://www.tashiraev.com/ar/privacy.
- https://www.tashiraev.com/ar/refund — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.com/ar/refund; OG https://www.tashiraev.com/ar/refund.
- https://www.tashiraev.com/ar/verify — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.com/ar/verify; OG https://www.tashiraev.com/ar/verify.
- https://www.tashiraev.com/ar/documents — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.com/ar/documents; OG https://www.tashiraev.com/ar/documents.
- https://www.tashiraev.com/ar/visa-prices — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.com/ar/visa-prices; OG https://www.tashiraev.com/ar/visa-prices.
- https://www.tashiraev.com/ar/login — HTTP 200; ownership/domain/legal name PASS; canonical not applicable (private/error); OG not applicable (private/error).
- https://www.tashiraev.com/ar/missing-ownership-check — HTTP 404; ownership/domain/legal name PASS; canonical not applicable (private/error); OG not applicable (private/error).
- https://www.tashiraev.ae/en — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.ae/en; OG https://www.tashiraev.ae/en.
- https://www.tashiraev.ae/en/disclaimers — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.ae/en/disclaimers; OG https://www.tashiraev.ae/en/disclaimers.
- https://www.tashiraev.ae/en/terms — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.ae/en/terms; OG https://www.tashiraev.ae/en/terms.
- https://www.tashiraev.ae/en/privacy — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.ae/en/privacy; OG https://www.tashiraev.ae/en/privacy.
- https://www.tashiraev.ae/en/refund — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.ae/en/refund; OG https://www.tashiraev.ae/en/refund.
- https://www.tashiraev.ae/en/verify — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.ae/en/verify; OG https://www.tashiraev.ae/en/verify.
- https://www.tashiraev.ae/en/documents — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.ae/en/documents; OG https://www.tashiraev.ae/en/documents.
- https://www.tashiraev.ae/en/visa-prices — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.ae/en/visa-prices; OG https://www.tashiraev.ae/en/visa-prices.
- https://www.tashiraev.ae/en/login — HTTP 200; ownership/domain/legal name PASS; canonical not applicable (private/error); OG not applicable (private/error).
- https://www.tashiraev.ae/en/missing-ownership-check — HTTP 404; ownership/domain/legal name PASS; canonical not applicable (private/error); OG not applicable (private/error).
- https://www.tashiraev.ae/ar — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.ae/ar; OG https://www.tashiraev.ae/ar.
- https://www.tashiraev.ae/ar/disclaimers — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.ae/ar/disclaimers; OG https://www.tashiraev.ae/ar/disclaimers.
- https://www.tashiraev.ae/ar/terms — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.ae/ar/terms; OG https://www.tashiraev.ae/ar/terms.
- https://www.tashiraev.ae/ar/privacy — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.ae/ar/privacy; OG https://www.tashiraev.ae/ar/privacy.
- https://www.tashiraev.ae/ar/refund — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.ae/ar/refund; OG https://www.tashiraev.ae/ar/refund.
- https://www.tashiraev.ae/ar/verify — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.ae/ar/verify; OG https://www.tashiraev.ae/ar/verify.
- https://www.tashiraev.ae/ar/documents — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.ae/ar/documents; OG https://www.tashiraev.ae/ar/documents.
- https://www.tashiraev.ae/ar/visa-prices — HTTP 200; ownership/domain/legal name PASS; canonical https://www.tashiraev.ae/ar/visa-prices; OG https://www.tashiraev.ae/ar/visa-prices.
- https://www.tashiraev.ae/ar/login — HTTP 200; ownership/domain/legal name PASS; canonical not applicable (private/error); OG not applicable (private/error).
- https://www.tashiraev.ae/ar/missing-ownership-check — HTTP 404; ownership/domain/legal name PASS; canonical not applicable (private/error); OG not applicable (private/error).

## Final header matrix

- https://tashiraev.com/en — activity-only header, HOME and ownership footer PASS.
- https://tashiraev.com/ar — activity-only header, HOME and ownership footer PASS.
- https://tashiraev.ae/en — activity-only header, HOME and ownership footer PASS.
- https://tashiraev.ae/ar — activity-only header, HOME and ownership footer PASS.
- https://www.tashiraev.ae/en — activity-only header, HOME and ownership footer PASS.
- https://www.tashiraev.ae/ar — activity-only header, HOME and ownership footer PASS.
