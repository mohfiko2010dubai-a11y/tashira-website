import NationalityAvailabilityNotice from "@/components/customer/NationalityAvailabilityNotice";
import { ApplicationDomScope } from "@/components/customer/ApplicationDomScope";
import { interviewTitle } from "../../contracts/private-page-title";
import { motionCommit } from "@/lib/motion";
import { ownerRequiredDocumentCodes } from "../../contracts/owner-document-requirements";
import OptionalFlightNotice from "@/components/customer/OptionalFlightNotice";
import { customerFileCount } from "@contracts/customer-count";
import { ApplicationSupplements } from "@/components/customer/ApplicationSupplements";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { TravellerContext } from "@/components/customer/TravellerContext";
import { Check } from "lucide-react";
import { trpc } from "@/providers/trpc-client";
import { documentUploadClient } from "@/lib/document-upload-client";
import { documentMimeType, type DocumentUploadProgress } from "../../contracts/document-upload-policy";
import { InterviewPartySetup, type PartyRequirementReadiness } from "@/components/customer/InterviewPartySetup";
import { InterviewRequirementDocuments } from "@/components/customer/InterviewRequirementDocuments";
import { legacyDocumentType } from "@/components/customer/requirement-document-type";
import { reviewDocumentStatus } from "@/components/customer/review-document-status";
import { canVisitCheckout } from "@/lib/checkout-preflight";
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
  const domScope = useContext(ApplicationDomScope);
  const { t, i18n } = useTranslation("wizard");
  useEffect(() => { if (!domScope) document.title = interviewTitle(i18n.language); }, [domScope, i18n.language]);
  const { referenceNumber = "" } = useParams();
  const query = trpc.dynamicInterview.current.useQuery({ referenceNumber }, { enabled: referenceNumber.length >= 3, retry: false });
  const [phase, updatePhase] = useState<3 | 4 | 5 | null>(null);
  const setPhase = (next: 3 | 4 | 5) => { if (next === phase) return; motionCommit(() => updatePhase(next), next < (phase ?? 3)); };
  const [activeTravellerId, setActiveTravellerId] = useState<number | null>(null);
  const [editingContext, setEditingContext] = useState(false);
  const prepareUploadMutation = trpc.dynamicInterview.prepareDocumentUploads.useMutation();
  const editContextMutation = trpc.dynamicInterview.editDocumentContext.useMutation();
  const [formSaving, setFormSaving] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [reviewAttempt, setReviewAttempt] = useState(0);
  const [validationCounts, setValidationCounts] = useState<Record<number, number>>({});
  const onValidationCount = useCallback((applicantId: number, count: number) => {
    setValidationCounts(current => current[applicantId] === count ? current : { ...current, [applicantId]: count });
  }, []);
  const [newDocumentCodes, setNewDocumentCodes] = useState<Record<number, string[]>>({});
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
  const [uploadingDocument, setUploadingDocument] = useState(false);
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
  // and honours an explicit manual selection until the customer navigates again.
  if (query.isLoading) return <main className="mx-auto min-h-[60vh] max-w-3xl px-5 py-12" aria-live="polite">Loading your application…</main>;
  if (query.error) return <main className="mx-auto min-h-[60vh] max-w-3xl px-5 py-12"><section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-semibold text-slate-900">Application interview unavailable</h1><p className="mt-2 text-slate-700">Use the secure link sent for this application, or contact TASHIRA support.</p></section></main>;
  const refreshState = async () => {
    await query.refetch();
    await readiness.refetch();
  };
  const state = query.data;
  if (!state) return null;

  const currentQuestionTravellerId = question?.applicantId ?? null;
  const activeId = activeTravellerId ?? currentQuestionTravellerId ?? travellers[0]?.applicantId ?? -1;
  const activeIndex = Math.max(0, travellers.findIndex((tr) => tr.applicantId === activeId));
  const activeProfile = state.partySetup?.applicants.find(item => item.applicantId === activeId);
  const contextOpen = editingContext || Boolean(activeProfile && (!activeProfile.nationality || !activeProfile.residenceCountry));


  const saveApplicantForm = async (applicantId: number, submission: ApplicantFormSubmission, continueAfter: boolean) => {
    setMissingFields([]);
    setFormSaving(true);
    try {
    const applicant = state.partySetup?.applicants.find(item => item.applicantId === applicantId);
    if (!applicant) throw new Error("Applicant unavailable");
    const previousCodes = ownerRequiredDocumentCodes(applicant.nationality, applicant.residenceCountry, state.applicationContext.visaType, applicant.tripPurpose, state.applicationContext.residenceType);
    await updateApplicationMutation.mutateAsync({ referenceNumber, applicantIndex: applicant.applicantIndex,
      passportNumber: submission.passportNumber, passportExpiry: submission.passportExpiry, profession: submission.profession });
    if (applicant.fullName !== submission.profile.fullName || applicant.nationality !== submission.profile.nationality || applicant.residenceCountry !== submission.profile.residenceCountry || applicant.tripPurpose !== submission.profile.tripPurpose) {
      await editApplicantMutation.mutateAsync({ referenceNumber, applicantId, expectedVersion: applicant.profileVersion,
        profile: submission.profile, reason: "Customer saved applicant form", idempotencyKey: crypto.randomUUID() });
    }
    const refreshed = (await query.refetch()).data;
    if (!refreshed) throw new Error("Application unavailable");
    let latest: NonNullable<typeof query.data> = refreshed;
    for (const field of submission.answers) {
      // Recheck relevance after each save: conditional fields may disappear or become required.
      if (![...(latest.formQuestions ?? []), ...latest.currentQuestions].some(item => item.code === field.code && item.applicantId === field.applicantId)) continue;
      const previous: FormAnswer | undefined = latest.knownAnswers.find(item => item.code === field.code && item.applicantId === field.applicantId);
      if (previous?.answer === field.answer) continue;
      const input = { referenceNumber, applicantId: field.applicantId, questionCode: field.code, answer: field.answer, changeReason: "CUSTOMER_FORM_SAVE" };
      latest = previous ? await editMutation.mutateAsync({ ...input, fromForm: true }) : await answerMutation.mutateAsync({ ...input, fromForm: true });
    }
    const ownMissing = latest.currentQuestions.some(item => item.applicantId === applicantId || item.applicantId === null);
    if (!ownMissing) {
      await completeFormMutation.mutateAsync({ referenceNumber, applicantId, submissionId: crypto.randomUUID() });
      await refreshState();
      const updatedCodes = ownerRequiredDocumentCodes(submission.profile.nationality, submission.profile.residenceCountry, state.applicationContext.visaType, submission.profile.tripPurpose, state.applicationContext.residenceType);
      setNewDocumentCodes(current => ({ ...current, [applicantId]: updatedCodes.filter(code => !previousCodes.includes(code)) }));
      setActiveTravellerId(applicantId);
      setPhase(4);
    } else { setActiveTravellerId(applicantId); setPhase(3); }
    await refreshState();
    if (!continueAfter) return;
    if (!ownMissing) {
      if (activeIndex < travellers.length - 1) goToTraveller(activeIndex + 1); else setPhase(5);
    } else {
      setMissingFields(latest.currentQuestions.filter(item => item.applicantId === applicantId || item.applicantId === null).map(item => t(`simple.fields.${item.code}`, { defaultValue: item.label })));
      requestAnimationFrame(() => { const target = (domScope ?? document).querySelector<HTMLElement>("#continue-documents-status"); target?.scrollIntoView({ block: "center" }); target?.focus({ preventScroll: true }); });
    }
    } finally { setFormSaving(false); }
  };

  const goToTraveller = (index: number) => {
    const target = travellers[index];
    if (target) { setEditingContext(false); setMissingFields([]); setActiveTravellerId(target.applicantId); setPhase(3); }
  };

  const uploadHandler = async (requirement: PartyRequirementReadiness, file: File, onProgress: (progress: DocumentUploadProgress) => void) => {
    setUploadingDocument(true);
    try {
    await prepareUploadMutation.mutateAsync({ referenceNumber, applicantId: requirement.applicantId, submissionId: crypto.randomUUID() });
    const documentType = legacyDocumentType(requirement.documentType);
    const applicationId = state.partySetup!.applicationId;
    onProgress({ phase: "preparing" });
    const uploaded = await documentUploadClient(onProgress).storage.upload.mutate({ applicationId,
      applicantId: requirement.applicantId, documentType, fileName: file.name, mimeType: documentMimeType(file.type, file.name), fileSize: file.size,
      base64Data: await readFileAsBase64(file), uploadedBy: `customer:${referenceNumber}` });
    onProgress({ phase: "saving" });
    const document = await documentCreateMutation.mutateAsync({ applicationId,
      applicantId: requirement.applicantId, documentType, originalFileName: file.name, storedFileName: uploaded.storedFileName,
      mimeType: uploaded.mimeType, fileSize: uploaded.fileSize, storagePath: uploaded.storagePath, uploadStatus: "uploaded",
      uploadedBy: `customer:${referenceNumber}` });
    await linkRequirementDocumentMutation.mutateAsync({ referenceNumber, applicantId: requirement.applicantId,
      requirementCode: requirement.requirementCode, documentKey: requirement.documentKey, documentId: document.id, idempotencyKey: crypto.randomUUID() });
    await refreshState();
    } finally { setUploadingDocument(false); }
  };

  const partyBusy = addApplicantMutation.isPending || editApplicantMutation.isPending || relationshipMutation.isPending || createTravelGroupMutation.isPending || updateTravelGroupMutation.isPending || linkSharedDocumentMutation.isPending;
  const partyError = Boolean(addApplicantMutation.error || editApplicantMutation.error || relationshipMutation.error || createTravelGroupMutation.error || updateTravelGroupMutation.error || linkSharedDocumentMutation.error);
  const docsBusy = uploadingDocument || documentCreateMutation.isPending || linkRequirementDocumentMutation.isPending;
  const docsError = Boolean(documentCreateMutation.error || linkRequirementDocumentMutation.error);

  const ownerRequirements = state.partySetup?.requirementReadiness.filter(item => {
    const traveller = state.partySetup?.applicants.find(a => a.applicantId === item.applicantId);
    return ownerRequiredDocumentCodes(traveller?.nationality, traveller?.residenceCountry, state.applicationContext.visaType, traveller?.tripPurpose, state.applicationContext.residenceType).includes(item.requirementCode);
  }) ?? [];
  const activeRequirements = ownerRequirements.filter(item => item.applicantId === activeId);
  const activeApplicants = state.partySetup
    ? state.partySetup.applicants.filter((a) => a.applicantId === activeId)
    : [];
  const remainingDocuments = activeRequirements.filter(item => !["UPLOADED", "VALIDATED", "WAIVED"].includes(item.state)).length;

  const currentStep = phase ?? 3;
  const canOpenCheckout = canVisitCheckout(readiness.data);
  return <WizardShell compactContent currentStep={currentStep === 5 ? 3 : 2}>
    <div className="mx-auto w-full max-w-[680px]">
      <StepHeader
        step={currentStep === 5 ? 3 : 2}
        title={t(currentStep === 5 ? "steps.review" : "steps.data")}
        subtitle={t(currentStep === 5 ? "flow.subtitle" : "flow.matchedDocuments")}
      />
      <NationalityAvailabilityNotice nationalities={state.partySetup?.applicants.map(traveller => traveller.nationality) ?? []} />
      {currentStep !== 5 && activeProfile && <TravellerContext key={`${activeId}:${contextOpen}`} applicant={activeProfile} reference={referenceNumber} editing={contextOpen} nationalityOnly={!editingContext && Boolean(activeProfile.residenceCountry && activeProfile.tripPurpose)}
        onEdit={() => setEditingContext(true)} onCancel={() => setEditingContext(false)} onSave={async profile => {
          const previous = ownerRequiredDocumentCodes(activeProfile.nationality, activeProfile.residenceCountry, state.applicationContext.visaType, activeProfile.tripPurpose, state.applicationContext.residenceType);
          await editContextMutation.mutateAsync({ referenceNumber, applicantId: activeId, expectedVersion: activeProfile.profileVersion, ...profile, idempotencyKey: crypto.randomUUID() });
          await refreshState();
          const next = ownerRequiredDocumentCodes(profile.nationality, profile.residenceCountry, state.applicationContext.visaType, profile.tripPurpose, state.applicationContext.residenceType);
          setNewDocumentCodes(current => ({ ...current, [activeId]: next.filter(code => !previous.includes(code)) }));
          setEditingContext(false); setPhase(3);
        }} />}

      {/* Traveller pager — one traveller per page */}
      {currentStep !== 5 && travellers.length > 1 && (
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Travellers">
          {travellers.map((traveller, i) => {
            const isActive = traveller.applicantId === activeId;
            const isCurrent = traveller.applicantId === currentQuestionTravellerId;
            const fields = Array.from(new Map([...(state.formQuestions ?? []), ...state.currentQuestions].map(field => [`${field.applicantId}:${field.code}`, field])).values()).filter(field => field.applicantId === traveller.applicantId);
            const isDone = fields.length > 0 && fields.every(field => state.knownAnswers.some(answer => answer.applicantId === field.applicantId && answer.code === field.code));
            return (
              <button
                key={traveller.applicantId}
                type="button"
                disabled={formSaving || docsBusy}
                aria-describedby={formSaving || docsBusy ? "traveller-busy" : undefined}
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

      {(formSaving || docsBusy) && <p id="traveller-busy" role="status" className="mb-3 text-sm">{i18n.language.startsWith("ar") ? "انتظر اكتمال الحفظ أو الرفع قبل تغيير المسافر." : "Wait for saving or uploading to finish before changing traveller."}</p>}
      <div hidden={contextOpen}>
      {/* Manage party (add travellers, family links, shared tickets) */}
      {state.partySetup && travellers.length > 1 && <details id="party-setup" className="mb-5 rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold">{t("simple.family")}</summary><InterviewPartySetup setup={state.partySetup}
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
        <ApplicantDataForm applicant={applicant} onValidationCount={onValidationCount} formId={`traveller-form-${applicant.applicantId}`} visaType={state.applicationContext.visaType} onEdit={() => setPhase(3)} arrivalDate={state.applicationContext.arrivalDate} residenceType={state.applicationContext.residenceType ?? "non-gcc"}
          questions={Array.from(new Map([...(state.formQuestions ?? []), ...state.currentQuestions].map(field => [`${field.applicantId}:${field.code}`, field])).values()).filter(field => field.applicantId === applicant.applicantId || (field.applicantId === null && index === 0))}
          saved={state.knownAnswers} onSave={(submission, continueAfter) => saveApplicantForm(applicant.applicantId, submission, continueAfter)} />
      </div>)}

      {currentStep !== 5 && !/transit|96hours/i.test(state.applicationContext.visaType) && <OptionalFlightNotice ar={i18n.language.startsWith("ar")} />}
      {state.partySetup && <div hidden={currentStep === 5}><InterviewRequirementDocuments applicants={activeApplicants} requirements={activeRequirements}
        newlyRequiredCodes={newDocumentCodes[activeId]} busy={docsBusy} error={docsError} onUpload={uploadHandler} /></div>}

      {currentStep !== 5 && !/transit|96hours/i.test(state.applicationContext.visaType) && <OptionalFlightNotice ar={i18n.language.startsWith("ar")} />}
      {state.partySetup && <div hidden={currentStep === 5}><ApplicationSupplements applicationId={state.partySetup.applicationId} ar={i18n.language.startsWith("ar")} companion={state.applicationContext.residenceType === "gcc-accompany"} onSaved={refreshState} /></div>}
      {/* Review when interview is complete — minimal, customer-friendly */}
      {currentStep === 5 && <section>
        <div className="rounded-3xl bg-gradient-to-br from-[#0A1628] to-[#16283f] p-8 text-center text-white shadow-sm">
          <p className="text-3xl">✅</p>
          <h2 className="mt-3 text-2xl font-extrabold">{t("step2.done.title")}</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#DDBB7A]">
            {canOpenCheckout ? t("simple.reviewAfterPayment") : t("step2.done.underReview")}
          </p>
          <span className="mt-5 inline-block rounded-full border border-[#DDBB7A]/30 bg-white/5 px-5 py-2 text-sm font-semibold text-[#DDBB7A]">{referenceNumber}</span>
        </div>

        <div className="mt-5 space-y-4">
          {state.review.applicants.map((applicant) => {
            const requirements = reviewDocumentStatus(applicant.applicantId, applicant.requirements, ownerRequirements, i18n.language.startsWith("ar"));
            return <article key={applicant.applicantId} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-[#0A1628]">{applicant.label}</h3>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${!canOpenCheckout ? "bg-amber-50 text-[#9b7425]" : "bg-emerald-50 text-emerald-700"}`}>
                {!canOpenCheckout ? t("step2.done.underReviewBadge") : t("simple.readyForCheckout")}
              </span>
            </div>
            {requirements.length > 0 && <ul className="mt-4 divide-y divide-gray-50">
              {requirements.map((requirement) => {
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
          </article>; })}
        </div>

        {readiness.data?.status === "INCOMPLETE" && !canOpenCheckout && <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5" role="status" tabIndex={-1} id="payment-blockers">
          <h2 className="font-bold">{t("simple.paymentBlockers")}</h2>
          <ul className="mt-3 list-disc space-y-1 ps-5">
            {readiness.data.applicationMissing.filter(item => item.code !== "application.policy").map(item => <li key={item.code}>{item.label}</li>)}
            {readiness.data.applicants.flatMap(applicant => applicant.missing.map(item => <li key={`${applicant.applicantId}-${item.code}`}>
              {travellers.find(traveller => traveller.applicantId === applicant.applicantId)?.name || applicant.label}: {item.label}
            </li>))}
          </ul>
        </section>}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Link to={`/applications/${encodeURIComponent(referenceNumber)}/status`} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700">{t("step2.saveView")}</Link>
          {canOpenCheckout && <Link to={`/pay/${encodeURIComponent(referenceNumber)}`} className="rounded-xl bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] px-8 py-3 font-bold text-white shadow-md shadow-[#C9A04C]/30">{t("step2.continueToPay")}</Link>}
          {!canOpenCheckout && <button type="button" className="rounded-xl bg-[#C9A04C] px-8 py-3 font-bold" aria-describedby="review-validation" onClick={() => {
            setReviewAttempt(value => value + 1);
            const blockers = (domScope ?? document).querySelector<HTMLElement>("#payment-blockers");
            requestAnimationFrame(() => {
              const target = blockers ?? (domScope ?? document).querySelector<HTMLElement>("#review-validation");
              target?.scrollIntoView({ block: "center", behavior: "smooth" });
              target?.focus({ preventScroll: true });
            });
          }}>{t("step2.continueToPay")}</button>}
          <p id="review-validation" tabIndex={-1} aria-live="polite" aria-atomic="true" className="w-full text-sm text-red-700">
            {reviewAttempt > 0 && !canOpenCheckout && <span key={reviewAttempt}>{t(readiness.data ? "validation.review" : "validation.reviewUnavailable")}</span>}
          </p>
          {!canOpenCheckout && !readiness.data && <button type="button" disabled={readiness.isFetching} className="rounded-xl border px-5 py-3" onClick={() => void readiness.refetch()}>{t("validation.retry")}</button>}
        </div>
      </section>}
      <div className="mt-6 space-y-3">
        {currentStep !== 5 && <>
          <p id="continue-documents-status" role="status" aria-live="polite" aria-atomic="true" tabIndex={-1} className="text-sm text-slate-600">
            {missingFields.length > 0 ? (i18n.language.startsWith("ar") ? `أكمل الحقول التالية ثم احفظ مجددًا: ${missingFields.join("، ")}` : `Complete these fields, then save again: ${missingFields.join(", ")}`) : remainingDocuments > 0 ? (i18n.language.startsWith("ar") ? `المتبقي لهذا المسافر: ${customerFileCount(remainingDocuments, true)}. يمكنك الانتقال الآن ورفعها قبل الدفع.` : `${remainingDocuments} documents remaining for this traveller. You can continue now and upload them before payment.`) : ""}
          </p>
          <p id="traveller-validation-status" aria-live="polite" aria-atomic="true" className="text-sm text-red-700">
            {validationCounts[activeId] > 0 ? t("validation.summary", { count: validationCounts[activeId] }) : ""}
          </p>
          <button type="submit" value="continue" onMouseDown={event => event.preventDefault()} form={`traveller-form-${activeId}`} aria-describedby="traveller-validation-status continue-documents-status" disabled={formSaving || docsBusy}
            className="min-h-12 rounded-xl bg-[#0A1628] px-6 py-3 font-bold text-white disabled:opacity-50">
            {t(activeIndex < travellers.length - 1 ? "simple.saveNextTraveller" : "simple.saveContinue")}</button>
        </>}
        <SaveContinueButton email={state.applicationContext.contactEmail} />
        {currentStep === 5 && <button type="button" className="min-h-11 rounded-xl border px-6 py-3" onClick={() => setPhase(4)}>{t("step2.back")}</button>}
        {currentStep === 5 && !canOpenCheckout && <p role="status">{t("flow.notReady")}</p>}
      </div>
      </div>
    </div>
  </WizardShell>;
}
