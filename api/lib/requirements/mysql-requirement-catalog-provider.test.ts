import { describe, expect, it } from "vitest";
import type { OperationsSqlClient, OperationsSqlParameter } from "../operations/mysql-access-provider";
import { MysqlRequirementCatalogProvider } from "./mysql-requirement-catalog-provider";

class FixtureSql implements OperationsSqlClient {
  calls: { sql: string; parameters: readonly OperationsSqlParameter[] }[] = [];
  constructor(private readonly resultSets: readonly (readonly object[])[]) {}
  async query(sql: string, parameters: readonly OperationsSqlParameter[] = []): Promise<readonly object[]> {
    this.calls.push({ sql, parameters }); return this.resultSets[this.calls.length - 1] ?? [];
  }
}
const requirement = {
  definitionId: "00000000-0000-4000-8000-000000000001", code: "PASSPORT", version: 1, status: "ACTIVE", documentType: "PASSPORT",
  customerLabel: "Passport", shortCustomerExplanation: "Clear passport copy", internalLabel: "Passport", classification: "OFFICIAL",
  authoritySemantics: "Authority", reasonTemplate: "Required by the relevant authority for this visa route.", category: "IDENTITY",
  requiredCapability: 1, conditionalCapability: 0, sharedDocumentCapability: 0, applicantScopedCapability: 1,
  travelGroupScopedCapability: 0, familyScopedCapability: 0, aiExtractionCapability: 1, humanReviewPolicy: "ON_WARNING",
  effectiveFrom: new Date("2026-01-01T00:00:00Z"), effectiveTo: null, reviewStatus: "APPROVED",
};

describe("MySQL requirement catalog provider", () => {
  it("loads only active approved effective definitions", async () => {
    const sql = new FixtureSql([[requirement], []]);
    const catalog = await new MysqlRequirementCatalogProvider(sql).active(new Date("2026-08-26T00:00:00Z"));
    expect(catalog.requirements[0]).toMatchObject({ code: "PASSPORT", version: 1, classification: "OFFICIAL" });
    expect(sql.calls[0].sql).toContain("status='ACTIVE'");
    expect(sql.calls[0].sql).toContain("review_status='APPROVED'");
    expect(sql.calls[0].parameters).toHaveLength(2);
  });

  it("fails closed on overlapping active versions", async () => {
    const sql = new FixtureSql([[requirement, { ...requirement, definitionId: "00000000-0000-4000-8000-000000000002", version: 2 }], []]);
    await expect(new MysqlRequirementCatalogProvider(sql).active(new Date("2026-08-26T00:00:00Z")))
      .rejects.toThrow("CATALOG_ACTIVE_VERSION_CONFLICT");
  });
});
