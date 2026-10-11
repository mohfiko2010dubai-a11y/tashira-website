import { describe, expect, it } from 'vitest';
import { parseManualMovement } from './manual-movement-verification';
const expected = { reference: 'pi_test', direction: 'TOP_UP' as const, amountMinor: 3000, currency: 'USD' };
const paid = { id: 'pi_test', status: 'succeeded', livemode: false, amount: 3000, amount_received: 3000, currency: 'usd', metadata: { referenceNumber: 'TEST-ORDER' } };
describe('manual Stripe movement evidence', () => {
  it('reads a completed exact payment', () => expect(parseManualMovement(paid, expected, false).paymentIntentId).toBe('pi_test'));
  it.each([{id:'pi_other'}, {status:'processing'}, {livemode:true}, {amount:2999}, {amount_received:0}, {currency:'aed'}])('rejects mismatched evidence %j', change => {
    expect(() => parseManualMovement({...paid,...change},expected,false)).toThrow();
  });
  it('does not confuse a payment with a refund', () => expect(() => parseManualMovement(paid,{...expected,direction:'REFUND'},false)).toThrow());
  it('binds a confirmed refund to its original payment', () => {
    const refund={id:'re_test',status:'succeeded',livemode:false,amount:3000,currency:'usd',payment_intent:'pi_original'};
    expect(parseManualMovement(refund,{...expected,reference:'re_test',direction:'REFUND'},false).paymentIntentId).toBe('pi_original');
  });
  it('rejects fractional minor units', () => expect(() => parseManualMovement({...paid,amount:0.5,amount_received:0.5},{...expected,amountMinor:0.5},false)).toThrow());
});
