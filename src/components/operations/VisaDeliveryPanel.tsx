import { useState } from "react";
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
  const [instructions, setInstructions] = useState("Check all details before travel");
  const [message, setMessage] = useState("");
  const availableDocuments = (documents.data ?? []).filter((document) => !applicantId || document.applicantId === Number(applicantId));
  return <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5" id="visa-delivery">
    <h2 className="text-lg font-semibold text-emerald-950">Visa upload, approval & secure delivery</h2>
    <p className="mt-1 text-sm text-emerald-900">Upload the visa in the document panel, complete its required security review, then prepare it for the correct applicant. No other applicant can access it.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium">Applicant<select value={applicantId} onChange={(event) => { setApplicantId(event.target.value); setDocumentId(""); }} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"><option value="">Select applicant</option>{applicants.map((applicant) => <option key={applicant.applicantId} value={applicant.applicantId}>{applicant.displayName}</option>)}</select></label>
      <label className="text-sm font-medium">Uploaded visa PDF<select value={documentId} onChange={(event) => setDocumentId(event.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2"><option value="">Select visa file</option>{availableDocuments.map((document) => <option key={document.id} value={document.id}>{document.originalFileName}</option>)}</select></label>
      <label className="text-sm font-medium">Visa reference<input value={visaReference} onChange={(event) => setVisaReference(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
      <label className="text-sm font-medium">Validity summary<input value={validitySummary} onChange={(event) => setValiditySummary(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="e.g. Valid for entry until …" /></label>
      <label className="text-sm font-medium sm:col-span-2">Customer instructions<textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" rows={2} /></label>
    </div>
    <button type="button" disabled={!applicantId || !documentId || visaReference.trim().length < 2 || validitySummary.trim().length < 3 || instructions.trim().length < 2 || prepare.isPending} onClick={async () => {
      setMessage(""); try { await prepare.mutateAsync({ applicationReference, applicantId: Number(applicantId), visaDocumentId: Number(documentId), visaReference: visaReference.trim(), validitySummary: validitySummary.trim(), customerInstructions: [instructions.trim()], commandId: crypto.randomUUID() }); setMessage("Visa approved for secure customer delivery."); } catch { setMessage("Visa delivery is blocked until ownership, permission and the latest security scan all pass."); }
    }} className="mt-4 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{prepare.isPending ? "Preparing…" : "Approve & prepare secure delivery"}</button>
    {message && <p role="status" className="mt-3 text-sm text-emerald-950">{message}</p>}
  </section>;
}
