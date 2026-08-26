import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scope = readFileSync(new URL("../scripts/staging-scope-dynamic-interview.ts", import.meta.url), "utf8");
const e2e = readFileSync(new URL("../scripts/staging-run-unified-interview-api-e2e.ts", import.meta.url), "utf8");
const scenarios = readFileSync(new URL("../scripts/staging-run-unified-interview-scenario-e2e.ts", import.meta.url), "utf8");
const partySetup = readFileSync(new URL("../scripts/staging-run-unified-party-setup-e2e.ts", import.meta.url), "utf8");
const portalScope = readFileSync(new URL("../scripts/staging-scope-customer-portal.ts", import.meta.url), "utf8");
const portalE2e = readFileSync(new URL("../scripts/staging-run-customer-portal-e2e.ts", import.meta.url), "utf8");

describe("Staging Dynamic Interview execution guards", () => {
  it("allows only explicit synthetic application scope and never global scope", () => {
    expect(scope).toContain('databaseUrl.pathname.slice(1) !== "tashira_staging"');
    expect(scope).toContain('endsWith("/var/www/tashira-staging")');
    expect(scope).toContain("allowed.has(reference)");
    expect(scope).toContain("'APPLICATION'");
    expect(scope).not.toContain("'GLOBAL'");
    expect(scope).toContain('"DYNAMIC_CUSTOMER_APPLICATION", "VISA_RULES_EVALUATION", "DYNAMIC_REQUIREMENTS"');
    expect(scope).not.toContain("OPERATIONS_CONTROLLED_WRITES");
  });

  it("uses an in-memory session and proves authorization, immutable history, idempotency and finance isolation", () => {
    expect(e2e).toContain('const reference = "TSH-STG-DYN-INDIVIDUAL"');
    expect(e2e).toContain("createCustomerApplicationCookie");
    expect(e2e).not.toMatch(/console\.log\([^)]*(cookie|secret|token)/i);
    expect(e2e).toContain("STAGING_UNIFIED_API_AUTHORIZATION=PASS");
    expect(e2e).toContain("STAGING_UNIFIED_API_IMMUTABLE_REEVALUATION=PASS");
    expect(e2e).toContain("STAGING_UNIFIED_API_IDEMPOTENCY=PASS");
    expect(e2e).toContain("STAGING_E2E_FINANCE_FIELD_LEAK");
  });

  it("keeps multi-scenario E2E synthetic, staging-only and finance-minimized", () => {
    expect(scenarios).toContain('databaseUrl.pathname.slice(1) !== "tashira_staging"');
    expect(scenarios).toContain('endsWith("/var/www/tashira-staging")');
    expect(scenarios).toContain("TSH-STG-DYN-FAMILY");
    expect(scenarios).toContain("STAGING_SCENARIO_CROSS_APPLICANT_REQUIREMENT_LEAK");
    expect(scenarios).toContain("STAGING_SCENARIO_FINANCE_FIELD_LEAK");
    expect(scenarios).not.toMatch(/STRIPE_SECRET_KEY|RESEND_API_KEY|storage_path/);
  });

  it("guards the customer party setup runner before any database or API mutation", () => {
    expect(partySetup).toContain('databaseUrl.pathname.slice(1) !== "tashira_staging"');
    expect(partySetup).toContain('endsWith("/var/www/tashira-staging")');
    expect(partySetup).toContain('reference = "TSH-STG-DYN-FAMILY"');
    expect(partySetup).toContain("STAGING_PARTY_SETUP_OWNERSHIP_ISOLATION=PASS");
    expect(partySetup).toContain("STAGING_PARTY_SETUP_FINANCE_ISOLATION=PASS");
    expect(partySetup).not.toMatch(/STRIPE_SECRET_KEY|RESEND_API_KEY|storage_path/);
  });

  it("keeps Customer Portal E2E application-scoped, authenticated and finance-minimized", () => {
    expect(portalScope).toContain('databaseUrl.pathname.slice(1) !== "tashira_staging"');
    expect(portalScope).toContain("allowed.has(reference)");
    expect(portalScope).toContain("'CUSTOMER_OPERATIONS_PORTAL','STAGING'");
    expect(portalScope).not.toContain("'GLOBAL'");
    expect(portalE2e).toContain("createCustomerApplicationCookie");
    expect(portalE2e).toContain("STAGING_CUSTOMER_PORTAL_CROSS_APPLICATION_DENIAL=PASS");
    expect(portalE2e).toContain("STAGING_CUSTOMER_PORTAL_FINANCE_ISOLATION=PASS");
    expect(portalE2e).not.toMatch(/STRIPE_SECRET_KEY|RESEND_API_KEY|storage_path/);
  });
});
