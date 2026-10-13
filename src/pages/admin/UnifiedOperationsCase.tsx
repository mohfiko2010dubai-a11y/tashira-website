import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { trpc } from '@/providers/trpc-client';
import OperationsShell from '@/components/operations/OperationsShell';
import DocumentManager from '@/components/shared/DocumentManager';
import VisaDeliveryPanel from '@/components/operations/VisaDeliveryPanel';
import CaseNotePanel from '@/components/operations/CaseNotePanel';
import RefundRequest from '@/components/operations/RefundRequest';
import SecurityDepositStatus from '@/components/operations/SecurityDepositStatus';
import { ManualVisaChange } from '@/components/admin/ManualVisaChange';
import CustomerProgressPanel from '@/components/operations/CustomerProgressPanel';
import { applicationStatusLabels } from '@/components/admin/application-display';
import { DocumentValidityReview } from '@/components/admin/DocumentValidityReview';
import SchedulerAlertPanel from '@/components/operations/SchedulerAlertPanel';
import CaseDocumentDecision from '@/components/operations/CaseDocumentDecision';
import SupplierSelectionPanel from '@/components/operations/SupplierSelectionPanel';
import SubmissionEvidencePanel from '@/components/operations/SubmissionEvidencePanel';
import { WORK_LISTS } from '@contracts/work-queue';

const tabs = [
  ['documents', 'البيانات والمستندات'], ['change', 'تعديل التأشيرة'],
  ['payments', 'الدفع والاسترداد'], ['submission', 'المورد والتقديم'],
  ['visa', 'تسليم التأشيرة'], ['messages', 'حالة العميل والإيميلات'], ['history', 'السجل والملاحظات'],
] as const;

