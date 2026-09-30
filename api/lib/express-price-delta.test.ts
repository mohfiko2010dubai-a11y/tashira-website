import { describe, expect, it } from "vitest";
import { expressPriceDelta } from "../../contracts/price-delta";
describe("wizard Express difference", () => {
  it.each([[170,200],[185,215],[295,325],[550,580],[265,295],[285,315],[385,415],[145,175]])("matches the catalog pair %s / %s", (regular, express) => {
    expect(expressPriceDelta(regular, express)).toBe(express - regular);
    expect(expressPriceDelta(regular * 3, express * 3)).toBe((express - regular) * 3);
  });
  it("follows a future product-specific price instead of a hard-coded fee", () => {
    expect(expressPriceDelta(170, 207.5)).toBe(37.5);
  });
});
