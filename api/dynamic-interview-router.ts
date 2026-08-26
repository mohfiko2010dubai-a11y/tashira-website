import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { TrpcContext } from "./context";
import { assertApplicationReferenceAccess } from "./lib/application-authorization";
import type { FeatureFlagContext, FeatureFlagRecord } from "./lib/feature-flags/feature-flags";
import { isOperationsFlagEnabled } from "./lib/feature-flags/feature-flags";
import { buildPersistentDynamicInterview } from "./lib/customer/dynamic-interview-service";
import { buildUnifiedInterviewRuntime } from "./lib/customer/unified-interview-orchestrator";
import { adaptPersistentUnifiedInterview } from "./lib/customer/unified-interview-persistence-adapter";
import type { InterviewAnswer, InterviewAnswerEvent } from "./lib/customer/dynamic-interview";
import { MysqlInterviewAnswerRepository } from "./lib/customer/mysql-interview-answer-repository";
import { MysqlCustomerInterviewWriteRepository, type CustomerApplicantProfile,
  type CustomerApplicantWriteResult, type CustomerTravelGroupInput } from "./lib/customer/mysql-customer-interview-write-repository";
import { MysqlOperationsAccessProvider } from "./lib/operations/mysql-access-provider";
import { defaultOperationsPool, defaultOperationsSqlClient } from "./lib/operations/mysql-query-client";
import { MysqlRequirementCatalogProvider } from "./lib/requirements/mysql-requirement-catalog-provider";
import { MysqlActiveRuleProvider } from "./lib/rules/mysql-active-rule-provider";
import { MysqlOperationsCaseReadProvider, type MysqlOperationsCaseBundle } from "./lib/operations/mysql-case-read-provider";
import type { EligibilityRule } from "./lib/eligibility/eligibility-engine";
import type { QuestionCatalogDefinition, RequirementCatalogDefinition, VersionedRequirementCatalog } from "./lib/requirements/requirement-catalog";
import { applicationAccessQuery, createRouter } from "./middleware";

type ApplicationInterviewRecord = { applicationId: number; referenceNumber: string; routeCode: string; applicantIds: readonly number[];
  applicantLabels: Readonly<Record<number, string>> };
const travelGroupInputSchema = z.object({ reference: z.string().trim().min(1).max(100), applicantIds: z.array(z.number().int().positive()).min(1).max(50),
  primaryTravellerId: z.number().int().positive(), accompanyingAdultId: z.number().int().positive().nullable(), arrangement: z.enum(["TOGETHER", "SEPARATELY"]),
  origin: z.string().trim().min(2).max(100), destination: z.string().trim().min(2).max(100), plannedArrivalDate: z.iso.date(),
  plannedDepartureDate: z.iso.date().nullable(), ticketStatus: z.enum(["NOT_BOOKED", "RESERVED", "CONFIRMED"]) }).strict();
type Dependencies = {
  flagContextForContext(ctx: TrpcContext): FeatureFlagContext | Promise<FeatureFlagContext>;
  flagsForContext(ctx: TrpcContext): Promise<readonly FeatureFlagRecord[]>;
  loadApplication(referenceNumber: string): Promise<ApplicationInterviewRecord | null>;
  loadCatalog(at: Date): Promise<Pick<VersionedRequirementCatalog, "questions" | "requirements">>;
  loadRules(routeCode: string): Promise<readonly EligibilityRule[]>;
  loadEvents(applicationId: number): Promise<readonly InterviewAnswerEvent[]>;
  loadUnifiedBundle?(referenceNumber: string): Promise<MysqlOperationsCaseBundle | null>;
  addApplicant?(input: { applicationId: number; profile: CustomerApplicantProfile; reason: string; actorReference: string;
    idempotencyKey: string; occurredAt: Date }): Promise<CustomerApplicantWriteResult>;
  editApplicant?(input: { applicationId: number; applicantId: number; expectedVersion: number; profile: CustomerApplicantProfile;
    reason: string; actorReference: string; idempotencyKey: string; occurredAt: Date }): Promise<CustomerApplicantWriteResult>;
  defineRelationship?(input: { applicationId: number; fromApplicantId: number; toApplicantId: number;
    relationship: "SPOUSE" | "PARENT" | "CHILD" | "GUARDIAN" | "DEPENDENT"; reason: string; actorReference: string;
    idempotencyKey: string; occurredAt: Date }): Promise<{ relationshipEventId: string; replayed: boolean }>;
  createTravelGroup?(input: { applicationId: number; group: CustomerTravelGroupInput; reason: string; actorReference: string;
    idempotencyKey: string; occurredAt: Date }): Promise<{ travelGroupId: string; version: number; replayed: boolean }>;
  updateTravelGroup?(input: { applicationId: number; travelGroupId: string; expectedVersion: number; group: CustomerTravelGroupInput;
    reason: string; actorReference: string; idempotencyKey: string; occurredAt: Date }): Promise<{ travelGroupId: string; version: number; replayed: boolean }>;
  linkSharedDocument?(input: { applicationId: number; documentId: number; documentType: "OUTBOUND_TICKET" | "RETURN_TICKET" |
    "ONWARD_TICKET" | "ROUND_TRIP_TICKET" | "FAMILY_BOOKING"; applicantIds: readonly number[]; actorReference: string;
    idempotencyKey: string; occurredAt: Date }): Promise<{ documentId: number; linkedApplicantIds: readonly number[]; replayed: boolean }>;
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
  return { application, context, flags };
}

