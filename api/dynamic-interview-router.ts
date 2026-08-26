import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TrpcContext } from "./context";
import { assertApplicationReferenceAccess } from "./lib/application-authorization";
import type { FeatureFlagContext, FeatureFlagRecord } from "./lib/feature-flags/feature-flags";
import { isOperationsFlagEnabled } from "./lib/feature-flags/feature-flags";
import { buildPersistentDynamicInterview } from "./lib/customer/dynamic-interview-service";
import type { InterviewAnswer, InterviewAnswerEvent } from "./lib/customer/dynamic-interview";
import { MysqlInterviewAnswerRepository } from "./lib/customer/mysql-interview-answer-repository";
import { MysqlOperationsAccessProvider } from "./lib/operations/mysql-access-provider";
import { defaultOperationsPool, defaultOperationsSqlClient } from "./lib/operations/mysql-query-client";
import { MysqlRequirementCatalogProvider } from "./lib/requirements/mysql-requirement-catalog-provider";
import { MysqlActiveRuleProvider } from "./lib/rules/mysql-active-rule-provider";
import type { EligibilityRule } from "./lib/eligibility/eligibility-engine";
import type { QuestionCatalogDefinition } from "./lib/requirements/requirement-catalog";
import { applicationAccessQuery, createRouter } from "./middleware";

type ApplicationInterviewRecord = { applicationId: number; referenceNumber: string; routeCode: string; applicantIds: readonly number[];
  applicantLabels: Readonly<Record<number, string>> };
type Dependencies = {
  flagContextForContext(ctx: TrpcContext): FeatureFlagContext | Promise<FeatureFlagContext>;
  flagsForContext(ctx: TrpcContext): Promise<readonly FeatureFlagRecord[]>;
  loadApplication(referenceNumber: string): Promise<ApplicationInterviewRecord | null>;
  loadQuestions(at: Date): Promise<readonly QuestionCatalogDefinition[]>;
  loadRules(routeCode: string): Promise<readonly EligibilityRule[]>;
  loadEvents(applicationId: number): Promise<readonly InterviewAnswerEvent[]>;
  append(input: { applicationId: number; applicantId: number | null; definition: QuestionCatalogDefinition; answer: InterviewAnswer;
    changeReason: string; actorReference: string; occurredAt: Date }): Promise<InterviewAnswerEvent>;
  now(): Date;
};

async function authorizedRuntime(deps: Dependencies, ctx: TrpcContext, referenceNumber: string) {
  assertApplicationReferenceAccess(ctx, referenceNumber);
  if (!ctx.customerApplicationReferences.has(referenceNumber)) throw new TRPCError({ code: "FORBIDDEN", message: "Dynamic interview access denied" });
  const [baseContext, flags, application] = await Promise.all([deps.flagContextForContext(ctx), deps.flagsForContext(ctx), deps.loadApplication(referenceNumber)]);
  if (!application) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
  const context = { ...baseContext, applicationReference: referenceNumber };
  if (!isOperationsFlagEnabled("DYNAMIC_CUSTOMER_APPLICATION", context, flags)
    || !isOperationsFlagEnabled("VISA_RULES_EVALUATION", context, flags)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Dynamic interview unavailable" });
  }
  return application;
}

