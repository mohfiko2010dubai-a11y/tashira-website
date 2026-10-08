import { useState } from 'react';
import { trpc } from '@/providers/trpc-client';

export default function SupplierSelectionPanel({ referenceNumber, onSaved }: { referenceNumber: string; onSaved: () => Promise<void> }) {
  const query = trpc.application.supplierOptions.useQuery({ referenceNumber });
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const save = trpc.application.selectSupplier.useMutation();
  const current = query.data?.currentSupplierId ?? null;
  const value = selected ?? current;
  return <section className="rounded-2xl border bg-white p-5" aria-labelledby="supplier-heading">
    <h2 id="supplier-heading" className="text-lg font-bold">المورد / جهة التقديم</h2>
    <p className="mt-2 text-sm text-slate-600">اختر المورد الذي سيتولى الطلب، أو جهة الهجرة عند التقديم المباشر. حفظ الاختيار لا يعني إرسال المستندات أو تقديم الطلب.</p>
    {query.isLoading && <p role="status">جارٍ تحميل الموردين…</p>}
    {query.isError && <p role="alert">تعذر تحميل الموردين. <button type="button" className="underline" onClick={() => void query.refetch()}>إعادة المحاولة</button></p>}
    {query.data && <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={async event => {
      event.preventDefault();
      if (!value) { setMessage('اختر المورد أولًا ثم اضغط حفظ المورد.'); return; }
      setMessage('');
      try {
        await save.mutateAsync({ referenceNumber, supplierId: value, expectedSupplierId: current });
        setSelected(null);
        await query.refetch();
        await onSaved();
        setMessage('تم حفظ المورد على الطلب.');
      } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر حفظ المورد. حدّث الطلب ثم حاول مجددًا.'); }
    }}>
      <label className="min-w-0 flex-1 font-medium">اسم المورد أو جهة الهجرة
        <select required className="mt-2 block w-full rounded-lg border bg-white p-3" value={value ?? ''} disabled={save.isPending} onChange={event => { setSelected(Number(event.target.value) || null); setMessage(''); }}>
          <option value="">اختر المورد…</option>
          {current && !query.data.options.some(option => option.id === current) && <option value={current}>المورد الحالي غير نشط — اختر بديلًا</option>}
          {query.data.options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
      </label>
      <button type="submit" disabled={save.isPending || query.data.options.length === 0} className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-50">{save.isPending ? 'جارٍ الحفظ…' : 'حفظ المورد'}</button>
      {!query.data.options.length && <p className="w-full text-sm">لا يوجد موردون نشطون. اطلب من المدير إضافة المورد إلى قائمة الموردين.</p>}
    </form>}
    <p role={save.isError ? 'alert' : 'status'} className="mt-3 text-sm">{message}</p>
  </section>;
}
