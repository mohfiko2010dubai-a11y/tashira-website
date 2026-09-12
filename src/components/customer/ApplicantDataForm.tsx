import { minimumPassportExpiry, validPassportExpiry } from "@contracts/traveller-details";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useValidationFeedback } from "./useValidationFeedback";
import NationalitySelect from "./NationalitySelect";
import type { PartyApplicant } from "./InterviewPartySetup";

type Value = string | number | boolean;
export type FormQuestion = { code: string; applicantId: number | null; label: string;
  answerType: "TEXT" | "SELECT" | "BOOLEAN" | "NUMBER" | "DATE"; allowedValues: readonly string[] | null };
export type FormAnswer = { code: string; applicantId: number | null; answer: Value };
export type ApplicantFormSubmission = { passportNumber: string; passportExpiry: string; profession: string; residenceType: string; profile: { fullName: string; nationality: string | null; residenceCountry: string | null }; answers: FormAnswer[] };
const gccCountries = ["SA", "KW", "BH", "QA", "OM", "AE"];
const countryCodes = new Set(["NATIONALITY", "PASSPORT_COUNTRY", "RESIDENCE_COUNTRY", "GCC_COUNTRY"]);
const keyOf = (field: { applicantId: number | null; code: string }) => `${field.applicantId}:${field.code}`;

