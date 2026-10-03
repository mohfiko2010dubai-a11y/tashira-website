import { describe, expect, it } from "vitest";
import { blockedProductNationalities, nationalityProductRules } from "../contracts/nationality-product";

const rules = nationalityProductRules.parse([{ nationality: "SD", product: "30days-multiple", from: "2026-10-01T00:00:00Z", until: "2026-11-01T00:00:00Z" }]);
describe("time-varying nationality by product", () => {
  it("blocks only the affected product and any affected family traveller", () => {
    expect(blockedProductNationalities(rules, "30days-multiple", ["EG", "SD", "SD"], new Date("2026-10-04"))).toEqual(["SD"]);
    expect(blockedProductNationalities(rules, "30days-single", ["SD"], new Date("2026-10-04"))).toEqual([]);
  });
  it("includes start and excludes end, without permanently blocking an expired rule", () => {
    expect(blockedProductNationalities(rules, "30days-multiple", ["SD"], new Date("2026-09-30"))).toEqual([]);
    expect(blockedProductNationalities(rules, "30days-multiple", ["SD"], new Date("2026-10-01"))).toEqual(["SD"]);
    expect(blockedProductNationalities(rules, "30days-multiple", ["SD"], new Date("2026-11-01"))).toEqual([]);
  });
  it("validates windows and supports an explicit all-product row", () => {
    expect(nationalityProductRules.safeParse([{ ...rules[0], until: rules[0].from }]).success).toBe(false);
    expect(blockedProductNationalities([{ ...rules[0], product: "*" }], "14days-single", ["SD"], new Date("2026-10-04"))).toEqual(["SD"]);
  });
});
