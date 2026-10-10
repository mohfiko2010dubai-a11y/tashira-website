import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '@/providers/trpc-client';
import { SUPPLIER_STAGES, supplierStageLabels, type SupplierStage } from '../../../contracts/supplier-operations';

export default function SupplierOperationsBoard({ manager = false }: { manager?: boolean }) {
  const [stage, setStage] = useState<SupplierStage>();
  const [search, setSearch] = useState('');
  const [includeTest, setIncludeTest] = useState(false);
  const [offset, setOffset] = useState(0);
  const query = trpc.supplier.operations.useQuery({ stage, search, includeTest, offset, limit: 30 }, { retry: false });
  const counts = query.data?.counts ?? {};
  const total = stage ? counts[stage] ?? 0 : Object.values(counts).reduce((sum, count) => sum + count, 0);
  const date = (value: string | null) => value ? new Date(value).toLocaleString('ar-AE', { timeZone: 'Asia/Dubai' }) : 'لم يُسجّل';
  return <section dir="rtl" lang="ar" className="space-y-4">
    <div className="rounded-xl border bg-white p-4"><h2 className="text-xl font-bold">عمليات الموردين والهجرة</h2>
      <p className="mt-2 text-sm text-slate-600">افتح الطلب لمراجعة المستندات، تسجيل الإرسال أو رفع التأشيرة. اختيار المورد وحده لا يعني إرسال المستندات.</p>
      <p className="mt-1 text-sm text-slate-600">اكتمال ملفات التأشيرات يتيح مراجعة الفاتورة؛ لا يثبت إرسال التأشيرات للعميل أو سداد المورد.</p>
    </div>
    <div role="group" aria-label="مراحل المورد" className="flex flex-wrap gap-2">
      <button type="button" aria-pressed={!stage} className={`rounded-lg border px-3 py-2 ${!stage ? 'bg-slate-900 text-white' : 'bg-white'}`} onClick={() => { setStage(undefined); setOffset(0); }}>كل العمليات</button>
      {SUPPLIER_STAGES.map(value => <button key={value} type="button" aria-pressed={stage === value}
        className={`rounded-lg border px-3 py-2 ${stage === value ? 'bg-slate-900 text-white' : 'bg-white'}`}
        onClick={() => { setStage(value); setOffset(0); }}>{supplierStageLabels[value]} ({counts[value] ?? 0})</button>)}
    </div>
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
      <label className="grid gap-1 text-sm">رقم الطلب أو اسم المورد<input className="rounded-lg border px-3 py-2" value={search} onChange={event => { setSearch(event.target.value); setOffset(0); }} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeTest} onChange={event => { setIncludeTest(event.target.checked); setOffset(0); }} />إظهار الطلبات التجريبية</label>
      <button type="button" className="rounded-lg border px-3 py-2" onClick={() => void query.refetch()}>تحديث</button>
    </div>
    {query.isLoading ? <p role="status">جارٍ تحميل العمليات…</p> : query.isError ? <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4">تعذر تحميل القائمة. اضغط تحديث، وإذا استمرت المشكلة راجع صلاحيات حسابك مع المدير.</p> : <>
      <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[850px] text-start text-sm">
        <thead className="bg-slate-100"><tr>{['الطلب', 'المورد / التأشيرة', 'المرحلة', 'التأشيرات المرفوعة', 'مرجع التقديم', 'موعد المتابعة', ...(manager ? ['التكلفة / الضريبة / الإجمالي', 'فاتورة المورد'] : []), 'الإجراء'].map(label => <th className="p-3 text-start" key={label}>{label}</th>)}</tr></thead>
        <tbody>{query.data?.items.map(row => <tr key={row.applicationId} className="border-t align-top">
          <td className="p-3"><span dir="ltr">{row.reference}</span>{row.isTest && <span className="block text-amber-700">طلب تجريبي</span>}</td>
          <td className="p-3">{row.supplierName}<span className="block text-slate-500">{row.product}</span></td>
          <td className="p-3">{supplierStageLabels[row.stage]}<span className="block text-xs text-slate-500">{row.authorityFiledAt ? `التقديم: ${date(row.authorityFiledAt)}` : row.supplierSentAt ? `الإرسال: ${date(row.supplierSentAt)}` : ''}</span></td>
          <td className="p-3">{row.visaCount} / {row.applicantCount}</td><td className="p-3" dir="ltr">{row.externalReference ?? '—'}</td>
          <td className="p-3">{date(row.followUpAt)}</td>
          {manager && <><td className="p-3">{row.accounting?.supplierTotalAed == null ? 'لم تُحدد التكلفة' : <><span className="block">التكلفة: {row.accounting.supplierCostAed ?? 'غير محددة'} AED</span><span className="block">الضريبة: {row.accounting.supplierVatAmount ?? 'غير محددة'} AED</span><strong>الإجمالي: {row.accounting.supplierTotalAed} AED</strong></>}</td>
            <td className="p-3">{row.accounting?.supplierInvoiceNumber || 'لم تُسجّل فاتورة'}<span className="block">{row.accounting?.supplierPaid === 'paid' ? 'مسجلة كمدفوعة' : 'لم يُسجّل السداد'}</span></td></>}
          <td className="p-3"><Link className="inline-block rounded-lg bg-slate-900 px-3 py-2 text-white" to={manager ? `/admin/applications/${encodeURIComponent(row.reference)}` : `/staff/operations/${encodeURIComponent(row.reference)}?tab=submission&from=suppliers`}>فتح الطلب</Link></td>
        </tr>)}</tbody>
      </table>{!query.data?.items.length && <p className="p-8 text-center text-slate-500">لا توجد عمليات ضمن هذه القائمة والصلاحيات الحالية.</p>}</div>
      <div className="flex items-center justify-between gap-3"><span aria-live="polite">{total} عملية مطابقة — المعروض {query.data?.items.length ?? 0}</span>
        <div className="flex gap-2"><button disabled={offset === 0} className="rounded-lg border p-2 disabled:opacity-40" onClick={() => setOffset(Math.max(0, offset - 30))}>السابق</button><button disabled={offset + 30 >= total} className="rounded-lg border p-2 disabled:opacity-40" onClick={() => setOffset(offset + 30)}>التالي</button></div>
      </div>
    </>}
  </section>;
}
