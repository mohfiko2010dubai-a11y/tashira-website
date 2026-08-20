import { describe, expect, it } from "vitest";
import { verifiedPaymentConversionParameters } from "../../src/lib/google-conversion-decision";

describe("Google Ads verified payment conversion", () => {
  it("uses server-confirmed value, currency, and stable transaction reference", () => {
    expect(verifiedPaymentConversionParameters(
      { conversionId: "AW-123456789", purchaseLabel: "paidVisa" },
      { transactionId: "TSH-123456", value: 170, currency: "usd" },
    )).toEqual({
      send_to: "AW-123456789/paidVisa",
      transaction_id: "TSH-123456",
      value: 170,
      currency: "USD",
    });
  });

  it("does not emit with placeholders, missing IDs, or invalid values", () => {
    expect(verifiedPaymentConversionParameters(
      { conversionId: "AW-XXXXXXXXXX", purchaseLabel: "" },
      { transactionId: "TSH-123456", value: 170, currency: "USD" },
    )).toBeNull();
    expect(verifiedPaymentConversionParameters(
      { conversionId: "AW-123456789", purchaseLabel: "paidVisa" },
      { transactionId: "TSH-123456", value: 0, currency: "USD" },
    )).toBeNull();
  });
});
