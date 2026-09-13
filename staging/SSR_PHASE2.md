# Phase 2 — route-owned language

Sixteen fixed public pages are available at `/en` and `/ar` prefixes. The root
and legacy public/customer URLs negotiate English or Arabic from Accept-Language
with a 302 and Vary header. Existing application references and query strings
are retained. Administrative routes remain available at their existing paths.

The server sets HTML lang/dir, metadata, canonical and all three reciprocal
hreflang links. Arabic resources initialize synchronously from the route.
Browser location is captured in bootstrap, outside component initialization.
The language switch updates the controlled router without remounting the wizard
or query provider, preserving unsaved fields, search, hash and history state.
Visible directional spacing/alignment uses logical CSS utilities.

All HTML remains private, no-store. No response cache, public data cache or
worker tuning is introduced. Logs now separate each awaited public data query,
parallel preload wall time, React render, serialization and remaining worker
startup/IPC time. Server-Timing exposes only the total render duration.

Known fixed pages with an empty body or an erroneous notFound result use the
HTTP 200 SPA fallback. Genuine missing pages use a localized HTTP 404. The
existing 3000ms render / 1000ms data deadlines remain unchanged. Signed-in
staging administrators can verify `/ar/visa-prices?__ssr_test=render-error`,
`render-timeout`, or `data-timeout`. Expect 200, X-Tashira-SSR: fallback and the
approved Arabic metadata, canonical and RTL HTML. Anonymous probes are ignored.

Staging Nginx must apply no-referrer to `/recover`, `/en/recover` and `/ar/recover`.
No production configuration, database schema or wizard business rule changes.

Required release checks: TypeScript, ESLint, full tests and production build;
32 fixed route source/no-JavaScript/hydration checks; delayed-JavaScript Arabic
first paint; unsaved form language switching; persisted synthetic application
and document recovery; genuine 404 and protected fallback verification.

Phase 3 remains held. It includes remaining OG/artwork, sitemap/host, font and
logging work. Revisit the optional checkout claim only with owner approval and
charged-versus-displayed tests. VAT accounting stays with the accountant.
