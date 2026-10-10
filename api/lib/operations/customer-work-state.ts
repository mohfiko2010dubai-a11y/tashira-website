import type { CustomerWaitReason } from '../../../contracts/customer-wait-events';
import type { WorkState } from '../../../contracts/work-queue';

export type CustomerWorkEvidence = {
  status: string;
  open: readonly { waitKey: string; reason: CustomerWaitReason }[];
  quote: null | { id: string; state: string; difference: number; paymentLinkIssued: boolean; refusalResolved: boolean };
};

/** A work-list decision only: never acknowledges consent, settles money or files a visa. */
export function customerWorkState(evidence: CustomerWorkEvidence, previous: WorkState): WorkState {
  if (['completed', 'cancelled', 'rejected'].includes(evidence.status)) return 'DONE';
  if (['visa_processing', 'visa_received'].includes(evidence.status)) return previous;
  const quote = evidence.quote;
  // Refusal is a staff decision to handle, not silence from the customer.
  if (quote?.state === 'REFUSED' && !quote.refusalResolved) return 'READY';
  const unresolved = evidence.open.filter(wait => {
    if (wait.waitKey.startsWith('quote:')) return !quote || (wait.waitKey === `quote:${quote.id}` && quote.state === 'PROPOSED');
    if (wait.waitKey.startsWith('payment:')) return !quote || (wait.waitKey === `payment:${quote.id}` && !['SETTLED', 'SUPERSEDED', 'REFUSED'].includes(quote.state));
    return true;
  });
  if (unresolved.length) return 'WAIT_CUSTOMER';
  // Accepted top-ups stay external waits after issuing their link, until the
  // existing approved settlement completes. An email/reply is not a receipt.
  if (quote && ['ACCEPTED', 'PAYMENT_PENDING'].includes(quote.state) && quote.difference > 0 && quote.paymentLinkIssued) return 'WAIT_CUSTOMER';
  // The employee must issue a link, arrange a refund or review returned files.
  // Keep an actively handled case active; preserve supplier follow-up as well.
  return previous === 'WAIT_CUSTOMER' ? 'READY' : previous;
}
