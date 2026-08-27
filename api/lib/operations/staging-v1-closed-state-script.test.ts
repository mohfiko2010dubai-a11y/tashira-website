import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../../scripts/staging-verify-v1-closed-state.ts", import.meta.url), "utf8");

describe("Staging V1 closed-state verification", () => {
  it("fails closed unless both path and database prove isolated Staging", () => {
    expect(source).toContain('databaseUrl.pathname.slice(1) !== "tashira_staging"');
    expect(source).toContain('endsWith("/var/www/tashira-staging")');
    expect(source).toContain("STAGING_V1_GATE_DATABASE_IDENTITY_CHANGED");
  });

  it("is read-only and checks migrations, closed capabilities and Production-scope absence", () => {
    expect(source).toContain("STAGING_V1_SCHEMA_OBJECTS_014_042=PASS");
    expect(source).toContain('"DOCUMENT_INTELLIGENCE"');
    expect(source).toContain('"OPERATIONS_CONTROLLED_WRITES"');
    expect(source).toContain('"DYNAMIC_CUSTOMER_APPLICATION"');
    expect(source).toContain('"OPERATIONS_EMAIL_AUTOMATION"');
    expect(source).toContain("environment='PRODUCTION' AND enabled='YES'");
    expect(source).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|REPLACE|ALTER|DROP|CREATE)\b/i);
  });
});
