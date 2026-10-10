import { useRef, useState } from "react";
import { trpc } from "@/providers/trpc-client";

export default function VisaDeliveryPanel({ applicationId, applicationReference, applicants }: {
  applicationId: number;
  applicationReference: string;
  applicants: readonly { applicantId: number; displayName: string }[];
}) {
  const documents = trpc.document.listByApplication.useQuery({ applicationId, documentType: "visa", sortBy: "createdAt", sortOrder: "desc" });
  const prepare = trpc.operationsVisaDelivery.prepare.useMutation();
  const [applicantId, setApplicantId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [visaReference, setVisaReference] = useState("");
  const [validitySummary, setValiditySummary] = useState("");
  const [instructions, setInstructions] = useState("راجع بيانات التأشيرة وتاريخ صلاحيتها قبل السفر.");
  const [message, setMessage] = useState("");
  const key = useRef<string | null>(null);
  const availableDocuments = (documents.data ?? []).filter((document) => !applicantId || document.applicantId === Number(applicantId));
  return <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5" id="visa-delivery">
    <h2 className="text-lg font-semibold text-emerald-950">تجهيز التأشيرة للعميل</h2>
    <p className="mt-1 text-sm text-emerald-900">١. سجّل استلام التأشيرة في حالة الطلب. ٢. ارفع ملف التأشيرة للمسافر الصحيح في المستندات. ٣. أكمل البيانات واحفظ؛ يفحص النظام الملف ويحفظ نسخة آمنة للعميل. عند فشل الفحص يظهر السبب ولا يُسلّم الملف.</p>
    {documents.isLoading && <p role="status">جارٍ تحميل ملفات التأشيرات…</p>}
    {documents.isError && <p role="alert">تعذر تحميل الملفات. <button type="button" className="underline" onClick={() => void documents.refetch()}>إعادة المحاولة</button></p>}
    {documents.data?.length === 0 && <p className="mt-3">لا توجد تأشيرة مرفوعة. ارفع الملف في قسم المستندات للمسافر الصحيح أولًا.</p>}
    <fieldset disabled={prepare.isPending} onChange={() => { key.current = null; setMessage(""); }} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium">المسافر<select value={applicantId} onChange={(event) => { setApplicantId(event.target.value); setDocumentId(""); }} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"><option value="">اختر المسافر</option>{applicants.map((applicant) => <option key={applicant.applicantId} value={applicant.applicantId}>{applicant.displayName}</option>)}</select></label>
      <label className="text-sm font-medium">ملف التأشيرة المرفوع<select value={documentId} onChange={(event) => setDocumentId(event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"><option value="">اختر ملف التأشيرة</option>{availableDocuments.map((document) => <option key={document.id} value={document.id}>{document.originalFileName}</option>)}</select></label>
      <label className="text-sm font-medium">رقم التأشيرة<input value={visaReference} onChange={(event) => setVisaReference(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
      <label className="text-sm font-medium">بيان الصلاحية<input value={validitySummary} onChange={(event) => setValiditySummary(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="مثال: صالحة للدخول حتى التاريخ المطبوع عليها" /></label>
      <label className="text-sm font-medium sm:col-span-2">تعليمات العميل<textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" rows={2} /></label>
    </fieldset>
    <button type="button" disabled={!applicantId || !documentId || visaReference.trim().length < 2 || validitySummary.trim().length < 3 || instructions.trim().length < 2 || prepare.isPending} onClick={async () => {
      setMessage(""); key.current ??= crypto.randomUUID(); try { await prepare.mutateAsync({ applicationReference, applicantId: Number(applicantId), visaDocumentId: Number(documentId), visaReference: visaReference.trim(), validitySummary: validitySummary.trim(), customerInstructions: [instructions.trim()], commandId: key.current }); setMessage("تم تجهيز التأشيرة للتحميل الآمن من حساب العميل. هذا الإجراء لا يؤكد إرسال بريد جديد."); } catch (error) { setMessage(error instanceof Error ? error.message : "تعذر تجهيز التأشيرة. حدّث الطلب ثم حاول مرة أخرى."); }
    }} className="mt-4 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{prepare.isPending ? "جارٍ التجهيز…" : "حفظ وتجهيز التأشيرة للعميل"}</button>
    {message && <p role="status" className="mt-3 text-sm text-emerald-950">{message}</p>}
  </section>;
}
