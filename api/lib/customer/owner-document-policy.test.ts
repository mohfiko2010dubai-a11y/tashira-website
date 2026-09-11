import { describe, expect, it } from "vitest";
import { applyOwnerDocumentRequirements, ownerDocumentRules, withOwnerDocumentCatalog } from "./owner-document-policy";
import { evaluateEligibility } from "../eligibility/eligibility-engine";
import { requirementDefinitionSchema } from "../requirements/requirement-catalog";
import { customerFormRules } from "./customer-form-rules";

const rules = ownerDocumentRules("TEST");
const docs = (nationality: string, gccCountry?: string) => evaluateEligibility({ rules,
  profile: { routeCode: "TEST", attributes: { nationality, gccCountry } }, evaluatedAt: new Date("2026-09-12") }).requiredDocuments;
describe("Owner PDF document matrix", () => {
  it.each([["PK", "PASSPORT_SECOND_PAGE"], ["IN", "PASSPORT_LAST_PAGE"], ["SY", "PASSPORT_LAST_PAGE"]])("adds the specified passport page for %s", (country, page) => {
    expect(docs(country)).toContain(page);
    expect(docs("EG")).not.toContain(page);
  });
  it.each(["PK", "IQ", "IR", "AF"])("requires home-country ID for %s", country => expect(docs(country)).toContain("HOME_NATIONAL_ID"));
  it("does not add home-country ID to unrelated nationalities", () => expect(docs("IN")).not.toContain("HOME_NATIONAL_ID"));
  it.each([
    ["SA", ["RESIDENCE_CARD_FRONT", "RESIDENCE_CARD_BACK", "SA_RESIDENCE_PROOF", "SA_ABSHER_REPORT"]],
    ["KW", ["RESIDENCE_CARD_FRONT", "RESIDENCE_CARD_BACK", "KW_MOBILE_ID"]],
    ["BH", ["BH_RESIDENCE_REPORT"]], ["QA", ["QA_RESIDENCE_CARD"]],
  ] as const)("requires exactly the specified separate residence uploads for %s", (country, expected) => {
    expect([...docs("EG", country)].sort()).toEqual([...expected].sort());
  });
  it("keeps operational documents from granting immigration eligibility", () => {
    expect(rules.every(rule => rule.eligibilityEffect === "NO_CHANGE" && rule.classification === "OPERATIONAL")).toBe(true);
  });
  it("publishes valid, applicant-scoped definitions for every upload", () => {
    const catalog = withOwnerDocumentCatalog({ catalogVersion: "test", requirements: [], questions: [] });
    for (const definition of catalog.requirements) expect(requirementDefinitionSchema.safeParse(definition).success).toBe(true);
    for (const code of rules.flatMap(rule => rule.requiredDocuments)) expect(catalog.requirements.some(item => item.code === code && item.applicantScopedCapability)).toBe(true);
  });
  it("removes only named demo overlays and preserves official rules", () => {
    const official = { ...rules[0], id: "OFFICIAL_PK", classification: "OFFICIAL" as const };
    const demo = { ...rules[0], id: "STAGING_TEST_ROUTE_TEST_PK" };
    expect(customerFormRules([official, demo])).toEqual([official]);
  });
});

it("adds versioned processing documents without inventing persisted rule matches or changing eligibility", () => {
  const profile = { routeCode: "TEST", attributes: { nationality: "PK", gccCountry: "SA" } };
  const at = new Date("2026-09-12");
  const base = evaluateEligibility({ profile, evaluatedAt: at, rules: [] });
  const result = applyOwnerDocumentRequirements(base, profile, at);
  expect(result.requiredDocuments).toContain("PASSPORT_SECOND_PAGE");
  expect(result.requiredDocuments).toContain("SA_ABSHER_REPORT");
  expect(result.matchedRules).toEqual(base.matchedRules);
  expect(result.matchedRuleVersions).toEqual(base.matchedRuleVersions);
  expect(result.finalEligibilityState).toBe(base.finalEligibilityState);
  expect(result.reason).toContain("tashira-owner-documents-20260911-v1");
});
