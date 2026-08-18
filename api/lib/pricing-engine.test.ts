import { describe, expect, it } from "vitest";
import { priceSnapshotMatchesQuote, type PriceQuoteEvidence } from "./price-snapshot-match";

describe("pricing invariants", () => {
  it("keeps all payable calculation on the server module", async () => {
    const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("./pricing-engine.ts", import.meta.url), "utf8"));
    expect(source).toContain("minimum selling price");
    expect(source).toContain("saveApplicationPriceSnapshot");
    expect(source).not.toContain("Math.random");
  });
});

describe("price snapshot retry invariants", () => {
  const quote: PriceQuoteEvidence = {
    pricingRuleId: 4,
    pricingVersion: 1,
    applicantCount: 1,
    unitPrice: 215,
    totalPrice: 215,
    supplierCost: 125,
    internalCost: 10,
    markup: 80,
    minimumSellingPrice: 195,
    currency: "USD",
    exchangeRateToBase: 3.67,
    baseCurrency: "AED",
    totalInBaseCurrency: 789.05,
  };

  it("recognizes an identical immutable snapshot on retry", () => {
    expect(priceSnapshotMatchesQuote({
      pricingRuleId: 4,
      pricingVersion: 1,
      applicantCount: 1,
      unitPrice: "215.00",
      totalPrice: "215.00",
      supplierCost: "125.00",
      internalCost: "10.00",
      markup: "80.00",
      minimumSellingPrice: "195.00",
      currency: "USD",
      exchangeRateToBase: "3.670000",
      baseCurrency: "AED",
      totalInBaseCurrency: "789.05",
    }, quote)).toBe(true);
  });

  it("rejects a retry whose server quote differs from immutable evidence", () => {
    const changed = { ...quote, totalPrice: 216 };
    expect(priceSnapshotMatchesQuote({
      pricingRuleId: 4,
      pricingVersion: 1,
      applicantCount: 1,
      unitPrice: "215.00",
      totalPrice: "215.00",
      supplierCost: "125.00",
      internalCost: "10.00",
      markup: "80.00",
      minimumSellingPrice: "195.00",
      currency: "USD",
      exchangeRateToBase: "3.670000",
      baseCurrency: "AED",
      totalInBaseCurrency: "789.05",
    }, changed)).toBe(false);
  });
});