export function createDynamicInterviewRouter(deps: Dependencies) {
  const state = async (ctx: TrpcContext, referenceNumber: string) => {
    const authorized = await authorizedRuntime(deps, ctx, referenceNumber); const { application, context, flags } = authorized; const now = deps.now();
    const [catalog, rules, events] = await Promise.all([deps.loadCatalog(now), deps.loadRules(application.routeCode),
      deps.loadEvents(application.applicationId)]);
    const questions: readonly QuestionCatalogDefinition[] = catalog.questions; const requirements: readonly RequirementCatalogDefinition[] = catalog.requirements;
    const interview = buildPersistentDynamicInterview({ applicationId: application.applicationId,
      routeCode: application.routeCode, applicantIds: application.applicantIds, questions, requirements, rules, events, evaluatedAt: now });
    const applicantId = interview.currentQuestions[0]?.applicantId ?? null;
    const unifiedEnabled = isOperationsFlagEnabled("DYNAMIC_REQUIREMENTS", context, flags);
    const bundle = unifiedEnabled && interview.currentQuestions.length === 0
      ? await (deps.loadUnifiedBundle?.(referenceNumber) ?? Promise.resolve(null)) : null;
    let unifiedReview = null;
    if (bundle) {
      const persistent = adaptPersistentUnifiedInterview(bundle);
      const answers = Object.fromEntries(application.applicantIds.map((id) => [id, Object.fromEntries(interview.knownAnswers
        .filter((answer) => answer.applicantId === id).map((answer) => [answer.code, String(answer.answer)]))]));
      unifiedReview = (await buildUnifiedInterviewRuntime({ context, flags,
        catalogProvider: { active: async () => ({ catalogVersion: "CURRENT", ...catalog }) }, evaluatedAt: now,
        applicationId: application.applicationId, ...persistent, answers, travelQuestions: [] })).review;
    }
    return { application, questions, rules, events, state: { ...interview, currentApplicant: applicantId === null ? null
      : { applicantId, label: application.applicantLabels[applicantId] ?? `Applicant ${application.applicantIds.indexOf(applicantId) + 1}` },
      review: { ...interview.review, applicants: interview.review.applicants.map((item) => ({ ...item,
        label: application.applicantLabels[item.applicantId] ?? `Applicant ${application.applicantIds.indexOf(item.applicantId) + 1}` })) }, unifiedReview } };
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
    editAnswer: applicationAccessQuery.input(z.object({ referenceNumber: z.string().trim().min(3).max(50), applicantId: z.number().int().positive().nullable(),
      questionCode: z.string().regex(/^[A-Z][A-Z0-9_]{1,99}$/), answer: z.union([z.string().max(500), z.number().finite(), z.boolean()]),
      changeReason: z.string().trim().min(3).max(500) }).strict()).mutation(async ({ input, ctx }) => {
      try {
        const runtime = await state(ctx, input.referenceNumber);
        const previous = runtime.state.knownAnswers.find((item) => item.code === input.questionCode && item.applicantId === input.applicantId);
        if (!previous) throw new TRPCError({ code: "CONFLICT", message: "Interview answer is not editable" });
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
    addApplicant: applicationAccessQuery.input(z.object({ referenceNumber: z.string().trim().min(3).max(50),
      profile: z.object({ fullName: z.string().trim().min(2).max(255), nationality: z.string().trim().min(2).max(100).nullable(),
        residenceCountry: z.string().trim().min(2).max(100).nullable() }).strict(), reason: z.string().trim().min(3).max(500),
      idempotencyKey: z.string().trim().min(8).max(100) }).strict()).mutation(async ({ input, ctx }) => {
      const { application, context, flags } = await authorizedRuntime(deps, ctx, input.referenceNumber);
      if (!isOperationsFlagEnabled("DYNAMIC_REQUIREMENTS", context, flags) || !deps.addApplicant) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Applicant changes unavailable" });
      }
      try { return await deps.addApplicant({ applicationId: application.applicationId, profile: input.profile, reason: input.reason,
        actorReference: `customer:${input.referenceNumber}`, idempotencyKey: input.idempotencyKey, occurredAt: deps.now() }); }
      catch (error) {
        if (error instanceof Error && error.message === "CUSTOMER_INTERVIEW_IDEMPOTENCY_CONFLICT") throw new TRPCError({ code: "CONFLICT", message: "Applicant change conflicts with an earlier request" });
        throw new TRPCError({ code: "BAD_REQUEST", message: "Applicant could not be added" });
      }
    }),
    editApplicant: applicationAccessQuery.input(z.object({ referenceNumber: z.string().trim().min(3).max(50), applicantId: z.number().int().positive(),
      expectedVersion: z.number().int().positive(), profile: z.object({ fullName: z.string().trim().min(2).max(255),
        nationality: z.string().trim().min(2).max(100).nullable(), residenceCountry: z.string().trim().min(2).max(100).nullable() }).strict(),
      reason: z.string().trim().min(3).max(500), idempotencyKey: z.string().trim().min(8).max(100) }).strict()).mutation(async ({ input, ctx }) => {
      const { application, context, flags } = await authorizedRuntime(deps, ctx, input.referenceNumber);
      if (!isOperationsFlagEnabled("DYNAMIC_REQUIREMENTS", context, flags) || !deps.editApplicant) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Applicant changes unavailable" });
      }
      try { return await deps.editApplicant({ applicationId: application.applicationId, applicantId: input.applicantId,
        expectedVersion: input.expectedVersion, profile: input.profile, reason: input.reason, actorReference: `customer:${input.referenceNumber}`,
        idempotencyKey: input.idempotencyKey, occurredAt: deps.now() }); }
      catch (error) {
        if (error instanceof Error && ["CUSTOMER_APPLICANT_VERSION_CONFLICT", "CUSTOMER_INTERVIEW_IDEMPOTENCY_CONFLICT"].includes(error.message)) {
          throw new TRPCError({ code: "CONFLICT", message: "Applicant change is no longer current" });
        }
        throw new TRPCError({ code: "BAD_REQUEST", message: "Applicant could not be updated" });
      }
    }),
    defineRelationship: applicationAccessQuery.input(z.object({ referenceNumber: z.string().trim().min(3).max(50),
      fromApplicantId: z.number().int().positive(), toApplicantId: z.number().int().positive(),
      relationship: z.enum(["SPOUSE", "PARENT", "CHILD", "GUARDIAN", "DEPENDENT"]), reason: z.string().trim().min(3).max(500),
      idempotencyKey: z.string().trim().min(8).max(100) }).strict()).mutation(async ({ input, ctx }) => {
      const { application, context, flags } = await authorizedRuntime(deps, ctx, input.referenceNumber);
      if (!isOperationsFlagEnabled("DYNAMIC_REQUIREMENTS", context, flags) || !deps.defineRelationship) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Relationship changes unavailable" });
      }
      try { return await deps.defineRelationship({ applicationId: application.applicationId, fromApplicantId: input.fromApplicantId,
        toApplicantId: input.toApplicantId, relationship: input.relationship, reason: input.reason,
        actorReference: `customer:${input.referenceNumber}`, idempotencyKey: input.idempotencyKey, occurredAt: deps.now() }); }
      catch (error) {
        if (error instanceof Error && ["CUSTOMER_INTERVIEW_IDEMPOTENCY_CONFLICT", "CUSTOMER_RELATIONSHIP_ALREADY_ACTIVE"].includes(error.message)) {
          throw new TRPCError({ code: "CONFLICT", message: "Relationship change is no longer current" });
        }
        throw new TRPCError({ code: "BAD_REQUEST", message: "Relationship could not be saved" });
      }
    }),
    createTravelGroup: applicationAccessQuery.input(z.object({ referenceNumber: z.string().trim().min(3).max(50), group: travelGroupInputSchema,
      reason: z.string().trim().min(3).max(500), idempotencyKey: z.string().trim().min(8).max(100) }).strict()).mutation(async ({ input, ctx }) => {
      const { application, context, flags } = await authorizedRuntime(deps, ctx, input.referenceNumber);
      if (!isOperationsFlagEnabled("DYNAMIC_REQUIREMENTS", context, flags) || !deps.createTravelGroup) throw new TRPCError({ code: "FORBIDDEN", message: "Travel changes unavailable" });
      try { return await deps.createTravelGroup({ applicationId: application.applicationId, group: input.group, reason: input.reason,
        actorReference: `customer:${input.referenceNumber}`, idempotencyKey: input.idempotencyKey, occurredAt: deps.now() }); }
      catch (error) { if (error instanceof Error && error.message.includes("CONFLICT")) throw new TRPCError({ code: "CONFLICT", message: "Travel change is no longer current" });
        throw new TRPCError({ code: "BAD_REQUEST", message: "Travel group could not be saved" }); }
    }),
    updateTravelGroup: applicationAccessQuery.input(z.object({ referenceNumber: z.string().trim().min(3).max(50), travelGroupId: z.string().uuid(),
      expectedVersion: z.number().int().positive(), group: travelGroupInputSchema, reason: z.string().trim().min(3).max(500),
      idempotencyKey: z.string().trim().min(8).max(100) }).strict()).mutation(async ({ input, ctx }) => {
      const { application, context, flags } = await authorizedRuntime(deps, ctx, input.referenceNumber);
      if (!isOperationsFlagEnabled("DYNAMIC_REQUIREMENTS", context, flags) || !deps.updateTravelGroup) throw new TRPCError({ code: "FORBIDDEN", message: "Travel changes unavailable" });
      try { return await deps.updateTravelGroup({ applicationId: application.applicationId, travelGroupId: input.travelGroupId,
        expectedVersion: input.expectedVersion, group: input.group, reason: input.reason, actorReference: `customer:${input.referenceNumber}`,
        idempotencyKey: input.idempotencyKey, occurredAt: deps.now() }); }
      catch (error) { if (error instanceof Error && error.message.includes("CONFLICT")) throw new TRPCError({ code: "CONFLICT", message: "Travel change is no longer current" });
        throw new TRPCError({ code: "BAD_REQUEST", message: "Travel group could not be updated" }); }
    }),
    linkSharedDocument: applicationAccessQuery.input(z.object({ referenceNumber: z.string().trim().min(3).max(50), documentId: z.number().int().positive(),
      documentType: z.enum(["OUTBOUND_TICKET", "RETURN_TICKET", "ONWARD_TICKET", "ROUND_TRIP_TICKET", "FAMILY_BOOKING"]),
      applicantIds: z.array(z.number().int().positive()).min(1).max(50), idempotencyKey: z.string().trim().min(8).max(100) }).strict())
      .mutation(async ({ input, ctx }) => {
        const { application, context, flags } = await authorizedRuntime(deps, ctx, input.referenceNumber);
        if (!isOperationsFlagEnabled("DYNAMIC_REQUIREMENTS", context, flags) || !deps.linkSharedDocument) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Shared document changes unavailable" });
        }
        try { return await deps.linkSharedDocument({ applicationId: application.applicationId, documentId: input.documentId,
          documentType: input.documentType, applicantIds: input.applicantIds, actorReference: `customer:${input.referenceNumber}`,
          idempotencyKey: input.idempotencyKey, occurredAt: deps.now() }); }
        catch (error) { if (error instanceof Error && error.message.includes("CONFLICT")) throw new TRPCError({ code: "CONFLICT", message: "Document link is no longer current" });
          throw new TRPCError({ code: "BAD_REQUEST", message: "Shared document could not be linked" }); }
      }),
  });
}