/** Drafts live only in this application/applicant instance; never in browser storage. */
export function ApplicantDataForm({ applicant, questions, saved, onSave, residenceType = "non-gcc", arrivalDate, onEdit }: {
  onEdit?: () => void; arrivalDate?: string | null; residenceType?: string; applicant: PartyApplicant; questions: readonly FormQuestion[]; saved: readonly FormAnswer[];
  onSave: (submission: ApplicantFormSubmission) => Promise<void>;
}) {
  const { t } = useTranslation("wizard");
  const selectedResidence = residenceType;
  const isGcc = selectedResidence === "gcc-resident" || selectedResidence === "gcc-accompany";
  const [passportNumber, setPassportNumber] = useState(applicant.passportNumber ?? "");
  const [passportExpiry, setPassportExpiry] = useState(applicant.passportExpiry ?? "");
  const [profession, setProfession] = useState(applicant.profession ?? "");
  const [draft, setDraft] = useState<Record<string, Value>>({});
  const [name, setName] = useState<string | null>(null);
  const [nationality, setNationality] = useState<string | null>(null);
  const [residence, setResidence] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const valueOf = (field: FormQuestion): Value => draft[keyOf(field)]
    ?? saved.find(item => keyOf(item) === keyOf(field))?.answer
    ?? (field.code === "NATIONALITY" ? applicant.nationality : field.code === "RESIDENCE_COUNTRY" ? applicant.residenceCountry : null) ?? "";
  const setValue = (field: FormQuestion, value: Value) => { onEdit?.(); setDraft(previous => ({ ...previous, [keyOf(field)]: value })); };
  const visibleQuestions = questions.filter(field => !["PROFESSION", "PASSPORT_NUMBER", "PASSPORT_EXPIRY", "GCC_RESIDENT", "GCC_COUNTRY", "RESIDENCE_COUNTRY", "HAS_CONFIRMED_TICKETS", "PLANNED_ARRIVAL_DATE", "TRAVELLING_TOGETHER"].includes(field.code) && (isGcc || field.code !== "RESIDENCE_EXPIRY"));
  const fullName = name ?? (/^Applicant\s+\d+$/i.test(applicant.fullName) ? "" : applicant.fullName);
  const profileCountry = (code: string, fallback: string | null) => {
    const field = questions.find(item => item.code === code && item.applicantId === applicant.applicantId);
    return field ? String(valueOf(field)) || null : fallback;
  };
  const profile = { fullName: fullName.trim(), nationality: profileCountry("NATIONALITY", nationality ?? applicant.nationality),
    residenceCountry: residence ?? applicant.residenceCountry };
  const complete = profile.fullName.length >= 2 && profile.nationality && profile.residenceCountry
    && (!isGcc || gccCountries.includes(profile.residenceCountry))
    && passportNumber.trim().length >= 3 && profession.trim().length >= 2 && validPassportExpiry(passportExpiry, arrivalDate)
    && visibleQuestions.every(field => String(valueOf(field)).trim() !== "");
  const passportMinimum = minimumPassportExpiry(arrivalDate);
  const nationalityField = visibleQuestions.find(field => field.code === "NATIONALITY" && field.applicantId === applicant.applicantId);
  const nationalityKey = nationalityField ? keyOf(nationalityField) : "nationality";
  const errors: Record<string, string | undefined> = {
    fullName: profile.fullName.length < 2 ? t("validation.name") : undefined,
    [nationalityKey]: !profile.nationality ? t("validation.choose", { field: t("simple.fields.NATIONALITY") }) : undefined,
    residence: !profile.residenceCountry || (isGcc && !gccCountries.includes(profile.residenceCountry)) ? t("validation.choose", { field: t("simple.fields.RESIDENCE_COUNTRY") }) : undefined,
    passportNumber: passportNumber.trim().length < 3 ? t("validation.passportNumber") : undefined,
    passportExpiry: !validPassportExpiry(passportExpiry, arrivalDate) ? t("validation.passportExpiry", { date: passportMinimum }) : undefined,
    profession: profession.trim().length < 2 ? t("validation.profession") : undefined,
  };
  for (const field of visibleQuestions) {
    if (String(valueOf(field)).trim() === "") errors[keyOf(field)] = t("validation.required", { field: t(`simple.fields.${field.code}`, { defaultValue: field.label }) });
  }
  const feedback = useValidationFeedback(errors, t("validation.format"));
  const fieldClass = "aria-[invalid=true]:border-red-700 aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-red-700 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#C9A04C] focus:outline-none focus:ring-2 focus:ring-[#C9A04C]/20";
  const labelFor = (field: FormQuestion) => t(`simple.fields.${field.code}`, { defaultValue: field.label });
  return <form onBlur={event => feedback.revalidateNative(event.currentTarget)} noValidate onChange={() => onEdit?.()} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7" onSubmit={async event => {
    event.preventDefault(); if (!feedback.validate(event.currentTarget) || !complete || busy) return;
    setBusy(true); setError(false);
    try { await onSave({ passportNumber: passportNumber.trim(), passportExpiry, profession: profession.trim(), residenceType: selectedResidence, profile, answers: [
      { code: "PROFESSION", applicantId: applicant.applicantId, answer: profession.trim() },
      { code: "GCC_RESIDENT", applicantId: applicant.applicantId, answer: isGcc },
      ...(profile.residenceCountry ? [{ code: "RESIDENCE_COUNTRY", applicantId: applicant.applicantId, answer: profile.residenceCountry }] : []),
      ...(isGcc && profile.residenceCountry ? [{ code: "GCC_COUNTRY", applicantId: applicant.applicantId, answer: profile.residenceCountry }] : []),
      ...visibleQuestions.map(field => ({ code: field.code, applicantId: field.applicantId, answer: valueOf(field) }))] });
      setDraft({}); setName(null); setNationality(null); setResidence(null);
    } catch { setError(true); } finally { setBusy(false); }
  }}>
    <h2 className="text-xl font-bold text-[#0A1628]">{t("simple.title")}</h2>
    <p className="mb-6 mt-2 text-sm text-slate-500">{t("simple.subtitle")}</p>
    <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2">
      <label className="grid gap-2 text-sm font-medium sm:col-span-2">{t("simple.fullName")} *
        <input {...feedback.fieldProps("fullName")} required minLength={2} maxLength={255} autoComplete="name" value={fullName} className={fieldClass} onChange={event => setName(event.target.value)} />
      {feedback.errorFor("fullName")}</label>
      {!questions.some(field => field.code === "NATIONALITY") && <div className="grid gap-2 text-sm font-medium">{t("simple.fields.NATIONALITY")} *
        <NationalitySelect {...feedback.fieldProps("nationality")} compact label={t("simple.fields.NATIONALITY")} value={nationality ?? applicant.nationality ?? ""} onChange={value => { onEdit?.(); setNationality(value); }} />{feedback.errorFor("nationality")}</div>}
      {<div className="grid gap-2 text-sm font-medium">{t("simple.fields.RESIDENCE_COUNTRY")} *
        <NationalitySelect {...feedback.fieldProps("residence")} compact allowedCodes={isGcc ? gccCountries : undefined} label={t("simple.fields.RESIDENCE_COUNTRY")} value={residence ?? applicant.residenceCountry ?? ""} onChange={value => { onEdit?.(); setResidence(value); }} />{feedback.errorFor("residence")}</div>}
      <label className="grid gap-2 text-sm font-medium">{t("simple.passportNumber")} *
        <input {...feedback.fieldProps("passportNumber")} required minLength={3} maxLength={50} value={passportNumber} className={fieldClass} onChange={event => setPassportNumber(event.target.value)} />{feedback.errorFor("passportNumber")}</label>
      <label className="grid gap-2 text-sm font-medium">{t("simple.passportExpiry")} *
        <input {...feedback.fieldProps("passportExpiry", "passport-helper-" + applicant.applicantId)} required type="date" min={passportMinimum} value={passportExpiry} className={fieldClass} onChange={event => setPassportExpiry(event.target.value)} />
        <span id={"passport-helper-" + applicant.applicantId} className={passportExpiry && !validPassportExpiry(passportExpiry, arrivalDate) ? "text-xs text-red-700" : "text-xs text-slate-500"}>{t("simple.passportValidity", { date: passportMinimum })}</span>{feedback.errorFor("passportExpiry")}</label>
      <label className="grid gap-2 text-sm font-medium sm:col-span-2">{t("simple.profession")} *
        <input {...feedback.fieldProps("profession")} required minLength={2} maxLength={255} value={profession} className={fieldClass} onChange={event => setProfession(event.target.value)} />{feedback.errorFor("profession")}</label>
      {visibleQuestions.map(field => {
        const value = valueOf(field); const props = feedback.fieldProps(keyOf(field)); const id = props.id;
        return <div key={keyOf(field)} className="grid content-start gap-2 text-sm font-medium">
          <label htmlFor={id}>{labelFor(field)} * {field.applicantId === null && <span className="text-xs text-slate-500">({t("simple.wholeParty")})</span>}</label>
          {countryCodes.has(field.code) ? <NationalitySelect compact {...props} label={labelFor(field)} value={String(value)} onChange={code => setValue(field, code)} />
            : field.answerType === "BOOLEAN" ? <select {...props} required className={fieldClass} value={String(value)}
              onChange={event => setValue(field, event.target.value === "" ? "" : event.target.value === "true")}>
              <option value="">{t("simple.select")}</option><option value="true">{t("simple.yes")}</option><option value="false">{t("simple.no")}</option></select>
            : field.answerType === "SELECT" && field.allowedValues ? <select {...props} required className={fieldClass} value={String(value)} onChange={event => setValue(field, event.target.value)}>
              <option value="">{t("simple.select")}</option>{field.allowedValues.map(option => <option key={option} value={option}>{t(`simple.options.${option}`, { defaultValue: option })}</option>)}</select>
            : <input {...props} required maxLength={500} className={fieldClass} type={field.answerType === "DATE" ? "date" : field.answerType === "NUMBER" ? "number" : "text"}
              value={String(value)} onChange={event => setValue(field, field.answerType === "NUMBER" && event.target.value !== "" ? Number(event.target.value) : event.target.value)} />}
          {feedback.errorFor(keyOf(field))}
        </div>;
      })}
    </fieldset>
    {error && <p role="alert" className="mt-5 text-sm text-red-700">{t("simple.error")}</p>}
    <p className="mt-6 text-xs text-slate-500">{t("simple.saveHint")}</p>
    <p aria-live="polite" aria-atomic="true" className="mt-3 text-sm text-red-700">{feedback.count > 0 ? t("validation.summary", { count: feedback.count }) : ""}</p>
    <button type="submit" onMouseDown={event => event.preventDefault()} disabled={busy} className="mt-4 min-h-11 w-full rounded-xl bg-[#C9A04C] px-6 py-3 font-bold text-[#0A1628] disabled:opacity-50 sm:w-auto">
      {t(busy ? "simple.saving" : "simple.continue")}
    </button>
  </form>;
}
