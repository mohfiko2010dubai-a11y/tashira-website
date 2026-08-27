import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./context";
import { createDocumentIntelligenceRouter } from "./document-intelligence-router";
import type { AuthorizationActor } from "./lib/authorization/policy";
import type { FeatureFlagRecord } from "./lib/feature-flags/feature-flags";

const actor: AuthorizationActor = { id: "staff:7", permissions: new Set(["document.review"]), scopes: ["TEAM"], teamIds: new Set([3]), departmentIds: new Set() };
const enabled: FeatureFlagRecord = { flagKey: "DOCUMENT_INTELLIGENCE", environment: "TEST", enabled: true, scopeType: "GLOBAL", scopeReference: "" };
const ctx = (): TrpcContext => ({ req: new Request("https://internal.invalid"), resHeaders: new Headers(), isAdmin: false, staffId: 7, customerApplicationReferences: new Set() });
const model = { applicationId: 1, applicantId: 2, runs: [{ runId: "run", documentId: 3, provider: "synthetic", modelVersion: "v1",
  processingTier: "MRZ", processingTiers: ["DETERMINISTIC", "MRZ"], escalationReasons: [], warnings: [], processedAt: "2026-08-27T00:00:00Z" }], fields: [] };

describe("Document Intelligence internal API", () => {
  it("fails closed while the feature flag is disabled", async () => {
    const repository = { readApplicant: vi.fn(async () => model) };
    const caller = createDocumentIntelligenceRouter({ actorForContext: async () => actor, flagContextForContext: () => ({ environment: "TEST" }),
      flagsForContext: async () => [], repository }).createCaller(ctx());
    await expect(caller.applicant({ applicationReference: "TSH-123", applicantId: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repository.readApplicant).not.toHaveBeenCalled();
  });

  it("passes only server-derived actor authority to the repository", async () => {
    const repository = { readApplicant: vi.fn(async () => model) };
    const caller = createDocumentIntelligenceRouter({ actorForContext: async () => actor, flagContextForContext: () => ({ environment: "TEST" }),
      flagsForContext: async () => [enabled], repository }).createCaller(ctx());
    expect(await caller.applicant({ applicationReference: "TSH-123", applicantId: 2 })).toEqual(model);
    expect(repository.readApplicant).toHaveBeenCalledWith("TSH-123", 2, actor);
    expect(JSON.stringify(repository.readApplicant.mock.calls)).not.toMatch(/clientRole|clientScope|supplierCost|margin|profit/i);
  });

  it("sanitizes ownership failures", async () => {
    const repository = { readApplicant: vi.fn(async () => { throw new Error("DOCUMENT_INTELLIGENCE_OWNERSHIP_INVALID"); }) };
    const caller = createDocumentIntelligenceRouter({ actorForContext: async () => actor, flagContextForContext: () => ({ environment: "TEST" }),
      flagsForContext: async () => [enabled], repository }).createCaller(ctx());
    await expect(caller.applicant({ applicationReference: "TSH-123", applicantId: 2 })).rejects.toMatchObject({ code: "FORBIDDEN", message: "Document Intelligence access denied" });
  });
});
