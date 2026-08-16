export function paymentSuccessEmailIdempotencyKey(input: { applicationId: number; paymentId: number }) {
  return `payment-success/${input.applicationId}/${input.paymentId}`;
}
