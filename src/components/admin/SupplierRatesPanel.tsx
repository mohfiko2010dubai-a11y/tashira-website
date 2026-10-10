import { useState } from 'react';
import { trpc } from '@/providers/trpc-client';
import { aedAmount, aedMinorUnits, supplierRateInput, supplierVatStatus, type SupplierRateInput } from '@contracts/supplier-rates';

export default function SupplierRatesPanel({ supplierId, name, onClose }: { supplierId: number; name: string; onClose: () => void }) {
  const query = trpc.supplier.rates.useQuery({ supplierId });
  const products = trpc.catalog.adminProducts.useQuery();
  const save = trpc.supplier.saveRate.useMutation();
  const [serviceCode, setServiceCode] = useState('');
  const [processingType, setProcessingType] = useState<'regular' | 'express'>('regular');
  const [form, setForm] = useState<Pick<SupplierRateInput, 'costAed' | 'vatAmountAed' | 'placeOfSupply' | 'active' | 'reason'> & { vatStatus: SupplierRateInput['vatStatus'] | '' }>({ costAed: '', vatAmountAed: '0', vatStatus: '', placeOfSupply: 'within_uae', active: true, reason: '' });
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState('');
  function choose(code: string, speed: 'regular' | 'express') {
    const row = query.data?.find(item => item.serviceCode === code && item.processingType === speed);
    setServiceCode(code); setProcessingType(speed); setVersion(row?.version ?? 0);
    setForm({ costAed: row?.costAed ?? '', vatAmountAed: row?.vatAmountAed ?? '0', vatStatus: row?.vatStatus ?? '',
      placeOfSupply: row?.placeOfSupply ?? 'within_uae', active: row?.active ?? true, reason: '' });
    setMessage('');
  }
  const parsed = supplierRateInput.safeParse({ supplierId, serviceCode, processingType, expectedVersion: version, ...form });
  const total = parsed.success ? aedAmount(aedMinorUnits(form.costAed) + aedMinorUnits(form.vatAmountAed)) : '—';
  const inputClass = 'mt-1 block w-full rounded-lg border p-2';
  return <section dir="rtl" className="my-5 rounded-xl border bg-white p-5" aria-labelledby="supplier-rates-heading">
    <div className="flex items-center justify-between gap-4"><h2 id="supplier-rates-heading" className="text-lg font-bold">قائمة أسعار {name}</h2><button type="button" onClick={onClose} className="underline">إغلاق</button></div>
    <p className="mt-2 text-sm text-slate-600">تكلفة التأشيرة للمسافر الواحد بالدرهم. أدخل ضريبة المورد كما في عرضه المعتمد؛ لا تظهر هذه الأسعار للموظف أو العميل. حفظ سعر جديد لا يغيّر الطلبات السابقة.</p>
    {(query.isLoading || products.isLoading) && <p role="status">جارٍ تحميل الأسعار…</p>}
    {(query.isError || products.isError) && <p role="alert">تعذر تحميل الأسعار. <button className="underline" onClick={() => { void query.refetch(); void products.refetch(); }}>أعد التحميل</button></p>}
    {query.data && products.data && <>
      <div className="my-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-start"><th>التأشيرة</th><th>الخدمة</th><th>التكلفة</th><th>الضريبة</th><th>الإجمالي AED</th><th>الحالة</th><th>التعديل</th></tr></thead>
        <tbody>{query.data.map(row => <tr key={row.id} className="border-b"><td className="py-3">{row.serviceCode}</td><td>{row.processingType === 'express' ? 'مستعجل' : 'عادي'}</td><td>{row.costAed}</td><td>{row.vatAmountAed}</td><td>{row.totalAed}</td><td>{row.active ? 'متاح' : 'موقوف'}</td><td><button className="underline" type="button" onClick={() => choose(row.serviceCode, row.processingType)}>تعديل السعر</button></td></tr>)}</tbody></table>
        {!query.data.length && <p className="py-4">لم تُضف أسعار لهذا المورد. اختر التأشيرة وأدخل تكلفتها أدناه.</p>}
      </div>
      <form onSubmit={async event => {
        event.preventDefault();
        if (!parsed.success) { setMessage(parsed.error.issues[0]?.message ?? 'راجع بيانات السعر ثم أعد الحفظ.'); return; }
        try { const result = await save.mutateAsync(parsed.data); await query.refetch(); setVersion(result.version); setForm(current => ({ ...current, reason: '' })); setMessage('تم حفظ نسخة جديدة من السعر.'); }
        catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر حفظ السعر. حدّث القائمة ثم حاول مرة أخرى.'); }
      }} className="grid gap-4 sm:grid-cols-2">
        <label>نوع التأشيرة<select required className={inputClass} value={serviceCode} onChange={event => choose(event.target.value, processingType)}><option value="">اختر التأشيرة</option>{products.data.map(product => <option key={product.serviceCode} value={product.serviceCode}>{product.serviceCode}{product.isActive ? '' : ' — غير معروضة حاليًا'}</option>)}</select></label>
        <label>الخدمة<select className={inputClass} value={processingType} onChange={event => choose(serviceCode, event.target.value === 'express' ? 'express' : 'regular')}><option value="regular">عادي</option><option value="express">مستعجل</option></select></label>
        <label>التكلفة قبل الضريبة — AED<input required inputMode="decimal" className={inputClass} value={form.costAed} onChange={event => setForm({ ...form, costAed: event.target.value })} /></label>
        <label>المعاملة الضريبية<select required className={inputClass} value={form.vatStatus} onChange={event => setForm({ ...form, vatStatus: event.target.value ? supplierVatStatus.parse(event.target.value) : '', vatAmountAed: '0' })}><option value="">اختر المعاملة الضريبية من عرض المورد</option><option value="out_of_scope">خارج النطاق</option><option value="standard">خاضعة للضريبة</option><option value="zero_rated">صفرية</option><option value="exempt">معفاة</option></select></label>
        <label>مبلغ الضريبة للمسافر — AED<input required inputMode="decimal" className={inputClass} disabled={form.vatStatus !== 'standard'} value={form.vatAmountAed} onChange={event => setForm({ ...form, vatAmountAed: event.target.value })} /></label>
        <label>مكان التوريد<select className={inputClass} value={form.placeOfSupply} onChange={event => setForm({ ...form, placeOfSupply: event.target.value === 'outside_uae' ? 'outside_uae' : 'within_uae' })}><option value="within_uae">داخل الإمارات</option><option value="outside_uae">خارج الإمارات</option></select></label>
        <label className="sm:col-span-2">سبب التحديث / مرجع عرض المورد<input required maxLength={500} className={inputClass} value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })} /></label>
        <label><input type="checkbox" checked={form.active} onChange={event => setForm({ ...form, active: event.target.checked })} /> السعر متاح للطلبات الجديدة</label>
        <p>الإجمالي للمسافر: <strong>{total} AED</strong></p>
        <button disabled={save.isPending} className="rounded-lg bg-slate-900 p-3 text-white disabled:opacity-50">{save.isPending ? 'جارٍ الحفظ…' : 'حفظ السعر'}</button>
      </form>
    </>}
    <p aria-live="polite" className="mt-3">{message}</p>
  </section>;
}
