import {describe,it,expect} from 'vitest';
import {ownershipText,ownershipHtml} from '../contracts/ownership';
import {licenceProfileSchema} from '../contracts/licence-profile';
import {renderPageTemplate} from './lib/ssr-html';
import {fixedMetadata} from '../contracts/ssr-pages';
const profile=licenceProfileSchema.parse({domains:['tashiraev.com','tashiraev.ae'],legalNameEn:'TASHIRA E-Visa & Tourism L.L.C-FZ',legalNameAr:'تشيرة',licence:'2541485.01',formation:'2541485',legalFormEn:'LLC-FZ',legalFormAr:'شركة',authorityEn:'Meydan',authorityAr:'ميدان',addressEn:'Meydan Grandstand, 6th Floor, Meydan Road, Nad Al Sheba, Dubai, UAE',addressAr:'Meydan Grandstand، الطابق السادس، شارع ميدان، ند الشبا، دبي',issuedAt:'2025-12-02',expiresAt:'2027-12-01',activities:[{code:'8299.98',en:'Online Government Transactions Processing',ar:'انجاز المعاملات الحكومية الكترونيا'}],verificationUrl:'https://app.invest.dubai.ae/DUL/FJ1704'});
describe('settings-backed ownership',()=>{
 for(const host of profile.domains!)for(const lang of ['ar','en'] as const)it(`${host} ${lang}`,()=>{
 const text=ownershipText(host,profile,lang);expect(text.startsWith(host+' ')).toBe(true);expect(text).toContain(profile.legalNameEn);expect(text).toContain('2541485.01');expect(text).toContain(lang==='ar'?'مرخّصة لإنجاز المعاملات الحكومية إلكترونيًا':'licensed for Online Government Transactions Processing');expect(text).toContain(lang==='ar'?'لسنا موقعًا حكوميًا':'We are not a government website');
 expect(ownershipText(host,{...profile,licence:'CHANGED'},lang)).toContain('CHANGED');const html=ownershipHtml(host,profile,lang);expect(html).toContain(`<bdi dir="ltr">${host}</bdi>`);expect(html).toContain('© 2026');
 const page=renderPageTemplate('<!--PAGE_METADATA--><div id="root"></div>',fixedMetadata('/',lang),undefined,lang,undefined,'https://'+host);expect(page).toContain(`rel="canonical" href="https://${host}/`);expect(page).toContain(`property="og:url" content="https://${host}/`);
 });
 it('rejects an unconfigured host instead of inventing a domain',()=>expect(()=>ownershipText('unrelated.example',profile,'en')).toThrow());
 it('escapes settings and isolates Latin company name in Arabic',()=>{const html=ownershipHtml('tashiraev.com',profile,'ar');expect(html).toContain('<bdi dir="ltr">TASHIRA E-Visa &amp; Tourism L.L.C-FZ</bdi>');expect(html).toContain('dir="rtl"');});
});
