import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/providers/trpc-client";
import { tripPurposeSchema, type TripPurpose } from "@contracts/document-requirement-engine";
import type { PartyApplicant } from "./InterviewPartySetup";
import NationalitySelect from "./NationalitySelect";
import { useValidationFeedback } from "./useValidationFeedback";

export function TravellerContext({ applicant, reference, editing, onEdit, onCancel, onSave }: {
  applicant: PartyApplicant; reference: string; editing: boolean; onEdit: () => void; onCancel: () => void;
  onSave: (context: { nationality: string; residenceCountry: string; tripPurpose: TripPurpose }) => Promise<void>;
}) {
  const { t, i18n } = useTranslation("wizard"); const ar = i18n.language.startsWith("ar");
  const catalog = trpc.dynamicInterview.nationalityCatalog.useQuery({});
  const country = (code: string | null) => { const item = catalog.data?.nationalities.find(item => item.code === code); return item ? ar ? item.nameAr : item.nameEn : code; };
  const [nationality, setNationality] = useState(applicant.nationality ?? "");
  const [residenceCountry, setResidenceCountry] = useState(applicant.residenceCountry ?? "");
  const [tripPurpose, setTripPurpose] = useState<TripPurpose>(applicant.tripPurpose ?? "tourism");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const feedback = useValidationFeedback({
    nationality: !nationality ? t("validation.choose", { field: t("simple.fields.NATIONALITY") }) : undefined,
    residence: !residenceCountry ? t("validation.choose", { field: t("simple.fields.RESIDENCE_COUNTRY") }) : undefined,
  });
  const purposeLabel = (value: TripPurpose) => t(value === "visiting_family" ? "simple.purposeFamily" : value === "transit" ? "simple.purposeTransit" : "simple.purposeTourism");
  if (!editing) return <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-[#e8e0d2] bg-white px-4 py-3 text-xs text-slate-600">
    <span>{country(applicant.nationality)} · {ar ? `مقيم في ${country(applicant.residenceCountry)}` : `Resident in ${country(applicant.residenceCountry)}`} · {purposeLabel(applicant.tripPurpose ?? "tourism")}</span>
    <button type="button" className="min-h-11 px-2 font-semibold text-[#9b7425] underline" onClick={onEdit}>{ar ? "تعديل" : "Edit"}</button>
    <span className="ms-auto font-mono text-[10px] text-slate-400" dir="ltr">{reference}</span>
  </div>;
  return <form className="mb-5 grid gap-5 rounded-2xl border bg-white p-5" noValidate onSubmit={async event => {
    event.preventDefault(); if (!feedback.validate(event.currentTarget)) return;
    setBusy(true); setError(""); try { await onSave({ nationality, residenceCountry, tripPurpose }); }
    catch { setError(ar ? "تعذر حفظ الاختيارات. حاول مرة أخرى." : "Your choices could not be saved. Try again."); } finally { setBusy(false); }
  }}>
    <div><NationalitySelect {...feedback.fieldProps("nationality")} compact label={t("simple.fields.NATIONALITY")} value={nationality} onChange={setNationality} />{feedback.errorFor("nationality")}</div>
    <div><NationalitySelect {...feedback.fieldProps("residence")} compact purpose="residence" label={t("simple.fields.RESIDENCE_COUNTRY")} value={residenceCountry} onChange={setResidenceCountry} />{feedback.errorFor("residence")}</div>
    <p className="text-xs text-slate-500">{t("simple.residenceHint")}</p>
    <label className="grid gap-2 text-sm">{t("simple.tripPurpose")}<select className="min-h-11 rounded-xl border px-3" value={tripPurpose} onChange={event => setTripPurpose(tripPurposeSchema.parse(event.target.value))}>
      {tripPurposeSchema.options.map(value => <option key={value} value={value}>{purposeLabel(value)}</option>)}
    </select></label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <p aria-live="polite" aria-atomic="true" className="text-sm text-red-700">{feedback.count > 0 ? t("validation.summary", { count: feedback.count }) : ""}</p>
    <div className="flex gap-3"><button disabled={busy} className="min-h-11 rounded-xl bg-[#0a1628] px-5 text-white">{ar ? "حفظ ومتابعة" : "Save & continue"}</button>
      {applicant.nationality && <button type="button" disabled={busy} onClick={onCancel} className="min-h-11 px-3">{ar ? "إلغاء" : "Cancel"}</button>}</div>
  </form>;
}
