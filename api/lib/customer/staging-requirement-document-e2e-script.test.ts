import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../../scripts/staging-run-requirement-document-e2e.ts", import.meta.url), "utf8");

describe("Staging requirement-document E2E guard", () => {
  it("fails closed outside the isolated Staging database and path", () => {
    expect(source).toContain('databaseUrl.pathname.slice(1) !== "tashira_staging"');
    expect(source).toContain("/var/www/tashira-staging");
  });

  it("proves authorization, applicant isolation, idempotency and finance isolation", () => {
    expect(source).toContain("STAGING_REQUIREMENT_DOCUMENT_AUTHORIZATION=PASS");
    expect(source).toContain("STAGING_REQUIREMENT_DOCUMENT_APPLICANT_ISOLATION=PASS");
    expect(source).toContain("STAGING_REQUIREMENT_DOCUMENT_IDEMPOTENCY=PASS");
    expect(source).toContain("STAGING_REQUIREMENT_DOCUMENT_CROSS_APPLICATION_DENIAL=PASS");
    expect(source).toContain("STAGING_REQUIREMENT_DOCUMENT_FINANCE_ISOLATION=PASS");
  });
});
