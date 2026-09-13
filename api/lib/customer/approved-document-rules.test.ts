import { describe, expect, it } from "vitest";
import { DOCUMENT_REQUIREMENT_RULES, documentRuleSchema, evaluateDocumentRequirements, requiredDocuments,
  requirementSatisfied, type DocumentRequirementRule } from "../../../contracts/document-requirement-engine";
import { assertDistinctDocument, projectOwnerDocuments, DISTINCT_DOCUMENT_MESSAGE } from "./owner-document-evidence";
const context = { nationality: "PK", country_of_residence: "SA", visa_type: "30days-single", trip_purpose: "tourism" as const };
const rulesFor = (nationality: string, country: string, rules = DOCUMENT_REQUIREMENT_RULES) => requiredDocuments({ ...context, nationality, country_of_residence: country }, { rules });
const keys = (nationality: string, country: string) => rulesFor(nationality, country).map(rule => rule.key);
const sa = ["ksa_iqama_front", "ksa_iqama_back", "ksa_residence_proof", "ksa_absher_report"];
const rule = (key: string) => DOCUMENT_REQUIREMENT_RULES.find(item => item.key === key)!;

describe("Approved nationality and residence document union: owner acceptance", () => {
  it("1: Saudi residence adds the same four slots for Egyptian, Indian and Pakistani applicants", () => {
    for (const nationality of ["EG", "IN", "PK"]) expect(keys(nationality, "SA").filter(key => key.startsWith("ksa_"))).toEqual(sa);
  });
  it("2: Pakistani ID and Indian last page are independent of the identical residence set", () => {
    expect(keys("PK", "SA")).toContain("home_national_id");
    expect(keys("IN", "SA")).not.toContain("home_national_id");
    expect(keys("IN", "SA")).toContain("in_passport_page_last");
  });
  it("3: Kuwait currently requires all three separate documents", () => {
    expect(keys("EG", "KW").filter(key => key.startsWith("kwt_"))).toEqual(["kwt_iqama_front", "kwt_iqama_back", "kwt_mobile_id"]);
  });
  it("4: Pakistani second, Indian last and Syrian last pages have distinct evidence identities", () => {
    for (const [nationality, key] of [["PK", "pk_passport_page_2"], ["IN", "in_passport_page_last"], ["SY", "sy_passport_page_last"]]) {
      expect(keys(nationality, "SA").filter(item => /passport_page_(2|last)$/.test(item))).toEqual([key]);
      expect(requirementSatisfied(rule(key), new Set(["PASSPORT_SECOND_PAGE"]))).toBe(nationality === "PK");
    }
    for (const key of ["in_passport_page_last", "sy_passport_page_last"]) expect(rule(key).hint_en).toMatch(/last page/i);
  });
  it("5: Iraq, Iran and Afghanistan need home ID but no extra passport pages", () => {
    for (const nationality of ["IQ", "IR", "AF"]) {
      expect(keys(nationality, "SA")).toContain("home_national_id");
      expect(keys(nationality, "SA").filter(key => /passport_page_(2|last)$/.test(key))).toEqual([]);
    }
  });
  it("6: PK + SA + 30-day visit has the exact approved union and no suppressed rules", () => {
    expect(keys("PK", "SA")).toEqual(["passport_page", "pk_passport_page_2", "personal_photo", "return_ticket", "home_national_id", ...sa]);
    expect(evaluateDocumentRequirements(context).suppressed).toEqual([]);
  });
  it("7: either proof option completes one slot, and the separate report remains required", () => {
    const proof = rule("ksa_residence_proof");
    expect(proof.any_of?.map(item => item.key)).toEqual(["ksa_proof_muqeem", "ksa_proof_absher"]);
    for (const code of ["KSA_PROOF_MUQEEM", "KSA_PROOF_ABSHER", "SA_RESIDENCE_PROOF"]) {
      expect(requirementSatisfied(proof, new Set([code]))).toBe(true);
      expect(requirementSatisfied(rule("ksa_absher_report"), new Set([code]))).toBe(false);
    }
    expect(requirementSatisfied(proof, new Set(["KSA_RESIDENCE_PROOF"]))).toBe(false);
  });
  it("8: Qatar and Oman each add their own single residence slot, Bahrain its report", () => {
    for (const [country, key] of [["QA", "qat_residence_card"], ["OM", "omn_residence_card"], ["BH", "bhr_permit_report"]]) {
      expect(keys("EG", country)).toEqual(["passport_page", "personal_photo", "return_ticket", key]);
    }
    expect(rule("omn_residence_card").label_en).toMatch(/Resident Card/);
    expect(rule("omn_residence_card").label_ar).toContain("بطاقة مقيم");
  });
  it("9: a pair without special rules has a nonempty base set", () => {
    expect(keys("EG", "AE")).toEqual(["passport_page", "personal_photo", "return_ticket"]);
  });
  it("10: duplicate keys from overlapping rule groups result in one slot", () => {
    const passport = rule("passport_page");
    expect(requiredDocuments(context, { rules: [passport, { ...passport, applies_when: { nationality: ["PK"] } }] })).toEqual([passport]);
  });
  it("11: edits retain applicable uploaded evidence, while new last-page and residence slots are missing", () => {
    const evidence = ["PASSPORT", "PASSPORT_SECOND_PAGE", "PERSONAL_PHOTO", "SA_RESIDENCE_PROOF"].map((code, index) => ({ applicantId: 1, code, documentId: index + 1, storagePath: `synthetic-${index}` }));
    const next = projectOwnerDocuments(rulesFor("IN", "KW"), evidence, 1);
    expect(next.filter(item => item.state === "UPLOADED").map(item => item.requirementCode)).toEqual(["PASSPORT", "PERSONAL_PHOTO"]);
    expect(next.find(item => item.requirementCode === "IN_PASSPORT_PAGE_LAST")?.state).toBe("MISSING");
    expect(projectOwnerDocuments(rulesFor("PK", "SA"), evidence, 1).find(item => item.requirementCode === "PK_PASSPORT_PAGE_2")?.state).toBe("UPLOADED");
    expect(projectOwnerDocuments(rulesFor("IN", "KW"), evidence, 2).every(item => item.state === "MISSING")).toBe(true);
  });
  it("12: accommodation is required outside GCC and not for GCC residents", () => {
    expect(keys("EG", "EG")).toContain("uae_accommodation");
    for (const country of ["SA", "KW", "BH", "QA", "OM", "AE"]) expect(keys("EG", country)).not.toContain("uae_accommodation");
  });
});

