import { describe, expect, it } from "vitest";
import { requiredDocuments } from "../../../contracts/document-requirement-engine";
import { ownerRequiredDocumentCodes } from "../../../contracts/owner-document-requirements";
import { precheckApplicationSearch, precheckDocuments, precheckPrefill } from "../../../src/lib/precheck-documents";
import { documentCardGroups } from "../../../src/components/customer/document-card-groups";

describe("precheck and wizard document parity", () => {
  for (const [nationality, country, visa, purpose] of [
    ["PK", "SA", "30days-single", "tourism"], ["PK", "OM", "30days-single", "tourism"],
    ["IN", "KW", "30days-single", "visiting_family"], ["EG", "EG", "96hours-transit", "transit"],
  ] as const) it(`${nationality}/${country}/${visa}/${purpose} preserves the exact wizard keys, labels and groups`, () => {
    const context = { nationality, country_of_residence: country, visa_type: visa, trip_purpose: purpose };
    const result = precheckDocuments(context);
    const wizard = requiredDocuments(context);
    expect(result.rules).toEqual(wizard);
    expect(result.rules.map(rule => rule.code)).toEqual(ownerRequiredDocumentCodes(nationality, country, visa, purpose));
    expect(result.groups).toEqual(documentCardGroups(wizard.map(rule => ({ ...rule, requirementCode: rule.code, state: "MISSING" }))));
    const params = new URLSearchParams(precheckApplicationSearch(context));
    expect(params.get("visa")).toBe(visa);
    expect(precheckPrefill(params)).toMatchObject({ nationality, country, purpose });
  });
  it("counts eight Saudi/Pakistani files in six cards, with no optional flight in the requirements", () => {
    const result = precheckDocuments({ nationality: "PK", country_of_residence: "SA", visa_type: "30days-single", trip_purpose: "tourism" });
    expect(result.rules.map(rule => rule.key)).toEqual(["passport_page", "pk_passport_page_2", "personal_photo", "home_national_id", "ksa_iqama_front", "ksa_iqama_back", "ksa_residence_proof", "ksa_absher_report"]);
    expect(result.groups.flatMap(group => group.cards)).toHaveLength(6);
    expect(result.groups.flatMap(group => group.cards.flatMap(card => card.files))).toHaveLength(8);
  });
  it("does not accept free text or arbitrary trip purposes as route prefills", () => {
    expect(precheckPrefill(new URLSearchParams("nationality=Egyptian&residence=Saudi Arabia&purpose=other")))
      .toEqual({ nationality: "", country: "", residenceType: "non-gcc", purpose: "tourism" });
  });
});
