import { describe, expect, it } from "vitest";
import { documentNumber, documentSeries } from "./financial-document-series";

describe("financial document identifiers", () => {
  it("continues beyond five digits without wrapping", () => {
    expect(documentNumber("TSH-INV", 99999)).toBe("TSH-INV-99999");
    expect(documentNumber("TSH-INV", 100000)).toBe("TSH-INV-100000");
  });
  it("separates invoices, credit notes and test documents", () => {
    expect(documentSeries("invoice", false)).toBe("TSH-INV");
    expect(documentSeries("credit-note", false)).toBe("TSH-CN");
    expect(documentSeries("invoice", true)).toBe("TEST-INV");
    expect(documentSeries("credit-note", true)).toBe("TEST-CN");
    expect(documentNumber("TSH-INV", 1)).toBe("TSH-INV-00001");
    expect(documentNumber("TEST-CN", 99999).length).toBeLessThanOrEqual(21);
  });
  it("does not wrap or reuse an exhausted sequence", () => {
    for (const n of [0, -1, 1.5, Number.MAX_SAFE_INTEGER]) expect(() => documentNumber("TSH-INV", n)).toThrow();
  });
});
