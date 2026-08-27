import { describe, expect, it } from "vitest";
import { parseTd3Mrz } from "./mrz";

const valid = [
  "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<",
  "L898902C36UTO7408122F1204159ZE184226B<<<<<10",
] as const;

describe("TD3 MRZ parser", () => {
  it("parses names without forcing middle-name semantics and validates check digits", () => {
    expect(parseTd3Mrz(valid)).toEqual(expect.objectContaining({ documentCode: "P", issuingCountry: "UTO",
      mrzSurname: "ERIKSSON", mrzGivenNames: "ANNA MARIA", passportNumber: "L898902C3", nationality: "UTO",
      dateOfBirth: "740812", sex: "F", expiryDate: "120415", checkDigitsValid: true, validationErrors: [] }));
  });

  it("returns explicit validation evidence instead of silently accepting a bad MRZ", () => {
    const invalid = [valid[0], `X${valid[1].slice(1)}`];
    const result = parseTd3Mrz(invalid);
    expect(result.checkDigitsValid).toBe(false);
    expect(result.validationErrors).toContain("PASSPORT_NUMBER_CHECK_DIGIT_INVALID");
  });

  it("rejects an unknown layout", () => expect(() => parseTd3Mrz(["TOO_SHORT"])).toThrow("MRZ_TD3_LAYOUT_INVALID"));
});

