import { useState } from "react";
import { useTranslation } from "react-i18next";
import NationalitySelect from "./NationalitySelect";
import type { PartyApplicant } from "./InterviewPartySetup";

type Value = string | number | boolean;
export type FormQuestion = { code: string; applicantId: number | null; label: string;
  answerType: "TEXT" | "SELECT" | "BOOLEAN" | "NUMBER" | "DATE"; allowedValues: readonly string[] | null };
export type FormAnswer = { code: string; applicantId: number | null; answer: Value };
export type ApplicantFormSubmission = { profile: { fullName: string; nationality: string | null; residenceCountry: string | null }; answers: FormAnswer[] };
const countryCodes = new Set(["NATIONALITY", "PASSPORT_COUNTRY", "RESIDENCE_COUNTRY", "GCC_COUNTRY"]);
const keyOf = (field: { applicantId: number | null; code: string }) => `${field.applicantId}:${field.code}`;

/** Drafts live only in this application/applicant instance; never in browser storage. */
export function ApplicantDataForm({ applicant, questions, saved, onSave }: {
  applicant: PartyApplicant; questions: readonly FormQuestion[]; saved: readonly FormAnswer[];
  onSave: (submission: ApplicantFormSubmission) => Promise<void>;
}) {
  const { t } = useTranslation("wizard");
  const [draft, setDraft] = useState<Record<string, Value>>({});
  const [name, setName] = useState<string | null>(null);
  const [nationality, setNationality] = useState<string | null>(null);
  const [residence, setResidence] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const valueOf = (field: FormQuestion): Value => draft[keyOf(field)]
    ?? saved.find(item => keyOf(item) === keyOf(field))?.answer
    ?? (field.code === "NATIONALITY" ? applicant.nationality : field.code === "RESIDENCE_COUNTRY" ? applicant.residenceCountry : null) ?? "";
  const setValue = (field: FormQuestion, value: Value) => setDraft(previous => ({ ...previous, [keyOf(field)]: value }));
  const gcc = questions.find(field => field.code === "GCC_RESIDENT" && field.applicantId === applicant.applicantId);
  const visibleQuestions = questions.filter(field => !gcc || valueOf(gcc) !== false
    || field.applicantId !== applicant.applicantId || !["GCC_COUNTRY", "RESIDENCE_EXPIRY"].includes(field.code));
  const fullName = name ?? (/^Applicant\s+\d+$/i.test(applicant.fullName) ? "" : applicant.fullName);
  const profileCountry = (code: string, fallback: string | null) => {
    const field = questions.find(item => item.code === code && item.applicantId === applicant.applicantId);
    return field ? String(valueOf(field)) || null : fallback;
  };
  const profile = { fullName: fullName.trim(), nationality: profileCountry("NATIONALITY", nationality ?? applicant.nationality),
    residenceCountry: profileCountry("RESIDENCE_COUNTRY", residence ?? applicant.residenceCountry) };
  const complete = profile.fullName.length >= 2 && profile.nationality && profile.residenceCountry
    && visibleQuestions.every(field => String(valueOf(field)).trim() !== "");
  const fieldClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#C9A04C] focus:outline-none focus:ring-2 focus:ring-[#C9A04C]/20";
  const labelFor = (field: FormQuestion) => t(`simple.fields.${field.code}`, { defaultValue: field.label });
  return <form className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7" onSubmit={async event => {
    event.preventDefault(); if (!complete || busy) return;
    setBusy(true); setError(false);
    try { await onSave({ profile, answers: visibleQuestions.map(field => ({ code: field.code, applicantId: field.applicantId, answer: valueOf(field) })) });
      setDraft({}); setName(null); setNationality(null); setResidence(null);
    } catch { setError(true); } finally { setBusy(false); }
  }}>
    <h2 className="text-xl font-bold text-[#0A1628]">{t("simple.title")}</h2>
    <p className="mb-6 mt-2 text-sm text-slate-500">{t("simple.subtitle")}</p>
    <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2">
      <label className="grid gap-2 text-sm font-medium sm:col-span-2">{t("simple.fullName")} *
        <input required minLength={2} maxLength={255} autoComplete="name" value={fullName} className={fieldClass} onChange={event => setName(event.target.value)} />
      </label>
      {!questions.some(field => field.code === "NATIONALITY") && <div className="grid gap-2 text-sm font-medium">{t("simple.fields.NATIONALITY")} *
        <NationalitySelect compact label={t("simple.fields.NATIONALITY")} value={nationality ?? applicant.nationality ?? ""} onChange={setNationality} /></div>}
      {!questions.some(field => field.code === "RESIDENCE_COUNTRY") && <div className="grid gap-2 text-sm font-medium">{t("simple.fields.RESIDENCE_COUNTRY")} *
        <NationalitySelect compact label={t("simple.fields.RESIDENCE_COUNTRY")} value={residence ?? applicant.residenceCountry ?? ""} onChange={setResidence} /></div>}
      {visibleQuestions.map(field => {
        const value = valueOf(field); const id = `field-${keyOf(field)}`;
        return <div key={keyOf(field)} className="grid content-start gap-2 text-sm font-medium">
          <label htmlFor={id}>{labelFor(field)} * {field.applicantId === null && <span className="text-xs text-slate-500">({t("simple.wholeParty")})</span>}</label>
          {countryCodes.has(field.code) ? <NationalitySelect compact id={id} label={labelFor(field)} value={String(value)} onChange={code => setValue(field, code)} />
            : field.answerType === "BOOLEAN" ? <select id={id} required className={fieldClass} value={String(value)}
              onChange={event => setValue(field, event.target.value === "" ? "" : event.target.value === "true")}>
              <option value="">{t("simple.select")}</option><option value="true">{t("simple.yes")}</option><option value="false">{t("simple.no")}</option></select>
            : field.answerType === "SELECT" && field.allowedValues ? <select id={id} required className={fieldClass} value={String(value)} onChange={event => setValue(field, event.target.value)}>
              <option value="">{t("simple.select")}</option>{field.allowedValues.map(option => <option key={option} value={option}>{t(`simple.options.${option}`, { defaultValue: option })}</option>)}</select>
            : <input id={id} required maxLength={500} className={fieldClass} type={field.answerType === "DATE" ? "date" : field.answerType === "NUMBER" ? "number" : "text"}
              value={String(value)} onChange={event => setValue(field, field.answerType === "NUMBER" && event.target.value !== "" ? Number(event.target.value) : event.target.value)} />}
        </div>;
      })}
    </fieldset>
    {error && <p role="alert" className="mt-5 text-sm text-red-700">{t("simple.error")}</p>}
    <p className="mt-6 text-xs text-slate-500">{t("simple.saveHint")}</p>
    <button type="submit" disabled={!complete || busy} className="mt-4 min-h-11 w-full rounded-xl bg-[#C9A04C] px-6 py-3 font-bold text-[#0A1628] disabled:opacity-50 sm:w-auto">
      {t(busy ? "simple.saving" : "simple.continue")}
    </button>
  </form>;
}
