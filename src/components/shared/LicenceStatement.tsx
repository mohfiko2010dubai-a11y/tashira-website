import {Link} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {trpc} from '@/providers/trpc-client';
import {nonAffiliation,footerNonAffiliation} from '@contracts/licence-profile';
export default function LicenceStatement({compact=false,footer=false}:{compact?:boolean;footer?:boolean}){
 const {i18n}=useTranslation();const ar=i18n.language.startsWith('ar');const {data}=trpc.business.licence.useQuery(undefined,{staleTime:0,refetchInterval:60000});
 if(!data)return null;const expired=data.expiry.status==='expired';const activity=data.profile.activities.find(a=>a.code==='8299.98');
 const activityName=ar?(activity?.ar==='انجاز المعاملات الحكومية الكترونيا'?'إنجاز المعاملات الحكومية إلكترونيًا':activity?.ar):activity?.en;
 if(compact)return <div className="max-w-[240px] text-[11px] leading-snug" data-licence-statement><Link to="/verify" className="underline underline-offset-2">{activityName}</Link></div>;
 const line=expired?(ar?`الرخصة ${data.profile.licence} قيد التجديد`:`Licence ${data.profile.licence} under renewal`):!activity?(ar?`رخصة ${data.profile.licence}`:`Licence ${data.profile.licence}`):footer?(ar?`(رخصة تجارية ${data.profile.licence}، مرخّصة لـ${activityName})`:`(Commercial Licence ${data.profile.licence}, licensed for ${activityName})`):(ar?`مرخّص: ${activityName} · رخصة ${data.profile.licence}`:`Licensed: ${activityName} · Licence ${data.profile.licence}`);
 return <div className="my-4 space-y-2 text-sm" data-licence-statement>
 <Link to="/verify" className="underline underline-offset-2">{line}</Link>
 <p className="mt-1">{footer?(ar?footerNonAffiliation.ar:footerNonAffiliation.en):(ar?nonAffiliation.ar:nonAffiliation.en)}</p>
 </div>;
}
