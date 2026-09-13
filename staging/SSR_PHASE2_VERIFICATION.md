# Phase 2 staging verification — 13 September 2026

Deployed code: `8102483fb8b54bc7304c0553ae5d15a3692af583`.
Staging-only deployment guard, local health and public health: PASS.
Production was not deployed or modified. All 15 pre-existing dirty files remain
byte-identical to the preserved baseline. The approved metadata JSON is unchanged
from Phase 1: 16 routes, 32 language-specific title/description pairs.

## What shipped and how to inspect it

- Open https://staging.tashiraev.com/ar/visa-prices or its `/en/visa-prices` pair.
  View source or disable JavaScript: headings, prices and body are present.
- All 16 fixed routes have both language variants. Server HTML owns lang/dir,
  canonical and reciprocal en/ar/x-default links. Canonical host is the approved
  `www.tashiraev.com`; production host redirects/sitemap remain Phase 3 work.
- `/` and old public/customer URLs negotiate via Accept-Language using 302 and
  `Vary: Accept-Language`. Existing application references/query strings survive.
- Select ARABIC/ENGLISH in the header: the route changes in place. Unsaved step 1
  email/phone and step 2 traveller/passport fields remain intact. No browser
  storage or navigator language is read during component initialization.
- Delaying JavaScript by 1500ms showed no lang/dir transition away from Arabic/RTL.
  Server and hydrated output match; zero browser console/page hydration errors
  across 32 fixed routes. Both existing CMS language articles also passed.
- Four representative Arabic mobile pages passed a 390px overflow check. The
  desktop header physically mirrors. Visual screenshots were inspected. Shared
  footer labels, address and processing badges are Arabic on the Arabic routes;
  the registered English company name is retained.

## Regression and privacy evidence

TypeScript, ESLint, 980 tests and full client/SSR/server build passed locally and
through the staging deployment guard. Twenty-six environment-gated tests remain
skipped; they were not suppressed or claimed as executed.

Synthetic case `TSH-MTZT24YN-593CA4`: creation, step 2 unsaved language switching,
four generated non-document PNG uploads, review and saved reload passed. A fresh
single-use `/ar/recover` link restored the same case to `/ar/pay/...`, then the
same saved details and four files were verified. This recovery check passed again
on the final deployed build. No email was sent and no charge was made. This is
payment-route continuity evidence, not a new end-to-end Stripe charge test.

Private pages stay client-rendered/noindex; references and recovery tokens are
absent from server metadata. `/recover`, `/en/recover` and `/ar/recover` emit
no-referrer through staging Nginx. No token leaked through browser referrers.
The production Nginx configuration hash is unchanged.

All HTML remains `private, no-store`. No HTTP response cache, public data TTL
cache, worker tuning, dependency upgrade or wizard business-rule change shipped.

## SSR failure checks

While signed into the staging administrator session, open:

- `/ar/visa-prices?__ssr_test=render-error`
- `/ar/visa-prices?__ssr_test=render-timeout`
- `/ar/visa-prices?__ssr_test=data-timeout`

The same probes work under `/en`. All six final-build probes returned HTTP 200,
`X-Tashira-SSR: fallback`, the approved route/language title, description,
canonical, hreflang and lang/dir, plus the working SPA entry. Anonymous fault
parameters are ignored. Render deadline remains 3000ms; awaited data deadline is
1000ms. Total data-timeout response also includes worker startup. Genuine unknown
and held pages return localized real 404s. Fixed-route notFound/empty worker
results now explicitly take the 200 fallback; catalog failure cannot turn the
known pricing route into a 404.

## Answers to the two Phase 1 audit questions

The hero was manually changed in earlier commit
`d257ac3db74c08cb2486719e70cb8b837b74f2a6`, before Phase 1. The compliance gate
rejects disallowed strings; it does not rewrite copy. The changed hero is not
evidence that the gate forced or automatically made that edit. No such claim is
made here.

