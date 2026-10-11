import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({read:vi.fn(),write:vi.fn(),verify:vi.fn(),prepare:vi.fn()}));
vi.mock('./operations/mysql-query-client',()=>({defaultOperationsPool:()=>({execute:mock.read})}));
vi.mock('./checkout-quote',()=>({withCheckoutLock:(_id:number,fn:(connection:{execute:typeof mock.write})=>unknown)=>fn({execute:mock.write})}));
vi.mock('./manual-movement-verification',()=>({verifyManualMovement:mock.verify}));
vi.mock('./invoice-archive',()=>({preparePaidInvoice:mock.prepare,issueVisaChangeInvoice:vi.fn()}));
vi.mock('./pricing-engine',()=>({activeBusinessSettings:async()=>({version:5,vatRegistered:'no',legalName:'Company'})}));
vi.mock('./stripe-runtime',()=>({stripeRuntimeMode:()=> 'TEST'}));
vi.mock('./payment-success-email',()=>({sendPaymentSuccessEmail:vi.fn()}));
vi.mock('./stripe-fee',()=>({captureStripeFee:vi.fn()}));
vi.mock('./application-timeline',()=>({recordTimelineEvent:vi.fn()}));
import {prepareManualTopUp} from './manual-topup-accounting';
beforeEach(()=>{
  vi.resetAllMocks();
  mock.read.mockResolvedValue([[{application_id:7,amount_minor:3000,difference_minor:3000,currency:'USD',stripe_reference:'pi_topup',quote_id:'quote',reference_number:'TEST-7',is_test:1,
    replacement_product:'60days-single',quote_json:{exchangeRateToBase:3.67,baseCurrency:'AED'},
    snapshot_json:{referenceNumber:'TEST-7',customerEmail:'synthetic@example.invalid',totalAmount:185,cardLast4:'1234',payerName:'Original payer'}}]]);
  mock.verify.mockResolvedValue({paymentIntentId:'pi_topup',metadata:{referenceNumber:'TEST-7',visaChangeQuoteId:'quote'}});
  mock.write.mockResolvedValueOnce([[{state:'PENDING',quote_state:'ACCEPTED',payment_id:null}]]).mockResolvedValueOnce([[]]).mockResolvedValueOnce([{insertId:12}]).mockResolvedValue([[]]);
  mock.prepare.mockResolvedValue({amount:'30.00'});
});
describe('manual top-up accounting preparation',()=>{
  it('reserves the verified payment and invoices only the difference with no inherited payer/card claim',async()=>{
    const result=await prepareManualTopUp('decision');
    expect(result.paymentId).toBe(12);
    const input=mock.prepare.mock.calls[0][2];
    expect(input.data.totalAmount).toBe(30);
    expect(input.data.cardLast4).toBeUndefined();
    expect(input.data.payerName).not.toBe('Original payer');
    expect(input.isTest).toBe(true);
    expect(mock.write.mock.calls.some(([sql])=>/UPDATE applications|UPDATE invoices/.test(sql))).toBe(false);
  });
  it.each([{referenceNumber:'OTHER',visaChangeQuoteId:'quote'},{referenceNumber:'TEST-7',visaChangeQuoteId:'old'},{}])('rejects unbound/foreign payment metadata %j',async metadata=>{
    mock.verify.mockResolvedValue({paymentIntentId:'pi_topup',metadata});
    await expect(prepareManualTopUp('decision')).rejects.toThrow('not linked');
    expect(mock.write).not.toHaveBeenCalled();
  });
  it('rejects a payment already used for an original invoice or other quote',async()=>{
    mock.write.mockReset().mockResolvedValueOnce([[{state:'PENDING',quote_state:'ACCEPTED',payment_id:null}]]).mockResolvedValueOnce([[{id:1,application_id:7,amount:'30.00',currency:'USD'}]]);
    await expect(prepareManualTopUp('decision')).rejects.toThrow('already bound');
    expect(mock.prepare).not.toHaveBeenCalled();
  });
  it('reuses a reserved payment after rendering failed without another payment insert',async()=>{
    mock.write.mockReset().mockResolvedValueOnce([[{state:'PENDING',quote_state:'PAYMENT_PENDING',payment_id:12}]]).mockResolvedValueOnce([[{id:12,application_id:7,amount:'30.00',currency:'USD'}]]);
    await prepareManualTopUp('decision');
    expect(mock.write.mock.calls.some(([sql])=>/INSERT INTO payments/.test(sql))).toBe(false);
  });
  it('does not finalize after the proposal changed',async()=>{
    mock.write.mockReset().mockResolvedValueOnce([[]]);
    await expect(prepareManualTopUp('decision')).rejects.toThrow('changed');
    expect(mock.prepare).not.toHaveBeenCalled();
  });
});
