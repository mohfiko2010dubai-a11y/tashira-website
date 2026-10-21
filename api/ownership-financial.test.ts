import {describe,it,expect,vi,afterEach} from 'vitest';
import fs from 'node:fs';
import {generateInvoicePDF} from './lib/invoice-pdf';
import {EMAIL_TEMPLATES,renderTransactionalEmail} from './lib/transactional-email';
import {appendOwnershipEmail,isOwnershipCustomerTemplate} from './lib/ownership-email';
import {profile} from './ownership-fixture';
import {recordOrderHost,orderOwnership} from './lib/order-ownership';
import type {PoolConnection} from 'mysql2/promise';
const mocks=vi.hoisted(()=>({execute:vi.fn(),settings:vi.fn()}));
vi.mock('./lib/operations/mysql-query-client',()=>({defaultOperationsPool:()=>({execute:mocks.execute})}));
vi.mock('./lib/company-licence',()=>({companyLicence:()=>mocks.settings()}));
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
const variables={referenceNumber:'TEST-OWNERSHIP',replyText:'Test reply',invoiceNumber:'TEST-PREVIEW',amountPaid:'100',currency:'USD',currentStatus:'paid',invoiceUrl:'https://tashiraev.com/invoice-download/TEST-PREVIEW?expires=9999999999&signature='+'a'.repeat(43),statusLabel:'Received',resumeUrl:'https://tashiraev.com/recover?token=test',otp:'123456',expiresMinutes:'10',amount:'100',purpose:'Test',depositUrl:'https://tashiraev.com/deposit/'+'a'.repeat(43),expiresAt:'2026-12-01',refundSummary:'Confirmed',processingType:'regular',originalProduct:'Original',replacementProduct:'Replacement',actionUrl:'https://tashiraev.com/en/track'};
describe('ownership on financial documents and emails',()=>{
 for(const host of profile.domains!)it('invoice records '+host,()=>{
 const data={company:{version:1,legalName:profile.legalNameEn,address:profile.addressEn,licence:profile.licence,website:host,email:'admin@tashiraev.com',phone:'SHOULD-NOT-PRINT',logo:null},ownership:{host,profile},invoiceNumber:'TEST-PREVIEW',referenceNumber:'TEST-OWNERSHIP',createdAt:'2026-10-21',customerName:'Document preview',customerEmail:'preview@example.invalid',customerPhone:'',passportNumber:'',passportExpiry:'',nationality:'',visaType:'Preview',processingType:'regular',applicantCount:1,unitPriceInBaseCurrency:100,baseCurrency:'AED',exchangeRateToBase:1,totalAmount:100,currency:'AED',payerName:'Preview',payerRelationship:'Self'};
 const pdf=generateInvoicePDF(data);const content=pdf.output();expect(content).toContain(host+' is owned and operated by');expect(content).not.toContain('SHOULD-NOT-PRINT');expect(pdf.getNumberOfPages()).toBe(2);fs.mkdirSync('tmp/ownership-pdf',{recursive:true});fs.writeFileSync(`tmp/ownership-pdf/${host}.pdf`,Buffer.from(pdf.output('arraybuffer')));
 });
 for(const template of EMAIL_TEMPLATES)for(const language of ['ar','en'] as const)it(template+' '+language,()=>{
 vi.stubEnv('PUBLIC_APP_URL','https://tashiraev.com');const base=renderTransactionalEmail(template,{...variables,language});const result=appendOwnershipEmail(base,template,language,{host:'tashiraev.ae',profile});
 if(isOwnershipCustomerTemplate(template)){expect(result.body).toContain('tashiraev.ae');expect(result.body).toContain(profile.legalNameEn);expect(result.html).toContain('data-ownership-statement');expect(appendOwnershipEmail(base,template,language,{host:'tashiraev.ae',profile:{...profile,licence:'UPDATED'}}).body).toContain('UPDATED');}else expect(result).toBe(base);
 });
 it('persists the initiating request host and subsequently reads it, without using another request host',async()=>{
 mocks.settings.mockResolvedValue({profile,version:3});mocks.execute.mockResolvedValue([[]]);const connection={execute:mocks.execute} as unknown as PoolConnection;await recordOrderHost(connection,7,new Request('https://tashiraev.ae/api/trpc/application.create'));expect(mocks.execute).toHaveBeenCalledWith(expect.stringContaining('INSERT'),[7,'tashiraev.ae']);mocks.execute.mockResolvedValue([[{request_host:'tashiraev.ae'}]]);expect((await orderOwnership('TEST-OWNERSHIP'))?.host).toBe('tashiraev.ae');
 });
 it('does not invent an origin for legacy records',async()=>{mocks.execute.mockResolvedValue([[]]);expect(await orderOwnership('OLD')).toBeUndefined();});
});
