import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { trpc } from "@/providers/trpc-client";
import { InterviewPartySetup, type PartyRequirementReadiness } from "@/components/customer/InterviewPartySetup";
import { InterviewRequirementDocuments } from "@/components/customer/InterviewRequirementDocuments";
import { legacyDocumentType } from "@/components/customer/requirement-document-type";
import WizardShell, { StepHeader } from "@/components/customer/WizardShell";
import { SaveContinueButton } from "@/components/customer/SaveContinueButton";
import { ApplicantDataForm, type ApplicantFormSubmission, type FormAnswer } from "@/components/customer/ApplicantDataForm";

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
  const [phase, setPhase] = useState<3 | 4 | 5 | null>(null);
  const [activeTravellerId, setActiveTravellerId] = useState<number | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const answerMutation = trpc.dynamicInterview.answer.useMutation();
  const completeFormMutation = trpc.dynamicInterview.completeForm.useMutation();
  const editMutation = trpc.dynamicInterview.editAnswer.useMutation();
  const updateApplicationMutation = trpc.wizard.updateApplication.useMutation();
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
  const readiness = trpc.payment.readiness.useQuery({ referenceNumber },
    { enabled: referenceNumber.length >= 3 && Boolean(query.data), retry: false });

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
  const refreshState = async () => {
    await query.refetch();
    await readiness.refetch();
  };
  const state = query.data;
  if (!state) return null;

  const currentQuestionTravellerId = question?.applicantId ?? null;
  const activeId = activeTravellerId ?? travellers[0]?.applicantId ?? -1;
  const activeIndex = Math.max(0, travellers.findIndex((tr) => tr.applicantId === activeId));
  const activeTraveller = travellers[activeIndex] ?? travellers[0];


  const saveApplicantForm = async (applicantId: number, submission: ApplicantFormSubmission) => {
    setFormSaving(true);
    try {
    const applicant = state.partySetup?.applicants.find(item => item.applicantId === applicantId);
    if (!applicant) throw new Error("Applicant unavailable");
    await updateApplicationMutation.mutateAsync({ referenceNumber, applicantIndex: applicant.applicantIndex,
      passportNumber: submission.passportNumber, passportExpiry: submission.passportExpiry, profession: submission.profession });
    if (applicant.fullName !== submission.profile.fullName || applicant.nationality !== submission.profile.nationality || applicant.residenceCountry !== submission.profile.residenceCountry) {
      await editApplicantMutation.mutateAsync({ referenceNumber, applicantId, expectedVersion: applicant.profileVersion,
        profile: submission.profile, reason: "Customer saved applicant form", idempotencyKey: crypto.randomUUID() });
    }
    const refreshed = (await query.refetch()).data;
    if (!refreshed) throw new Error("Application unavailable");
    let latest: NonNullable<typeof query.data> = refreshed;
    for (const field of submission.answers) {
      // Recheck relevance after each save: conditional fields may disappear or become required.
      if (!latest.formQuestions?.some(item => item.code === field.code && item.applicantId === field.applicantId)) continue;
      const previous: FormAnswer | undefined = latest.knownAnswers.find(item => item.code === field.code && item.applicantId === field.applicantId);
      if (previous?.answer === field.answer) continue;
      const input = { referenceNumber, applicantId: field.applicantId, questionCode: field.code, answer: field.answer, changeReason: "CUSTOMER_FORM_SAVE" };
      latest = previous ? await editMutation.mutateAsync({ ...input, fromForm: true }) : await answerMutation.mutateAsync({ ...input, fromForm: true });
    }
    const ownMissing = latest.currentQuestions.some(item => item.applicantId === applicantId || item.applicantId === null);
    if (!ownMissing) {
      await completeFormMutation.mutateAsync({ referenceNumber, applicantId, submissionId: crypto.randomUUID() });
      await refreshState();
      setActiveTravellerId(applicantId);
      setPhase(4);
    } else { setActiveTravellerId(applicantId); setPhase(3); }
    await refreshState();
    } finally { setFormSaving(false); }
  };

  const goToTraveller = (index: number) => {
    const target = travellers[index];
    if (target) { setActiveTravellerId(target.applicantId); setPhase(3); }
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
    await refreshState();
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

  const currentStep = phase ?? 3;
  return <WizardShell currentStep={currentStep === 5 ? 3 : 2}>
    <div>
      <StepHeader
        step={currentStep === 5 ? 3 : 2}
        title={t(currentStep === 5 ? "steps.review" : "steps.data")}
        subtitle={t("flow.subtitle")}
      />
      <p className="mb-6 text-xs text-gray-400">Reference <span className="font-semibold text-[#C9A04C]">{referenceNumber}</span></p>

      {/* Traveller pager — one traveller per page */}
      {currentStep !== 5 && travellers.length > 1 && (
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Travellers">
          {travellers.map((traveller, i) => {
            const isActive = traveller.applicantId === activeId;
            const isCurrent = traveller.applicantId === currentQuestionTravellerId;
            const fields = (state.formQuestions ?? state.currentQuestions).filter(field => field.applicantId === traveller.applicantId);
            const isDone = fields.length > 0 && fields.every(field => state.knownAnswers.some(answer => answer.applicantId === field.applicantId && answer.code === field.code));
            return (
              <button
                key={traveller.applicantId}
                type="button"
                disabled={formSaving || docsBusy || i > activeIndex}
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

        </nav>
      )}

      {/* Manage party (add travellers, family links, shared tickets) */}
      {state.partySetup && travellers.length > 1 && <details id="party-setup" className="mb-5 rounded-xl border border-slate-200 p-4" hidden={currentStep !== 3}><summary className="cursor-pointer text-sm font-semibold">{t("simple.family")}</summary><InterviewPartySetup setup={state.partySetup}
        hideTravelGroups relationshipsOnly
        busy={partyBusy}
        error={partyError}
        onAddApplicant={async (profile) => { await addApplicantMutation.mutateAsync({ referenceNumber, profile,
          reason: "Customer added applicant", idempotencyKey: crypto.randomUUID() }); await refreshState(); }}
        onEditApplicant={async (applicant, profile) => { await editApplicantMutation.mutateAsync({ referenceNumber,
          applicantId: applicant.applicantId, expectedVersion: applicant.profileVersion, profile, reason: "Customer updated applicant profile",
          idempotencyKey: crypto.randomUUID() }); await refreshState(); }}
        onDefineRelationship={async (fromApplicantId, toApplicantId, relationship) => { await relationshipMutation.mutateAsync({ referenceNumber,
          fromApplicantId, toApplicantId, relationship, reason: "Customer defined family relationship", idempotencyKey: crypto.randomUUID() }); await refreshState(); }}
        onCreateTravelGroup={async (group) => { await createTravelGroupMutation.mutateAsync({ referenceNumber, group,
          reason: "Customer created travel group", idempotencyKey: crypto.randomUUID() }); await refreshState(); }}
        onUpdateTravelGroup={async (current, group) => { await updateTravelGroupMutation.mutateAsync({ referenceNumber,
          travelGroupId: current.travelGroupId, expectedVersion: current.version, group, reason: "Customer updated travel group",
          idempotencyKey: crypto.randomUUID() }); await refreshState(); }}
        onLinkSharedDocument={async (document, applicantIds) => { await linkSharedDocumentMutation.mutateAsync({ referenceNumber,
          documentId: document.documentId, documentType: document.documentType, applicantIds, idempotencyKey: crypto.randomUUID() });
          await refreshState(); }} /></details>}

      {/* A complete, grouped form per applicant; hidden instances retain independent drafts. */}
      {state.partySetup?.applicants.map((applicant, index) => <div key={applicant.applicantId} hidden={currentStep === 5 || applicant.applicantId !== activeId}>
        <ApplicantDataForm applicant={applicant} onEdit={() => setPhase(3)} arrivalDate={state.applicationContext.arrivalDate} residenceType={state.applicationContext.residenceType ?? "non-gcc"}
          questions={(state.formQuestions ?? state.currentQuestions).filter(field => field.applicantId === applicant.applicantId || (field.applicantId === null && index === 0))}
          saved={state.knownAnswers} onSave={submission => saveApplicantForm(applicant.applicantId, submission)} />
      </div>)}

      {/* Active traveller documents */}
      {currentStep === 4 && state.partySetup && activeRequirements.length > 0 && <div className="mb-3 mt-8">
        <span className="inline-block rounded-full bg-[#C9A04C]/10 px-4 py-1.5 text-xs font-bold text-[#C9A04C]">{t("steps.documents")}</span>
        <h2 className="mt-3 text-xl font-extrabold text-[#0A1628]">
          {t("step2.docsTitle", { name: activeTraveller?.name ?? t("step2.traveller", { n: activeIndex + 1 }) })}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{t("step2.docsSub")}</p>
      </div>}
      {state.partySetup && <div hidden={currentStep !== 4}><InterviewRequirementDocuments applicants={activeApplicants} requirements={activeRequirements}
        busy={docsBusy}
        error={docsError}
        onUpload={uploadHandler} /></div>}

      {/* Review when interview is complete — minimal, customer-friendly */}
      {currentStep === 5 && <section>
        <div className="rounded-3xl bg-gradient-to-br from-[#0A1628] to-[#16283f] p-8 text-center text-white shadow-sm">
          <p className="text-3xl">✅</p>
          <h2 className="mt-3 text-2xl font-extrabold">{t("step2.done.title")}</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#DDBB7A]">
            {readiness.data?.status === "READY" ? t("step2.done.ready") : t("step2.done.underReview")}
          </p>
          <span className="mt-5 inline-block rounded-full border border-[#DDBB7A]/30 bg-white/5 px-5 py-2 text-sm font-semibold text-[#DDBB7A]">{referenceNumber}</span>
        </div>

        <div className="mt-5 space-y-4">
          {state.review.applicants.map((applicant) => <article key={applicant.applicantId} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-[#0A1628]">{applicant.label}</h3>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${readiness.data?.status !== "READY" ? "bg-amber-50 text-[#9b7425]" : "bg-emerald-50 text-emerald-700"}`}>
                {readiness.data?.status !== "READY" ? t("step2.done.underReviewBadge") : t("step2.done.readyBadge")}
              </span>
            </div>
            {applicant.requirements.length > 0 && <ul className="mt-4 divide-y divide-gray-50">
              {applicant.requirements.map((requirement) => {
                const needed = requirement.classification !== "MAY_BE_REQUIRED" && !["UPLOADED", "VALIDATED", "WAIVED"].includes(requirement.state);
                const received = ["UPLOADED", "VALIDATED", "WAIVED"].includes(requirement.state);
                return <li key={`${requirement.code}-${requirement.state}`} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium text-[#0A1628]">{requirement.label}</span>
                  {received
                    ? <span className="text-xs font-bold text-emerald-700">✓ {t("step2.done.received")}</span>
                    : needed
                      ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-[#9b7425]">{t("step2.done.needed")}</span>
                      : <span className="text-xs text-gray-400">{t("step2.done.ifAsked")}</span>}
                </li>;
              })}
            </ul>}
          </article>)}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Link to={`/applications/${encodeURIComponent(referenceNumber)}/status`} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700">{t("step2.saveView")}</Link>
          {readiness.data?.status === "READY" && !state.review.manualReviewRequired && <Link to={`/pay/${encodeURIComponent(referenceNumber)}`} className="rounded-xl bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] px-8 py-3 font-bold text-white shadow-md shadow-[#C9A04C]/30">{t("step2.continueToPay")}</Link>}
        </div>
      </section>}
      {state.unifiedReviewBlocker === "RELATIONSHIP_REQUIRED" && <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
        <strong>Complete the family relationships above.</strong>
        <p className="mt-1">Every family member must be linked to the lead applicant before the final family readiness review can be generated.</p>
      </section>}
      <div className="mt-8 space-y-4">
        <p className="text-sm text-slate-600">{t("flow.savedOnly")}</p>
        <SaveContinueButton />
        {currentStep === 4 && <>
          <p className="text-sm text-slate-600">{t("simple.uploadBeforeNext")}</p>
          <button type="button" disabled={formSaving || docsBusy || !activeRequirements.length || activeRequirements.some(item => !["UPLOADED", "VALIDATED", "WAIVED"].includes(item.state))}
            className="min-h-11 rounded-xl bg-[#C9A04C] px-6 py-3 font-bold disabled:opacity-50"
            onClick={() => activeIndex < travellers.length - 1 ? goToTraveller(activeIndex + 1) : setPhase(5)}>
            {t(activeIndex < travellers.length - 1 ? "step2.nextTraveller" : "simple.reviewApplication")}</button>
        </>}
        {currentStep > 3 && <button type="button" className="min-h-11 rounded-xl border px-6 py-3"
          onClick={() => setPhase(currentStep === 5 ? 4 : 3)}>{t("step2.back")}</button>}
        {currentStep === 5 && readiness.data?.status !== "READY" && <p role="status">{t("flow.notReady")}</p>}
      </div>
    </div>
  </WizardShell>;
}
