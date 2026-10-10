import { describe, expect, it } from 'vitest';
import { refundRequestIdentity } from './refund-request-identity';
describe('persisted refund request identity', () => {
  const visa = { sourceType: 'VISA_SERVICE', paymentId: 4, requestedAmount: 25, deduction: { type: 'NONE' } };
  it('matches persisted decimal representations and item order without losing payment identity', () => {
    const deposit = { sourceType: 'SECURITY_DEPOSIT', securityDepositPaymentId: 'deposit', requestedAmount: 10, deduction: { type: 'FIXED', value: 1 } };
    expect(refundRequestIdentity([visa, deposit])).toBe(refundRequestIdentity([{ ...deposit, requestedAmount: '10.00', deduction: { type: 'FIXED', value: '1.0000' } }, { ...visa, requestedAmount: '25.00', deduction: { type: 'NONE', value: '0.0000' } }]));
    expect(refundRequestIdentity([{ ...visa, requestedAmount: 2.675 }])).toBe(refundRequestIdentity([{ ...visa, requestedAmount: '2.68' }]));
    for (const changed of [{ ...visa, paymentId: 5 }, { ...visa, requestedAmount: 26 }, { ...visa, deduction: { type: 'FIXED', value: 1 } }]) expect(refundRequestIdentity([changed])).not.toBe(refundRequestIdentity([visa]));
  });
});
