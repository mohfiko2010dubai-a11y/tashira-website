export type RefundDeduction =
  | { type: "NONE" }
  | { type: "PERCENTAGE"; value: number }
  | { type: "FIXED"; value: number }
  | { type: "ACTUAL_COSTS"; value: number };

export type RefundCalculation = {
  requestedAmount: number;
  deductionAmount: number;
  refundAmount: number;
};

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateRefund(input: {
  paidAmount: number;
  requestedAmount: number;
  deduction: RefundDeduction;
}): RefundCalculation {
  const { paidAmount, requestedAmount, deduction } = input;
  if (![paidAmount, requestedAmount].every(Number.isFinite) || paidAmount <= 0) {
    throw new Error("Paid amount must be positive");
  }
  if (requestedAmount <= 0 || requestedAmount > paidAmount) {
    throw new Error("Requested refund must be positive and cannot exceed the paid amount");
  }

  let deductionAmount = 0;
  if (deduction.type === "PERCENTAGE") {
    if (!Number.isFinite(deduction.value) || deduction.value < 0 || deduction.value > 100) {
      throw new Error("Deduction percentage must be between 0 and 100");
    }
    deductionAmount = requestedAmount * deduction.value / 100;
  } else if (deduction.type === "FIXED" || deduction.type === "ACTUAL_COSTS") {
    if (!Number.isFinite(deduction.value) || deduction.value < 0) {
      throw new Error("Deduction amount cannot be negative");
    }
    deductionAmount = deduction.value;
  }

  deductionAmount = money(deductionAmount);
  if (deductionAmount > requestedAmount) {
    throw new Error("Deduction cannot exceed the requested refund");
  }
  if (deductionAmount === requestedAmount) {
    throw new Error("A refund must return a positive amount");
  }
  return {
    requestedAmount: money(requestedAmount),
    deductionAmount,
    refundAmount: money(requestedAmount - deductionAmount),
  };
}

export function assertRefundSource(input: {
  sourceType: "VISA_SERVICE" | "SECURITY_DEPOSIT";
  paymentId?: number;
  securityDepositPaymentId?: string;
}) {
  const hasVisaPayment = Number.isInteger(input.paymentId) && Number(input.paymentId) > 0;
  const hasDepositPayment = typeof input.securityDepositPaymentId === "string" && input.securityDepositPaymentId.length > 0;
  if (input.sourceType === "VISA_SERVICE" && (!hasVisaPayment || hasDepositPayment)) {
    throw new Error("Visa-service refunds require only the visa payment");
  }
  if (input.sourceType === "SECURITY_DEPOSIT" && (!hasDepositPayment || hasVisaPayment)) {
    throw new Error("Security-deposit refunds require only the deposit payment");
  }
}
