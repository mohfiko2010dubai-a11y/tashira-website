import {beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({read:vi.fn(),write:vi.fn(),verify:vi.fn(),prepare:vi.fn(),issue:vi.fn()}));
vi.mock('./operations/mysql-query-client',()=>({defaultOperationsPool:()=>({execute:mock.read})}));
vi.mock('./checkout-quote',()=>({withCheckoutLock:(_id:number,fn:(connection:{execute:typeof mock.write})=>unknown)=>fn({execute:mock.write})}));
vi.mock('./manual-movement-verification',()=>({verifyManualMovement:mock.verify}));
vi.mock('./refund-credit-note',()=>({prepareVisaRefundCreditNote:mock.prepare}));
vi.mock('./financial-document-series',()=>({issueFinancialDocument:mock.issue}));
import {prepareManualRefund} from './manual-refund-accounting';
beforeEach(()=>{
  vi.resetAllMocks();
  mock.read.mockResolvedValue([[{application_id:7,amount_minor:3000,difference_minor:-3000,currency:'USD',stripe_reference:'re_test',quote_id:'quote',kind:'SETTLEMENT',requested_by:2,reason:'Cheaper product'}]]);
  mock.verify.mockResolvedValue({reference:'re_test',paymentIntentId:'pi_original',currency:'USD'});
  mock.write.mockResolvedValueOnce([[{state:'PENDING',quote_state:'ACCEPTED',refund_case_id:null}]])
    .mockResolvedValueOnce([[{id:12,amount:'185.00',currency:'USD'}]])
    .mockResolvedValueOnce([[]]).mockResolvedValueOnce([[{total:'0.00'}]]).mockResolvedValue([{}]);
  mock.prepare.mockResolvedValue({prepared:{number:'TEST-CN-00001'}});
});
describe('manual refund import for visa changes',()=>{
  it('imports the existing provider refund against its invoiced payment, with no second refund request',async()=>{
    const value=await prepareManualRefund('decision');
    expect(value.paymentId).toBe(12);expect(value.refund.id).toBe('re_test');expect(value.refund.amount).toBe(3000);
    expect(mock.prepare.mock.calls[0][1].payment_intent).toBe('pi_original');
    expect(mock.write.mock.calls.some(([sql])=>/INSERT INTO refund_items/.test(sql))).toBe(true);
  });
  it('rejects another application payment before creating accounting records',async()=>{
    mock.write.mockReset().mockResolvedValueOnce([[{state:'PENDING',quote_state:'ACCEPTED',refund_case_id:null}]]).mockResolvedValueOnce([[]]);
    await expect(prepareManualRefund('decision')).rejects.toThrow('does not belong');
    expect(mock.prepare).not.toHaveBeenCalled();
  });
  it('does not overbook a balance already reserved for another refund',async()=>{
    mock.write.mockReset().mockResolvedValueOnce([[{state:'PENDING',quote_state:'ACCEPTED',refund_case_id:null}]]).mockResolvedValueOnce([[{id:12,amount:'185.00',currency:'USD'}]])
      .mockResolvedValueOnce([[]]).mockResolvedValueOnce([[{total:'160.00'}]]);
    await expect(prepareManualRefund('decision')).rejects.toThrow('reserve this balance');
    expect(mock.prepare).not.toHaveBeenCalled();
  });
  it('reuses an already imported refund after an interrupted invoice preparation',async()=>{
    mock.write.mockReset().mockResolvedValueOnce([[{state:'PENDING',quote_state:'REFUND_PENDING',refund_case_id:'case'}]])
      .mockResolvedValueOnce([[{id:12,amount:'185.00',currency:'USD'}]])
      .mockResolvedValueOnce([[{id:'item',refund_case_id:'case',application_id:7,payment_id:12,refund_source_type:'VISA_SERVICE',refund_amount:'30.00',currency:'USD',refund_item_status:'PROCESSING',idempotency_key:'manual:re_test'}]])
      .mockResolvedValueOnce([[{count:1}]]).mockResolvedValue([{}]);
    const value=await prepareManualRefund('decision');expect(value.itemId).toBe('item');
    expect(mock.write.mock.calls.some(([sql])=>/INSERT INTO refund/.test(sql))).toBe(false);
  });
  it('does not write a pending or failed Stripe refund',async()=>{
    mock.verify.mockRejectedValue(new Error('Provider refund not succeeded'));
    await expect(prepareManualRefund('decision')).rejects.toThrow('not succeeded');expect(mock.write).not.toHaveBeenCalled();
  });
});
