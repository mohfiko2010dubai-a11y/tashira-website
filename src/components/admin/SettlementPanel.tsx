import {trpc} from '@/providers/trpc-client';
import {formatFeeMinor} from './application-display';

export default function SettlementPanel({applicationId}:{applicationId:number}){
  const report=trpc.business.settlementReport.useQuery({applicationId});
  const reconcile=trpc.business.reconcileSettlement.useMutation({onSuccess:()=>{void report.refetch();}});
  return <section dir="rtl" className="space-y-4 rounded-xl border bg-white p-5">
    <div><h2 className="text-lg font-bold">مطابقة التحصيل والاسترداد</h2>
      <p className="mt-1 text-sm text-slate-600">مطابقة للقراءة من Stripe فقط؛ لا تخصم أو ترد أموالًا. التأمين المسترد منفصل عن إيراد خدمة التأشيرة.</p></div>
    {report.isLoading&&<p role="status">جارٍ تحميل الحركات…</p>}
    {report.error&&<p role="alert">تعذر تحميل المطابقة. <button className="underline" onClick={()=>{void report.refetch();}}>أعد المحاولة</button></p>}
    {report.data&&<>
      <p role="status">{report.data.missing?`${report.data.missing} حركات تحتاج مطابقة. الإجماليات أدناه تشمل الحركات المطابقة فقط.`:'كل الحركات الناجحة المسجلة في الطلب مطابقة.'}</p>
      {!report.data.rows.length&&<p>لا توجد دفعات أو استردادات ناجحة مسجلة لهذا الطلب.</p>}
      {report.data.rows.map(row=><div key={`${row.kind}:${row.id}`} className="rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold">{row.kind==='PAYMENT'?'دفعة':'استرداد'}: {formatFeeMinor(row.amountMinor,row.currency)}</p>
          <button disabled={reconcile.isPending} className="min-h-11 rounded-lg border px-4 disabled:opacity-50" onClick={()=>reconcile.mutate({applicationId,kind:row.kind,id:row.id})}>{row.settlement?'إعادة التحقق من Stripe':'مطابقة مع Stripe'}</button></div>
        {row.settlement?<dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div><dt>حركة الرصيد</dt><dd>{formatFeeMinor(row.settlement.grossMinor,row.settlement.currency)}</dd></div>
          <div><dt>رسوم الحركة</dt><dd>{formatFeeMinor(row.settlement.feeMinor,row.settlement.currency)}</dd></div>
          <div><dt>صافي حركة الرصيد</dt><dd>{formatFeeMinor(row.settlement.netMinor,row.settlement.currency)}</dd></div>
        </dl>:<p className="mt-2 text-amber-800">لم تُطابق بعد؛ لا تدخل في إجمالي التسوية.</p>}
      </div>)}
      {report.data.totals.map(total=><p key={total.currency} className="rounded-lg bg-slate-50 p-3">صافي الحركات المطابقة ({total.currency}): <strong>{formatFeeMinor(total.netMinor,total.currency)}</strong></p>)}
      <p className="text-sm">تكلفة المورد شاملة الضريبة: {report.data.supplier.totalAed===null?'غير مسجلة':`${report.data.supplier.totalAed} AED`} · فاتورة المورد: {report.data.supplier.invoiceNumber??'لم تُسجل'} · {report.data.supplier.paid?'مسدد للمورد':'لم يسجل سداد المورد'}</p>
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">صافي رصيد Stripe ليس الربح النهائي. يلزم استكمال فواتير المورد والتكاليف وتسوية الضريبة؛ العملات المختلفة لا تُجمع في رقم واحد.</p>
    </>}
    <div aria-live="polite">{reconcile.isPending&&<p>جارٍ التحقق من Stripe…</p>}{reconcile.isSuccess&&<p className="text-emerald-800">تمت مطابقة الحركة.</p>}{reconcile.error&&<p role="alert" className="text-red-700">{reconcile.error.message}</p>}</div>
  </section>;
}
