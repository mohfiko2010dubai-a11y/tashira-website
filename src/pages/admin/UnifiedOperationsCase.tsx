import { Link, useParams, useSearchParams } from 'react-router-dom';
import { trpc } from '@/providers/trpc-client';
import OperationsShell from '@/components/operations/OperationsShell';
import { OperationsControlledWritePanelLive } from '@/components/operations/OperationsControlledWritePanel';
import DocumentManager from '@/components/shared/DocumentManager';
import VisaDeliveryPanel from '@/components/operations/VisaDeliveryPanel';
import CaseNotePanel from '@/components/operations/CaseNotePanel';
import RefundRequest from '@/components/operations/RefundRequest';
import { ManualVisaChange } from '@/components/admin/ManualVisaChange';
import CustomerProgressPanel from '@/components/operations/CustomerProgressPanel';
import { applicationStatusLabels } from '@/components/admin/application-display';
import { DocumentValidityReview } from '@/components/admin/DocumentValidityReview';
import SchedulerAlertPanel from '@/components/operations/SchedulerAlertPanel';
import SupplierSelectionPanel from '@/components/operations/SupplierSelectionPanel';
import { WORK_LISTS } from '@contracts/work-queue';

const tabs = [
  ['documents', 'البيانات والمستندات'], ['change', 'تعديل التأشيرة'],
  ['payments', 'الدفع والاسترداد'], ['submission', 'المورد والتقديم'],
  ['visa', 'تسليم التأشيرة'], ['messages', 'حالة العميل والإيميلات'], ['history', 'السجل والملاحظات'],
] as const;

export default function UnifiedOperationsCase() {
  const { referenceNumber = '' } = useParams<{ referenceNumber: string }>();
  const [search, setSearch] = useSearchParams();
  const tab = tabs.find(([key]) => key === search.get('tab'))?.[0] ?? 'documents';
  const work = WORK_LISTS.find(value => value === search.get('work')) ?? 'ACTIVE';
  const query = trpc.operationsRead.caseByReference.useQuery({ reference: referenceNumber }, { enabled: !!referenceNumber, retry: false });
  const refresh = async () => { await query.refetch(); };
  if (query.isLoading) return <OperationsShell title="ملف الطلب"><p role="status">جارٍ تحميل الطلب…</p></OperationsShell>;
  if (query.isError || !query.data) return <OperationsShell title="ملف الطلب"><p role="alert">تعذر فتح الطلب. حدّث الصفحة أو راجع إسناد الطلب إلى حسابك.</p><Link to={`/staff/dashboard?work=${work}`} className="underline">العودة للقائمة</Link></OperationsShell>;
  const model = query.data;
  const applicants = model.applicants.map(person => ({ applicantId: person.applicantId, displayName: person.displayName }));
  return <OperationsShell title="ملف الطلب" subtitle={model.summary.reference}>
    <div dir="rtl" lang="ar" className="space-y-5">
      <Link to={`/staff/dashboard?work=${work}`} className="inline-block rounded-lg border bg-white px-4 py-2">→ العودة للقائمة</Link>
      <section className="grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-3" aria-label="بيانات الطلب الأساسية">
        <div><p className="text-sm text-slate-500">المسافرون</p><p className="font-bold">{model.applicants.map(person => person.displayName).join('، ')}</p></div>
        <div><p className="text-sm text-slate-500">حالة الطلب</p><p>{applicationStatusLabels[model.summary.status] || model.summary.status}</p></div>
        <div><p className="text-sm text-slate-500">المورد / جهة التقديم</p><p>{model.supplier?.name || 'لم يُحدد بعد'}</p></div>
      </section>
      <nav aria-label="أقسام ملف الطلب" className="flex flex-wrap gap-2 rounded-xl border bg-white p-2">
        {tabs.map(([key, label]) => <button key={key} type="button" aria-pressed={tab === key} className={`min-h-11 rounded-lg px-4 py-2 ${tab === key ? 'bg-slate-900 text-white' : 'text-slate-700'}`} onClick={() => { const next = new URLSearchParams(search); next.set('tab', key); setSearch(next, { replace: true }); }}>{label}</button>)}
      </nav>
      {tab === 'documents' && <>
        <DocumentManager applicationId={model.summary.applicationId} readOnly allowUpload applicants={applicants} language="ar" />
        <DocumentValidityReview referenceNumber={model.summary.reference} />
        <OperationsControlledWritePanelLive enabled model={model} onRefresh={refresh} group="documents" />
      </>}
      {tab === 'change' && <><DocumentValidityReview referenceNumber={model.summary.reference} mode="change" /><p className="rounded-xl border bg-white p-4">عرض التعديل وموافقة العميل وفرق المبلغ مرتبطة بالطلب نفسه. تسوية فرق المبلغ لا تعني تقديم الطلب للهجرة.</p><ManualVisaChange referenceNumber={model.summary.reference} /></>}
      {tab === 'payments' && <><CustomerProgressPanel referenceNumber={model.summary.reference} /><RefundRequest applicationId={model.summary.applicationId} arabic /></>}
      {tab === 'submission' && <><SupplierSelectionPanel referenceNumber={model.summary.reference} onSaved={refresh} /><OperationsControlledWritePanelLive enabled model={model} onRefresh={refresh} group="status" /><SchedulerAlertPanel applicationId={model.summary.applicationId} /></>}
      {tab === 'visa' && <><DocumentManager applicationId={model.summary.applicationId} readOnly allowUpload applicants={applicants} language="ar" /><VisaDeliveryPanel applicationId={model.summary.applicationId} applicationReference={model.summary.reference} applicants={applicants} /></>}
      {tab === 'messages' && <><CustomerProgressPanel referenceNumber={model.summary.reference} /><Link to="/staff/operations/support" className="inline-block rounded-lg border bg-white px-4 py-2">فتح صندوق المراسلات</Link></>}
      {tab === 'history' && <><section className="rounded-2xl border bg-white p-5"><h2 className="mb-3 font-bold">سجل إجراءات الطلب</h2><ul className="divide-y">{model.operationalHistory.map(event => <li key={event.id} className="py-3"><p>{event.reason || event.event}</p><p className="text-sm text-slate-500">{event.actorReference || event.actorType} · {event.occurredAt}</p></li>)}</ul></section><CaseNotePanel referenceNumber={model.summary.reference} onRecorded={refresh} /></>}
    </div>
  </OperationsShell>;
}
