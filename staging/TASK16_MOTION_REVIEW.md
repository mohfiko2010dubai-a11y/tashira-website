# TASK16 — deployed to staging; device acceptance remains open

Code candidate: `3976592aa5264b288a9c221a0f9c369e2fcf5466` on `kimi/unified-wizard-reviewed`.
TASK16 is deployed to staging after explicit source-transfer approval. Device/performance acceptance remains open. No production change, migration, payment or real customer upload occurred.

## Owner-approved interpretation

The revised attachment ec1851bc-839c-4cfc-97ae-be7cd08f731f supersedes the first draft: all three wizard steps enter/leave with the same transition, including upload and payment. After arrival only upload feedback moves; payment stays still. Ambient motion belongs to the marketing layout; application, admin and staff layouts do not opt in. The source prototype is a reference, not executable production code.

## Implemented

- Explicit MarketingLayout with a shared backdrop, plus server marketing fallback/404 markup. Wizard entry and private shells have no ambient element. Existing SSR metadata and status handling are preserved.
- Real XHR byte progress is presented from 0–96. Processing and metadata/evidence linking stay at 96; successful completion reaches 100. Required and optional uploads share a filename/progress/error/retry view. Selected files remain available after failure, and file objects are released after success.
- 5px transform-based bar, clipped gateway fill, 1.15s verifying shuttle, 420ms success check, 260ms error drain. HEIC/HEIF processing is labelled as image conversion.
- Native View Transitions around navigation/state commits; immediate CSS incoming-screen fallback where unavailable. No animation wait gates input. History index distinguishes back from forward. No remount key was added to wizard state.
- Existing footer logo is the eligible non-header brand mark. It runs after paint once per session; it may be below the initial viewport. SSR defaults to the complete mark. Header, application and back-office logos remain static.
- One reduced-motion/print override; hidden-tab pause/resume in the marketing component. Removed live GSAP reveal calls, automatic hero bounce and marquee scrolling; gallery scrolling is user-controlled. Payment spinners are static, and legacy chat/loading animation classes are suppressed on working layouts.
- No dependency or pricing/document/payment rule changes. All 15 unrelated dirty files remain byte-identical.

## Timing and implementation notes

All specified brand, upload, transition and background timings are retained. The 900ms brand token is not the total choreography; the specified last wordmark ends at 1620ms. Brand animations use `both` fill mode: this retains the requested forward final state and also supplies the starting frame during stagger delays; cancellation returns to the visible base SVG. Official logo curves remain unchanged, including their small differences from the prototype's rounded coordinates. Ambient path opacity weights are 1 / .7 / .45 as in the prototype. CSS fallback paints the incoming screen; native View Transitions provide both old/new snapshots.

## Verified locally

- TypeScript, lint, tests and build pass: 1094 passed, 26 existing environment-gated skips. No gate suppressed. Existing Vite chunk/Browserslist notices remain.
- Frozen-source SHA checks before/after build and against the candidate commit match all 32 touched source paths.
- Client JS/CSS graph gzip: baseline 730036 bytes; candidate 687263 bytes; delta -42773 bytes (below the +3072 limit). Baseline is the currently published public asset graph.
- Local browser: EN/AR marketing has one backdrop; /ar/apply and admin/staff login have zero. Header remains static. Reduced-motion browser emulation returns zero running animations.
- Brand browser check: middle arch stays undrawn and star stays hidden during their delay; cancelling animations restores complete base appearance; reloading the same session does not replay.
- Unit tests cover 96/100 acceptance separation, unknown totals, failure drain, inline filename/retry, and server fallback layout boundaries.

## Staging verification - 2026-09-14

Explicit owner approval resolved the source-transfer gate. Guard deployed candidate 3976592, with 1094 tests passed, 26 existing skips, all check/lint/build gates and local/public health 200. No alternate transfer method was used.

- Throttled synthetic HEIC replacement: 96 during processing/saving, 100 after acceptance. Unsupported .docx shows filename/error/retry. Save & Continue reaches review, no payment or page errors. Initial UAT needed to expand the already-completed identity group; no lost documents.
- EN/AR marketing: one backdrop, static header. Apply and admin/staff login: zero backdrop. Reduced-motion browser emulation: zero running animations.
- Raw SSR home/prices contain rendered content/backdrop; apply and admin shell exclude backdrop. Real missing page returns 404. Authenticated render-error/render-timeout return 200 fallback, Arabic lang/dir and metadata/canonical. HTML remains private, no-store.
- To trigger fallback while logged into staging admin: /ar/visa-prices?__ssr_test=render-error or ?__ssr_test=render-timeout. Expected X-Tashira-SSR: fallback, HTTP 200.
- Six desktop Chromium runs at 390x844: EN median LCP baseline 4100ms / candidate 3760ms; AR 4368ms / 2556ms. EN CLS about .0046 / .0045, AR median .0931 / .0784. Candidate EN outlier 8560ms. Small noisy sample does not certify no regression, p95, zero motion-attributable CLS or Android performance.
- Fifteen unrelated dirty files rehashed and unchanged.

