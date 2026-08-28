import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { trpc } from "@/providers/trpc-client";
import { TERMS_POLICY_VERSION } from "@contracts/constants";

const visaRoutes = [
  ["14days-single", "14 Days Visa"], ["14days-multiple", "14 Days Multiple Entry"],
  ["30days-single", "30 Days Visa"], ["30days-multiple", "30 Days Multiple Entry"],
  ["60days-single", "60 Days Visa"], ["60days-multiple", "60 Days Multiple Entry"],
  ["90days-single", "90 Days Visa"], ["96hours-transit", "96 Hours Transit"],
] as const;

function createReference(): string {
  return `TSH-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

export default function DynamicApplicationStart() {
  const navigate = useNavigate();
  const [applicationType, setApplicationType] = useState<"single" | "family">("single");
  const [applicantCount, setApplicantCount] = useState(1);
  const [visaType, setVisaType] = useState<string>(visaRoutes[0][0]);
  const [processingType, setProcessingType] = useState<"regular" | "express">("regular");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [accepted, setAccepted] = useState(false);
  const applicants = useMemo(() => Array.from({ length: applicationType === "single" ? 1 : applicantCount }, (_, index) => ({
    fullName: `Applicant ${index + 1}`,
  })), [applicationType, applicantCount]);
  const create = trpc.application.create.useMutation({
    onSuccess: ({ referenceNumber }) => navigate(`/apply/${encodeURIComponent(referenceNumber)}/interview`, { replace: true }),
  });

  return <main className="min-h-[75vh] bg-slate-50 px-4 py-10"><div className="mx-auto max-w-4xl">
    <header className="mb-7 text-center"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#9b7425]">TASHIRA Dynamic Application</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Start your visa application</h1><p className="mx-auto mt-3 max-w-2xl text-slate-600">The next steps adapt independently for every traveller and show only the questions and documents relevant to that applicant.</p></header>
    <form className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9" onSubmit={(event) => {
      event.preventDefault(); if (!accepted || create.isPending) return;
      create.mutate({ referenceNumber: createReference(), baseType: applicationType, residenceType: "non-gcc", visaType,
        processingType, contactEmail: email, contactPhone: phone, journeyMode: "DYNAMIC", ...(arrivalDate ? { arrivalDate } : {}),
        policyVersion: TERMS_POLICY_VERSION, applicants });
    }}>
      <fieldset><legend className="text-sm font-semibold text-slate-900">Who is travelling?</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{(["single", "family"] as const).map((type) => <button key={type} type="button" onClick={() => { setApplicationType(type); setApplicantCount(type === "single" ? 1 : Math.max(2, applicantCount)); }} className={`rounded-2xl border p-5 text-left ${applicationType === type ? "border-amber-500 bg-amber-50" : "border-slate-200"}`}><strong>{type === "single" ? "Single applicant" : "Family / multiple applicants"}</strong><span className="mt-1 block text-sm text-slate-600">{type === "single" ? "One traveller" : "Separate questions and documents for every traveller"}</span></button>)}</div></fieldset>
      {applicationType === "family" && <label className="mt-5 block text-sm font-medium">Number of travellers<input type="number" min={2} max={10} value={applicantCount} onChange={(event) => setApplicantCount(Math.min(10, Math.max(2, Number(event.target.value))))} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Visa service<select value={visaType} onChange={(event) => setVisaType(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3">{visaRoutes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm font-medium">Processing<select value={processingType} onChange={(event) => setProcessingType(event.target.value as "regular" | "express")} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"><option value="regular">Regular</option><option value="express">Express</option></select></label>
        <label className="text-sm font-medium">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
        <label className="text-sm font-medium">Mobile number<input required value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
        <label className="text-sm font-medium sm:col-span-2">Planned arrival date<input type="date" value={arrivalDate} onChange={(event) => setArrivalDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
      </div>
      <label className="mt-6 flex items-start gap-3 text-sm text-slate-700"><input required type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1" /><span>I agree to the <Link className="text-amber-700 underline" to="/terms" target="_blank">Terms</Link>, <Link className="text-amber-700 underline" to="/privacy" target="_blank">Privacy Policy</Link> and <Link className="text-amber-700 underline" to="/refund" target="_blank">Refund/Cancellation Policy</Link>.</span></label>
      {create.error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">We couldn't start your application. Please check the details and try again.</p>}
      <button type="submit" disabled={!accepted || create.isPending} className="mt-7 w-full rounded-xl bg-[#cda64f] px-6 py-4 font-bold text-slate-950 disabled:opacity-50">{create.isPending ? "Creating secure application…" : "Continue to dynamic interview"}</button>
      <p className="mt-4 text-center text-xs text-slate-500">Progress remains tied to the same secure application reference so you can leave and resume later.</p>
    </form>
  </div></main>;
}
