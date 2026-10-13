import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(()=>({read:vi.fn(),write:vi.fn(),prepare:vi.fn(),issue:vi.fn(),notify:vi.fn()}));
vi.mock('./operations/mysql-query-client',()=>({defaultOperationsPool:()=>({execute:mocks.read})}));
vi.mock('./checkout-quote',()=>({withCheckoutLock:(_id:number,fn:(c:{execute:typeof mocks.write})=>unknown)=>fn({execute:mocks.write})}));
vi.mock('./manual-topup-accounting',()=>({prepareAutomaticTopUp:mocks.prepare,issueManualTopUp:mocks.issue,notifyManualTopUp:mocks.notify}));
import {finalizeAutomaticVisaTopUp} from './automatic-visa-topup';
beforeEach(()=>{
  vi.resetAllMocks();mocks.read.mockResolvedValue([[{state:'PAYMENT_PENDING'}]]);
  mocks.prepare.mockResolvedValue({applicationId:7,paymentId:12});mocks.issue.mockResolvedValue('TSH-INV-123');
  mocks.write.mockResolvedValueOnce([[{state:'PAYMENT_PENDING',payment_id:12,version:2,replacement_product:'60days-single'}]]).mockResolvedValue([[]]);
});
it('settles only verified difference payment and creates its invoice before releasing the quote',async()=>{
  await expect(finalizeAutomaticVisaTopUp('TEST-7','quote','pi_topup')).resolves.toEqual({invoiceNumber:'TSH-INV-123',replay:false});
  expect(mocks.prepare).toHaveBeenCalledWith('quote','pi_topup','TEST-7');
  expect(mocks.issue.mock.invocationCallOrder[0]).toBeLessThan(mocks.write.mock.invocationCallOrder[1]);
  expect(mocks.write.mock.calls[1][1]).toEqual(['quote']);
  expect(mocks.notify).toHaveBeenCalledTimes(1);
});
it('replays a duplicate provider event without another invoice or email',async()=>{
  mocks.read.mockResolvedValue([[{state:'SETTLED',stripe_payment_intent_id:'pi_topup',invoice_number:'TSH-INV-123'}]]);
  await expect(finalizeAutomaticVisaTopUp('TEST-7','quote','pi_topup')).resolves.toMatchObject({replay:true});
  expect(mocks.prepare).not.toHaveBeenCalled();expect(mocks.issue).not.toHaveBeenCalled();expect(mocks.notify).not.toHaveBeenCalled();
});
it('rejects another movement against a settled quote',async()=>{
  mocks.read.mockResolvedValue([[{state:'SETTLED',stripe_payment_intent_id:'pi_other',invoice_number:'TSH-INV-123'}]]);
  await expect(finalizeAutomaticVisaTopUp('TEST-7','quote','pi_topup')).rejects.toThrow('another movement');
  expect(mocks.write).not.toHaveBeenCalled();
});
it('does not release the amendment if verification or invoice preparation fails',async()=>{
  mocks.prepare.mockRejectedValue(new Error('amount mismatch'));
  await expect(finalizeAutomaticVisaTopUp('TEST-7','quote','pi_topup')).rejects.toThrow('amount mismatch');
  expect(mocks.write).not.toHaveBeenCalled();expect(mocks.notify).not.toHaveBeenCalled();
});
it('rechecks the reserved payment inside the lock',async()=>{
  mocks.write.mockReset().mockResolvedValueOnce([[{state:'PAYMENT_PENDING',payment_id:99}]]);
  await expect(finalizeAutomaticVisaTopUp('TEST-7','quote','pi_topup')).rejects.toThrow('changed');
  expect(mocks.issue).not.toHaveBeenCalled();
});
