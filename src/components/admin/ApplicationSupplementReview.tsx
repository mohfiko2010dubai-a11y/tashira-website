import { trpc } from "@/providers/trpc-client";
export function ApplicationSupplementReview({ applicationId }: { applicationId: number }) {
  const query = trpc.applicationSupplements.get.useQuery({ applicationId });
  return <section className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-5">
    <h2 className="font-bold">ملاحظات العميل والمستندات الداعمة</h2>
    {query.isLoading ? <p>جارٍ التحميل…</p> : query.error ? <p role="alert">تعذر تحميل ملاحظات العميل. <button onClick={() => void query.refetch()}>إعادة المحاولة</button></p> : <>
      <p className="mt-3 whitespace-pre-wrap" dir="auto">{query.data?.notes || "لم يضف العميل ملاحظات."}</p>
      <p className="mt-3 text-sm">عدد الملفات الداعمة الاختيارية: {query.data?.files.length ?? 0} — يمكن فتحها من قسم المستندات.</p>
      <ul>{query.data?.files.map(file => <li key={file.id}>{file.name}</li>)}</ul>
      {query.data?.sponsors.filter(sponsor => sponsor.name).map(sponsor => <p key={sponsor.applicantId} className="mt-2">المسافر {sponsor.applicantId} · الكفيل: {sponsor.name} · {sponsor.relation}</p>)}
    </>}
  </section>;
}
