import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, Plus } from "lucide-react";
import { trpc } from "@/providers/trpc-client";
import { UnifiedInterviewReviewPanel } from "@/components/UnifiedInterviewReviewPanel";
import { InterviewPartySetup, type PartyRequirementReadiness } from "@/components/customer/InterviewPartySetup";
import { InterviewRequirementDocuments } from "@/components/customer/InterviewRequirementDocuments";
import { legacyDocumentType } from "@/components/customer/requirement-document-type";
import WizardShell, { StepHeader } from "@/components/customer/WizardShell";
import { SaveContinueButton } from "@/components/customer/SaveContinueButton";
import NationalitySelect from "@/components/customer/NationalitySelect";

type AnswerValue = string | number | boolean;
const readFileAsBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("File could not be read"));
  reader.onload = () => {
    const result = reader.result;
    if (typeof result !== "string") return reject(new Error("File could not be read"));
    const separator = result.indexOf(",");
    if (separator < 0) return reject(new Error("File could not be encoded"));
    resolve(result.slice(separator + 1));
  };
  reader.readAsDataURL(file);
});

export default function DynamicApplication() {
  const { t } = useTranslation("wizard");
  const { referenceNumber = "" } = useParams();
  const query = trpc.dynamicInterview.current.useQuery({ referenceNumber }, { enabled: referenceNumber.length >= 3, retry: false });
  const [answer, setAnswer] = useState<AnswerValue>("");
  const [editing, setEditing] = useState<{ code: string; applicantId: number | null; answer: AnswerValue } | null>(null);
  const [activeTravellerId, setActiveTravellerId] = useState<number | null>(null);
  const answerMutation = trpc.dynamicInterview.answer.useMutation({ onSuccess: async () => { setAnswer(""); setActiveTravellerId(null); await query.refetch(); } });
  const editMutation = trpc.dynamicInterview.editAnswer.useMutation({ onSuccess: async () => { setEditing(null); await query.refetch(); } });
  const addApplicantMutation = trpc.dynamicInterview.addApplicant.useMutation();
  const editApplicantMutation = trpc.dynamicInterview.editApplicant.useMutation();
  const relationshipMutation = trpc.dynamicInterview.defineRelationship.useMutation();
  const createTravelGroupMutation = trpc.dynamicInterview.createTravelGroup.useMutation();
  const updateTravelGroupMutation = trpc.dynamicInterview.updateTravelGroup.useMutation();
  const linkSharedDocumentMutation = trpc.dynamicInterview.linkSharedDocument.useMutation();
  const storageUploadMutation = trpc.storage.upload.useMutation();
  const documentCreateMutation = trpc.document.create.useMutation();
  const linkRequirementDocumentMutation = trpc.dynamicInterview.linkRequirementDocument.useMutation();
  const question = query.data?.currentQuestions[0];

  // Traveller list (from party setup when available, otherwise review/answers)
  const travellers = useMemo(() => {
    const data = query.data;
    if (!data) return [] as { applicantId: number; index: number; name: string }[];
    if (data.partySetup && data.partySetup.applicants.length > 0) {
      return data.partySetup.applicants.map((a, i) => ({ applicantId: a.applicantId, index: i, name: a.fullName }));
    }
    if (data.review.applicants.length > 0) {
      return data.review.applicants.map((a, i) => ({ applicantId: a.applicantId, index: i, name: a.label }));
    }
    return [{ applicantId: -1, index: 0, name: t("step2.traveller", { n: 1 }) }];
  }, [query.data, t]);

  // The pager follows the traveller who owns the current question by default
  // (activeTravellerId is reset to null after each saved answer), and honours
  // a manual tab pick until the next answer is submitted.
  if (query.isLoading) return <main className="mx-auto min-h-[60vh] max-w-3xl px-5 py-12" aria-live="polite">Loading your application…</main>;
  if (query.error) return <main className="mx-auto min-h-[60vh] max-w-3xl px-5 py-12"><section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-semibold text-slate-900">Application interview unavailable</h1><p className="mt-2 text-slate-700">Use the secure link sent for this application, or contact TASHIRA support.</p></section></main>;
  const state = query.data;
  if (!state) return null;

  const currentQuestionTravellerId = question?.applicantId ?? null;
  const activeId = activeTravellerId ?? currentQuestionTravellerId ?? travellers[0]?.applicantId ?? -1;
  const activeIndex = Math.max(0, travellers.findIndex((tr) => tr.applicantId === activeId));
  const activeTraveller = travellers[activeIndex] ?? travellers[0];
  const answeredIds = new Set(state.knownAnswers.map((item) => item.applicantId));
  const questionForActive = question && (question.applicantId === activeId || question.applicantId === null) ? question : null;

  const submit = () => {
    if (!questionForActive || answer === "") return;
    answerMutation.mutate({ referenceNumber, applicantId: questionForActive.applicantId, questionCode: questionForActive.code, answer, changeReason: "CUSTOMER_ANSWER" });
  };

  const goToTraveller = (index: number) => {
    const target = travellers[index];
    if (target) setActiveTravellerId(target.applicantId);
  };

  const uploadHandler = async (requirement: PartyRequirementReadiness, file: File) => {
    const documentType = legacyDocumentType(requirement.documentType);
    const applicationId = state.partySetup!.applicationId;
    const uploaded = await storageUploadMutation.mutateAsync({ applicationId,
      applicantId: requirement.applicantId, documentType, fileName: file.name, mimeType: file.type, fileSize: file.size,
      base64Data: await readFileAsBase64(file), uploadedBy: `customer:${referenceNumber}` });
    const document = await documentCreateMutation.mutateAsync({ applicationId,
      applicantId: requirement.applicantId, documentType, originalFileName: file.name, storedFileName: uploaded.storedFileName,
      mimeType: file.type, fileSize: file.size, storagePath: uploaded.storagePath, uploadStatus: "uploaded",
      uploadedBy: `customer:${referenceNumber}` });
    await linkRequirementDocumentMutation.mutateAsync({ referenceNumber, applicantId: requirement.applicantId,
      requirementCode: requirement.requirementCode, documentId: document.id, idempotencyKey: crypto.randomUUID() });
    await query.refetch();
  };

  const partyBusy = addApplicantMutation.isPending || editApplicantMutation.isPending || relationshipMutation.isPending || createTravelGroupMutation.isPending || updateTravelGroupMutation.isPending || linkSharedDocumentMutation.isPending;
  const partyError = Boolean(addApplicantMutation.error || editApplicantMutation.error || relationshipMutation.error || createTravelGroupMutation.error || updateTravelGroupMutation.error || linkSharedDocumentMutation.error);
  const docsBusy = storageUploadMutation.isPending || documentCreateMutation.isPending || linkRequirementDocumentMutation.isPending;
  const docsError = Boolean(storageUploadMutation.error || documentCreateMutation.error || linkRequirementDocumentMutation.error);

  const activeRequirements = state.partySetup
    ? state.partySetup.requirementReadiness.filter((item) => item.applicantId === activeId)
    : [];
  const activeApplicants = state.partySetup
    ? state.partySetup.applicants.filter((a) => a.applicantId === activeId)
    : [];

  return <WizardShell currentStep={2}>
    <div>
      <StepHeader
        step={2}
        title={question ? t("step2.title") : t("step2.reviewTitle")}
        subtitle={question ? t("step2.subtitle") : "Check every traveller and the documents your visa rules require before payment."}
      />
      <p className="mb-6 text-xs text-gray-400">Reference <span className="font-semibold text-[#C9A04C]">{referenceNumber}</span></p>

      {/* Traveller pager — one traveller per page */}
      {question && travellers.length > 0 && (
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Travellers">
          {travellers.map((traveller, i) => {
            const isActive = traveller.applicantId === activeId;
            const isCurrent = traveller.applicantId === currentQuestionTravellerId;
            const isDone = !isCurrent && answeredIds.has(traveller.applicantId);
            return (
              <button
                key={traveller.applicantId}
                type="button"
                onClick={() => goToTraveller(i)}
                className={`rounded-full border px-4 py-2 text-xs font-bold transition-colors ${
                  isActive
                    ? "border-[#0A1628] bg-[#0A1628] text-[#DDBB7A]"
                    : isDone
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 bg-white text-gray-400 hover:border-[#DDBB7A]"
                }`}
              >
                {isDone && <Check size={12} className="me-1 inline" />}
                {t("step2.traveller", { n: i + 1 })}
                {isActive ? ` · ${t("step2.thisTraveller")}` : isDone ? "" : isCurrent ? "" : ` · ${t("step2.notStarted")}`}
              </button>
            );
          })}
          {state.partySetup && (
            <a href="#party-setup" className="rounded-full border border-dashed border-[#C9A04C] px-4 py-2 text-xs font-bold text-[#C9A04C] hover:bg-[#C9A04C]/10">
              <Plus size={12} className="me-1 inline" />{t("step1.family")}
            </a>
          )}
        </nav>
      )}

      {/* Manage party (add travellers, family links, shared tickets) */}
      {state.partySetup && <div id="party-setup"><InterviewPartySetup setup={state.partySetup}
        busy={partyBusy}
        error={partyError}
        onAddApplicant={async (profile) => { await addApplicantMutation.mutateAsync({ referenceNumber, profile,
          reason: "Customer added applicant", idempotencyKey: crypto.randomUUID() }); await query.refetch(); }}
        onEditApplicant={async (applicant, profile) => { await editApplicantMutation.mutateAsync({ referenceNumber,
          applicantId: applicant.applicantId, expectedVersion: applicant.profileVersion, profile, reason: "Customer updated applicant profile",
          idempotencyKey: crypto.randomUUID() }); await query.refetch(); }}
        onDefineRelationship={async (fromApplicantId, toApplicantId, relationship) => { await relationshipMutation.mutateAsync({ referenceNumber,
          fromApplicantId, toApplicantId, relationship, reason: "Customer defined family relationship", idempotencyKey: crypto.randomUUID() }); await query.refetch(); }}
        onCreateTravelGroup={async (group) => { await createTravelGroupMutation.mutateAsync({ referenceNumber, group,
          reason: "Customer created travel group", idempotencyKey: crypto.randomUUID() }); await query.refetch(); }}
        onUpdateTravelGroup={async (current, group) => { await updateTravelGroupMutation.mutateAsync({ referenceNumber,
          travelGroupId: current.travelGroupId, expectedVersion: current.version, group, reason: "Customer updated travel group",
          idempotencyKey: crypto.randomUUID() }); await query.refetch(); }}
        onLinkSharedDocument={async (document, applicantIds) => { await linkSharedDocumentMutation.mutateAsync({ referenceNumber,
          documentId: document.documentId, documentType: document.documentType, applicantIds, idempotencyKey: crypto.randomUUID() });
          await query.refetch(); }} /></div>}

      {/* Current traveller question */}
      {questionForActive ? <section className="rounded-2xl border border-gray-100 bg-[#FAFAF7] p-6 sm:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm font-semibold text-[#9b7425]">{state.currentApplicant?.label ?? "Whole application"}</p><p className="text-sm text-slate-500">{state.currentStep.replaceAll("_", " ")}</p></div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">Reference {referenceNumber}</span>
        </div>
        <h2 className="text-2xl font-semibold text-slate-950">{questionForActive.label}</h2>
        <p className="mt-2 text-slate-600">{questionForActive.helpText}</p>
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{questionForActive.whyQuestionIsNeeded}</p>
        <div className="mt-7">
          {["NATIONALITY", "PASSPORT_COUNTRY", "RESIDENCE_COUNTRY", "GCC_COUNTRY"].includes(questionForActive.code)
            ? <NationalitySelect value={typeof answer === "string" ? answer : ""} onChange={(code) => setAnswer(code)} />
          : questionForActive.answerType === "BOOLEAN" ? <div className="grid grid-cols-2 gap-3">{[true, false].map((value) => <button type="button" key={String(value)} onClick={() => setAnswer(value)} className={`rounded-xl border px-5 py-4 font-semibold ${answer === value ? "border-[#b48a36] bg-amber-50" : "border-slate-200"}`}>{value ? "Yes" : "No"}</button>)}</div>
          : questionForActive.answerType === "SELECT" && questionForActive.allowedValues ? <select value={String(answer)} onChange={(event) => setAnswer(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-4"><option value="">Select an answer</option>{questionForActive.allowedValues.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          : <input type={questionForActive.answerType === "DATE" ? "date" : questionForActive.answerType === "NUMBER" ? "number" : "text"} value={String(answer)} onChange={(event) => setAnswer(questionForActive.answerType === "NUMBER" ? Number(event.target.value) : event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-4" autoComplete="off" />}
        </div>
        {answerMutation.error && <p className="mt-4 text-sm text-red-700">We could not save that answer. Please review it and try again.</p>}
        <button type="button" disabled={answer === "" || answerMutation.isPending} onClick={submit} className="mt-7 w-full rounded-xl bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] px-6 py-4 font-bold text-white shadow-md shadow-[#C9A04C]/30 disabled:cursor-not-allowed disabled:opacity-50">{answerMutation.isPending ? "Saving…" : "Continue"}</button>
      </section> : question ? (
        <section className="rounded-2xl border border-gray-100 bg-[#FAFAF7] p-6 sm:p-8">
          <p className="text-sm text-slate-600">
            {answeredIds.has(activeId) ? t("step2.noQuestions") : t("step2.waiting")}
          </p>
        </section>
      ) : null}

      {/* Active traveller documents */}
      {state.partySetup && activeRequirements.length > 0 && <div className="mb-3 mt-8">
        <span className="inline-block rounded-full bg-[#C9A04C]/10 px-4 py-1.5 text-xs font-bold text-[#C9A04C]">{t("steps.travellers")}</span>
        <h2 className="mt-3 text-xl font-extrabold text-[#0A1628]">
          {t("step2.docsTitle", { name: activeTraveller?.name ?? t("step2.traveller", { n: activeIndex + 1 }) })}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{t("step2.docsSub")}</p>
      </div>}
      {state.partySetup && <InterviewRequirementDocuments applicants={activeApplicants} requirements={activeRequirements}
        busy={docsBusy}
        error={docsError}
        onUpload={uploadHandler} />}

      {/* Review when interview is complete */}
      {!question && <section className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Interview complete</p><h2 className="mt-2 text-2xl font-bold text-slate-950">{t("step2.reviewTitle")}</h2><p className="mt-3 text-slate-600">Application status: {state.eligibilityState.replaceAll("_", " ")}</p><div className="mt-6 space-y-4">{state.review.applicants.map((applicant) => <article key={applicant.applicantId} className="rounded-2xl border border-slate-200 p-5"><h3 className="font-semibold text-slate-950">{applicant.label}</h3><p className="mt-1 text-sm text-slate-600">{applicant.customerMessage}</p><p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Requirements</p>{applicant.requirements.length ? <ul className="mt-2 grid gap-2 sm:grid-cols-2">{applicant.requirements.map((requirement) => <li key={`${requirement.code}-${requirement.state}`} className="rounded-lg bg-slate-50 px-3 py-3 text-sm"><span className="font-semibold text-slate-900">{requirement.label}</span><span className="mt-1 block text-xs text-[#8a6721]">{requirement.classification.replaceAll("_", " ")}</span><span className="mt-1 block text-xs text-slate-600">{requirement.explanation}</span></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No verified requirement list is available yet.</p>}{applicant.evidence && <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-xs text-slate-600"><p className="font-semibold uppercase tracking-wide text-slate-500">Evaluation evidence</p><p className="mt-1">{applicant.evidence.reason}</p>{applicant.evidence.manualReviewReason && <p className="mt-1 font-semibold text-amber-800">Review reason: {applicant.evidence.manualReviewReason}</p>}{applicant.evidence.matchedRules.length > 0 && <ul className="mt-2 space-y-1">{applicant.evidence.matchedRules.map((rule) => <li key={`${rule.ruleId}-${rule.ruleVersion}`}><span className="font-mono text-[11px] text-slate-800">{rule.ruleId} v{rule.ruleVersion}</span><span className="mx-1 text-slate-400">·</span>{rule.layer.replaceAll("_", " ")}<span className="mx-1 text-slate-400">·</span>{rule.sourceAuthority}<span className="mt-0.5 block text-slate-500">{rule.reason}</span></li>)}</ul>}</div>}</article>)}</div>{state.review.manualReviewRequired && <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950"><p className="font-bold">Specialist review required before payment</p><p className="mt-1">Your saved application is already visible to the Operations team.</p><ul className="mt-3 list-disc space-y-1 ps-5">{state.review.applicants.filter((a) => a.evidence?.manualReviewReason || ["HUMAN_REVIEW_REQUIRED", "NOT_RESEARCHED", "RULE_CONFLICT"].includes(a.eligibilityState)).map((a) => <li key={a.applicantId}><strong>{a.label}:</strong> {a.evidence?.manualReviewReason ?? a.customerMessage}</li>)}</ul><p className="mt-3 text-xs text-amber-800">Next step: a TASHIRA specialist reviews the evaluated rules and any missing data above, then contacts you or clears the application for payment. Nothing is lost — your confirmed requirements remain attached to each traveller.</p></section>}<div className="mt-6 grid gap-3 sm:grid-cols-2"><Link to={`/applications/${encodeURIComponent(referenceNumber)}/status`} className="rounded-xl border border-slate-300 px-5 py-3 text-center font-semibold text-slate-800">{t("step2.saveView")}</Link><Link to={`/pay/${encodeURIComponent(referenceNumber)}`} className={`rounded-xl px-5 py-3 text-center font-bold ${state.review.manualReviewRequired ? "pointer-events-none bg-slate-200 text-slate-500" : "bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] text-white shadow-md shadow-[#C9A04C]/30"}`}>{t("step2.continueToPay")}</Link></div></section>}
      {state.unifiedReview && <UnifiedInterviewReviewPanel review={state.unifiedReview} />}
      {state.unifiedReviewBlocker === "RELATIONSHIP_REQUIRED" && <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
        <strong>Complete the family relationships above.</strong>
        <p className="mt-1">Every family member must be linked to the lead applicant before the final family readiness review can be generated.</p>
      </section>}
      {state.knownAnswers.length > 0 && <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer font-semibold text-slate-900">Review previous answers</summary><ul className="mt-4 space-y-3 text-sm text-slate-700">{state.knownAnswers.map((item) => <li key={`${item.applicantId}-${item.code}`} className="border-b border-slate-100 pb-3">{editing?.code === item.code && editing.applicantId === item.applicantId ? <div className="space-y-2"><label className="block font-medium" htmlFor={`edit-${item.applicantId}-${item.code}`}>{item.code.replaceAll("_", " ")}</label>{["NATIONALITY", "PASSPORT_COUNTRY", "RESIDENCE_COUNTRY", "GCC_COUNTRY"].includes(item.code)
        ? <NationalitySelect value={typeof editing.answer === "string" ? editing.answer : ""} onChange={(code) => setEditing({ ...editing, answer: code })} />
        : <input id={`edit-${item.applicantId}-${item.code}`} value={String(editing.answer)} onChange={(event) => setEditing({ ...editing, answer: typeof item.answer === "boolean" ? event.target.value === "true" : typeof item.answer === "number" ? Number(event.target.value) : event.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2"/>}<div className="flex gap-2"><button type="button" className="rounded-lg bg-[#C9A04C] px-3 py-2 font-semibold text-white" disabled={editMutation.isPending} onClick={() => editMutation.mutate({ referenceNumber, applicantId: editing.applicantId, questionCode: editing.code, answer: editing.answer, changeReason: "CUSTOMER_CORRECTION" })}>Save correction</button><button type="button" className="rounded-lg border border-slate-300 px-3 py-2" onClick={() => setEditing(null)}>Cancel</button></div></div> : <div className="flex items-center justify-between gap-4"><span>{item.code.replaceAll("_", " ")}</span><span className="flex items-center gap-3"><strong>{String(item.answer)}</strong><button type="button" className="text-[#8a6721] underline" onClick={() => setEditing(item)}>Edit</button></span></div>}</li>)}</ul>{editMutation.error && <p className="mt-3 text-sm text-red-700">We could not save that correction. Please try again.</p>}</details>}

      {/* Action row: previous traveller / save / next traveller */}
      {question && (
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          {activeIndex > 0 ? (
            <button type="button" onClick={() => goToTraveller(activeIndex - 1)}
              className="rounded-xl bg-gray-100 border border-gray-200 px-6 py-3 font-bold text-gray-500 hover:bg-gray-200 transition-colors">
              {t("step2.prevTraveller", { n: activeIndex })}
            </button>
          ) : <span />}
          <SaveContinueButton />
          {activeIndex < travellers.length - 1 ? (
            <button type="button" onClick={() => goToTraveller(activeIndex + 1)}
              className="rounded-xl bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] px-8 py-3 font-bold text-white shadow-md shadow-[#C9A04C]/30 hover:shadow-lg transition-all">
              {t("step2.nextTraveller")}
            </button>
          ) : <span />}
        </div>
      )}
    </div>
  </WizardShell>;
}
