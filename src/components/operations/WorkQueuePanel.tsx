import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { trpc } from '@/providers/trpc-client';
import { AVAILABILITY, WORK_STATES, availabilityLabels, workStateLabels, workBucket, type WorkState } from '../../../contracts/work-queue';

export default function WorkQueuePanel({ includeTest }: { includeTest: boolean }) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const queue = trpc.operationsWork.overview.useQuery({ includeTest }, { refetchInterval: 30000 });
  const [tab, setTab] = useState<WorkState | 'DUE'>('ACTIVE');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [state, setState] = useState<WorkState>('READY');
  const [reason, setReason] = useState('');
  const [due, setDue] = useState('');
  const command = trpc.operationsWork.command.useMutation({
    onSuccess: async (result, input) => {
      await Promise.all([utils.operationsWork.overview.invalidate(), utils.application.list.invalidate()]);
      setEditing(null);
      if (input.kind === 'CLAIM') {
        if (result.reference) navigate(`/staff/operations/${encodeURIComponent(result.reference)}`);
        else setNotice('لا توجد طلبات جاهزة للاستلام الآن. راجع المتابعات المستحقة أدناه.');
      } else setNotice('تم حفظ التحديث.');
    },
    onError: error => setNotice(`لم يتم الحفظ: ${error.message} حدّث القائمة ثم حاول مجددًا.`),
  });
  const rows = queue.data?.mine ?? [];
  const tabs = ['ACTIVE', 'READY', 'DUE', 'WAIT_CUSTOMER', 'WAIT_AUTHORITY', 'WAIT_SUPPLIER', 'DONE'] as const;
  const shown = rows.filter(row => workBucket(row.state, row.dueAt, queue.data?.asOf ?? 0) === tab);
  return <section dir="rtl" className="mb-6 rounded-xl border border-slate-200 bg-white p-5" aria-label="طابور العمل والمتابعة">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-xl font-bold">مكتب العمل والمتابعة</h2>
        <p className="mt-1 text-sm text-slate-600">استلم التالي حسب الأولوية ثم الأقدم. الطلب المستلم يظهر لك وحدك وللمدير.</p>
        <p className="mt-1 text-sm text-slate-600">إنهاء عملك هنا لا يصدر تأشيرة ولا يغيّر حالة الدفع أو ضمان التقديم.</p></div>
      <button type="button" onClick={() => queue.refetch()} className="rounded-lg border px-3 py-2">تحديث</button>
    </div>
    {queue.isLoading && <p role="status" className="mt-3">جارٍ تحميل طابور العمل…</p>}
    {queue.isError && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3">تعذر تحميل طابور العمل. اضغط تحديث؛ إذا استمرت المشكلة اطلب من المدير مراجعة تفعيل الطابور وصلاحيات حسابك.</p>}
    {queue.data && <>
      <div className="my-4 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">حالتي الآن
          <select className="ms-3 rounded-lg border p-2" value={queue.data.availability} disabled={command.isPending}
            onChange={e => { const selected = AVAILABILITY.find(value => value === e.target.value); if (selected) command.mutate({ kind: 'AVAILABILITY', availability: selected, key: crypto.randomUUID() }); }}>
            {AVAILABILITY.map(value => <option key={value} value={value}>{availabilityLabels[value]}</option>)}
          </select>
        </label>
        <button type="button" disabled={command.isPending || queue.data.availability !== 'AVAILABLE'}
          className="rounded-lg bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-50"
          onClick={() => command.mutate({ kind: 'CLAIM', includeTest, key: crypto.randomUUID() })}>استلام التالي</button>
        <p className="py-2 text-sm">{queue.data.availableCount} طلب جديد متاح{includeTest ? ' — تشمل طلبات الاختبار' : ''}</p>
      </div>
      {queue.data.availability !== 'AVAILABLE' && <p className="mb-3 text-sm">اختر «متاح لاستلام الطلبات» لتبدأ. تسجيل الدخول وحده لا يحدد تواجدك.</p>}
      <div className="flex flex-wrap gap-2" aria-label="قوائم العمل">
        {tabs.map(value => <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)}
          className={`rounded-lg border px-3 py-2 text-sm ${tab === value ? 'bg-slate-900 text-white' : 'bg-white'}`}>
          {value === 'DUE' ? 'متابعة مستحقة الآن' : workStateLabels[value]} ({rows.filter(row => workBucket(row.state, row.dueAt, queue.data?.asOf ?? 0) === value).length})
        </button>)}
      </div>
      <div className="mt-4 space-y-3">
        {shown.length === 0 && <p className="p-3 text-sm text-slate-500">لا توجد طلبات في هذه القائمة.</p>}
        {shown.map(row => <article key={row.applicationId} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><Link className="break-all font-semibold underline" to={`/staff/operations/${encodeURIComponent(row.reference)}`}>{row.reference}</Link>
              <p className="mt-1 text-sm">{row.visaType} · {row.processingType === 'express' ? 'مستعجل' : 'عادي'}</p>
              {row.reason && <p className="mt-1 text-sm text-slate-600">آخر إجراء: {row.reason}</p>}
              {row.dueAt && <p className="mt-1 text-sm">موعد المتابعة: {new Date(row.dueAt).toLocaleString('ar-AE', { timeZone: 'Asia/Dubai' })} — دبي</p>}
            </div>
            <button type="button" className="rounded-lg border px-3 py-2" onClick={() => { setEditing(row.applicationId); setState(row.state); setReason(''); setDue(''); }}>تحديث العمل والمتابعة</button>
          </div>
          {editing === row.applicationId && <form className="mt-4 grid gap-3" onSubmit={e => { e.preventDefault(); command.mutate({ kind: 'WORK_STATE', applicationId: row.applicationId, version: row.version, state, reason,
            followUpAt: state.startsWith('WAIT_') && due ? new Date(due).toISOString() : null, key: crypto.randomUUID() }); }}>
            <label>الإجراء التالي<select className="ms-3 rounded border p-2" value={state} onChange={e => { const value = WORK_STATES.find(item => item === e.target.value); if (value) setState(value); }}>{WORK_STATES.map(value => <option key={value} value={value}>{workStateLabels[value]}</option>)}</select></label>
            <label>سبب التحديث أو المطلوب متابعته<textarea required minLength={3} maxLength={500} className="mt-1 w-full rounded border p-2" value={reason} onChange={e => setReason(e.target.value)} /></label>
            {state.startsWith('WAIT_') && <label>موعد المتابعة — بتوقيت جهازك<input type="datetime-local" required className="ms-3 rounded border p-2" value={due} onChange={e => setDue(e.target.value)} /></label>}
            <div><button disabled={command.isPending} className="rounded-lg bg-slate-900 px-4 py-2 text-white">حفظ المتابعة</button><button type="button" className="ms-3 px-3 py-2" onClick={() => setEditing(null)}>إلغاء</button></div>
          </form>}
        </article>)}
      </div>
    </>}
    <p aria-live="polite" className="mt-3 text-sm">{notice}</p>
  </section>;
}
