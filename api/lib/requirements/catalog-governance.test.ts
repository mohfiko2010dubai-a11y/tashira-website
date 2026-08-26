import { describe, expect, it } from "vitest";
import type { AuthorizationActor } from "../authorization/policy";
import { InMemoryCatalogGovernanceRepository } from "./catalog-governance";
import { buildGenericCatalogSeed } from "./requirement-catalog-seed";

const actor = (permissions: AuthorizationActor["permissions"]): AuthorizationActor => ({ id: "staff:7", permissions, scopes: ["ALL"], teamIds: new Set(), departmentIds: new Set() });
const proposer = actor(new Set(["rule.propose"]));
const reviewer = actor(new Set(["rule.review"]));
const activator = actor(new Set(["rule.activate"]));

describe("catalog governance", () => {
  it("imports deterministic definitions as DRAFT only", () => {
    const repo = new InMemoryCatalogGovernanceRepository();
    const result = repo.importDraft(buildGenericCatalogSeed(), proposer, new Date("2026-08-26T00:00:00Z"));
    expect(result.imported).toBe(31);
    expect(repo.get(result.catalog.requirements[0].definitionId)?.state).toBe("DRAFT");
  });

  it("requires separated permissions and freezes submitted evidence", () => {
    const repo = new InMemoryCatalogGovernanceRepository();
    const imported = repo.importDraft(buildGenericCatalogSeed(), proposer, new Date("2026-08-26T00:00:00Z"));
    const id = imported.catalog.requirements[0].definitionId;
    expect(() => repo.transition({ definitionId: id, expectedVersion: 1, toState: "REVIEW", reason: "Ready", occurredAt: new Date() }, reviewer))
      .toThrow("CATALOG_GOVERNANCE_ACCESS_DENIED");
    repo.transition({ definitionId: id, expectedVersion: 1, toState: "REVIEW", reason: "Ready", occurredAt: new Date() }, proposer);
    expect(() => repo.editDraft({ definitionId: id, expectedVersion: 2, payload: {} }, proposer)).toThrow("CATALOG_DEFINITION_IMMUTABLE");
    repo.transition({ definitionId: id, expectedVersion: 2, toState: "APPROVED", reason: "Reviewed", occurredAt: new Date() }, reviewer);
    repo.transition({ definitionId: id, expectedVersion: 3, toState: "ACTIVE", reason: "Synthetic activation", occurredAt: new Date() }, activator);
    expect(repo.get(id)?.state).toBe("ACTIVE");
    expect(repo.history(id).map(({ toState }) => toState)).toEqual(["DRAFT", "REVIEW", "APPROVED", "ACTIVE"]);
  });

  it("rejects stale and invalid transitions", () => {
    const repo = new InMemoryCatalogGovernanceRepository();
    const id = repo.importDraft(buildGenericCatalogSeed(), proposer, new Date()).catalog.questions[0].definitionId;
    expect(() => repo.transition({ definitionId: id, expectedVersion: 2, toState: "REVIEW", reason: "Stale", occurredAt: new Date() }, proposer))
      .toThrow("CATALOG_VERSION_CONFLICT");
    expect(() => repo.transition({ definitionId: id, expectedVersion: 1, toState: "ACTIVE", reason: "Skip", occurredAt: new Date() }, activator))
      .toThrow("CATALOG_TRANSITION_INVALID");
  });
});
