import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./context";
import { createDynamicInterviewRouter } from "./dynamic-interview-router";
import type { FeatureFlagRecord } from "./lib/feature-flags/feature-flags";
import type { QuestionCatalogDefinition, RequirementCatalogDefinition } from "./lib/requirements/requirement-catalog";
import type { EligibilityRule } from "./lib/eligibility/eligibility-engine";
import type { InterviewAnswerEvent } from "./lib/customer/dynamic-interview";

const reference = "TSH-DYNAMIC-TEST"; const at = new Date("2026-08-26T00:00:00Z");
const context = (references: readonly string[] = []): TrpcContext => ({ req: new Request("https://staging.invalid/api/trpc"),
  resHeaders: new Headers(), isAdmin: false, customerApplicationReferences: new Set(references) });
const question: QuestionCatalogDefinition = { definitionId: "11111111-1111-4111-8111-111111111111", code: "NATIONALITY", version: 1,
  status: "ACTIVE", kind: "QUESTION", customerLabel: "Nationality", shortCustomerExplanation: "Select your nationality",
  internalLabel: "Nationality", classification: "OFFICIAL", authoritySemantics: null, reasonTemplate: "Required by active rule",
  effectiveFrom: at, effectiveTo: null, reviewStatus: "APPROVED", questionType: "NATIONALITY", helpText: "Choose the passport nationality",
  answerType: "TEXT", allowedValues: null, validationContract: {}, customerVisible: true };
const rule: EligibilityRule = { id: "TEST_BASE", version: 1, routeCode: "UAE_VISIT", layer: "BASE_ROUTE", classification: "OFFICIAL",
  sourceAuthority: "Synthetic staging authority", reason: "Synthetic test route", effectiveFrom: at, effectiveTo: null,
  conditions: [{ field: "nationality", operator: "EXISTS" }], eligibilityEffect: "ELIGIBLE", requiredDocuments: ["PASSPORT"], conditionalDocuments: [] };
const requirement: RequirementCatalogDefinition = { kind: "DOCUMENT", definitionId: "99999999-1111-4111-8111-111111111111", code: "PASSPORT", version: 1,
  status: "ACTIVE", customerLabel: "Passport copy", shortCustomerExplanation: "Upload the passport bio page", internalLabel: "Passport",
  classification: "OFFICIAL", authoritySemantics: null, reasonTemplate: "Required by the selected route", effectiveFrom: at, effectiveTo: null,
  reviewStatus: "APPROVED", documentType: "PASSPORT", category: "IDENTITY", requiredCapability: true, conditionalCapability: false,
  sharedDocumentCapability: false, applicantScopedCapability: true, travelGroupScopedCapability: false, familyScopedCapability: false,
  aiExtractionCapability: false, humanReviewPolicy: "ALWAYS" };
const flags: FeatureFlagRecord[] = ["DYNAMIC_CUSTOMER_APPLICATION", "VISA_RULES_EVALUATION"].map((flagKey) => ({
  flagKey: flagKey as FeatureFlagRecord["flagKey"], environment: "STAGING", enabled: true, scopeType: "APPLICATION", scopeReference: reference,
}));
function deps(currentFlags = flags) {
  const events: InterviewAnswerEvent[] = [];
  const loadUnifiedBundle = vi.fn(async () => null);
  const append = vi.fn(async (input) => {
    events.push({ eventId: "event-1", applicationId: input.applicationId, applicantId: input.applicantId,
      questionDefinitionId: input.definition.definitionId, questionDefinitionVersion: 1, answer: input.answer,
      answerSha256: "a".repeat(64), supersedesEventId: null, changeReason: input.changeReason, occurredAt: input.occurredAt.toISOString() });
    return events[0];
  });
  return { flagContextForContext: async () => ({ environment: "STAGING" as const }), flagsForContext: async () => currentFlags,
    loadApplication: async (value: string) => value === reference ? ({ applicationId: 9, referenceNumber: reference, routeCode: "UAE_VISIT", applicantIds: [21], applicantLabels: { 21: "Ahmed — Father" } }) : null,
    loadCatalog: async () => ({ questions: [question], requirements: [requirement] }), loadRules: async () => [rule], loadEvents: async () => events,
    loadUnifiedBundle, append, now: () => at };
}

describe("authenticated Dynamic Interview API", () => {
  it("denies missing and cross-application customer capability", async () => {
    const caller = createDynamicInterviewRouter(deps()).createCaller(context(["TSH-OTHER"]));
    await expect(caller.current({ referenceNumber: reference })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("fails closed unless application-scoped flags are enabled", async () => {
    const caller = createDynamicInterviewRouter(deps([])).createCaller(context([reference]));
    await expect(caller.current({ referenceNumber: reference })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("does not read unified persistence while its requirement flag is closed", async () => {
    const current = deps(); const caller = createDynamicInterviewRouter(current).createCaller(context([reference]));
    await caller.current({ referenceNumber: reference });
    expect(current.loadUnifiedBundle).not.toHaveBeenCalled();
  });

  it("requests the trusted unified persistence bundle only after its application flag opens", async () => {
    const dynamicRequirements: FeatureFlagRecord = { flagKey: "DYNAMIC_REQUIREMENTS", environment: "STAGING", enabled: true,
      scopeType: "APPLICATION", scopeReference: reference };
    const current = deps([...flags, dynamicRequirements]); const caller = createDynamicInterviewRouter(current).createCaller(context([reference]));
    expect(await caller.current({ referenceNumber: reference })).toMatchObject({ unifiedReview: null });
    expect(current.loadUnifiedBundle).toHaveBeenCalledExactlyOnceWith(reference);
  });

  it("accepts only the authoritative current question and returns the next state", async () => {
    const current = deps(); const caller = createDynamicInterviewRouter(current).createCaller(context([reference]));
    expect(await caller.current({ referenceNumber: reference })).toMatchObject({ currentApplicant: { applicantId: 21, label: "Ahmed — Father" }, currentQuestions: [{ code: "NATIONALITY", applicantId: 21 }] });
    await expect(caller.answer({ referenceNumber: reference, applicantId: 21, questionCode: "GCC_COUNTRY", answer: "AE", changeReason: "INITIAL_ANSWER" }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    expect(await caller.answer({ referenceNumber: reference, applicantId: 21, questionCode: "NATIONALITY", answer: "EG", changeReason: "INITIAL_ANSWER" }))
      .toMatchObject({ eligibilityState: "ELIGIBLE_ROUTE_FOUND", nextAction: "REVIEW_REQUIREMENTS" });
    expect(current.append).toHaveBeenCalledTimes(1);
  });

  it("edits only an existing owned answer through append-only history", async () => {
    const current = deps(); const caller = createDynamicInterviewRouter(current).createCaller(context([reference]));
    await expect(caller.editAnswer({ referenceNumber: reference, applicantId: 21, questionCode: "NATIONALITY", answer: "PK", changeReason: "CUSTOMER_CORRECTION" }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    await caller.answer({ referenceNumber: reference, applicantId: 21, questionCode: "NATIONALITY", answer: "EG", changeReason: "INITIAL_ANSWER" });
    await caller.editAnswer({ referenceNumber: reference, applicantId: 21, questionCode: "NATIONALITY", answer: "PK", changeReason: "CUSTOMER_CORRECTION" });
    expect(current.append).toHaveBeenCalledTimes(2);
    expect(current.append).toHaveBeenLastCalledWith(expect.objectContaining({ applicantId: 21, answer: "PK", changeReason: "CUSTOMER_CORRECTION" }));
  });
});
