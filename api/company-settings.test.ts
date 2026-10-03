import { describe, expect, it } from "vitest";
import { COMPANY_FIELDS, companyReopeningBlockers } from "../contracts/company-settings";

const settings = { legalName: "Synthetic company", address: "Synthetic address", licence: "TEST",
  email: "office@example.test", phone: "+971000000000", website: "example.test", logo: "/test.png", provisionalFieldsJson: "[]" };
describe("company reopening guard", () => {
  it("names the provisional field and clears only with a reviewed version", () => {
    expect(companyReopeningBlockers({ ...settings, provisionalFieldsJson: '["phone"]' }))
      .toEqual(["Cannot reopen: company phone is still provisional."]);
    expect(companyReopeningBlockers(settings)).toEqual([]);
  });
  it.each([null, "bad-json", "{}", '["unknown"]'])("fails closed for missing or invalid review evidence: %s", provisionalFieldsJson => {
    expect(companyReopeningBlockers({ ...settings, provisionalFieldsJson })).toHaveLength(1);
  });
  it.each(COMPANY_FIELDS)("refuses a missing %s even when not marked provisional", field => {
    expect(companyReopeningBlockers({ ...settings, [field]: "" })).toEqual([`Cannot reopen: company ${field} is missing.`]);
  });
});
