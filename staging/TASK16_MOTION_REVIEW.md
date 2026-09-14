# TASK16 — local candidate, staging transfer blocked

Code candidate: `3976592aa5264b288a9c221a0f9c369e2fcf5466` on `kimi/unified-wizard-reviewed`.
TASK16 is NOT deployed and is NOT fully accepted. No production change, migration, payment or real customer upload occurred.

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

## Still required after staging transfer approval

- Actual throttled HEIC upload, verifying-to-accepted and review navigation on the synthetic staging fixture. The prepared script has NOT run against this candidate.
- Post-deploy LCP/CLS comparison, native/fallback direction/focus and saved-application smoke. Baseline contains six unthrottled desktop Chromium runs at 390x844 (three per language), with substantial variability. It is not a p95 or an Android performance result. Zero CLS contribution and no LCP regression are NOT yet certified.
- Real OS reduced-motion setting and physical mid-range Android 60fps/scroll trace. Browser emulation is not a substitute; neither hardware criterion is claimed passed.
- Direct browser verification of no-JavaScript server output and the deployed fallback/404.

## Concrete blocked action

Incremental Git bundle: `C:/Users/ADMIN/OneDrive/Documents/TASHIRA/tmp/task16-reviewed.bundle`.
SHA-256: `926e7c7246f848d8fc3bb338d8eec42d66730dc4b90274d09d266df305b4fcf0`.
Required base: `d79a8bc57b5e2a9f50869e7d1c39283661885498`.
Destination: staging server `168.231.85.149` (DNS matches `staging.tashiraev.com`; also documented in `handoff/kimi/KIMI_STAGING_RUNBOOK.md`), constrained review repository `/var/lib/tashira-kimi-review/repository.git` through `/usr/local/bin/tashira-kimi-readonly ingest-bundle`, running as `kimi-deploy`.
Then: guarded staging-only deployment to `/var/www/tashira-staging`, conditional on exact base/candidate, full guard gates and health checks. No production deployment.

Automatic approval review rejected source transfer twice, including after DNS/runbook/incremental-bundle evidence. Its stated reason was that general staging authorization did not explicitly authorize source disclosure to this destination. No alternate upload method was used. Explicit owner authorization for this source transfer is now requested.

## Staging maintenance performed

Only three obsolete, reproducible node_modules caches were removed after exact path, revision, symlink and active-runtime checks: 58e93d9…, a7be072…, a938f6c…. Source, locks, backups and active dependencies were retained; available disk increased to about 4.6GB. No DB, application source or customer storage mutation occurred.

TASK15's separately approved 24-continuous-hour Express guarantee remains unfinished; this motion work does not complete it.
