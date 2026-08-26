import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./context";
import type { AuthorizationActor } from "./lib/authorization/policy";
import { createCatalogGovernanceRouter } from "./catalog-governance-router";

const context = (staffId?: number): TrpcContext => ({
  req: new Request("https://internal.invalid/api/trpc"),
  resHeaders: new Headers(),
  isAdmin: staffId === undefined,
  staffId,
  customerApplicationReferences: new Set(),
});

const actor: AuthorizationActor = {
  id: "staff:7",
  permissions: new Set(["rule.read", "rule.propose", "rule.review", "rule.activate"]),
  scopes: ["TEAM"],
  teamIds: new Set([7]),
  departmentIds: new Set(),
};

function repository() {
  return {
    list: vi.fn(async () => []),
    importDraft: vi.fn(async () => ({ importId: "import-1", imported: 24, sha256: "a".repeat(64) })),
    editDraft: vi.fn(async () => ({ definitionId: "11111111-1111-4111-8111-111111111111", kind: "QUESTION" as const, state: "DRAFT" as const, recordVersion: 2 })),
    transition: vi.fn(async () => ({ definitionId: "11111111-1111-4111-8111-111111111111", kind: "QUESTION" as const, state: "REVIEW" as const, recordVersion: 2 })),
  };
}

describe("catalog governance router", () => {
  it("requires a trusted staff or admin session", async () => {
    const current = repository();
    const caller = createCatalogGovernanceRouter({ actorForContext: async () => actor, repository: current, now: () => new Date("2026-08-26T00:00:00Z") }).createCaller(context());
    await expect(caller.list({})).resolves.toEqual([]);
    expect(current.list).toHaveBeenCalledWith(actor);
  });

  it("passes only validated governance commands to persistence", async () => {
    const current = repository();
    const caller = createCatalogGovernanceRouter({ actorForContext: async () => actor, repository: current, now: () => new Date("2026-08-26T00:00:00Z") }).createCaller(context(7));
    const command = { definitionId: "11111111-1111-4111-8111-111111111111", kind: "QUESTION" as const,
      expectedVersion: 1, toState: "REVIEW" as const, reason: "Ready for independent review" };
    await caller.transition(command);
    expect(current.transition).toHaveBeenCalledWith(command, actor, new Date("2026-08-26T00:00:00Z"));
    await expect(caller.transition({ ...command, expectedVersion: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("maps concurrency conflicts without exposing database details", async () => {
    const current = repository();
    current.transition = vi.fn(async () => { throw new Error("CATALOG_VERSION_CONFLICT"); });
    current.list = vi.fn(async () => { throw new Error("SELECT secret FROM production"); });
    const caller = createCatalogGovernanceRouter({ actorForContext: async () => actor, repository: current, now: () => new Date() }).createCaller(context(7));
    const command = { definitionId: "11111111-1111-4111-8111-111111111111", kind: "QUESTION" as const,
      expectedVersion: 1, toState: "REVIEW" as const, reason: "Ready for independent review" };
    await expect(caller.transition(command)).rejects.toMatchObject({ code: "CONFLICT", message: "CATALOG_VERSION_CONFLICT" });
    await expect(caller.list({})).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Catalog operation rejected" });
  });
});