The initial retained Sep 13 Nginx audit found 11 requests for the exact document
path `/visa-prices`, all 200 and none 404. The shared access log lacks a host
field. The earlier observed 404 is therefore unexplained; neither a cached
client response nor a deployment race has been established as its cause.

One separate availability issue was observed during this phase's final deploy:
the browser requested `/en` while the single staging process was restarting and
received 502 at **12:54:10 UTC**. The access log corroborates that event. Health
then passed, and all stable-build checks were rerun successfully. The exact gap
duration was not measured. SPA fallback cannot operate while the process is
unavailable. The current deployment is not zero-downtime; resolving that needs a
separate staging deployment proposal before paid traffic. No production or
worker configuration was changed to conceal this limitation.

## Performance — measured, not tuned

The old 648ms figure was **server SSR p95 from 68 verification renders**, not
full network TTFB. It did not have a layer split. The instrumentation now does.

Across 190 successful Phase 2 verification renders (fault responses excluded):

| Layer | p50 ms | p95 ms |
|---|---:|---:|
| Total server SSR | 484 | 736 |
| React render | 29.7 | 52.1 |
| Awaited public data wall time | 0.1 | 58.9 |
| State serialization | 1.1 | 9.5 |
| Remaining setup / worker startup / module loading / IPC | 416.7 | 661.8 |

| Awaited public procedure | Samples | p50 ms | p95 ms |
|---|---:|---:|---:|
| `catalog.listActiveProducts` | 67 | 44.6 | 59.4 |
| `content.publicBySlug` | 2 | 70.9 | 70.9 |
| `content.publicList.GUIDE` | 22 | 47.5 | 63.2 |
| `content.publicList.NEWS` | 18 | 43.7 | 62.9 |

The separate pre-render CMS redirect lookup measured 282 calls: p50 1.5ms,
p95 4.6ms. Public query times include loopback tRPC/batch overhead; concurrent
queries overlap. Percentiles across layers must not be added together. The
remaining server bucket is measured by subtraction and is not a pure CPU timer.

The final controlled sample was 20 sequential pricing requests (10 per language),
each using a fresh HTTPS connection from this workstation:

| Measured duration | p50 ms | p95 ms |
|---|---:|---:|
| DNS | 20.7 | 30.2 |
| TCP connection | 120.0 | 128.4 |
| TLS handshake | 129.7 | 135.7 |
| Server SSR | 495.9 | 835.4 |
| Full first-byte time | 1007.8 | 1336.5 |
| Full first-byte minus SSR | 515.2 | 561.4 |

The final 20-render server breakdown is also in server-timing.json. The initial
94-render cohort had SSR p95 590ms and the first fresh-connection cohort had
TTFB p95 1119.2ms. Those earlier cohorts are preserved, not discarded to select a
preferred result. Variability is material; this is not a controlled before/after
performance comparison or a production load test.

Sizing: staging and production share the same 2-vCPU, 7940MiB host, each with one
online PM2 fork process. There is no independently sized staging box. Workload,
code paths and shared-host contention can differ, so these p95 values cannot
predict production traffic. The current design starts a fresh SSR worker for
each request, so worker cold-start cost recurs even when the app itself is warm.

Inference from these measurements: public catalog/CMS calls are not the dominant
cost. A permitted 60-second public-reference-data cache could save some data time
but would leave the large setup/worker remainder. Worker lifecycle isolation and
startup should be the subject of a measured proposal, preserving hard deadlines;
no tuning was performed in this phase. Performance and deployment continuity
remain pre-paid-traffic work. Response caching remains prohibited.

## Phase boundary

Phase 2 is deployed and ready for the owner's independent acceptance. Phase 3 is
held. No new OG artwork, host redirect policy, sitemap, font changes or checkout
marketing claim was introduced. The optional charging claim still requires owner
approval and displayed-versus-charged tests across product/speed combinations.

Raw results and screenshots are alongside this report. The release repository
also records the implementation under `staging/SSR_PHASE2.md`.
