import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = readFileSync(new URL("../../../scripts/staging-govern-dynamic-interview-rules.ts", import.meta.url), "utf8");

describe("Staging synthetic Dynamic Interview rule fixture", () => {
  it("fails closed outside the isolated Staging path and database", () => {
    expect(script).toContain('databaseUrl.pathname.slice(1) !== "tashira_staging"');
    expect(script).toContain('endsWith("/var/www/tashira-staging")');
  });

  it("labels all evidence synthetic and follows the governed lifecycle", () => {
    expect(script).toContain("STAGING_TEST_SYNTHETIC_NOT_REGULATORY");
    expect(script).toContain("'DRAFT'");
    expect(script).toContain("'UNDER_REVIEW'");
    expect(script).toContain("'APPROVED'");
    expect(script).toContain("'ACTIVE'");
    expect(script).toContain("prohibited from Production activation");
  });
});
