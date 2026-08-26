import { createTRPCProxyClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import { createPool, type RowDataPacket } from "mysql2/promise";
import superjson from "superjson";
import type { AppRouter } from "../api/router";
import { env } from "../api/lib/env";
import { createCustomerApplicationCookie } from "../api/lib/customer-session";

const reference = "TSH-STG-DYN-INDIVIDUAL";
const databaseUrl = new URL(env.databaseUrl);
if (databaseUrl.pathname.slice(1) !== "tashira_staging") throw new Error("STAGING_E2E_DATABASE_IDENTITY_FAILED");
if (!process.cwd().replaceAll("\\", "/").endsWith("/var/www/tashira-staging")) throw new Error("STAGING_E2E_PATH_IDENTITY_FAILED");

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
  try { await operation(); throw new Error("STAGING_E2E_EXPECTED_DENIAL_MISSING"); }
  catch (error) {
    if (!(error instanceof TRPCClientError) || !["UNAUTHORIZED", "FORBIDDEN"].includes(String(error.data?.code))) throw error;
  }
}

const pool = createPool({ uri: env.databaseUrl, connectionLimit: 1 });
try {
  const authorized = client([reference]); const anonymous = client([]);
  await expectDenied(() => anonymous.dynamicInterview.current.query({ referenceNumber: reference }));
  await expectDenied(() => authorized.dynamicInterview.current.query({ referenceNumber: "TSH-STG-DYN-FAMILY" }));
  let state = await authorized.dynamicInterview.current.query({ referenceNumber: reference });
  const answers: Readonly<Record<string, string | boolean>> = { NATIONALITY: "EG", GCC_RESIDENT: false };
  while (state.currentQuestions[0]) {
    const question = state.currentQuestions[0]; const answer = answers[question.code];
    if (answer === undefined) throw new Error(`STAGING_E2E_UNEXPECTED_QUESTION:${question.code}`);
    state = await authorized.dynamicInterview.answer.mutate({ referenceNumber: reference, applicantId: question.applicantId,
      questionCode: question.code, answer, changeReason: "STAGING_SYNTHETIC_E2E" });
  }
  if (!state.unifiedReview || state.unifiedReview.applicants.length !== 1 || state.unifiedReview.travelGroups.length !== 1) {
    throw new Error("STAGING_E2E_UNIFIED_REVIEW_INCOMPLETE");
  }
  const serialized = JSON.stringify(state.unifiedReview).toLowerCase();
  if (["suppliercost", "internalcost", "margin", "profit", "stripe"].some((field) => serialized.includes(field))) {
    throw new Error("STAGING_E2E_FINANCE_FIELD_LEAK");
  }
  const applicantId = state.unifiedReview.applicants[0].applicantId;
  state = await authorized.dynamicInterview.editAnswer.mutate({ referenceNumber: reference, applicantId, questionCode: "NATIONALITY",
    answer: "PK", changeReason: "STAGING_SYNTHETIC_REEVALUATION" });
  if (!state.unifiedReview?.applicants[0].requirements.some(({ code }) => code === "BANK_STATEMENT")) {
    throw new Error("STAGING_E2E_REEVALUATION_REQUIREMENT_MISSING");
  }
  await authorized.dynamicInterview.editAnswer.mutate({ referenceNumber: reference, applicantId, questionCode: "NATIONALITY",
    answer: "PK", changeReason: "STAGING_SYNTHETIC_NOOP" });
  const [rows] = await pool.execute<RowDataPacket[]>(`SELECT
    (SELECT COUNT(*) FROM visa_rule_evaluation_runs e JOIN applications a ON a.id=e.application_id WHERE a.reference_number=?) AS evaluations,
    (SELECT COUNT(*) FROM visa_rule_evaluation_selections s JOIN applications a ON a.id=s.application_id WHERE a.reference_number=?) AS selections,
    (SELECT COUNT(*) FROM travel_groups g JOIN applications a ON a.id=g.application_id WHERE a.reference_number=?) AS travelGroups`,
  [reference, reference, reference]);
  if (Number(rows[0].evaluations) !== 2 || Number(rows[0].selections) !== 2 || Number(rows[0].travelGroups) !== 1) {
    throw new Error("STAGING_E2E_IMMUTABLE_HISTORY_INVALID");
  }
  console.log("STAGING_UNIFIED_API_AUTHORIZATION=PASS");
  console.log("STAGING_UNIFIED_API_APPLICANT_ISOLATION=PASS");
  console.log("STAGING_UNIFIED_API_IMMUTABLE_REEVALUATION=PASS");
  console.log("STAGING_UNIFIED_API_IDEMPOTENCY=PASS");
  console.log("STAGING_UNIFIED_API_FINANCE_ISOLATION=PASS");
} finally { await pool.end(); }
