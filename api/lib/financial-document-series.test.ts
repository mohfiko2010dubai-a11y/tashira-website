import { describe, expect, it } from "vitest";
import { documentNumber, documentSeries, documentYear } from "./financial-document-series";

describe("financial document identifiers", () => {
  it("uses Dubai's calendar year at the UTC boundary", () => {
    expect(documentYear(new Date("2026-12-31T19:59:59Z"))).toBe(2026);
    expect(documentYear(new Date("2026-12-31T20:00:00Z"))).toBe(2027);
  });
  it("separates invoices, credit notes and test documents", () => {
    expect(documentSeries("invoice", false)).toBe("TSH");
    expect(documentSeries("credit-note", false)).toBe("TSH-CN");
    expect(documentSeries("invoice", true)).toBe("TEST");
    expect(documentSeries("credit-note", true)).toBe("TEST-CN");
    expect(documentNumber("TSH", 2026, 1)).toBe("TSH-2026-00001");
    expect(documentNumber("TEST-CN", 2026, 99999).length).toBeLessThanOrEqual(21);
  });
  it("does not wrap or reuse an exhausted sequence", () => {
    for (const n of [0, -1, 1.5, 100000]) expect(() => documentNumber("TSH", 2026, n)).toThrow();
  });
});