const sql = defaultOperationsSqlClient();
let access: MysqlOperationsAccessProvider | undefined; let catalog: MysqlRequirementCatalogProvider | undefined;
let rules: MysqlActiveRuleProvider | undefined; let answers: MysqlInterviewAnswerRepository | undefined; let cases: MysqlOperationsCaseReadProvider | undefined;
let applicantWrites: MysqlCustomerInterviewWriteRepository | undefined;
function accessProvider() { return access ??= new MysqlOperationsAccessProvider(sql); }
function catalogProvider() { return catalog ??= new MysqlRequirementCatalogProvider(sql); }
function ruleProvider() { return rules ??= new MysqlActiveRuleProvider(sql); }
function answerProvider() { return answers ??= new MysqlInterviewAnswerRepository(defaultOperationsPool()); }
function caseProvider() { return cases ??= new MysqlOperationsCaseReadProvider(sql); }
function applicantWriteProvider() { return applicantWrites ??= new MysqlCustomerInterviewWriteRepository(defaultOperationsPool()); }
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
  loadCatalog: (at) => catalogProvider().active(at),
  loadRules: (routeCode) => ruleProvider().activeForRoute(routeCode), loadEvents: (applicationId) => answerProvider().all(applicationId),
  loadUnifiedBundle: (referenceNumber) => caseProvider().load(referenceNumber),
  addApplicant: (input) => applicantWriteProvider().addApplicant(input), editApplicant: (input) => applicantWriteProvider().editApplicant(input),
  defineRelationship: (input) => applicantWriteProvider().defineRelationship(input),
  createTravelGroup: (input) => applicantWriteProvider().createTravelGroup(input),
  updateTravelGroup: (input) => applicantWriteProvider().updateTravelGroup(input),
  linkSharedDocument: (input) => applicantWriteProvider().linkSharedDocument(input),
  append: (input) => answerProvider().append(input), now: () => new Date(),
});
