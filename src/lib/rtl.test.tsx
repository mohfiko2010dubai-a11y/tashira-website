import { describe, expect, it } from "vitest";
import { documentDirection, isRtlLanguage } from "./rtl";

describe("isRtlLanguage", () => {
  it("detects all shipped RTL locales", () => {
    for (const lang of ["ar", "ur", "fa", "he"]) {
      expect(isRtlLanguage(lang)).toBe(true);
    }
  });

  it("handles region variants", () => {
    expect(isRtlLanguage("ar-EG")).toBe(true);
    expect(isRtlLanguage("ur-PK")).toBe(true);
    expect(isRtlLanguage("en-US")).toBe(false);
  });

  it("returns false for LTR and empty input", () => {
    expect(isRtlLanguage("en")).toBe(false);
    expect(isRtlLanguage("")).toBe(false);
    expect(isRtlLanguage(undefined)).toBe(false);
  });
});

describe("documentDirection", () => {
  it("maps languages to directions", () => {
    expect(documentDirection("ar")).toBe("rtl");
    expect(documentDirection("he")).toBe("rtl");
    expect(documentDirection("en")).toBe("ltr");
  });
});
