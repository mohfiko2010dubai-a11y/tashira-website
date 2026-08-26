import { describe, expect, it } from "vitest";
import type { OperationsSqlClient, OperationsSqlParameter } from "../operations/mysql-access-provider";
import { MysqlActiveRuleProvider } from "./mysql-active-rule-provider";

class FixtureSql implements OperationsSqlClient {
  statement = "";
  parameters: readonly OperationsSqlParameter[] = [];
  private readonly rows: readonly object[];
  constructor(rows: readonly object[]) { this.rows = rows; }
  async query(sql: string, parameters: readonly OperationsSqlParameter[] = []): Promise<readonly object[]> {
    this.statement = sql; this.parameters = parameters; return this.rows;
  }
}

const valid = {
  stableId: "UAE-VISIT-BASE", version: 2, classification: "OFFICIAL", ruleLayer: "BASE_ROUTE",
  effectiveFrom: new Date("2026-01-01T00:00:00Z"), effectiveTo: null,
  conditionsJson: JSON.stringify([{ field: "nationality", operator: "EQUALS", value: "EG" }]),
  outcomeJson: JSON.stringify({ eligibility: "ELIGIBLE", requirementCodes: ["PASSPORT"],
    conditionalDocuments: [{ code: "RETURN_TICKET", reason: "Only when requested" }], explanationCode: "SUPPORTED_ROUTE" }),
  routeCode: "UAE_VISIT", authority: "Synthetic Official Authority",
};

describe("MySQL active rule provider", () => {
  it("loads only governed ACTIVE, validated and successfully sourced rules", async () => {
    const sql = new FixtureSql([valid]);
    const rules = await new MysqlActiveRuleProvider(sql).activeForRoute("UAE_VISIT");
    expect(sql.statement).toContain("v.status='ACTIVE'");
    expect(sql.statement).toContain("v.research_status='VALIDATED'");
    expect(sql.statement).toContain("ss.retrieval_status='SUCCESS'");
    expect(sql.statement).toContain("s.is_active='ACTIVE'");
    expect(sql.parameters).toEqual(["UAE_VISIT"]);
    expect(rules[0]).toMatchObject({ id: "UAE-VISIT-BASE", version: 2, eligibilityEffect: "ELIGIBLE" });
  });
  it("fails closed when ACTIVE evidence is malformed", async () => {
    await expect(new MysqlActiveRuleProvider(new FixtureSql([{ ...valid, outcomeJson: "{}" }])).activeForRoute("UAE_VISIT"))
      .rejects.toThrow("ACTIVE_RULE_EVIDENCE_INVALID");
  });
});
