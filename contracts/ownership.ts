import type {LicenceProfile} from './licence-profile';
export function ownershipHost(host: string, profile: LicenceProfile): string {
 const value=host.toLowerCase();
 if(!profile.domains?.includes(value))throw new Error('Request host is not configured in company settings');
 return value;
}
export function ownershipText(host:string,profile:LicenceProfile,language:'en'|'ar'){
 const domain=ownershipHost(host,profile);const activity=profile.activities.find(a=>a.code==='8299.98');
 if(!activity)throw new Error('Licensed activity is missing');
 const arabicActivity=activity.ar==='انجاز المعاملات الحكومية الكترونيا'?'إنجاز المعاملات الحكومية إلكترونيًا':activity.ar;
 return language==='ar'?`${domain} موقع مملوك ومُدار من ${profile.legalNameEn} (رخصة تجارية ${profile.licence}، مرخّصة ${arabicActivity.startsWith("إنجاز")?"ل"+arabicActivity:"لـ"+arabicActivity})، شركة خاصة تقدّم المساعدة في تقديم طلبات تأشيرة الإمارات كطرف ثالث. لسنا موقعًا حكوميًا ولا دائرة هجرة ولا سفارة ولا قنصلية، ولسنا تابعين لأي جهة حكومية. الموافقة ومدد المعالجة والدخول إلى الإمارات قرارات تعود للجهات المختصة وحدها ولا يمكن ضمانها. المقر: ${profile.addressAr}.`:`${domain} is owned and operated by ${profile.legalNameEn} (Commercial Licence ${profile.licence}, licensed for ${activity.en}), a private company providing UAE visa application assistance as a third-party service. We are not a government website, an immigration authority, an embassy or a consulate, and we are not affiliated with any government agency. Approval, processing times and entry into the UAE are decided solely by the competent UAE authorities and cannot be guaranteed. Registered at ${profile.addressEn}.`;
}
export function ownershipHtml(host:string,profile:LicenceProfile,language:'en'|'ar'){
 const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const text=ownershipText(host,profile,language);const parts=text.split(new RegExp('('+[host,profile.legalNameEn,profile.licence].map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','g'));
 return `<div data-ownership-statement dir="${language==='ar'?'rtl':'ltr'}"><p>${parts.map(p=>[host,profile.legalNameEn,profile.licence].includes(p)?`<bdi dir="ltr">${escape(p)}</bdi>`:escape(p)).join('')}</p><p>© 2026 <bdi dir="ltr">${escape(host)}</bdi></p></div>`;
}
