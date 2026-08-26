import { createTRPCProxyClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import { createPool, type RowDataPacket } from "mysql2/promise";
import superjson from "superjson";
import type { AppRouter } from "../api/router";
import { env } from "../api/lib/env";
import { createCustomerApplicationCookie } from "../api/lib/customer-session";

type Scenario = { applicantNationalities: readonly string[]; expectedState: string; expectedRequirement?: string };
const scenarios: Readonly<Record<string, Scenario>> = {
  "TSH-STG-DYN-GCC-FUTURE": { applicantNationalities: ["EG"], expectedState: "ELIGIBLE_ROUTE_FOUND", expectedRequirement: "GCC_RESIDENCE" },
  "TSH-STG-DYN-FAMILY": { applicantNationalities: ["EG", "PK", "EG", "EG"], expectedState: "ELIGIBLE_ROUTE_FOUND" },
  "TSH-STG-DYN-NOT-RESEARCHED": { applicantNationalities: ["ZZ"], expectedState: "NOT_RESEARCHED" },
  "TSH-STG-DYN-CONFLICT": { applicantNationalities: ["EG"], expectedState: "RULE_CONFLICT" },
};
const reference = process.argv[2] ?? ""; const scenario = scenarios[reference];
if (!scenario) throw new Error("STAGING_SCENARIO_ARGUMENT_INVALID");
const databaseUrl = new URL(env.databaseUrl);
if (databaseUrl.pathname.slice(1) !== "tashira_staging") throw new Error("STAGING_SCENARIO_DATABASE_IDENTITY_FAILED");
if (!process.cwd().replaceAll("\\", "/").endsWith("/var/www/tashira-staging")) throw new Error("STAGING_SCENARIO_PATH_IDENTITY_FAILED");

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
  try { await operation(); throw new Error("STAGING_SCENARIO_EXPECTED_DENIAL_MISSING"); }
  catch (error) {
    if (!(error instanceof TRPCClientError) || !["UNAUTHORIZED", "FORBIDDEN"].includes(String(error.data?.code))) throw error;
  }
}

const pool = createPool({ uri: env.databaseUrl, connectionLimit: 1 });
try {
  const authorized = client([reference]);
  await expectDenied(() => client([]).dynamicInterview.current.query({ referenceNumber: reference }));
  await expectDenied(() => authorized.dynamicInterview.current.query({ referenceNumber: "TSH-STG-DYN-INDIVIDUAL" }));
  const [applicantRows] = await pool.execute<RowDataPacket[]>(`SELECT p.id,p.applicant_index AS applicantIndex FROM applicants p
    JOIN applications a ON a.id=p.application_id WHERE a.reference_number=? ORDER BY p.applicant_index,p.id`, [reference]);
  if (applicantRows.length !== scenario.applicantNationalities.length) throw new Error("STAGING_SCENARIO_APPLICANT_COUNT_INVALID");
  const nationalityByApplicant = new Map(applicantRows.map((row) => [Number(row.id), scenario.applicantNationalities[Number(row.applicantIndex)]]));
  let state = await authorized.dynamicInterview.current.query({ referenceNumber: reference });
  let guard = 0;
  while (state.currentQuestions[0]) {
    if (++guard > 50) throw new Error("STAGING_SCENARIO_QUESTION_LOOP");
    const question = state.currentQuestions[0];
    const answer = question.code === "NATIONALITY" && question.applicantId !== null ? nationalityByApplicant.get(question.applicantId)
      : question.code === "GCC_RESIDENT" ? reference === "TSH-STG-DYN-GCC-FUTURE"
        : question.code === "GCC_COUNTRY" ? "AE"
          : question.code === "RESIDENCE_EXPIRY" ? "2027-12-31"
            : question.code === "TRAVELLING_TOGETHER" ? true : undefined;
    if (answer === undefined) throw new Error(`STAGING_SCENARIO_UNEXPECTED_QUESTION:${question.code}`);
    state = await authorized.dynamicInterview.answer.mutate({ referenceNumber: reference, applicantId: question.applicantId,
      questionCode: question.code, answer, changeReason: "STAGING_SYNTHETIC_SCENARIO_E2E" });
  }
  if (!state.unifiedReview || state.unifiedReview.applicants.length !== scenario.applicantNationalities.length) {
    throw new Error("STAGING_SCENARIO_UNIFIED_REVIEW_INCOMPLETE");
  }
  if (state.eligibilityState !== scenario.expectedState) throw new Error("STAGING_SCENARIO_ELIGIBILITY_INVALID");
  if (scenario.expectedRequirement && !state.unifiedReview.applicants[0].requirements.some(({ code }) => code === scenario.expectedRequirement)) {
    throw new Error("STAGING_SCENARIO_REQUIREMENT_MISSING");
  }
  if (reference === "TSH-STG-DYN-FAMILY") {
    const requirements = new Map(state.unifiedReview.applicants.map((applicant) => [applicant.applicantId,
      new Set(applicant.requirements.map(({ code }) => code))]));
    const motherId = Number(applicantRows[1].id);
    if (!requirements.get(motherId)?.has("BANK_STATEMENT")) throw new Error("STAGING_SCENARIO_FAMILY_MOTHER_REQUIREMENT_MISSING");
    for (const row of [applicantRows[0], applicantRows[2], applicantRows[3]]) {
      if (requirements.get(Number(row.id))?.has("BANK_STATEMENT")) throw new Error("STAGING_SCENARIO_CROSS_APPLICANT_REQUIREMENT_LEAK");
    }
  }
  const serialized = JSON.stringify(state.unifiedReview).toLowerCase();
  if (["suppliercost", "internalcost", "margin", "profit", "stripe"].some((field) => serialized.includes(field))) {
    throw new Error("STAGING_SCENARIO_FINANCE_FIELD_LEAK");
  }
  const [counts] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(DISTINCT e.applicant_id) AS evaluatedApplicants
    FROM visa_rule_evaluation_runs e JOIN applications a ON a.id=e.application_id WHERE a.reference_number=?`, [reference]);
  if (Number(counts[0].evaluatedApplicants) !== scenario.applicantNationalities.length) throw new Error("STAGING_SCENARIO_EVALUATION_EVIDENCE_INCOMPLETE");
  console.log(`STAGING_SCENARIO=${reference}`);
  console.log(`STAGING_SCENARIO_ELIGIBILITY=${scenario.expectedState}`);
  console.log("STAGING_SCENARIO_AUTHORIZATION=PASS");
  console.log("STAGING_SCENARIO_APPLICANT_ISOLATION=PASS");
  console.log("STAGING_SCENARIO_EVALUATION_EVIDENCE=PASS");
  console.log("STAGING_SCENARIO_FINANCE_ISOLATION=PASS");
} finally { await pool.end(); }