## Outstanding acceptance

Physical mid-range Android 60fps/scroll trace, real OS reduced-motion and explicit native/fallback forward/back direction and focus UAT remain unverified. Browser emulation is not a substitute. Not all motion criteria are claimed passed.

Evidence is in staging/task16-evidence: task16-upload-uat.json, task16-staging-browser.json, task16-ssr-uat.json, task16-candidate-metrics.json, task16-baseline-metrics.json. Full deploy log retained at tmp/task16-reviewed-deploy.log.

## Staging maintenance performed

Only three obsolete, reproducible node_modules caches were removed after exact path, revision, symlink and active-runtime checks: 58e93d9…, a7be072…, a938f6c…. Source, locks, backups and active dependencies were retained; available disk increased to about 4.6GB. No DB, application source or customer storage mutation occurred.

TASK15's separately approved 24-continuous-hour Express guarantee remains unfinished; this motion work does not complete it.

## Visibility correction - 2026-09-14

Owner reported no visible motion. The old open tab still had the pre-TASK16 triplicated gallery; a fresh tab loaded the new implementation. Separately, brand playback was consumed while the footer was below the viewport. Commit 3d8ae0be27dd352d13d64a7d06e9bb3e1af0338e defers playback/session marking until IntersectionObserver reports the footer mark visible, after paint. No duration/opacity/geometry change. Full local and guarded gates passed, health 200. Local and deployed browser verification prove pending state off-screen, playback on visibility, static header, and no replay on reload. A real staging capture is retained in tmp/task16-visible-brand.webm. Hardware/performance and explicit route-direction checks remain open.

## Owner-approved first-screen placement - 2026-09-15

Owner rejected the small footer treatment and explicitly approved a large, nonblocking first-screen mark outside the header. Deployed 3647b0743e9ec53f137cad50a4bd2c4def9d90b2: reference-width 132px mark above homepage title; other marketing pages have a navy introduction; footer/header static. Normal-flow reserved dimensions preserve content access; no overlay or loading gate. All original motion timings retained.

Full local gates passed with two Vitest workers after an initial run hit worker start/termination timeouts. 1094 pass, 26 existing skips. Guard gates passed too. SSH output disconnected during build; subsequent read-only checks found the exact deployed revision, deployment audit PASS (2026-09-15T05:38:45Z), PM2 online, local health and public page 200. Initial browser navigation timeouts cleared on retry; actual staging desktop/mobile visual UAT passed.

Desktop mark: x574/y113.77, 132x169.70 within 1280x900. Mobile: x129/y88, 132x169.70 within 390x844. Intermediate stroke offsets are nonzero at 50/500ms, zero at 1700ms; star ends opacity1. Header/footer static, no horizontal overflow, no page errors, no repeat after reload. Screenshots visually inspected; actual recordings in tmp/task16-intro-desktop.webm and tmp/task16-intro-mobile.webm. EN homepage and AR prices smoke, SSR final markup, reduced-motion zero animations and apply/admin exclusions pass. Physical Android, real OS setting, LCP/CLS regression certification and transition-direction UAT remain open; do not claim them passed.

Two obsolete dependency caches (ca15cff0, cf1e0fec) removed only after exact revision/path and active-runtime checks; source/locks/backups retained. Fifteen unrelated dirty files unchanged. No production, payment or document mutation.

## Owner rejection and removal - 2026-09-15

Owner explicitly rejected the large first-screen logo and requested removal. Staging dd57d4ef798cc3ea1241cd31f61668e5a9200240 removes all mounted BrandLoad instances (home, marketing strip and optional footer wiring), restores homepage spacing, and retains normal static header/footer logos. Guard check/lint/test/build and both health checks passed. Actual AR/EN home and AR pricing return 200 with zero brand-intro/brand-play elements, no page errors, standard logos present. Evidence: staging/task16-evidence/task16-remove-uat.json. No new visual treatment is proposed. Other previously approved upload, transition and ambient functionality unchanged. All 15 unrelated files preserved. Production untouched.
