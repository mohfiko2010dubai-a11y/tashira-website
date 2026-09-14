import { trpc } from "@/providers/trpc-client";
export function ApplicationSupplementReview({ applicationId }: { applicationId: number }) {
  const query = trpc.applicationSupplements.get.useQuery({ applicationId });
  return <section className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-5">
    <h2 className="font-bold">Customer additional notes / ملاحظات العميل</h2>
    {query.isLoading ? <p>Loading…</p> : query.error ? <p role="alert">Could not load customer notes. <button onClick={() => void query.refetch()}>Retry</button></p> : <>
      <p className="mt-3 whitespace-pre-wrap" dir="auto">{query.data?.notes || "No additional notes supplied."}</p>
      <p className="mt-3 text-sm">Optional supporting files: {query.data?.files.length ?? 0} — available in Documents.</p>
      <ul>{query.data?.files.map(file => <li key={file.id}>{file.name}</li>)}</ul>
      {query.data?.sponsors.filter(sponsor => sponsor.name).map(sponsor => <p key={sponsor.applicantId} className="mt-2">Applicant {sponsor.applicantId} · Sponsor: {sponsor.name} · {sponsor.relation}</p>)}
    </>}
  </section>;
}
