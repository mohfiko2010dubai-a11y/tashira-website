import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({execute:vi.fn(),quote:vi.fn()}));
vi.mock('./operations/mysql-query-client',()=>({defaultOperationsPool:()=>({execute:mocks.execute})}));
vi.mock('./visa-change-quotes',()=>({currentVisaChangeQuote:mocks.quote}));
import {visaChangeProgress} from './visa-change-progress';
beforeEach(()=>vi.resetAllMocks());
it('scopes every document and event read to the case and current quote',async()=>{mocks.quote.mockResolvedValue({id:'quote-2',version:2});mocks.execute.mockResolvedValueOnce([[{document_number:'TEST-INV-1',kind:'ORIGINAL',amount:'200.00',currency:'USD',issued_at:'2026-10-13'}]]).mockResolvedValueOnce([[]]).mockResolvedValueOnce([[{job_key:'adjustment-link:quote-2',job_status:'FAILED',created_at:'2026-10-13'}]]);const r=await visaChangeProgress(42);expect(r.documents[0]).toMatchObject({number:'TEST-INV-1',amount:200});expect(r.mail[0].status).toBe('FAILED');expect(mocks.execute.mock.calls.map(x=>x[1])).toEqual([[42],[42,2],[42,'substitution:42:2','adjustment-link:quote-2']]);});
it('shows existing invoices before any amendment without fabricating mail or consent',async()=>{mocks.quote.mockResolvedValue(null);mocks.execute.mockResolvedValue([[]]);expect(await visaChangeProgress(42)).toEqual({quote:null,events:[],mail:[],documents:[]});expect(mocks.execute).toHaveBeenCalledTimes(1);});
