import {useState} from 'react';
import {trpc} from '@/providers/trpc-client';
import {visaLabel} from './application-display';
const mailLabels:Record<string,string>={PENDING:'في قائمة الإرسال',SENDING:'جارٍ الإرسال',SENT:'أُرسل عبر مزود البريد',FAILED:'تعذر الإرسال',SUPPRESSED:'لم يُرسل — يحتاج مراجعة'};
const date=(value:string)=>new Date(value).toLocaleString('ar-AE');
export default function VisaChangeProgress({referenceNumber}:{referenceNumber:string}){
 const query=trpc.application.visaChangeProgress.useQuery({referenceNumber},{refetchInterval:10000});
 const link=trpc.application.createDifferenceLink.useMutation();const [message,setMessage]=useState('');
 if(query.isError)return <p role="alert">تعذر تحميل مراحل التعديل والفواتير. <button onClick={()=>void query.refetch()}>إعادة المحاولة</button></p>;
 if(!query.data)return <p role="status">جارٍ تحميل مراحل التعديل والفواتير…</p>;
 const {quote:q,events,mail,documents}=query.data;
 const money=(minor:number)=>`${(minor/100).toFixed(2)} ${q?.currency||'USD'}`;
 const answer=events.find(e=>e.action==='REFUSED'||e.action==='ACKNOWLEDGED');
 const email=(kind:string)=>{const row=mail.find(m=>m.kind===kind);return row?`${row.status==='SUPPRESSED'&&kind==='PROPOSAL'&&q?.state!=='PROPOSED'?'لم تُرسل رسالة قديمة بعد تسجيل رد العميل':mailLabels[row.status]||row.status} · ${date(row.at)}`:kind==='PROPOSAL'&&q&&q.state!=='PROPOSED'?'لا يوجد سجل إرسال للمقترح؛ رد العميل مسجّل أدناه.':'بانتظار إنشاء رسالة الإرسال';};
 return <section dir="rtl" className="space-y-5 rounded-2xl border bg-white p-5" aria-label="متابعة تعديل التأشيرة والفواتير">
 <h2 className="text-xl font-bold">مراحل التعديل والفواتير</h2>
 {q?<>
 <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4">السعر السابق · {visaLabel(q.previousProduct)}<strong className="block">{money(q.oldTotalMinor)}</strong></div><div className="rounded-xl bg-slate-50 p-4">السعر الجديد · {visaLabel(q.replacementProduct)}<strong className="block">{money(q.newTotalMinor)}</strong></div><div className="rounded-xl bg-amber-50 p-4">{q.differenceMinor>0?(q.state==='SETTLED'?'فرق السعر — تم سداده':'المطلوب من العميل'):q.differenceMinor<0?'المبلغ المسترد للعميل':'لا يوجد فرق'}<strong className="block">{money(Math.abs(q.differenceMinor))}</strong></div></div>
 <article className="rounded-xl border p-4"><h3 className="font-bold">١. إرسال مقترح التعديل للعميل</h3><p>{email('PROPOSAL')}</p><p className="text-sm">يفتح العميل الرابط لمراجعة السعرين والفرق، ثم يوافق أو يرفض. حالة الإرسال لا تعني أنه قرأ الرسالة.</p></article>
 <article className="rounded-xl border p-4"><h3 className="font-bold">٢. رد العميل</h3><p>{q.state==='PROPOSED'?'بانتظار موافقة العميل':q.state==='REFUSED'?'رفض العميل التعديل':'وافق العميل على التعديل'}{answer?` · ${date(answer.at)}`:''}</p>{q.state==='REFUSED'&&answer?.reason&&<p>سبب الرفض: {answer.reason}</p>}</article>
 <article className="space-y-3 rounded-xl border p-4"><h3 className="font-bold">٣. {q.differenceMinor<0?'رد فرق السعر':'دفع فرق السعر'}</h3>
 {q.state==='SETTLED'?<p className="text-emerald-800">{q.differenceMinor===0?'لا يوجد فرق للدفع. يمكن متابعة المورد والتقديم.':'تمت تسوية الفرق. يمكن متابعة المورد والتقديم.'}</p>:q.differenceMinor>0?<>
 <p>{q.state==='PROPOSED'?'الخطوة التالية: انتظار موافقة العميل؛ بعدها يتاح إرسال رابط الدفع.':q.state==='REFUSED'?'العميل رفض المقترح؛ لا يُطلب منه دفع الفرق.':q.paymentLink?'بانتظار دفع العميل عبر Stripe.':'الخطوة التالية: إنشاء وإرسال رابط دفع الفرق.'}</p>
 <button className="min-h-11 rounded-lg bg-slate-900 px-4 text-white disabled:opacity-50" disabled={link.isPending||q.state!=='ACCEPTED'||!!q.paymentLink} onClick={async()=>{try{await link.mutateAsync({referenceNumber,quoteId:q.id,version:q.version});await query.refetch();setMessage('تم إنشاء الرابط ووضع رسالة العميل في قائمة الإرسال.');}catch(error){setMessage(error instanceof Error?error.message:'تعذر إنشاء الرابط.');}}}>{link.isPending?'جارٍ إنشاء الرابط…':'إنشاء وإرسال رابط دفع الفرق'}</button>
 {q.paymentLink&&<div><a className="underline" href={q.paymentLink} target="_blank" rel="noreferrer">فتح رابط دفع الفرق</a><p>رسالة رابط الدفع: {email('LINK')}</p></div>}
 <p className="text-sm">بعد الدفع يؤكد Stripe التحصيل وتصدر فاتورة الفرق تلقائيًا؛ لا يلزم تأكيد دفع يدوي.</p>
 </>:q.differenceMinor<0?<p>{q.state==='PROPOSED'?'بانتظار موافقة العميل على رد الفرق.':q.state==='REFUSED'?'رفض العميل المقترح؛ راجع الحل معه قبل أي استرداد.':'بانتظار تنفيذ الاسترداد وتسجيل تسويته من الإجراء أدناه.'}</p>:<p>لا يلزم رابط دفع؛ بانتظار رد العميل.</p>}
 </article></>:<p>لم يُحفظ مقترح تعديل بعد. اختر النوع أعلاه لعرض السعر والفرق، ثم أرسل المقترح.</p>}
 {q?.state==='SETTLED'&&q.paymentLink&&<p><a className="underline" href={q.paymentLink} target="_blank" rel="noreferrer">رابط دفعة الفرق المسددة</a> · رسالة الرابط: {email('LINK')}</p>}
 <article className="space-y-3 rounded-xl border p-4"><h3 className="font-bold">٤. الفواتير والإشعارات الدائنة</h3>
 {documents.length===0&&<p>لا توجد مستندات مالية صادرة بعد.</p>}
 {documents.map(d=><div key={d.number} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3"><div><strong>{d.kind==='ORIGINAL'?'الفاتورة الأصلية':d.kind==='CREDIT'?'إشعار دائن — استرداد':'فاتورة فرق التأشيرة'} · {d.number}</strong><p>{d.amount?.toFixed(2)} {d.currency} · {d.kind==='CREDIT'?'استرداد موثق':'دفعة مؤكدة'} · {date(d.issuedAt)}</p></div><div className="flex gap-4"><a className="underline" target="_blank" rel="noreferrer" href={`/invoices/${encodeURIComponent(d.number)}/view`}>عرض PDF</a><a className="underline" href={`/invoices/${encodeURIComponent(d.number)}/download`}>تنزيل PDF</a></div></div>)}
 {q&&q.differenceMinor>0&&q.state!=='SETTLED'&&<p>فاتورة هذا الفرق تصدر بعد تأكيد الدفع. الفاتورة الأصلية لا تتغير.</p>}
 </article>{message&&<p role="status">{message}</p>}
 </section>;
}
