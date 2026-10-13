import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({read:vi.fn(),record:vi.fn(),fetch:vi.fn()}));
vi.mock('./operations/mysql-query-client',()=>({defaultOperationsPool:()=>({execute:mocks.read})}));
vi.mock('./stripe-runtime',()=>({stripeSecretKey:()=> 'synthetic-test-only',stripeRuntimeMode:()=> 'TEST'}));
vi.mock('./manual-visa-change',()=>({recordDifferenceLink:mocks.record}));
import {createVisaDifferenceLink} from './visa-difference-link';
beforeEach(()=>{vi.resetAllMocks();vi.stubGlobal('fetch',mocks.fetch);mocks.read.mockResolvedValue([[{reference_number:'TEST-1',state:'ACCEPTED',difference_minor:3000,currency:'USD',payment_link:null}]]);});
afterEach(()=>vi.unstubAllGlobals());
it('binds a one-use link to the exact order/quote and stores it only after a matching TEST response',async()=>{
  mocks.fetch.mockResolvedValueOnce({ok:true,json:async()=>({id:'price_test'})}).mockResolvedValueOnce({ok:true,json:async()=>({livemode:false,url:'https://buy.stripe.com/test_example'})});
  await expect(createVisaDifferenceLink(1,'quote',2,7,7)).resolves.toEqual({url:'https://buy.stripe.com/test_example'});
  const body=mocks.fetch.mock.calls[1][1].body as URLSearchParams;
  expect(body.get('payment_intent_data[metadata][referenceNumber]')).toBe('TEST-1');
  expect(body.get('payment_intent_data[metadata][visaChangeQuoteId]')).toBe('quote');
  expect(body.get('restrictions[completed_sessions][limit]')).toBe('1');
  expect(mocks.record).toHaveBeenCalledWith(1,'quote',2,7,'https://buy.stripe.com/test_example',7);
});
it.each(['PROPOSED','SETTLED','REFUSED'])('does not create or mail a link for %s',async state=>{
  mocks.read.mockResolvedValue([[{state,difference_minor:3000,currency:'USD'}]]);
  await expect(createVisaDifferenceLink(1,'quote',2,7)).rejects.toThrow();
  expect(mocks.fetch).not.toHaveBeenCalled();expect(mocks.record).not.toHaveBeenCalled();
});
it('returns the existing link without a second provider request or email',async()=>{
  mocks.read.mockResolvedValue([[{state:'ACCEPTED',difference_minor:3000,currency:'USD',payment_link:'https://buy.stripe.com/test_existing'}]]);
  await expect(createVisaDifferenceLink(1,'quote',2,7)).resolves.toEqual({url:'https://buy.stripe.com/test_existing'});
  expect(mocks.fetch).not.toHaveBeenCalled();expect(mocks.record).not.toHaveBeenCalled();
});
