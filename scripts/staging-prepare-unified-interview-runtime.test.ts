import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./staging-prepare-unified-interview-runtime.ts", import.meta.url), "utf8");

describe("Staging Unified Interview preparation guard", () => {
  it("is bound to the isolated staging path/database and never enables flags", () => {
    expect(source).toContain('databaseUrl.pathname.slice(1) !== "tashira_staging"');
    expect(source).toContain('endsWith("/var/www/tashira-staging")');
    expect(source).toContain("STAGING_UNIFIED_CUSTOMER_FLAG_PREMATURELY_ENABLED");
    expect(source).not.toMatch(/UPDATE\s+operations_feature_flags|INSERT\s+INTO\s+operations_feature_flags/i);
  });

  it("uses the canonical customer-write repository for family and travel persistence", () => {
    expect(source).toContain("new MysqlCustomerInterviewWriteRepository(pool)");
    expect(source).toContain("repository.defineRelationship");
    expect(source).toContain("repository.createTravelGroup");
    expect(source).not.toContain("INSERT INTO family_relationship_events");
    expect(source).not.toContain("INSERT INTO travel_groups");
  });
});
