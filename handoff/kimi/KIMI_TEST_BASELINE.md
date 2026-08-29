# Kimi Test Baseline

Baseline SHA: `4e0f520b72e047e590a646774576eec2614a2e22`.

| Gate | Baseline | Command / evidence |
|---|---|---|
| TypeScript | PASS | `npm run check` |
| ESLint | PASS | `NODE_OPTIONS=--max-old-space-size=6144 npm run lint` |
| Unit/integration | PASS | `npm run test`; 775 passed, 26 environment-gated skipped |
| Schema/migrations | PASS | paired migrations `014`–`043`; production-readiness verifier |
| Client build | PASS | `npm run build` |
| Static assets | PASS | `scripts/verify-static-assets.mjs` within build |
| Server bundle | PASS | esbuild step within build |
| Native Staging build | PASS | `node staging/build-native.mjs` |
| Staging health | PASS | local/public HTTP 200 at handoff |
| Authenticated Operations Browser E2E | PASS for scoped synthetic cases | applicant isolation, assignment, reviews, controlled transition and visible audit history |
| Full owner visual acceptance | PENDING | owner records PASS/FAIL/CHANGE REQUEST |
| External OCR/mailbox/authority providers | SKIPPED | no approved provider/credentials |
| Production | NOT RUN / NOT AUTHORIZED | separate owner gate |

## Required rerun

```text
npm ci
npm run check
NODE_OPTIONS=--max-old-space-size=6144 npm run lint
npm run test
npm run build
node --experimental-strip-types scripts/verify-operations-production-readiness.ts
```

Any skipped MySQL/provider test must state the exact required isolated environment variable. Never satisfy it with Production credentials.
