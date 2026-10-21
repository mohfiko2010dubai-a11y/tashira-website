import {ownershipText,ownershipHtml} from '../../contracts/ownership';
import type {LicenceProfile} from '../../contracts/licence-profile';
const internal=new Set(['APPROVAL_PENDING','GUARANTEE_BREACHED','CONNECTION_BROKEN','SUPPLIER_OVERRIDE','LICENCE_EXPIRY']);
export function isOwnershipCustomerTemplate(template:string){return !internal.has(template);}
export function appendOwnershipEmail<T extends {body:string;html?:string}>(rendered:T,template:string,language:'en'|'ar',ownership?:{host:string;profile:LicenceProfile}){
 if(!isOwnershipCustomerTemplate(template))return rendered;
 if(!ownership)throw new Error('Customer email requires original order ownership');
 const footer=ownershipHtml(ownership.host,ownership.profile,language);
 const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 return {...rendered,body:rendered.body+'\n\n'+ownershipText(ownership.host,ownership.profile,language)+`\n© 2026 ${ownership.host}`,html:rendered.html?rendered.html.replace('</body>',footer+'</body>'):`<!doctype html><html dir="${language==='ar'?'rtl':'ltr'}"><body><p>${escape(rendered.body)}</p>${footer}</body></html>`};
}
