import { createTRPCProxyClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../api/router";
import { env } from "../api/lib/env";
import { createCustomerApplicationCookie } from "../api/lib/customer-session";

const reference = "TSH-STG-DYN-INDIVIDUAL";
const databaseUrl = new URL(env.databaseUrl);
if (databaseUrl.pathname.slice(1) !== "tashira_staging") throw new Error("STAGING_READ_CONTRACT_DATABASE_IDENTITY_FAILED");
if (!process.cwd().replaceAll("\\", "/").endsWith("/var/www/tashira-staging")) throw new Error("STAGING_READ_CONTRACT_PATH_IDENTITY_FAILED");

function client(references: readonly string[]) {
  const headers = new Headers({ host: "staging.tashiraev.com", "x-forwarded-proto": "https" });
  const cookies = references.reduce((current, item) => {
    const nextHeaders = new Headers(headers); if (current) nextHeaders.set("cookie", current);
    return createCustomerApplicationCookie(nextHeaders, item).split(";", 1)[0];
  }, "");
  return createTRPCProxyClient<AppRouter>({ links: [httpBatchLink({ url: "http://127.0.0.1:3002/api/trpc", transformer: superjson,
    headers: () => cookies ? ({ cookie: cookies }) : ({}) })] });
}

async function expectDenied(operation: () => Promise<unknown>): Promise<void> {
  try { await operation(); throw new Error("STAGING_READ_CONTRACT_EXPECTED_DENIAL_MISSING"); }
  catch (error) {
    if (!(error instanceof TRPCClientError) || !["UNAUTHORIZED", "FORBIDDEN"].includes(String(error.data?.code))) throw error;
  }
}

const authorized = client([reference]); const anonymous = client([]); const input = { referenceNumber: reference };
const started = await authorized.dynamicInterview.start.query(input);
const resumed = await authorized.dynamicInterview.resume.query(input);
if (JSON.stringify(started) !== JSON.stringify(resumed)) throw new Error("STAGING_READ_CONTRACT_RESUME_DIVERGED");
const [question, eligibility, requirements, uploads, scheduler, review] = await Promise.all([
  authorized.dynamicInterview.getCurrentQuestion.query(input), authorized.dynamicInterview.getEligibility.query(input),
  authorized.dynamicInterview.getRequirements.query(input), authorized.dynamicInterview.getUploadRequirements.query(input),
  authorized.dynamicInterview.getSchedulerResult.query(input), authorized.dynamicInterview.getReviewSummary.query(input),
]);
if (question.currentStep !== started.currentStep || question.nextAction !== started.nextAction) throw new Error("STAGING_READ_CONTRACT_QUESTION_DIVERGED");
if (eligibility.eligibilityState !== started.eligibilityState || eligibility.applicants.length !== started.review.applicants.length) {
  throw new Error("STAGING_READ_CONTRACT_ELIGIBILITY_DIVERGED");
}
if (requirements.length !== started.review.applicants.length) throw new Error("STAGING_READ_CONTRACT_REQUIREMENTS_DIVERGED");
if (uploads.length !== (started.partySetup?.requirementReadiness.length ?? 0)) throw new Error("STAGING_READ_CONTRACT_UPLOADS_DIVERGED");
if (scheduler.length !== (started.unifiedReview?.schedules.length ?? 0)) throw new Error("STAGING_READ_CONTRACT_SCHEDULER_DIVERGED");
if (JSON.stringify(review.interview) !== JSON.stringify(started.review)
  || JSON.stringify(review.unified) !== JSON.stringify(started.unifiedReview)) throw new Error("STAGING_READ_CONTRACT_REVIEW_DIVERGED");
const serialized = JSON.stringify({ question, eligibility, requirements, uploads, scheduler, review }).toLowerCase();
if (["suppliercost", "internalcost", "margin", "profit", "stripe"].some((field) => serialized.includes(field))) {
  throw new Error("STAGING_READ_CONTRACT_FINANCE_FIELD_LEAK");
}
const deniedOperations = [
  () => anonymous.dynamicInterview.start.query(input), () => anonymous.dynamicInterview.resume.query(input),
  () => anonymous.dynamicInterview.getCurrentQuestion.query(input), () => anonymous.dynamicInterview.getEligibility.query(input),
  () => anonymous.dynamicInterview.getRequirements.query(input), () => anonymous.dynamicInterview.getUploadRequirements.query(input),
  () => anonymous.dynamicInterview.getSchedulerResult.query(input), () => anonymous.dynamicInterview.getReviewSummary.query(input),
];
for (const operation of deniedOperations) await expectDenied(operation);
console.log("STAGING_UNIFIED_READ_CONTRACT=PASS");
console.log("STAGING_UNIFIED_READ_LIFECYCLE_EQUIVALENCE=PASS");
console.log("STAGING_UNIFIED_READ_AUTHORIZATION=PASS");
console.log("STAGING_UNIFIED_READ_FINANCE_ISOLATION=PASS");
