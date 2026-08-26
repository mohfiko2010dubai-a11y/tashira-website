import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const script = readFileSync(new URL("../../../scripts/staging-create-dynamic-interview-fixtures.ts", import.meta.url), "utf8");

describe("isolated Staging Dynamic Interview applications", () => {
  it("fails closed outside isolated Staging and classifies every fixture TEST", () => {
    expect(script).toContain('databaseUrl.pathname.slice(1) !== "tashira_staging"');
    expect(script).toContain('endsWith("/var/www/tashira-staging")');
    expect(script).toContain("'TEST'");
    expect(script).toContain("@example.invalid");
  });

  it("keeps application flags off until the runtime acceptance gate", () => {
    expect(script).toContain("STAGING_FIXTURE_FLAG_PREMATURELY_ENABLED");
    expect(script).toContain("STAGING_TEST_CUSTOMER_FLAGS=OFF");
  });
});
