import { useState } from "react";
import { useParams } from "react-router-dom";
import { trpc } from "@/providers/trpc-client";

const steps = ["Applicant Profile", "Travel Details", "Requirements", "Documents", "Review"] as const;
type AnswerValue = string | number | boolean;

export default function DynamicApplication() {
  const { referenceNumber = "" } = useParams();
  const query = trpc.dynamicInterview.current.useQuery({ referenceNumber }, { enabled: referenceNumber.length >= 3, retry: false });
  const [answer, setAnswer] = useState<AnswerValue>("");
  const [editing, setEditing] = useState<{ code: string; applicantId: number | null; answer: AnswerValue } | null>(null);
  const answerMutation = trpc.dynamicInterview.answer.useMutation({ onSuccess: async () => { setAnswer(""); await query.refetch(); } });
  const editMutation = trpc.dynamicInterview.editAnswer.useMutation({ onSuccess: async () => { setEditing(null); await query.refetch(); } });
  const question = query.data?.currentQuestions[0];

  if (query.isLoading) return <main className="mx-auto min-h-[60vh] max-w-3xl px-5 py-12" aria-live="polite">Loading your application…</main>;
  if (query.error) return <main className="mx-auto min-h-[60vh] max-w-3xl px-5 py-12"><section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-semibold text-slate-900">Application interview unavailable</h1><p className="mt-2 text-slate-700">Use the secure link sent for this application, or contact TASHIRA support.</p></section></main>;
  const state = query.data;
  if (!state) return null;
  const activeStep = state.currentStep === "PROFILE" ? 0 : state.currentStep === "TRAVEL_PARTY" || state.currentStep === "TRAVEL_DATES" ? 1 : 4;
  const submit = () => {
    if (!question || answer === "") return;
    answerMutation.mutate({ referenceNumber, applicantId: question.applicantId, questionCode: question.code, answer, changeReason: "CUSTOMER_ANSWER" });
  };
  return <main className="min-h-[70vh] bg-slate-50 px-4 py-8 sm:py-12">
    <div className="mx-auto max-w-3xl">
      <header className="mb-7">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9b7425]">Secure visa application</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Tell us about your trip</h1>
        <p className="mt-2 text-slate-600">We ask only the questions needed for your application.</p>
      </header>
      <ol className="mb-8 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5" aria-label="Application progress">
        {steps.map((step, index) => <li key={step} className={`rounded-full px-3 py-2 text-center ${index <= activeStep ? "bg-[#cda64f] font-semibold text-slate-950" : "bg-white text-slate-500"}`}>{step}</li>)}
      </ol>
      {question ? <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm font-semibold text-[#9b7425]">{state.currentApplicant?.label ?? "Whole application"}</p><p className="text-sm text-slate-500">{state.currentStep.replaceAll("_", " ")}</p></div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">Reference {referenceNumber}</span>
        </div>
        <h2 className="text-2xl font-semibold text-slate-950">{question.label}</h2>
        <p className="mt-2 text-slate-600">{question.helpText}</p>
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{question.whyQuestionIsNeeded}</p>
        <div className="mt-7">
          {question.answerType === "BOOLEAN" ? <div className="grid grid-cols-2 gap-3">{[true, false].map((value) => <button type="button" key={String(value)} onClick={() => setAnswer(value)} className={`rounded-xl border px-5 py-4 font-semibold ${answer === value ? "border-[#b48a36] bg-amber-50" : "border-slate-200"}`}>{value ? "Yes" : "No"}</button>)}</div>
          : question.answerType === "SELECT" && question.allowedValues ? <select value={String(answer)} onChange={(event) => setAnswer(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-4"><option value="">Select an answer</option>{question.allowedValues.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          : <input type={question.answerType === "DATE" ? "date" : question.answerType === "NUMBER" ? "number" : "text"} value={String(answer)} onChange={(event) => setAnswer(question.answerType === "NUMBER" ? Number(event.target.value) : event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-4" autoComplete="off" />}
        </div>
        {answerMutation.error && <p className="mt-4 text-sm text-red-700">We could not save that answer. Please review it and try again.</p>}
        <button type="button" disabled={answer === "" || answerMutation.isPending} onClick={submit} className="mt-7 w-full rounded-xl bg-[#cda64f] px-6 py-4 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{answerMutation.isPending ? "Saving…" : "Continue"}</button>
      </section> : <section className="rounded-3xl border border-emerald-200 bg-white p-8 shadow-sm"><p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Interview complete</p><h2 className="mt-2 text-2xl font-bold text-slate-950">Your answers are ready for review</h2><p className="mt-3 text-slate-600">Eligibility status: {state.eligibilityState.replaceAll("_", " ")}</p></section>}
      {state.knownAnswers.length > 0 && <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer font-semibold text-slate-900">Review previous answers</summary><ul className="mt-4 space-y-3 text-sm text-slate-700">{state.knownAnswers.map((item) => <li key={`${item.applicantId}-${item.code}`} className="border-b border-slate-100 pb-3">{editing?.code === item.code && editing.applicantId === item.applicantId ? <div className="space-y-2"><label className="block font-medium" htmlFor={`edit-${item.applicantId}-${item.code}`}>{item.code.replaceAll("_", " ")}</label><input id={`edit-${item.applicantId}-${item.code}`} value={String(editing.answer)} onChange={(event) => setEditing({ ...editing, answer: typeof item.answer === "boolean" ? event.target.value === "true" : typeof item.answer === "number" ? Number(event.target.value) : event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2"/><div className="flex gap-2"><button type="button" className="rounded-lg bg-[#cda64f] px-3 py-2 font-semibold text-slate-950" disabled={editMutation.isPending} onClick={() => editMutation.mutate({ referenceNumber, applicantId: editing.applicantId, questionCode: editing.code, answer: editing.answer, changeReason: "CUSTOMER_CORRECTION" })}>Save correction</button><button type="button" className="rounded-lg border border-slate-300 px-3 py-2" onClick={() => setEditing(null)}>Cancel</button></div></div> : <div className="flex items-center justify-between gap-4"><span>{item.code.replaceAll("_", " ")}</span><span className="flex items-center gap-3"><strong>{String(item.answer)}</strong><button type="button" className="text-[#8a6721] underline" onClick={() => setEditing(item)}>Edit</button></span></div>}</li>)}</ul>{editMutation.error && <p className="mt-3 text-sm text-red-700">We could not save that correction. Please try again.</p>}</details>}
    </div>
  </main>;
}
