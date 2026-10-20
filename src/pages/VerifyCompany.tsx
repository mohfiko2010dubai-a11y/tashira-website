import LicenceStatement from '@/components/shared/LicenceStatement';
import {useTranslation} from 'react-i18next';
import {trpc} from '@/providers/trpc-client';
import {nonAffiliation} from '@contracts/licence-profile';
export default function VerifyCompany({disclaimers=false}:{disclaimers?:boolean}){
 const {i18n}=useTranslation();const ar=i18n.language.startsWith('ar');const query=trpc.business.licence.useQuery(undefined,{staleTime:0,refetchInterval:60000});const data=query.data;
 return <article className="mx-auto max-w-4xl px-5 pb-16 pt-36" dir={ar?'rtl':'ltr'}>
 <h1 className="text-3xl font-bold">{disclaimers?(ar?'إخلاء المسؤولية':'Disclaimers'):(ar?'التحقق من رخصة الشركة':'Verify our company licence')}</h1>
 <p className="my-5 rounded-xl border border-amber-300 bg-amber-50 p-5 text-lg">{ar?nonAffiliation.ar:nonAffiliation.en}</p>
 {!data?<p role="status">{query.isError?(ar?'تعذر تحميل بيانات الرخصة. حاول لاحقًا.':'Licence details could not be loaded. Try again later.'):(ar?'جارٍ تحميل بيانات الرخصة':'Loading licence details')}</p>:<>
 {data.expiry.status==='expired'&&<p role="alert" className="my-4 rounded border border-red-300 p-4 text-xl">{ar?'الرخصة قيد التجديد — البيانات التالية سجل الرخصة السابقة وليست إثباتًا لسريانها.':'Licence under renewal — the following is the previous licence record, not evidence of current validity.'}</p>}
 {disclaimers&&<LicenceStatement />}
 <h2 className="text-xl font-bold" dir="ltr">{data.profile.legalNameEn}</h2><p className="my-2 text-xl" dir="rtl">{data.profile.legalNameAr}</p>
 <dl className="my-6 grid gap-4 sm:grid-cols-2">{[
 [ar?'رقم الرخصة':'Licence number',data.profile.licence],[ar?'رقم التأسيس':'Formation number',data.profile.formation],
 [ar?'الشكل القانوني':'Legal form',ar?data.profile.legalFormAr:data.profile.legalFormEn],[ar?'جهة الإصدار':'Issuing authority',ar?data.profile.authorityAr:data.profile.authorityEn],
 [ar?'تاريخ الإصدار':'Issue date',data.profile.issuedAt.split('-').reverse().join('/')],[ar?'تاريخ الانتهاء':'Expiry date',data.profile.expiresAt.split('-').reverse().join('/')],
 [ar?'العنوان المسجل':'Registered address',ar?data.profile.addressAr:data.profile.addressEn]].map(([label,value])=><div key={label} className="rounded border p-3"><dt className="text-sm text-slate-600">{label}</dt><dd className="mt-1">{value}</dd></div>)}</dl>
 <h2 className="text-xl font-bold">{ar?'الأنشطة المرخصة':'Licensed activities'}</h2>
 <p className="my-3">{ar?'الحصول على موافقة السلطات المختصة إلزامي لممارسة الأعمال المرخصة.':'Relevant authorities’ approval must be obtained prior to conducting applicable business activities.'}</p>
 <ul className="space-y-3">{data.profile.activities.map(a=><li key={a.code} className="rounded border p-4"><b dir="ltr">{a.code}</b><p dir="ltr">{a.en}</p><p dir="rtl">{a.ar}</p></li>)}</ul>
 <section className="mt-8 rounded-xl border p-5"><h2 className="text-xl font-bold">{ar?'التحقق من تسجيل الشركة':'Verify company registration'}</h2>
 {data.profile.documentPreviewPath&&<a href={data.profile.documentPreviewPath} target="_blank" rel="noopener noreferrer"><img className="my-4 h-auto w-full rounded border" src={data.profile.documentPreviewPath} alt={ar?'الصفحة الأولى من الرخصة الموحدة في دبي، مع رمز التحقق الأصلي':'First page of the Dubai Unified Licence, including its original verification QR'}/></a>}
 <p className="my-3">{ar?'امسح رمز QR أو افتح رابط التحقق أدناه لعرض السجل لدى الجهة الرسمية.':'Scan the QR or open the verification link below to view the official registry record.'}</p>
 {!data.profile.documentPreviewPath&&<img width="256" height="256" src={data.qrDataUrl} alt={ar?'رمز التحقق من تسجيل الشركة':'Company registration verification QR'}/>}
 <a className="inline-block rounded bg-slate-900 px-5 py-3 text-white" href={data.profile.verificationUrl} target="_blank" rel="noopener noreferrer">{ar?'التحقق من تسجيل الشركة':'Verify company registration'}</a></section>
 </>}
 </article>;
}
