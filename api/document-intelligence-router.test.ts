import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./context";
import { createDocumentIntelligenceRouter } from "./document-intelligence-router";
import type { AuthorizationActor } from "./lib/authorization/policy";
import type { FeatureFlagRecord } from "./lib/feature-flags/feature-flags";

const actor: AuthorizationActor = { id: "staff:7", permissions: new Set(["document.review"]), scopes: ["TEAM"], teamIds: new Set([3]), departmentIds: new Set() };
const enabled: FeatureFlagRecord = { flagKey: "DOCUMENT_INTELLIGENCE", environment: "TEST", enabled: true, scopeType: "GLOBAL", scopeReference: "" };
const writesEnabled: FeatureFlagRecord = { ...enabled, flagKey: "OPERATIONS_CONTROLLED_WRITES" };
const ctx = (): TrpcContext => ({ req: new Request("https://internal.invalid"), resHeaders: new Headers(), isAdmin: false, staffId: 7, customerApplicationReferences: new Set() });
const model = { applicationId: 1, applicantId: 2, runs: [{ runId: "run", documentId: 3, provider: "synthetic", modelVersion: "v1",
  processingTier: "MRZ", processingTiers: ["DETERMINISTIC", "MRZ"], escalationReasons: [], warnings: [], processedAt: "2026-08-27T00:00:00Z" }], fields: [] };

describe("Document Intelligence internal API", () => {
  it("fails closed while the feature flag is disabled", async () => {
    const repository = { readApplicant: vi.fn(async () => model),reviewField:vi.fn() };
    const caller = createDocumentIntelligenceRouter({ actorForContext: async () => actor, flagContextForContext: () => ({ environment: "TEST" }),
      flagsForContext: async () => [], repository }).createCaller(ctx());
    await expect(caller.applicant({ applicationReference: "TSH-123", applicantId: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repository.readApplicant).not.toHaveBeenCalled();
  });

  it("passes only server-derived actor authority to the repository", async () => {
    const repository = { readApplicant: vi.fn(async () => model),reviewField:vi.fn() };
    const caller = createDocumentIntelligenceRouter({ actorForContext: async () => actor, flagContextForContext: () => ({ environment: "TEST" }),
      flagsForContext: async () => [enabled], repository }).createCaller(ctx());
    expect(await caller.applicant({ applicationReference: "TSH-123", applicantId: 2 })).toEqual(model);
    expect(repository.readApplicant).toHaveBeenCalledWith("TSH-123", 2, actor);
    expect(JSON.stringify(repository.readApplicant.mock.calls)).not.toMatch(/clientRole|clientScope|supplierCost|margin|profit/i);
  });

  it("sanitizes ownership failures", async () => {
    const repository = { readApplicant: vi.fn(async () => { throw new Error("DOCUMENT_INTELLIGENCE_OWNERSHIP_INVALID"); }),reviewField:vi.fn() };
    const caller = createDocumentIntelligenceRouter({ actorForContext: async () => actor, flagContextForContext: () => ({ environment: "TEST" }),
      flagsForContext: async () => [enabled], repository }).createCaller(ctx());
    await expect(caller.applicant({ applicationReference: "TSH-123", applicantId: 2 })).rejects.toMatchObject({ code: "FORBIDDEN", message: "Document Intelligence access denied" });
  });

  it("keeps field review closed unless both intelligence and controlled writes are enabled",async()=>{const repository={readApplicant:vi.fn(async()=>model),reviewField:vi.fn()};
    const caller=createDocumentIntelligenceRouter({actorForContext:async()=>actor,flagContextForContext:()=>({environment:"TEST"}),flagsForContext:async()=>[enabled],repository}).createCaller(ctx());
    await expect(caller.reviewField({applicationReference:"TSH-123",applicantId:2,fieldCode:"passport_number",selectedEvidenceId:crypto.randomUUID(),expectedSelectionId:crypto.randomUUID(),commandId:crypto.randomUUID(),reason:"Verified against evidence"})).rejects.toMatchObject({code:"FORBIDDEN"});expect(repository.reviewField).not.toHaveBeenCalled();});

  it("uses server authority and timestamps an enabled field review", async () => {
    const result = { selectionId: crypto.randomUUID(), applicationId: 1, applicantId: 2, fieldCode: "passport_number",
      selectedEvidenceId: crypto.randomUUID(), state: "VERIFIED" as const, replayed: false };
    const repository = { readApplicant: vi.fn(async () => model), reviewField: vi.fn(async () => result) };
    const caller = createDocumentIntelligenceRouter({ actorForContext: async () => actor, flagContextForContext: () => ({ environment: "TEST" }),
      flagsForContext: async () => [enabled, writesEnabled], repository }).createCaller(ctx());
    const input = { applicationReference: "TSH-123", applicantId: 2, fieldCode: "passport_number", selectedEvidenceId: result.selectedEvidenceId,
      expectedSelectionId: crypto.randomUUID(), commandId: result.selectionId, reason: "Verified against evidence" };

    await expect(caller.reviewField(input)).resolves.toEqual(result);
    expect(repository.reviewField).toHaveBeenCalledWith(expect.objectContaining({ ...input, occurredAt: expect.any(String) }), actor);
  });
});
