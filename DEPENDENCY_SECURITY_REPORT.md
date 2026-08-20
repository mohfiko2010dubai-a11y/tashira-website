# TASHIRA Dependency Security Review

Date: 2026-08-11

## Outcome

A clean isolated-staging audit initially reported 24 vulnerable packages: 1 low, 7 moderate, and 16 high. Targeted compatible updates and removal of the mismatched direct React Router v7 dependency reduced the verified result to 18 packages: 1 low, 9 moderate, and 8 high.

No `npm audit fix --force`, automatic major upgrade, ignored failure, or production change was used. A broad lockfile update that reduced the count further was rejected and reverted because `npm ci` proved the generated lock inconsistent.

## Accepted targeted updates

| Package | Classification | Change | Result |
|---|---|---|---|
| `dompurify` | Direct runtime | 3.4.4 → 3.4.13 | Known reported sanitizer findings cleared |
| `hono` | Direct runtime | 4.8.3 → 4.13.1 | Direct Hono findings cleared |
| `nanoid` | Direct runtime | 5.1.6 → 5.1.16 | Direct Nano ID finding cleared |
| `postcss` | Direct development/build | 8.5.6 → 8.5.26 | Direct PostCSS findings cleared |
| `vite` | Direct development/build | 7.2.4 → 7.3.6 | Direct Vite findings cleared |
| `react-router-dom` | Direct runtime | 6.28.0 → 6.30.4 | Clears older v6 advisories; one newer advisory remains |
| `react-router` | Direct runtime | Removed v7 dependency | Application imports now use the Router DOM v6 context consistently |

The React Router correction also fixed a verified runtime failure: the fallback page previously crashed because components imported from direct Router v7 were rendered under a Router DOM v6 provider.

## Remaining findings

| Package | Severity | Direct/transitive | Runtime exposure | Disposition |
|---|---|---|---|---|
| `xlsx` | High | Direct | Client-side export code; current app writes workbooks and does not parse uploaded workbooks | No npm fix. Defer replacement/removal decision; keep XLSX code behind authenticated lazy-loaded admin routes |
| `react-router-dom` / `react-router` | Moderate | Direct/transitive | Client routing | Latest v6 still reported; npm proposes v7 major. Defer major migration. Current navigation uses application-owned route strings rather than untrusted external redirects |
| `@hono/node-server` | Moderate | Direct | Production HTTP/static adapter | Advisory concerns encoded Windows backslashes; verified staging/production OS is Linux. npm reports no compatible fix; v2 major requires separate review |
| `@hono/vite-dev-server` | Moderate | Direct development | Development only | Inherited adapter finding; not used by production server startup |
| `drizzle-kit`, `@esbuild-kit/core-utils`, `@esbuild-kit/esm-loader`, `esbuild` | Moderate | Direct/transitive development | Schema/build tooling | npm proposes an unsafe downgrade/major-semantic change. Defer until Drizzle toolchain migration is tested |
| `@babel/core` | Low | Transitive development | Build tooling with local-file preconditions | Compatible transitive fix not selected independently; monitor toolchain updates |
| `brace-expansion`, `minimatch`, `picomatch` | High | Transitive development | Glob processing in lint/build tools | No untrusted production glob input. Update through owning tools, not lockfile overrides without compatibility tests |
| `flatted`, `js-yaml`, `lodash` | High | Transitive development/tooling | Build/config parsing | No identified customer-controlled production call path. Update through owning packages after compatibility review |
| `rollup` | High | Transitive development/build | Build output path handling | Staging and CI build trusted repository input into fixed directories. Update through a compatible Vite release when available |
| `ajv` | Moderate | Transitive development/tooling | Schema/config validation | Broad lock update caused an `ajv` lock inconsistency and was rejected. Defer to owning dependency update |

## Exploitability and controls

- `xlsx` is not allowed to parse customer uploads; it is used only for authenticated export generation from application-controlled data.
- Development-server, bundler, glob, and schema-tool findings are not loaded by the production runtime path, but remain CI/developer workstation risks and are not dismissed.
- Static file path resolution has application-level traversal checks and production runs on Linux; the Node adapter major upgrade remains pending.
- Router navigation must continue to use internal route constants or validated identifiers. Do not pass customer-controlled absolute, protocol-relative, or backslash-prefixed targets to navigation APIs.
- No package override was added merely to silence audit output.

## Verification

- `npm ci`: PASS with the targeted lockfile.
- `npm run check`: PASS.
- `npm run lint`: PASS.
- `npm run test`: PASS, 56/56.
- `npm run build`: PASS.
- Verified audit after changes: 18 total (1 low, 9 moderate, 8 high).

## Required follow-up

1. Evaluate replacing `xlsx` with a maintained export-only library or a supported SheetJS distribution.
2. Plan and test a coherent React Router v7 migration instead of mixing major versions.
3. Test `@hono/node-server` v2 separately against static files, storage, invoices, webhooks, and tRPC.
4. Upgrade Drizzle/esbuild ownership chains together; do not accept npm's proposed Drizzle downgrade.
5. Re-run this audit after every lockfile or build-tool change.
