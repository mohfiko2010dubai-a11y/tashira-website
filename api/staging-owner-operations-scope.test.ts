import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("staging owner Operations acceptance scope", () => {
  it("is fail-closed to the isolated Staging identity and one staff account", async () => {
    const source = await readFile(new URL("../scripts/staging-scope-owner-operations.ts", import.meta.url), "utf8");
    expect(source).toContain('databaseUrl.pathname.slice(1) !== "tashira_staging"');
    expect(source).toContain('expectedDirectory = "/var/www/tashira-staging"');
    expect(source).toContain('ownerUsername = "staging-owner"');
    expect(source).toContain("scope_type='STAFF'");
    expect(source).not.toContain("'PRODUCTION'");
    expect(source).not.toContain('"REGULATORY_WATCHER",');
  });

  it("does not activate customer, payment, email, or external-provider behavior", async () => {
    const source = await readFile(new URL("../scripts/staging-scope-owner-operations.ts", import.meta.url), "utf8");
    expect(source).not.toContain('"DYNAMIC_CUSTOMER_APPLICATION",');
    expect(source).not.toContain('"CUSTOMER_OPERATIONS_PORTAL",');
    expect(source).not.toContain('"OPERATIONS_EMAIL_AUTOMATION",');
    expect(source).not.toContain('"AI_DOCUMENT_REVIEW",');
    expect(source).toContain('"DOCUMENT_INTELLIGENCE",');
  });
});
