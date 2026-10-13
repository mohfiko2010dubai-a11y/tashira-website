import { useRef, useState } from 'react';
import { trpc } from '@/providers/trpc-client';

export default function CaseDocumentDecision({ applicationId, onReady, onChangeVisa, onSaved }: {
  applicationId: number; onReady(): Promise<void>; onChangeVisa(): void; onSaved(): Promise<void>;
}) {
  const query = trpc.operationsWrite.capabilities.useQuery({ applicationId }, { retry: false });
  const review = trpc.operationsWrite.humanReview.useMutation();
  const utils = trpc.useUtils();
  const [missing, setMissing] = useState(false), [reason, setReason] = useState(''), [message, setMessage] = useState('');
  const key = useRef<{ payload: string; id: string } | null>(null);
  async function save(complete: boolean, changeVisa = false) {
    const outcome = complete ? 'APPROVED_FOR_NEXT_STEP' : 'NEEDS_CORRECTION';
    const detail = changeVisa ? 'تمت مراجعة المستندات؛ يتابع الموظف اقتراح تعديل التأشيرة وموافقة العميل.' : complete ? 'المستندات المطلوبة مكتملة والتأشيرة مناسبة بعد مراجعة الموظف.' : reason.trim();
    const payload = JSON.stringify({ outcome, detail });
    if (key.current?.payload !== payload) key.current = { payload, id: crypto.randomUUID() };
    try {
      await review.mutateAsync({ applicationId, expectedVersion: query.data?.version ?? -1, outcome, reason: detail, idempotencyKey: key.current.id });
      await Promise.all([query.refetch(), onSaved(), utils.operationsWork.overview.invalidate()]);
      setMessage(complete ? 'اكتملت المراجعة.' : 'تم حفظ النواقص وإضافة إشعار العميل إلى قائمة الإرسال. الطلب بانتظار العميل.');
      if (changeVisa) onChangeVisa();
      else if (complete) await onReady();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر الحفظ. أعد المحاولة.'); }
  }
  return <section className="space-y-4 rounded-xl border bg-white p-5">
    <h2 className="text-lg font-bold">نتيجة مراجعة المستندات والتأشيرة</h2>
    <p>راجع وجود المستندات المطلوبة ووضوحها وملاءمة التأشيرة، ثم اختر الإجراء مرة واحدة.</p>
    {query.error && <p role="alert">تعذر تحميل الإجراءات. <button onClick={() => void query.refetch()} className="underline">إعادة المحاولة</button></p>}
    {query.data?.humanReview && <>
      <div className="flex flex-wrap gap-3">
        <button disabled={review.isPending} onClick={() => void save(true)} className="rounded-lg bg-emerald-800 px-4 py-3 text-white">المستندات مكتملة — اختيار المورد</button>
        <button disabled={review.isPending} onClick={() => setMissing(true)} className="rounded-lg border px-4 py-3">مستندات ناقصة — طلب استكمال</button>
        <button disabled={review.isPending} onClick={() => void save(true, true)} className="rounded-lg border px-4 py-3">أوصي بتعديل التأشيرة</button>
      </div>
      {missing && <div className="space-y-3"><label className="block">المستندات المطلوبة من العميل<textarea className="mt-2 w-full rounded-lg border p-3" value={reason} onChange={event => setReason(event.target.value)} placeholder="اذكر المستند والمسافر المطلوب منه بوضوح؛ سيرسل هذا النص للعميل." /></label><button disabled={review.isPending || reason.trim().length < 3} onClick={() => void save(false)} className="rounded-lg bg-slate-900 px-4 py-3 text-white">حفظ وإرسال طلب الاستكمال</button></div>}
    </>}
    {query.data && !query.data.humanReview && <p>المراجعة غير مطلوبة في هذه المرحلة. تابع الإجراء الحالي للطلب.</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
