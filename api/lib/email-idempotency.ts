import { createHash } from 'node:crypto';

export function paymentSuccessEmailIdempotencyKey(input: { applicationId: number; paymentId: number }) {
  return `payment-success/${input.applicationId}/${input.paymentId}`;
}

export function refundOutcomeEmailIdempotencyKey(refundCaseId: string, completedItemIds?: readonly string[]) {
  const base = `refund-case/${refundCaseId}`;
  return completedItemIds ? `refund-outcome/${createHash('sha256').update(JSON.stringify([refundCaseId, [...completedItemIds].sort()])).digest('hex')}` : base;
}
