import { describe, expect, it } from "vitest";
import { parseMrz, parseTd1Mrz, parseTd2Mrz, parseTd3Mrz } from "./mrz";

const valid = [
  "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<",
  "L898902C36UTO7408122F1204159ZE184226B<<<<<10",
] as const;

describe("TD3 MRZ parser", () => {
  it("parses names without forcing middle-name semantics and validates check digits", () => {
    expect(parseTd3Mrz(valid)).toEqual(expect.objectContaining({ documentCode: "P", issuingCountry: "UTO",
      mrzType:"TD3",
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

describe("TD1/TD2 MRZ dispatch",()=>{
  it("parses the ICAO TD1 sample deterministically",()=>{const lines=["I<UTOD231458907<<<<<<<<<<<<<<<","7408122F1204159UTO<<<<<<<<<<<6","ERIKSSON<<ANNA<MARIA<<<<<<<<<<"];
    expect(parseTd1Mrz(lines)).toMatchObject({mrzType:"TD1",passportNumber:"D23145890",nationality:"UTO",mrzSurname:"ERIKSSON",checkDigitsValid:true});expect(parseMrz(lines).mrzType).toBe("TD1");});
  it("parses a deterministic TD2 fixture and reports check evidence",()=>{const lines=["I<UTOERIKSSON<<ANNA<MARIA".padEnd(36,"<"),"D231458907UTO7408122F1204159<<<<<<<6"];
    const result=parseTd2Mrz(lines);expect(result).toMatchObject({mrzType:"TD2",passportNumber:"D23145890",nationality:"UTO",checkDigitsValid:true,validationErrors:[]});expect(parseMrz(lines).mrzType).toBe("TD2");});
  it("fails unknown dimensions closed",()=>expect(()=>parseMrz(["UNKNOWN"])).toThrow("MRZ_LAYOUT_UNSUPPORTED"));
});
