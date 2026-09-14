The revised owner instructions resolved both questions. Implementation and current evidence: see TASK16_MOTION_REVIEW.md. Earlier preflight follows for history.

# TASK16 motion preflight — 2026-09-14

Status: inspected; no application-code changes or deployment. TASK15 Express guarantee remains unfinished, with the 24-continuous-hour window approved.

## Owner clarifications pending

- Section 2 requires upload animation; acceptance criterion 9 forbids animation on the upload screen. Asked whether upload feedback alone is the exception.
- Section 0 forbids decorative motion; section 4 requires ambient motion. Asked whether this is an explicit exception or should remain static.
- Owner supplied motion.html at C:/Users/ADMIN/Documents/Claude outputs/motion.html; inspected on 2026-09-14. Reference only; written TASK16 constraints take precedence.

## Verified code and proposed touch points

All source paths below are relative to the isolated clean export tmp/next3-check, not the unrelated dirty worktree versions.

- src/lib/document-upload-client.ts: actual XHR progress already exists, but currently emits up to 100 before server processing finishes. Map byte progress into 0–96; never interpret transfer completion as accepted.
- contracts/document-upload-policy.ts: existing preparing/uploading/processing/saving phases; extend the shared presentation contract for accepted/error and honest indeterminate progress.
- src/components/customer/InterviewRequirementDocuments.tsx and ApplicationSupplements.tsx: preserve selected files on error; keep verifying through metadata/evidence linking, then show accepted. New shared UploadProgress component avoids divergent state displays.
- src/components/shared/Logo.tsx: existing inline SVG geometry with SSR final-state markup; add stable part hooks/pathLength only. Header remains static. New session-gated brand component must read browser storage only after hydration.
- src/PublicApp.tsx, src/App.tsx and wizard view boundary: candidate integration points for route/step transitions, with hard exclusions for payment, uploads and admin/staff. Preserve language routing and wizard state. Inspect navigation commit timing before choosing the View Transition integration.
- src/index.css plus a shared motion stylesheet: tokens, permitted properties only, one global reduced-motion override, print exclusions and documented specification timing exceptions (including the 900ms brand token versus the explicitly required 760ms arch sequence).
- src/hooks/useDocumentUpload.ts contains legacy synthetic 30/60/80 progress. Trace callers before changing; do not describe this as the active wizard transport without evidence.

## Verification requirements

Capture baseline and candidate on identical routes, viewport/network/CPU settings and repeated samples; compare LCP/CLS and report measurement noise rather than asserting exact zero from one run. Measure gzip bundle delta against the same baseline. Test XHR throttling, delayed server acceptance, conversion, errors/retry, session repeat, JavaScript disabled, RTL next/back, payment/admin exclusions and hidden-tab pause.

Real OS reduced-motion and physical mid-range Android 60fps must be reported as unverified unless actually exercised on those devices; browser emulation is supplementary evidence, not a substitute. No performance measurements have been run yet.

## Prototype inspection

- Brand timings match the detailed specification: 760ms arches with 130ms staggering; final wordmark finishes at 1620ms. Prototype caption claiming 900ms is not the sequence duration.
- Prototype starts arcs/text hidden without JavaScript; production must default to the final visible state and apply animation only after hydration/paint.
- Prototype animates width and margin-inline-start; replace those with transform/clip-path. Do not copy its forced offsetWidth reflow.
- Prototype upload uses random increments and timers. Keep the existing real XHR transport instead; accepted must follow successful server storage/metadata/evidence linking.
- Prototype reduced-motion keeps 90ms route animations; production must disable them entirely.
- Prototype inF uses -14px * --dir: with RTL --dir=-1 this enters from the right, contrary to the written requirement. Production forward entry must use +14px * --dir (left in RTL), reversed for back.
- Prototype animates its payment mock and blocks navigation during animation; neither behaviour is permitted in production.
- Prototype visibility handler pauses on hide but never resumes on show. Production visibility state must handle both transitions.
- Prototype glow performance, battery-cost and zero-CLS prose are claims, not measurements. Baseline/candidate and real-device checks remain required.

No prototype scripts executed, no application code changed, and no deployment performed during this reference review. The two owner clarification questions remain pending.
