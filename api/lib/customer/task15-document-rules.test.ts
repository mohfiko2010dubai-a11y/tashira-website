import { describe, expect, it } from "vitest";
import { requiredDocuments, requirementSatisfied } from "../../../contracts/document-requirement-engine";
import { documentCardGroups } from "../../../src/components/customer/document-card-groups";
import { documentCardCopy } from "../../../src/components/customer/document-card-copy";

describe("TASK15 owner document corrections", () => {
  for (const country of ["QA", "OM"]) it(`${country}: two independent faces in one card`, () => {
    const rules = requiredDocuments({ nationality: "EG", country_of_residence: country, visa_type: "30days-single" });
    expect(rules).toHaveLength(4);
    const files = rules.map(rule => ({ requirementCode: rule.code, state: "MISSING" }));
    const cards = documentCardGroups(files).find(group => group.key === "residence")!.cards;
    expect(cards).toHaveLength(1);
    expect(cards[0].pair).toBe("residence");
    expect(cards[0].files.map(file => file.requirementCode)).toEqual(country === "QA" ? ["QAT_RESIDENCE_FRONT", "QAT_RESIDENCE_BACK"] : ["OMN_RESIDENCE_FRONT", "OMN_RESIDENCE_BACK"]);
    for (const rule of rules.slice(2)) expect(requirementSatisfied(rule, new Set(["QA_RESIDENCE_CARD", "OMN_ID_CARD"]))).toBe(false);
    expect(requirementSatisfied(rules[3], new Set([rules[2].code]))).toBe(false);
    if (country === "OM") for (const ar of [true, false]) {
      expect(documentCardCopy(cards[0], "EG", ar).label).toContain("Resident Card");
      expect(documentCardCopy(cards[0], "EG", ar).label).toContain("بطاقة مقيم");
    }
  });
  it("adds sponsor evidence without replacing Iraq or Qatar requirements", () => {
    const context = { nationality: "IQ", country_of_residence: "QA", visa_type: "30days-single" };
    const normal = requiredDocuments(context).map(rule => rule.key);
    const companion = requiredDocuments({ ...context, residence_type: "gcc-accompany" }).map(rule => rule.key);
    expect(companion).toEqual([...normal, "sponsor_id"]);
    expect(normal).not.toContain("sponsor_id");
    expect(companion).toContain("home_national_id");
    expect(companion.filter(key => key.includes("passport"))).toEqual(["passport_page"]);
  });
  it("shows the owner photo instruction in both languages", () => {
    expect(documentCardCopy({ key: "PERSONAL_PHOTO" }, "EG", false).label).toBe("Recent personal photo — white background, without glasses");
    expect(documentCardCopy({ key: "PERSONAL_PHOTO" }, "EG", true).label).toBe("صورة شخصية حديثة — خلفية بيضاء، بدون نظارة");
  });
});
