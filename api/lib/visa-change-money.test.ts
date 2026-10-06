import { describe, expect, it } from "vitest";
import { visaChangeAmount } from "../../contracts/visa-change-money";
describe("visa-change difference", () => {
  it.each([[185, 215, 3000, "PAY"], [215, 185, -3000, "REFUND"], [185, 185, 0, "NONE"], [370, 430, 6000, "PAY"]] as const)("compares complete order totals %s and %s", (oldTotal, newTotal, differenceMinor, direction) => {
      expect(visaChangeAmount(oldTotal, newTotal, "usd", "USD")).toMatchObject({ differenceMinor, direction });
    });
  it.each([NaN, Infinity, -1, 1.001, Number.MAX_SAFE_INTEGER])("refuses invalid money %s", value => {
    expect(() => visaChangeAmount(185, value, "USD", "USD")).toThrow();
  });
  it("does not compare different currencies", () => expect(() => visaChangeAmount(185, 700, "USD", "AED")).toThrow());
});
