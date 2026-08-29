import { describe, expect, it } from "vitest";
import { isNationalityCode, NATIONALITY_CATALOG, nationalityLabel, searchNationalities } from "./nationality-catalog";

describe("governed nationality catalog", () => {
  it("stores unique uppercase ISO alpha-2 codes and excludes user-assigned codes", () => {
    const codes = NATIONALITY_CATALOG.map((entry) => entry.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((code) => /^[A-Z]{2}$/.test(code))).toBe(true);
    expect(isNationalityCode("XK")).toBe(false);
    expect(["AE", "EG", "IN", "PK", "PH", "GB", "US"].every(isNationalityCode)).toBe(true);
  });

  it("provides bilingual labels and bilingual search without changing stored codes", () => {
    expect(nationalityLabel("EG", "en")).toBe("Egypt");
    expect(nationalityLabel("EG", "ar")).toBe("مصر");
    expect(searchNationalities("مصر", "ar")).toEqual([expect.objectContaining({ code: "EG" })]);
    expect(searchNationalities("egy", "en")).toEqual([expect.objectContaining({ code: "EG" })]);
  });
});
