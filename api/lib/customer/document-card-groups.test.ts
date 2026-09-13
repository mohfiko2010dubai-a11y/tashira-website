import { describe, expect, it } from "vitest";
import { requiredDocuments } from "../../../contracts/document-requirement-engine";
import { documentCardGroups } from "../../../src/components/customer/document-card-groups";

describe("step two grouped work", () => {
  it("keeps eight independent Saudi/Pakistani files in six cards and removes the flight gate", () => {
    const files = requiredDocuments({ nationality: "PK", country_of_residence: "SA", visa_type: "30days-single" }).map(rule => ({ applicantId: 1,
      requirementCode: rule.code, documentType: rule.document_type, state: "MISSING" as const }));
    const groups = documentCardGroups(files);
    expect(files).toHaveLength(8);
    expect(groups.flatMap(group => group.cards)).toHaveLength(6);
    expect(groups.flatMap(group => group.cards.flatMap(card => card.files))).toHaveLength(8);
    expect(groups.map(group => [group.key, group.cards.flatMap(card => card.files).length])).toEqual([["identity", 4], ["residence", 4]]);
    expect(files.some(file => file.requirementCode === "RETURN_TICKET")).toBe(false);
  });
  it("preserves the Indian last page and both Kuwait card faces as separate slots", () => {
    const files = requiredDocuments({ nationality: "IN", country_of_residence: "KW", visa_type: "30days-single" }).map(rule => ({ applicantId: 1,
      requirementCode: rule.code, documentType: rule.document_type, state: "MISSING" as const }));
    const pairs = documentCardGroups(files).flatMap(group => group.cards).filter(card => card.pair);
    expect(pairs.map(card => card.files.map(file => file.requirementCode))).toEqual([["PASSPORT", "IN_PASSPORT_PAGE_LAST"], ["KWT_IQAMA_FRONT", "KWT_IQAMA_BACK"]]);
  });
});
