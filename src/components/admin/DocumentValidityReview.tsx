import { ManualVisaChange } from "./ManualVisaChange";
import { useState } from "react";
import { trpc } from "@/providers/trpc-client";

export function DocumentValidityReview({ referenceNumber }: { referenceNumber: string }) {
  const facts = trpc.application.documentReviewFacts.useQuery({ referenceNumber });
  const record = trpc.application.recordDocumentReview.useMutation();
  const propose = trpc.application.proposeSubmittedProduct.useMutation();
  const products = trpc.catalog.adminProducts.useQuery();
  const application = trpc.application.getByReference.useQuery({ referenceNumber });
  const [result, setResult] = useState("");
  return <section className="my-4 rounded border bg-white p-4">
    <h2 className="font-bold">Document review facts</h2>
    <p>Customer-entered dates are assertions. Check the uploaded documents before deciding.</p>
    <p>Sold: {application.data?.visaType} · Submitted product: {application.data?.submittedProduct ?? "Not filed"}</p>
    <form className="my-3 flex flex-wrap gap-2" onSubmit={async event => {
      event.preventDefault(); const data = new FormData(event.currentTarget); const product = String(data.get("product"));
      try { await propose.mutateAsync({ referenceNumber, product, reason: String(data.get("reason")) }); await application.refetch(); setResult("Proposal saved. Filing remains blocked until customer acknowledgement."); }
      catch (error) { setResult(error instanceof Error ? error.message : "Proposal could not be saved. Try again."); }
    }}>
      <select name="product" required aria-label="Proposed filing product" className="rounded border p-2">
        <option value="">Choose proposed product</option>{products.data?.filter(product => product.isActive).map(product => <option key={product.serviceCode} value={product.serviceCode}>{product.serviceCode}</option>)}
      </select>
      <input name="reason" required maxLength={500} aria-label="Reason for substitution" placeholder="Reason for substitution" className="rounded border p-2" />
      <button disabled={propose.isPending} className="rounded border px-3 py-2">Propose replacement</button>
    </form>
    {facts.isLoading && <p>Loading review facts…</p>}
    {facts.error && <p role="alert">Review facts unavailable. Refresh before reviewing this order.</p>}
    {facts.data?.applicants.map(applicant => <article key={applicant.applicantId} className="mt-3 border-t pt-3">
      <h3>Applicant {applicant.applicantId} · Settings version {facts.data.settingsVersion}</h3>
      <p>Entry: {applicant.entryDate ?? "Unknown — confirm intended entry"}</p>
      {(["passport", "residence"] as const).map(field => <p key={field}>
        {field}: {applicant[field].expiry ?? "Not supplied"} · {applicant[field].status}
        {applicant[field].requiredUntil && ` · Required until ${applicant[field].requiredUntil}`}
        {applicant[field].daysFromEntry !== null && ` · ${applicant[field].daysFromEntry} days from entry to expiry`}
      </p>)}
      {applicant.childReview === "CONFIRM_CHILD_RATE" && <p className="font-semibold text-amber-800">Applicant appears to be a child — confirm from documents for child rate.</p>}
      <form className="mt-3 flex flex-wrap gap-2" onSubmit={async event => {
        event.preventDefault(); const data = new FormData(event.currentTarget);
        const decision = data.get("decision");
        if (decision !== "PROCEED" && decision !== "CONTACT" && decision !== "SUBSTITUTE" && decision !== "REFUND") return;
        try { await record.mutateAsync({ referenceNumber, applicantId: applicant.applicantId, decision, reason: String(data.get("reason")) }); setResult("Decision recorded on the order timeline. This does not file or refund the order."); }
        catch (error) { setResult(error instanceof Error ? error.message : "Could not record decision. Try again."); }
      }}>
        <select name="decision" aria-label="Review decision" className="rounded border p-2"><option value="PROCEED">Proceed</option><option value="CONTACT">Contact customer</option><option value="SUBSTITUTE">Substitute product</option><option value="REFUND">Refund</option></select>
        <input name="reason" required maxLength={180} aria-label="Reason for decision" placeholder="Reason for decision" className="rounded border p-2" />
        <button disabled={record.isPending} className="rounded bg-slate-900 px-3 py-2 text-white">Record decision</button>
      </form>
    </article>)}
    <p role="status">{result}</p>
    <ManualVisaChange referenceNumber={referenceNumber} />
  </section>;
}