describe("Data-only policy changes and diagnostics", () => {
  it("changes Kuwait to (front AND back) OR Hawiyati by editing JSON data only", () => {
    const front = rule("kwt_iqama_front"), back = rule("kwt_iqama_back"), mobile = rule("kwt_mobile_id");
    const choice = documentRuleSchema.parse({ ...front, key: "kwt_residence_choice", code: "KWT_RESIDENCE_CHOICE", any_of: [
      { ...front, key: "kwt_card", code: "KWT_CARD", all_of: [front, back] }, mobile] });
    const data = DOCUMENT_REQUIREMENT_RULES.filter(item => !item.key.startsWith("kwt_")).concat(choice);
    const result = rulesFor("IN", "KW", data);
    expect(result.filter(item => item.key.startsWith("kwt_"))).toEqual([choice]);
    expect(requirementSatisfied(choice, new Set([front.code]))).toBe(false);
    expect(requirementSatisfied(choice, new Set([back.code]))).toBe(false);
    expect(requirementSatisfied(choice, new Set([front.code, back.code]))).toBe(true);
    expect(requirementSatisfied(choice, new Set([mobile.code]))).toBe(true);
    expect(requirementSatisfied(choice, new Set(["KWT_CARD"]))).toBe(false);
  });
  it("changes Saudi to three residence items by removing one JSON row only", () => {
    const data = DOCUMENT_REQUIREMENT_RULES.filter(item => item.key !== "ksa_absher_report");
    expect(rulesFor("EG", "SA", data).filter(item => item.key.startsWith("ksa_")).map(item => item.key)).toEqual(sa.slice(0, 3));
    expect(keys("EG", "SA").filter(key => key.startsWith("ksa_"))).toHaveLength(4);
  });
  it("reports applicable drafts separately from unmatched conditions and withholds them", () => {
    const draft: DocumentRequirementRule = { ...rule("ksa_absher_report"), status: "draft" };
    const result = evaluateDocumentRequirements(context, { rules: [draft, rule("kwt_mobile_id")] });
    expect(result.requirements).toEqual([]);
    expect(result.suppressed).toEqual([{ key: draft.key, reason: "draft" }]);
    expect(result.unmatched).toEqual([{ key: "kwt_mobile_id", reason: "unmatched_condition", conditions: ["country_of_residence"] }]);
    expect(documentRuleSchema.safeParse({ ...draft, status: "approved", placeholder: true }).success).toBe(false);
  });
  it("preserves purpose-driven host and onward requirements", () => {
    expect(requiredDocuments({ ...context, trip_purpose: "visiting_family" }).map(item => item.key)).toContain("host_details");
    const transit = requiredDocuments({ ...context, visa_type: "96hours-transit", trip_purpose: "transit" }).map(item => item.key);
    expect(transit).toContain("onward_ticket"); expect(transit).not.toContain("personal_photo"); expect(transit).not.toContain("return_ticket");
  });
});

describe("Separate Saudi report evidence", () => {
  const proof = rule("ksa_residence_proof"), report = rule("ksa_absher_report");
  const file = { applicantId: 1, code: "KSA_PROOF_ABSHER", documentId: 10, storagePath: "test/proof.pdf" };
  it("blocks the same document ID, same storage path and reuploaded identical bytes in either direction", async () => {
    await expect(assertDistinctDocument(report, [proof, report], file, [file])).rejects.toThrow(DISTINCT_DOCUMENT_MESSAGE);
    await expect(assertDistinctDocument(report, [proof, report], { ...file, documentId: 11 }, [file])).rejects.toThrow(DISTINCT_DOCUMENT_MESSAGE);
    await expect(assertDistinctDocument(report, [proof, report], { ...file, documentId: 11, storagePath: "test/renamed.pdf" }, [file], async () => "same-sha")).rejects.toThrow(DISTINCT_DOCUMENT_MESSAGE);
    await expect(assertDistinctDocument(proof, [proof, report], file, [{ ...file, code: report.code }])).rejects.toThrow(DISTINCT_DOCUMENT_MESSAGE);
  });
  it("allows genuinely different documents and isolates applicants", async () => {
    await expect(assertDistinctDocument(report, [proof, report], { ...file, documentId: 11, storagePath: "test/report.pdf" }, [file], async path => path)).resolves.toBeUndefined();
    await expect(assertDistinctDocument(report, [proof, report], { ...file, applicantId: 2 }, [file])).resolves.toBeUndefined();
  });
  it("a valid replacement resolves a historical duplicate without deleting immutable links", () => {
    const duplicate = { ...file, code: report.code };
    expect(projectOwnerDocuments([proof, report], [file, duplicate], 1)[1].state).toBe("MISSING");
    const replacement = { ...duplicate, documentId: 12, storagePath: "test/separate-report.pdf" };
    expect(projectOwnerDocuments([proof, report], [file, duplicate, replacement], 1)[1].state).toBe("UPLOADED");
  });
});
