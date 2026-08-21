import { describe, expect, it } from "vitest";
import { assertRefundSource, calculateRefund } from "./refund-domain";

describe("refund domain", () => {
  it("calculates a full refund without a deduction", () => {
    expect(calculateRefund({ paidAmount: 170, requestedAmount: 170, deduction: { type: "NONE" } }))
      .toEqual({ requestedAmount: 170, deductionAmount: 0, refundAmount: 170 });
  });

  it("calculates percentage and fixed deductions without changing the paid amount", () => {
    expect(calculateRefund({ paidAmount: 2500, requestedAmount: 2500, deduction: { type: "PERCENTAGE", value: 2 } }))
      .toEqual({ requestedAmount: 2500, deductionAmount: 50, refundAmount: 2450 });
    expect(calculateRefund({ paidAmount: 2500, requestedAmount: 1000, deduction: { type: "FIXED", value: 125 } }))
      .toEqual({ requestedAmount: 1000, deductionAmount: 125, refundAmount: 875 });
  });

  it("rejects over-refunds and excessive deductions", () => {
    expect(() => calculateRefund({ paidAmount: 170, requestedAmount: 171, deduction: { type: "NONE" } })).toThrow();
    expect(() => calculateRefund({ paidAmount: 170, requestedAmount: 100, deduction: { type: "FIXED", value: 101 } })).toThrow();
    expect(() => calculateRefund({ paidAmount: 170, requestedAmount: 100, deduction: { type: "PERCENTAGE", value: 101 } })).toThrow();
  });

  it("keeps visa and deposit payment ownership mutually exclusive", () => {
    expect(() => assertRefundSource({ sourceType: "VISA_SERVICE", paymentId: 1 })).not.toThrow();
    expect(() => assertRefundSource({ sourceType: "SECURITY_DEPOSIT", securityDepositPaymentId: "deposit-payment" })).not.toThrow();
    expect(() => assertRefundSource({ sourceType: "VISA_SERVICE", paymentId: 1, securityDepositPaymentId: "mixed" })).toThrow();
    expect(() => assertRefundSource({ sourceType: "SECURITY_DEPOSIT", paymentId: 1 })).toThrow();
  });
});
