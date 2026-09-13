# Phase 1: existing English routes

Scope: request-time React SSR and approved metadata for the 16 existing fixed
English routes, plus published CMS articles. Language prefixes and Phase 3 work
remain held for owner verification. No wizard rules, payment amounts, database
schema, production environment, or prior uncommitted work were changed.

## Failure handling

- React worker deadline: 3,000 ms, including worker startup and awaited data.
- Every public API fetch (including reading its response body): 1,000 ms.
- CMS redirect lookup and staging fault authentication: 1,000 ms each.
- The worker is terminated at the render deadline, including synchronous hangs.
- Render exceptions/deadlines return HTTP 200 with the working SPA shell and the
  fixed route's exact approved title, description, and canonical.
- Confirmed absent routes and missing CMS records return actual HTTP 404.
- All HTML is `private, no-store`; no HTML cache exists. Only fingerprinted
  static assets receive one-year immutable caching.
- Public SSR calls do not forward visitor cookies or authorization. Reference
  pages remain client-only and noindex. Recovery also sends no-referrer.

## Owner staging checks

Log in as an administrator on staging, then open any of these in that browser:

- `/visa-prices?__ssr_test=render-error`
- `/visa-prices?__ssr_test=render-timeout`
- `/visa-prices?__ssr_test=data-timeout`

Each returns 200 and `X-Tashira-SSR: fallback`. Page source retains the exact
pricing title, description and query-free canonical, plus the client entry.
With JavaScript enabled, the existing pricing page renders normally. The render
timeout deliberately blocks the isolated worker to test hard termination.
The parameters are ignored for unauthenticated visitors and outside the exact
staging PUBLIC_APP_URL. No persistent setting is changed.

Remove the query to see `X-Tashira-SSR: rendered`, actual page body in source,
and `<html lang="en" dir="ltr">`. `/not-a-real-page`, `/uae-visa`, and
`/dubai-visa` return 404. Check all paths in
`contracts/public-page-metadata.json` with JavaScript disabled and enabled.

Server logs include JSON events `ssr_fallback` with route template, reason
(`render_error`, `render_timeout`, `data_timeout`) and elapsedMs. `ssr_render`
records route template, elapsedMs and rendered/fallback mode. No raw exception,
cookie, query string or order reference is logged by these events.

## Verification and deferred decisions

Production build, TypeScript, ESLint, full regression suite, no-JavaScript HTML
checks, and production Chrome hydration checks are required before release.
Three real-worker failure tests verify 200, retained metadata and deadlines.
HTTP tests cover private headers, recovery, CMS 404 and fault access control.

The owner must verify Phase 1 before Phase 2 starts. If SSR p95 exceeds 150 ms,
report it and propose an optimization; do not add caching automatically.
At Phase 3, revisit the owner's homepage GCC body content and the optional
checkout claim. That claim needs owner approval plus charged/displayed amount
tests across every visa type and both processing speeds. VAT extraction for
accounting remains an accountant decision.
