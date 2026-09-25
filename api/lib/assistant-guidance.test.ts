import { describe, expect, it } from "vitest";
import { assistantApplicationPath, assistantDocuments, ASSISTANT_GUIDANCE } from "../../contracts/assistant-guidance";
import { requiredDocuments } from "../../contracts/document-requirement-engine";

describe("assistant uses the current application rules", () => {
  it.each([
    ["EG", "EG", "non-gcc", 3], ["EG", "SA", "gcc-resident", 6],
    ["PK", "SA", "gcc-resident", 8], ["IQ", "QA", "gcc-accompany", 6],
  ])("matches %s / %s / %s", (nationality, country, residence, count) => {
    const context = { nationality, country_of_residence: country, residence_type: residence, visa_type: "30days-single", trip_purpose: "tourism" as const };
    const rules = assistantDocuments(context);
    expect(rules).toEqual(requiredDocuments(context));
    expect(rules).toHaveLength(count);
    expect(rules.every(rule => rule.status === "approved")).toBe(true);
    expect(rules.some(rule => /ticket/i.test(rule.code))).toBe(false);
  });
  it("recomputes nationality and residence without changing another traveller", () => {
    const context = { nationality: "EG", country_of_residence: "SA", residence_type: "gcc-resident", visa_type: "30days-single" };
    const egypt = assistantDocuments(context);
    expect(assistantDocuments({ ...context, nationality: "PK" }).map(r => r.code)).toContain("PK_PASSPORT_PAGE_2");
    const oman = assistantDocuments({ ...context, country_of_residence: "OM" }).map(r => r.code);
    expect(oman).not.toContain("KSA_IQAMA_FRONT");
    expect(assistantDocuments(context)).toEqual(egypt);
  });
  it("keeps the separate Saudi report distinct from its choose-one evidence", () => {
    const rules = assistantDocuments({ nationality: "EG", country_of_residence: "SA", residence_type: "gcc-resident", visa_type: "30days-single" });
    expect(rules.find(rule => rule.code === "KSA_RESIDENCE_PROOF")?.any_of).toHaveLength(2);
    expect(rules.map(rule => rule.code)).toContain("SA_ABSHER_REPORT");
  });
  it("resumes through the owned form and rejects malformed stored references", () => {
    expect(assistantApplicationPath("ar", "TSH-TEST-123")).toBe("/ar/apply/TSH-TEST-123/interview");
    expect(assistantApplicationPath("en", "../../pay")).toBe("/en/apply");
    expect(assistantApplicationPath("ar")).toBe("/ar/apply");
  });
  it("explains the actual upload limit and supported iPhone formats in both languages", () => {
    for (const language of ["en", "ar"] as const) {
      expect(ASSISTANT_GUIDANCE[language].uploads).toContain("20");
      expect(ASSISTANT_GUIDANCE[language].uploads).toContain("HEIC");
      expect(ASSISTANT_GUIDANCE[language].uploads).toContain("HEIF");
    }
  });
});
