import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { trpc } from '@/providers/trpc-client';
import { AVAILABILITY, WORK_STATES, WORK_LISTS, availabilityLabels, workStateLabels, workListLabels, workList, type WorkList, type WorkState } from '../../../contracts/work-queue';
import { visaLabel } from '@/components/admin/application-display';

export default function WorkQueuePanel({ includeTest }: { includeTest: boolean }) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const queue = trpc.operationsWork.overview.useQuery({ includeTest }, { refetchInterval: 30000 });
  const [search, setSearch] = useSearchParams();
  const selectedTab = search.get('work');
  const tab = selectedTab === 'WAIT_SUPPLIER' ? 'WAIT_AUTHORITY' : WORK_LISTS.find(value => value === selectedTab) ?? 'ACTIVE';
  const setTab = (value: WorkList) => { const next = new URLSearchParams(search); next.set('work', value); setSearch(next, { replace: true }); };
  const [notice, setNotice] = useState('');
  const [savedList, setSavedList] = useState<WorkList | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [state, setState] = useState<WorkState>('READY');
  const [reason, setReason] = useState('');
  const [due, setDue] = useState('');
  const command = trpc.operationsWork.command.useMutation({
    onSuccess: async (result, input) => {
      await Promise.all([utils.operationsWork.overview.invalidate(), utils.application.list.invalidate()]);
      setEditing(null);
      if (input.kind === 'CLAIM') {
        if (result.reference) navigate(`/staff/operations/${encodeURIComponent(result.reference)}?work=${tab}`);
        else setNotice('لا توجد طلبات جاهزة للاستلام الآن. راجع المتابعات المستحقة أدناه.');
      } else if (input.kind === 'WORK_STATE') {
        const destination = workList(input.state, input.followUpAt, Date.now());
        setSavedList(destination);
        setTab(destination);
        setNotice(`تم حفظ المتابعة. الطلب موجود الآن في «${workListLabels[destination]}».`);
      } else { setSavedList(null); setNotice('تم حفظ التحديث.'); }
    },
    onError: error => { setSavedList(null); setNotice(`لم يتم الحفظ: ${error.message} حدّث القائمة ثم حاول مجددًا.`); },
  });
  const rows = queue.data?.mine ?? [];
  const shown = rows.filter(row => workList(row.state, row.dueAt, queue.data?.asOf ?? 0) === tab);
  const editRow = rows.find(row => row.applicationId === editing);
  return <section dir="rtl" className="mb-6 rounded-xl border border-slate-200 bg-white p-5" aria-label="طابور العمل والمتابعة">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-xl font-bold">مكتب العمل والمتابعة</h2>
        <p className="mt-1 text-sm text-slate-600">الاستلام حسب الأولوية ثم الأقدم. الطلب المستلم يُسجّل باسمك حتى تستكمل العمل عليه.</p>
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
          onClick={() => command.mutate({ kind: 'CLAIM', includeTest, key: crypto.randomUUID() })}>{rows.some(row => row.state === 'ACTIVE') ? 'العودة للطلب الجاري' : rows.some(row => row.state === 'READY' || workList(row.state, row.dueAt, queue.data?.asOf ?? 0) === 'DUE') ? 'استكمال الطلب التالي' : 'استلام طلب جديد'}</button>
        <p className="py-2 text-sm">{queue.data.availableCount} طلب جديد متاح{includeTest ? ' — تشمل طلبات الاختبار' : ''}</p>
      </div>
      {queue.data.availability !== 'AVAILABLE' && <p className="mb-3 text-sm">اختر «متاح لاستلام الطلبات» لتبدأ. تسجيل الدخول وحده لا يحدد تواجدك.</p>}
      <div className="flex flex-wrap gap-2" aria-label="قوائم العمل">
        {WORK_LISTS.map(value => <button key={value} type="button" aria-pressed={tab === value} onClick={() => { setEditing(null); setTab(value); }}
          className={`rounded-lg border px-3 py-2 text-sm ${tab === value ? 'bg-slate-900 text-white' : 'bg-white'}`}>
          {workListLabels[value]} ({value === 'NEW' ? queue.data.availableCount : rows.filter(row => workList(row.state, row.dueAt, queue.data?.asOf ?? 0) === value).length})
        </button>)}
      </div>
      <div className="mt-4 overflow-x-auto">
        {tab === 'NEW' ? <>
          <p className="mb-3 text-sm text-slate-600">تفاصيل العميل متاحة بعد الاستلام. تعرض القائمة أول ١٠٠ طلب؛ زر الاستلام يراعي أيضًا عملك الحالي والمتابعات المستحقة.</p>
          <table className="w-full text-start text-sm"><thead><tr className="border-b text-start text-slate-500"><th className="p-3 text-start">رقم الطلب</th><th className="p-3 text-start">التأشيرة</th><th className="p-3 text-start">المعالجة</th></tr></thead><tbody>
            {queue.data.available.map(row => <tr key={row.reference} className="border-b"><td className="break-all p-3"><bdi>{row.reference}</bdi></td><td className="p-3">{visaLabel(row.visaType)}</td><td className="p-3">{row.processingType === 'express' ? 'مستعجل' : 'عادي'}</td></tr>)}
          </tbody></table>{queue.data.available.length === 0 && <p className="p-3">لا توجد طلبات جديدة متاحة.</p>}
        </> : <>
          <table className="w-full text-start text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3 text-start">الطلب / التأشيرة</th><th className="p-3 text-start">آخر تحديث</th><th className="p-3 text-start">الإجراء</th></tr></thead><tbody>
            {shown.map(row => <tr key={row.applicationId} className="border-b hover:bg-slate-50">
              <td className="p-3"><Link className="break-all font-semibold underline" to={`/staff/operations/${encodeURIComponent(row.reference)}?work=${tab}`}><bdi>{row.reference}</bdi></Link><p>{visaLabel(row.visaType)} · {row.processingType === 'express' ? 'مستعجل' : 'عادي'}</p></td>
              <td className="p-3"><p>{workStateLabels[row.state]}</p>{row.reason && <p className="text-slate-600">{row.reason}</p>}{row.dueAt && <p>المتابعة: {new Date(row.dueAt).toLocaleString('ar-AE', { timeZone: 'Asia/Dubai' })}</p>}</td>
              <td className="p-3">{row.state !== 'DONE' && <button type="button" className="rounded-lg border px-3 py-2" onClick={() => { setEditing(row.applicationId); setState(row.state); setReason(''); setDue(''); }}>تحديث المتابعة</button>}</td>
            </tr>)}
          </tbody></table>{shown.length === 0 && <p className="p-3 text-slate-500">لا توجد طلبات في هذه القائمة.</p>}
        </>}
      </div>
          {editRow && <form className="mt-4 grid gap-3 rounded-lg border p-4" onSubmit={e => { e.preventDefault(); command.mutate({ kind: 'WORK_STATE', applicationId: editRow.applicationId, version: editRow.version, state, reason,
            followUpAt: state.startsWith('WAIT_') && due ? new Date(due).toISOString() : null, key: crypto.randomUUID() }); }}>
            <label>الإجراء التالي<select className="ms-3 rounded border p-2" value={state} onChange={e => { const value = WORK_STATES.find(item => item === e.target.value); if (value) setState(value); }}>{WORK_STATES.filter(value => value !== 'DONE').map(value => <option key={value} value={value}>{workStateLabels[value]}</option>)}</select></label>
            <label>سبب التحديث أو المطلوب متابعته<textarea required minLength={3} maxLength={500} className="mt-1 w-full rounded border p-2" value={reason} onChange={e => setReason(e.target.value)} /></label>
            {state.startsWith('WAIT_') && <label>موعد المتابعة — بتوقيت جهازك<input type="datetime-local" required className="ms-3 rounded border p-2" value={due} onChange={e => setDue(e.target.value)} /></label>}
            <div><button disabled={command.isPending} className="rounded-lg bg-slate-900 px-4 py-2 text-white">حفظ المتابعة</button><button type="button" className="ms-3 px-3 py-2" onClick={() => setEditing(null)}>إلغاء</button></div>
          </form>}
    </>}
    <p aria-live="polite" className="mt-3 text-sm">{notice}</p>
    {savedList && <Link className="mt-2 inline-block underline" to={`/staff/dashboard?work=${savedList}`}>فتح قائمة {workListLabels[savedList]}</Link>}
  </section>;
}
