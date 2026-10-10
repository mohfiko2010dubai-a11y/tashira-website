import { useRef, useState } from 'react';
import { trpc } from '@/providers/trpc-client';
import DocumentPreviewModal from '@/components/shared/DocumentPreviewModal';

export default function SubmissionEvidencePanel({ applicationId, referenceNumber, onSaved }: { applicationId: number; referenceNumber: string; onSaved: () => Promise<void> }) {
  const utils = trpc.useUtils();
  const supplier = trpc.application.supplierOptions.useQuery({ referenceNumber });
  const documents = trpc.document.listByApplication.useQuery({ applicationId });
  const history = trpc.application.submissionEvidence.useQuery({ referenceNumber });
  const capabilities = trpc.operationsWrite.capabilities.useQuery({ applicationId }, { retry: false });
  const dispatch = trpc.application.recordSupplierDispatch.useMutation();
  const filing = trpc.operationsWrite.statusTransition.useMutation();
  const [kind, setKind] = useState<'supplier' | 'authority'>('authority');
  const [documentId, setDocumentId] = useState('');
  const [externalReference, setExternalReference] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<{ documentId: number; mimeType: string } | null>(null);
  const key = useRef<string | null>(null);
  const pending = dispatch.isPending || filing.isPending;
  const canFile = capabilities.data?.validStatusTransitions.includes('visa_processing') ?? false;
  const sources = documents.data?.filter(document => document.documentType === 'supporting' && document.uploadStatus === 'uploaded') ?? [];
  const inputClass = 'mt-1 block w-full rounded-lg border bg-white p-3';
  return <section className="rounded-2xl border bg-white p-5" aria-labelledby="submission-evidence-heading">
    <h2 id="submission-evidence-heading" className="text-lg font-bold">الإرسال وإثبات التقديم</h2>
    <p className="mt-2 text-sm text-slate-600">ارفع الإثبات كمرفق إضافي في المستندات، ثم اختره هنا. إرسال الملف للمورد يبقى في قائمة المتابعة؛ تأكيد تقديمه للهجرة يحدّث حالة العميل ويرسل إشعارًا له.</p>
    <p className="mt-2 text-sm">هذا الزر يسجّل إرسالًا تم بالفعل خارج اللوحة؛ لا يرسل المستندات تلقائيًا إلى المورد.</p>
    {(supplier.isError || documents.isError || capabilities.isError || history.isError) && <p role="alert" className="mt-3">تعذر تحميل بيانات التقديم. <button type="button" className="underline" onClick={() => { void supplier.refetch(); void documents.refetch(); void capabilities.refetch(); void history.refetch(); }}>إعادة المحاولة</button></p>}
    <form className="mt-4" onChange={() => { key.current = null; setMessage(''); }} onSubmit={async event => {
      event.preventDefault();
      if (!supplier.data?.currentSupplierId) { setMessage('اختر المورد واحفظه أولًا.'); return; }
      key.current ??= crypto.randomUUID();
      try {
        const evidence = { supplierId: supplier.data.currentSupplierId, documentId: Number(documentId), externalReference, occurredAt: new Date(occurredAt).toISOString(), ...(kind === 'supplier' ? { followUpAt: new Date(followUpAt).toISOString() } : {}) };
        if (kind === 'supplier') await dispatch.mutateAsync({ referenceNumber, evidence, key: key.current });
        else await filing.mutateAsync({ applicationId, expectedVersion: capabilities.data?.version ?? -1, to: 'visa_processing', reason: 'تأكيد التقديم بناءً على الرقم والإثبات المرفق.', idempotencyKey: key.current, submission: evidence });
        await Promise.all([history.refetch(), documents.refetch(), capabilities.refetch(), onSaved(), utils.operationsWork.overview.invalidate(), utils.operationsWork.managerReport.invalidate()]);
        setMessage(kind === 'supplier' ? 'تم تسجيل الإرسال. ستجد الطلب في متابعة المورد والهجرة، ولم يُسجّل كتقديم للهجرة بعد.' : 'تم تسجيل التقديم للهجرة وإثباته وتحديث حالة العميل.');
        key.current = null;
      } catch (error) { setMessage(error instanceof Error ? error.message : 'تعذر تسجيل التقديم. حدّث بيانات الطلب ثم حاول مجددًا.'); }
    }}>
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">ما الذي تم فعليًا؟<select className={inputClass} value={kind} onChange={event => setKind(event.target.value === 'supplier' ? 'supplier' : 'authority')}><option value="authority">تم تقديم الطلب للهجرة — مباشرة أو بواسطة المورد</option><option value="supplier">أرسلت المستندات للمورد — بانتظار تأكيد تقديمه</option></select></label>
        <label>{kind === 'authority' ? 'رقم طلب الهجرة' : 'مرجع الإرسال لدى المورد'}<input required maxLength={100} className={inputClass} value={externalReference} onChange={event => setExternalReference(event.target.value)} /></label>
        <label>الإثبات المرفق<select required className={inputClass} value={documentId} onChange={event => setDocumentId(event.target.value)}><option value="">اختر إثباتًا من المرفقات الإضافية</option>{sources.map(document => <option key={document.id} value={document.id}>{document.originalFileName}</option>)}</select></label>
        <label>الوقت الفعلي كما في الإثبات<input required type="datetime-local" step="1" className={inputClass} value={occurredAt} onChange={event => setOccurredAt(event.target.value)} /></label>
        {kind === 'supplier' && <label>موعد المتابعة القادم<input required type="datetime-local" className={inputClass} value={followUpAt} onChange={event => setFollowUpAt(event.target.value)} /></label>}
        {kind === 'authority' && !canFile && <p className="sm:col-span-2">يلزم أن يكون الطلب قيد المراجعة مع استلام الدفع قبل تأكيد التقديم. استخدم خطوات مراجعة المستندات وحالة الطلب أدناه.</p>}
        {!sources.length && <p className="sm:col-span-2">لا يوجد إثبات متاح. ارفع الصورة أو ملف PDF كمرفق إضافي في قسم المستندات ثم اضغط إعادة المحاولة.</p>}
        <button type="submit" disabled={pending || kind === 'authority' && !canFile} className="rounded-lg bg-slate-900 p-3 font-semibold text-white disabled:opacity-50">{pending ? 'جارٍ التسجيل…' : kind === 'authority' ? 'تأكيد التقديم للهجرة' : 'تسجيل الإرسال للمورد'}</button>
        <button type="button" className="underline" onClick={() => void documents.refetch()}>تحديث قائمة المرفقات</button>
      </fieldset>
    </form>
    <p role="status" className="mt-3">{message}</p>
    <ul className="mt-5 divide-y">{history.data?.map(item => <li key={item.id} className="py-3"><p className="font-semibold">{item.kind === 'AUTHORITY_FILED' ? 'تقديم للهجرة' : 'إرسال للمورد'} · {item.supplierName}</p><p>المرجع: {item.externalReference} · {new Date(item.occurredAt).toLocaleString('ar-AE')}</p><button type="button" className="underline" onClick={() => setPreview({ documentId: item.documentId, mimeType: item.mimeType })}>فتح نسخة الإثبات المحفوظة</button></li>)}</ul>
    {preview && <DocumentPreviewModal {...preview} fileName="إثبات التقديم" onClose={() => setPreview(null)} />}
  </section>;
}
