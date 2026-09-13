# Phase 1 staging verification — 2026-09-13

Deployed commit: `b9c206c16e545ff7184bfecfd0279f73e9977fc2`.
Previous staging commit: `7ecc5800310dceced5346f224019fe00b56ad58e`.
Deployment guard: PASS; local/public health: HTTP 200. Production application,
database and configuration were not modified. All 15 prior dirty/untracked
working files retain their exact pre-Phase-1 SHA-256 hashes.

## Verified

- Server guard reran check, lint, build, and all tests: 967 passed, 26
  environment-gated integration tests skipped. No gate was disabled.
- All 16 fixed English routes return HTTP 200, real source body, one exact
  approved title, exact description and query-free canonical. Metadata strings
  were not changed after approval.
- Production Chrome: all 16 routes work without JavaScript; with JavaScript,
  no page errors or hydration errors. A published `/guides/how-to-apply-uae-visa`
  article also passed source, record-derived metadata and hydration checks.
- Unknown route, both held landing routes and missing CMS article return 404.
- Every checked HTML response is private, no-store. Private application,
  payment, track, login and recovery routes remain noindex; no synthetic order
  reference or recovery token appears in source metadata.
- Actual staging fallback results: render-error 200 (~442 ms), render-timeout
  200 (~3016 ms including HTTP overhead), data-timeout 200 (~1420 ms including
  worker startup). All preserve the exact static pricing metadata and SPA
  entry. Server logs contain the corresponding redacted failure reason.
- Anonymous fault parameters are ignored. The SPA fallback itself was tested
  in production Chrome and mounted the real pricing page without errors.
- Browser journey `TSH-MTZRNR65-A8B2B0`: synthetic applicant, four synthetic
  uploads, review ready for payment, saved fields/documents survive reload.
  A short-lived synthetic recovery challenge, seeded without email delivery,
  was consumed in a fresh browser, reached `/pay/:reference`, and restored the
  same four documents and fields. No recovery token leaked via Referrer or
  metadata. No card entry, real payment, or customer data was used.

## Staging proxy correction

Live testing found Nginx appending `strict-origin-when-cross-origin` after the
application's `no-referrer`. Corrected only
`/etc/nginx/sites-available/staging.tashiraev.com`:

```nginx
map $uri $tashira_staging_referrer_policy {
    default "strict-origin-when-cross-origin";
    /recover "no-referrer";
}
# Inside the staging TLS server:
proxy_hide_header Referrer-Policy;
add_header Referrer-Policy $tashira_staging_referrer_policy always;
```

`nginx -t` passed before reload. Backup:
`/var/backups/tashira-staging/phase1-nginx-referrer-20260913.conf`.
Production vhost SHA-256 stayed
`b4c6d4998dad9da8f17417bb35b096447dd2106d274ff6f47180b137e0836491`.
Live `/recover` now has exactly `Referrer-Policy: no-referrer`.

## Owner fallback checks

Log in at `https://staging.tashiraev.com/admin/login` in the same browser, then:

- `https://staging.tashiraev.com/visa-prices?__ssr_test=render-error`
- `https://staging.tashiraev.com/visa-prices?__ssr_test=render-timeout`
- `https://staging.tashiraev.com/visa-prices?__ssr_test=data-timeout`

Expected: HTTP 200, `X-Tashira-SSR: fallback`, pricing title/description/canonical
in page source, functioning pricing page with JavaScript. Removing the query
restores `X-Tashira-SSR: rendered` and server-rendered page body. Faults are
request-local and only honored for an administrator on staging.

Limits remain 3,000 ms for the entire worker render and 1,000 ms for each
awaited public fetch (including response body), redirect lookup and fault-auth
lookup. Synchronous worker hangs are terminated at the render deadline.

Logs: `/var/www/tashira-staging/logs/app-out.log` (`ssr_render`) and
`/var/www/tashira-staging/logs/app-error.log` (`ssr_fallback`). Events use route
templates and reason categories, not cookies, queries or reference numbers.

## Performance threshold — proposal only

Observed staging sample: 68 successful SSR renders, p95 648 ms, minimum 370 ms,
maximum 986 ms. Deliberate fallbacks excluded. This is verification traffic,
not a representative production load test, but exceeds the owner's 150 ms
trigger. **No HTML cache was added.**

Recommended next proposal: profile worker startup separately from API fetch
and React rendering, then consider warm isolated workers with a fresh query
client and i18n instance per request, tested for state isolation and hard
termination. This can reduce startup overhead while keeping private, no-store
and zero response caching. This optimization has not been implemented.

If the owner instead approves a public marketing cache, first prove its route
allowlist cannot read cookies/session/reference; require explicit TTL, keys and
CMS/catalog invalidation decisions. `/apply`, order and payment routes remain
permanently excluded. Do not introduce that cache without owner approval.

Phase 2 remains held for owner verification. Phase 3 reminders: owner-supplied
GCC homepage copy, OG artwork, and an optional checkout claim only with owner
approval and charged-versus-displayed tests for every visa/speed. VAT extraction
for accounting remains outside this code conclusion.
