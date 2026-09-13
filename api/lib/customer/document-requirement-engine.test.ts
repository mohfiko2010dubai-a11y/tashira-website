import { describe, expect, it } from "vitest";
import { DOCUMENT_REQUIREMENT_RULES, documentRuleSchema, requiredDocuments } from "../../../contracts/document-requirement-engine";
const context = { nationality: "PK", country_of_residence: "SA", visa_type: "30days", trip_purpose: "tourism" as const };
const keys = (country: string) => requiredDocuments({ ...context, country_of_residence: country }, { previewDrafts: true }).filter(rule => !rule.placeholder).map(rule => rule.key);
describe("document requirement union and publication", () => {
  it("previews all eight Saudi requirements while withholding draft rows from customers", () => {
    expect(keys("SA")).toEqual(["passport_page", "personal_photo", "return_ticket", "home_national_id", "ksa_iqama_front", "ksa_iqama_back", "ksa_residence_proof", "ksa_absher_report"]);
    expect(requiredDocuments(context).map(rule => rule.key)).toEqual(["passport_page", "personal_photo", "return_ticket"]);
    expect(requiredDocuments(context, { previewDrafts: true }).find(rule => rule.placeholder)?.label_en).toBe("TBD — pending approval");
  });
  it("uses Oman rather than Saudi residence rules", () => {
    expect(keys("OM")).toContain("omn_id_card");
    expect(keys("OM").some(key => key.startsWith("ksa_"))).toBe(false);
  });
  it("returns the applicable base set for a nationality/residence pair with no special rule", () => {
    expect(requiredDocuments({ ...context, nationality: "EG", country_of_residence: "EG" }).map(rule => rule.key))
      .toEqual(["passport_page", "personal_photo", "return_ticket", "uae_accommodation"]);
    expect(requiredDocuments({ ...context, nationality: "EG", country_of_residence: "AE" })).toHaveLength(3);
  });
  it("deduplicates a document required by two matching groups by key", () => {
    const passport = DOCUMENT_REQUIREMENT_RULES[0];
    expect(requiredDocuments(context, { rules: [passport, { ...passport, applies_when: { nationality: ["PK"] } }] })).toEqual([passport]);
  });
  it("adds host details only for family visits and onward tickets for transit", () => {
    expect(requiredDocuments({ ...context, trip_purpose: "visiting_family" }).map(rule => rule.key)).toContain("host_details");
    expect(requiredDocuments({ ...context, visa_type: "transit", trip_purpose: "transit" }).map(rule => rule.key)).toEqual(["passport_page", "onward_ticket"]);
  });
  it("recomputes by country, preserves common keys and never publishes an unfinished placeholder", () => {
    const old = keys("SA"); const next = keys("OM");
    expect(next.filter(key => old.includes(key))).toEqual(["passport_page", "personal_photo", "return_ticket", "home_national_id"]);
    const placeholder = DOCUMENT_REQUIREMENT_RULES.find(rule => rule.placeholder)!;
    expect(documentRuleSchema.safeParse({ ...placeholder, status: "approved" }).success).toBe(false);
  });
});
