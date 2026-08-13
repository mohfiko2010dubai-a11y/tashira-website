export type PaymentViewState = "checkout" | "confirming" | "confirmed";

export function paymentViewState(input: {
  paymentStatus: "pending" | "paid" | "failed";
  browserConfirmed: boolean;
  confirmationPending: boolean;
}): PaymentViewState {
  if (input.paymentStatus === "paid" || input.browserConfirmed) return "confirmed";
  if (input.confirmationPending) return "confirming";
  return "checkout";
}
