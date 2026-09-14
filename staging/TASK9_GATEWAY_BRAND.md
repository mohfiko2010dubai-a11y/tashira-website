# Task 9 revised — Gateway brand delivery

Deployed to isolated staging on 2026-09-14: **d29df9727db5764f2c996376bec07b03fe6f8367**. Production untouched. Owner pack SHA-256: 78ecec7c5e05977beb542a0db911acf24bd0041bebc437890d79d236312d8884.

## Changes

- One application component: src/components/shared/Logo.tsx. Ported owner logo-lockup.html vector paths and live-text wordmark, with full/mark-only, light/dark and size props. Each instance owns a useId gradient. The lockup stays LTR in Arabic, clear space is four seal-dot widths, and SERVICES remains visible at 26px and above. Existing site Tajawal uses weight 900; reserved text width prevents font-loading reflow.
- Header/footer, 404, pre-check result/empty state, app loading and auth skeleton, wizard sidebar before payment, received uploads, save confirmation and resume screens use that component. Admin/staff login shields and back-office heading marks were replaced. No new decorative mark was added to the payment body.
- Server failure shells and server 404 use the supplied PNG, with fixed dimensions and alt text; this remains visible even if React cannot render. Fallback keeps the route metadata and HTTP 200; missing pages remain 404.
- Both generated invoice implementations embed the exact supplied PNG on a light ground. The existing invoice financial content/logic is unchanged. The synthetic preview was rendered and visually reviewed. Original customer uploads and government-issued PDFs are not altered.
- Every transactional template now has branded HTML with the same 64×64 PNG, meaningful alt text and a plain-text fallback. Existing secure-link validation and email delivery restrictions remain active. No email was sent.
- Supplied favicon.ico, simplified SVG favicon, PNG icon set and manifest installed. All 32 supplied OG JPEGs are wired through server metadata and subsequent client navigation, including absolute og:image/twitter:image, dimensions and alt text. Staging images use the staging asset origin; canonical remains www.tashiraev.com.

## Verification

| Check | Result / evidence |
| --- | --- |
| Required gates | Local and deployment check/lint/test/build passed: **1081 tests passed**, 26 existing environment-gated skips. |
| 16 routes × EN/AR | All 32 return 200 with the correct image metadata. Every remote JPEG hash matches the supplied asset; all are 1200×630. task9-evidence/staging.json. |
| Header/footer gradients | Two unique gradient IDs on one page; light and dark marks visually reviewed. |
| Mobile/Arabic | 320px EN and 375px AR: no horizontal overflow or browser page errors. task9-evidence/visual.json. |
| Delayed fonts | On deployed Arabic page, eight font requests held while fonts were loading. Logo bounds before/after are identical, shift 0, direction LTR. task9-evidence/font-delay.json. |
| Admin/staff login | Both actual login forms rendered and captured; dark marks legible. Admin visa-rules header also verified with an authorized staging session. |
| SSR failure | Authorized /ar/visa-prices?__ssr_test=render-error returns 200, fallback header, Arabic RTL metadata, brand PNG and Arabic OG image. |
| Old assets | Four files removed below; old public URLs return 404. 144 deployed text assets scanned: zero old logo references. Exactly one application Logo component. |
| Invoice | Local synthetic PDF generated from the actual server template and visually checked; see task9-evidence/invoice.pdf and invoice.png. |
| Payment smoke | Existing paid TEST order still shows Payment Successful; no new charge/order and zero analytics requests. |
| External clients | WhatsApp's actual UI and received-message rendering in Gmail/Outlook are **not yet verified**. HTTP scraper inputs and all email HTML templates pass, but these are not substitutes for receiving/opening the message in those clients. Test addresses and explicit send authorization requested. |

One initial staging browser navigation timed out. A separate HTTPS probe returned 200 with SSR 563ms; the repeated full browser matrix passed without page errors. No claim is made that this one probe is a performance benchmark.

## Removed files

- public/tashira-logo.svg
- public/tashira-logo.png
- dist/public/tashira-logo.svg
- dist/public/tashira-logo.png

The old gallery reference was changed to the supplied PNG. The owner HTML reference remains in brandkit as source documentation, not a second mounted component. All 15 unrelated dirty files remain byte-identical; their old contents were not included in the release.

## Manual review

1. Open https://staging.tashiraev.com/ar/ and /en/. Check header, footer and SERVICES; repeat at mobile width.
2. Open /admin/login and /staff/login. Check the Gateway on the existing navy ground.
3. Open /ar/visa-pre-check; its empty/result panel uses the shared mark. Existing completed uploads show the mark beside Received / تم الاستلام.
4. View source on /ar/visa-prices and /en/visa-prices: distinct absolute images, correct language, 1200×630 and alt tags. The 32-route matrix records every URL.
5. With a staging admin session, open the SSR fault URL above; remove the query to return to normal SSR.
6. Open the unsent order-confirmation.html and synthetic invoice.pdf in the evidence directory. Actual Gmail/Outlook receipt and WhatsApp preview remain owner/client verification gates.

Deployment needed dependency-cache space. Removed node_modules only from three verified obsolete staging build directories (e5390827, a146376d, a46b34d); source, lockfiles, rollback backups, databases and uploads were retained. No new is_test flags, order deletion, policy change, production deployment or live payment occurred. Earlier launch blockers remain in effect.
