import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = readFileSync(new URL("../../../scripts/staging-govern-customer-route-uat-rules.ts", import.meta.url), "utf8");

describe("Staging customer-route UAT rule fixture", () => {
  it("fails closed to the isolated Staging path and database", () => {
    expect(script).toContain('databaseUrl.pathname.slice(1) !== "tashira_staging"');
    expect(script).toContain('endsWith("/var/www/tashira-staging")');
    expect(script).toContain("STAGING_TEST_SYNTHETIC_NOT_REGULATORY");
  });

  it("cannot impersonate official eligibility or an official authority", () => {
    expect(script).toContain("'OPERATIONAL','VALIDATED'");
    expect(script).toContain("eligibility: \"NO_CHANGE\"");
    expect(script).toContain("'COMMERCIAL','APPROVED'");
    expect(script).not.toContain("'OFFICIAL','VALIDATED'");
    expect(script).not.toContain('eligibility: "ELIGIBLE"');
    expect(script).toContain('layer: "OPERATIONAL_OVERLAY"');
    expect(script).not.toContain('layer: "TRAVEL_OVERLAY"');
  });

  it("supports an explicit idempotent deactivation path", () => {
    expect(script).toContain('action !== "activate" && action !== "deactivate"');
    expect(script).toContain("SET v.status='RETIRED'");
    expect(script).toContain("STAGING_TEST_RULE_ROLLBACK=PASS");
  });
});
