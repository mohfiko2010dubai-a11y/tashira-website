import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyFinancialArchive, verifySeriesPosition } from "./financial-document-integrity";

describe("permanent financial boot invariant", () => {
  it("accepts a clean series and future contiguous issuance, without a fixed seed", () => {
    expect(() => verifySeriesPosition("TSH-INV", 0, [])).not.toThrow();
    expect(() => verifySeriesPosition("TSH-INV", 3, [1, 2, 3])).not.toThrow();
    expect(() => verifySeriesPosition("TSH-CN", 1, [1])).not.toThrow();
  });
  it.each([[3, [1, 3]], [2, [1]], [1, [1, 2]], [2, [1, 1]], [-1, []]])(
    "rejects counter %s with inconsistent archives %s", (counter, sequences) => {
      expect(() => verifySeriesPosition("TSH-INV", counter as number, sequences as number[])).toThrow();
    });
  it("checks archived bytes and the canonical number, refusing pre-series mappings", () => {
    const pdf = Buffer.from("%PDF-1.7\nsynthetic");
    const row = { series: "TSH-INV" as const, sequence: 1, number: "TSH-INV-00001", pdf,
      sha256: createHash("sha256").update(pdf).digest("hex") };
    expect(() => verifyFinancialArchive(row)).not.toThrow();
    expect(() => verifyFinancialArchive({ ...row, pdf: Buffer.from("%PDF-changed") })).toThrow();
    expect(() => verifyFinancialArchive({ ...row, number: "INV-OLD" })).toThrow();
    expect(() => verifyFinancialArchive({ ...row, sequence: 2 })).toThrow();
  });
});