export function createDynamicInterviewRouter(deps: Dependencies) {
  const state = async (ctx: TrpcContext, referenceNumber: string) => {
    const application = await authorizedRuntime(deps, ctx, referenceNumber); const now = deps.now();
    const [questions, rules, events] = await Promise.all([deps.loadQuestions(now), deps.loadRules(application.routeCode), deps.loadEvents(application.applicationId)]);
    const interview = buildPersistentDynamicInterview({ applicationId: application.applicationId,
      routeCode: application.routeCode, applicantIds: application.applicantIds, questions, rules, events, evaluatedAt: now });
    const applicantId = interview.currentQuestions[0]?.applicantId ?? null;
    return { application, questions, rules, events, state: { ...interview, currentApplicant: applicantId === null ? null
      : { applicantId, label: application.applicantLabels[applicantId] ?? `Applicant ${application.applicantIds.indexOf(applicantId) + 1}` } } };
  };
  return createRouter({
    current: applicationAccessQuery.input(z.object({ referenceNumber: z.string().trim().min(3).max(50) }).strict()).query(async ({ input, ctx }) => {
      try { return (await state(ctx, input.referenceNumber)).state; }
      catch (error) { if (error instanceof TRPCError) throw error; throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Dynamic interview unavailable" }); }
    }),
    answer: applicationAccessQuery.input(z.object({ referenceNumber: z.string().trim().min(3).max(50), applicantId: z.number().int().positive().nullable(),
      questionCode: z.string().regex(/^[A-Z][A-Z0-9_]{1,99}$/), answer: z.union([z.string().max(500), z.number().finite(), z.boolean()]),
      changeReason: z.string().trim().max(500).default("INITIAL_ANSWER") }).strict()).mutation(async ({ input, ctx }) => {
      try {
        const runtime = await state(ctx, input.referenceNumber); const current = runtime.state.currentQuestions[0];
        if (!current || current.code !== input.questionCode || current.applicantId !== input.applicantId) throw new TRPCError({ code: "CONFLICT", message: "Interview question is no longer current" });
        const definition = runtime.questions.find((question) => question.code === input.questionCode);
        if (!definition) throw new TRPCError({ code: "CONFLICT", message: "Interview question unavailable" });
        await deps.append({ applicationId: runtime.application.applicationId, applicantId: input.applicantId, definition,
          answer: input.answer, changeReason: input.changeReason, actorReference: `customer:${input.referenceNumber}`, occurredAt: deps.now() });
        return (await state(ctx, input.referenceNumber)).state;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        if (error instanceof Error && error.message.startsWith("INTERVIEW_")) throw new TRPCError({ code: "BAD_REQUEST", message: "Interview answer rejected" });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Dynamic interview unavailable" });
      }
    }),
  });
}

const sql = defaultOperationsSqlClient();
let access: MysqlOperationsAccessProvider | undefined; let catalog: MysqlRequirementCatalogProvider | undefined;
let rules: MysqlActiveRuleProvider | undefined; let answers: MysqlInterviewAnswerRepository | undefined;
function accessProvider() { return access ??= new MysqlOperationsAccessProvider(sql); }
function catalogProvider() { return catalog ??= new MysqlRequirementCatalogProvider(sql); }
function ruleProvider() { return rules ??= new MysqlActiveRuleProvider(sql); }
function answerProvider() { return answers ??= new MysqlInterviewAnswerRepository(defaultOperationsPool()); }
export const dynamicInterviewRouter = createDynamicInterviewRouter({
  flagContextForContext: (ctx) => accessProvider().flagContextForContext(ctx), flagsForContext: () => accessProvider().featureFlags(),
  loadApplication: async (referenceNumber) => {
    const applicationRows = await sql.query("SELECT id,reference_number AS referenceNumber,visa_type AS routeCode FROM applications WHERE reference_number=?", [referenceNumber]);
    const row = applicationRows[0]; if (!row) return null; const applicationId = Number(Reflect.get(row, "id"));
    const applicantRows = await sql.query("SELECT id,applicant_index AS applicantIndex,full_name AS fullName FROM applicants WHERE application_id=? ORDER BY applicant_index,id", [applicationId]);
    const applicantIds = applicantRows.map((applicant) => Number(Reflect.get(applicant, "id")));
    return { applicationId, referenceNumber: String(Reflect.get(row, "referenceNumber")), routeCode: String(Reflect.get(row, "routeCode")),
      applicantIds, applicantLabels: Object.fromEntries(applicantRows.map((applicant) => { const id = Number(Reflect.get(applicant, "id"));
        const fullName = String(Reflect.get(applicant, "fullName") ?? "").trim(); const index = Number(Reflect.get(applicant, "applicantIndex"));
        return [id, fullName || `Applicant ${index + 1}`]; })) };
  },
  loadQuestions: async (at) => (await catalogProvider().active(at)).questions,
  loadRules: (routeCode) => ruleProvider().activeForRoute(routeCode), loadEvents: (applicationId) => answerProvider().all(applicationId),
  append: (input) => answerProvider().append(input), now: () => new Date(),
});