export default function UnifiedOperationsCase() {
  const navigate=useNavigate();
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const { referenceNumber = '' } = useParams<{ referenceNumber: string }>();
  const [search, setSearch] = useSearchParams();
  const tab = tabs.find(([key]) => key === search.get('tab'))?.[0] ?? 'documents';
  const supplierReturn = search.get('from') === 'suppliers';
  const work = WORK_LISTS.find(value => value === search.get('work')) ?? 'ACTIVE';
  const query = trpc.operationsRead.caseByReference.useQuery({ reference: referenceNumber }, { enabled: !!referenceNumber, retry: false });
  const utils = trpc.useUtils();
  const refresh = async () => { await Promise.all([query.refetch(), utils.operationsWork.overview.invalidate()]); };
  if (query.isLoading) return <OperationsShell title="ملف الطلب"><p role="status">جارٍ تحميل الطلب…</p></OperationsShell>;
  if (query.isError || !query.data) return <OperationsShell title="ملف الطلب"><p role="alert">تعذر فتح الطلب. حدّث الصفحة أو راجع إسناد الطلب إلى حسابك.</p><Link to={supplierReturn ? '/staff/operations/supplier-sla' : `/staff/dashboard?work=${work}`} className="underline">العودة للقائمة</Link></OperationsShell>;
  const model = query.data;
  const applicants = model.applicants.map(person => ({ applicantId: person.applicantId, displayName: person.displayName }));
  return <OperationsShell title="ملف الطلب" subtitle={model.summary.reference}>
    <div dir="rtl" lang="ar" className="space-y-5">
      <Link to={supplierReturn ? '/staff/operations/supplier-sla' : `/staff/dashboard?work=${work}`} className="inline-block rounded-lg border bg-white px-4 py-2">→ العودة للقائمة</Link>
      <section className="grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-3" aria-label="بيانات الطلب الأساسية">
        <div><p className="text-sm text-slate-500">المسافرون</p><p className="font-bold">{model.applicants.map(person => person.displayName).join('، ')}</p></div>
        <div><p className="text-sm text-slate-500">حالة الطلب</p><p>{applicationStatusLabels[model.summary.status] || model.summary.status}</p></div>
        <div><p className="text-sm text-slate-500">المورد / جهة التقديم</p><p>{model.supplier?.name || 'لم يُحدد بعد'}</p></div>
      </section>
      <nav aria-label="أقسام ملف الطلب" className="flex flex-wrap gap-2 rounded-xl border bg-white p-2">
        {tabs.map(([key, label]) => <button key={key} type="button" aria-pressed={tab === key} className={`min-h-11 rounded-lg px-4 py-2 ${tab === key ? 'bg-slate-900 text-white' : 'text-slate-700'}`} onClick={() => { const next = new URLSearchParams(search); next.set('tab', key); setSearch(next, { replace: true }); }}>{label}</button>)}
      </nav>
      {tab === 'documents' && <>
        <section className="rounded-2xl border bg-white p-5"><h2 className="font-bold">ملف المستندات والمراجعة</h2><p className="my-3">افتح الملف لمعاينة المستندات ورفع المرفقات، ثم اختر نتيجة مراجعة الطلب أدناه.</p><p className="mb-3 text-sm text-slate-600">المستندات: {model.applicants.reduce((total, applicant) => total + applicant.documents.length, 0)}</p><button type="button" className="rounded-lg bg-slate-900 px-4 py-3 text-white" onClick={() => setDocumentsOpen(true)}>فتح ملف المستندات ومراجعته</button></section>
        <Dialog open={documentsOpen} onOpenChange={setDocumentsOpen}><DialogContent dir="rtl" lang="ar" className="max-h-[90vh] overflow-y-auto sm:max-w-5xl"><DialogTitle>ملف المستندات والمراجعة</DialogTitle><DialogDescription>راجع المستندات وارفع الناقص منها، ثم ارجع إلى الطلب.</DialogDescription><DocumentManager applicationId={model.summary.applicationId} readOnly allowUpload applicants={applicants} language="ar" /><button type="button" className="rounded-lg border p-3" onClick={() => setDocumentsOpen(false)}>إغلاق الملف والعودة للطلب</button></DialogContent></Dialog>
        <CaseDocumentDecision applicationId={model.summary.applicationId} onSaved={refresh} onReady={async () => { const next = new URLSearchParams(search); next.set('tab', 'submission'); setSearch(next, { replace: true }); }} onChangeVisa={() => { const next = new URLSearchParams(search); next.set('tab', 'change'); setSearch(next, { replace: true }); }} />
      </>}
      {tab === 'change' && <><DocumentValidityReview referenceNumber={model.summary.reference} mode="change" /><p className="rounded-xl border bg-white p-4">عرض التعديل وموافقة العميل وفرق المبلغ مرتبطة بالطلب نفسه. تسوية فرق المبلغ لا تعني تقديم الطلب للهجرة.</p><ManualVisaChange referenceNumber={model.summary.reference} /></>}
      {tab === 'payments' && <><CustomerProgressPanel referenceNumber={model.summary.reference} /><SecurityDepositStatus applicationId={model.summary.applicationId} /><RefundRequest applicationId={model.summary.applicationId} arabic /></>}
      {tab === 'submission' && <><SupplierSelectionPanel referenceNumber={model.summary.reference} onSaved={refresh} /><SubmissionEvidencePanel applicationId={model.summary.applicationId} referenceNumber={model.summary.reference} onSaved={async () => { await refresh(); const next = new URLSearchParams(search); next.set('work', 'WAIT_AUTHORITY'); next.set('tab', 'visa'); setSearch(next, { replace: true }); }} /><SchedulerAlertPanel applicationId={model.summary.applicationId} /></>}
      {tab === 'visa' && <><VisaDeliveryPanel applicationId={model.summary.applicationId} applicationReference={model.summary.reference} applicants={applicants} applicationStatus={model.summary.status} onSaved={async () => { const updated=await query.refetch();await utils.operationsWork.overview.invalidate();if(updated.data?.summary.status==='completed')navigate('/staff/dashboard?work=DONE'); }} /></>}
      {tab === 'messages' && <><CustomerProgressPanel referenceNumber={model.summary.reference} /><Link to="/staff/operations/support" className="inline-block rounded-lg border bg-white px-4 py-2">فتح صندوق المراسلات</Link></>}
      {tab === 'history' && <><section className="rounded-2xl border bg-white p-5"><h2 className="mb-3 font-bold">سجل إجراءات الطلب</h2><ul className="divide-y">{model.operationalHistory.map(event => <li key={event.id} className="py-3"><p>{event.reason || event.event}</p><p className="text-sm text-slate-500">{event.actorReference || event.actorType} · {event.occurredAt}</p></li>)}</ul></section><CaseNotePanel referenceNumber={model.summary.reference} onRecorded={refresh} /></>}
    </div>
  </OperationsShell>;
}
