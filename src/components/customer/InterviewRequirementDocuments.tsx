import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OWNER_DOCUMENTS } from "@contracts/owner-document-requirements";
import type { PartyApplicant, PartyRequirementReadiness } from "./InterviewPartySetup";

type Props = { applicants: readonly PartyApplicant[]; requirements: readonly PartyRequirementReadiness[]; busy: boolean;
  error: boolean; onUpload: (requirement: PartyRequirementReadiness, file: File) => Promise<void> };

export function InterviewRequirementDocuments({ applicants, requirements, busy, error, onUpload }: Props) {
  const { i18n } = useTranslation();
  const ar = (i18n.language ?? "en").startsWith("ar");
  const [selected, setSelected] = useState<Record<string, File | undefined>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const upload = async (requirement: PartyRequirementReadiness, file: File) => {
    const key = `${requirement.applicantId}:${requirement.requirementCode}`;
    setSelected(current => ({ ...current, [key]: file }));
    setUploadError("");
    if (file.size === 0 || file.size > 8 * 1024 * 1024) {
      setUploadError(ar ? "اختر ملفًا غير فارغ بحجم لا يزيد عن 8 ميجابايت." : "Choose a non-empty file no larger than 8 MB."); return;
    }
    setUploading(true);
    try { await onUpload(requirement, file); setSelected(current => ({ ...current, [key]: undefined })); }
    catch { setUploadError(ar ? "لم يكتمل رفع الملف. أعد المحاولة وانتظر ظهور تم الاستلام." : "The upload did not finish. Retry and wait for Received."); }
    finally { setUploading(false); }
  };
  if (!requirements.length) return null;
  return <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="requirement-documents-heading">
    <p className="text-sm font-semibold uppercase tracking-wide text-[#9b7425]">{ar ? "المستندات" : "Documents"}</p>
    <h2 id="requirement-documents-heading" className="mt-1 text-2xl font-bold text-slate-950">{ar ? "مستندات المسافر المطلوبة" : "Applicant document requirements"}</h2>
    <p className="mt-2 text-sm text-slate-600">{ar ? "كل ملف يُحفظ ويرتبط بالمسافر الموضح أدناه فقط." : "Each upload is stored and linked only to the applicant shown below."}</p>
    <p className="mt-2 text-sm text-slate-600">{ar ? "يبدأ الرفع تلقائيًا بعد اختيار الملف. PDF أو JPG أو PNG، بحد أقصى 8 ميجابايت لكل ملف." : "Uploading starts when you choose a file. PDF, JPG or PNG, up to 8 MB each."}</p>
    {uploading && <p role="status">{ar ? "جارٍ الرفع والحفظ…" : "Uploading and saving…"}</p>}
    {(error || uploadError) && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{uploadError || (ar ? "تعذر إكمال الرفع. أعد المحاولة." : "The upload could not be completed. Please retry.")}</p>}
    <div className="mt-5 grid gap-4">{applicants.map((applicant) => { const own = requirements.filter((item) => item.applicantId === applicant.applicantId);
      if (!own.length) return null;
      return <article key={applicant.applicantId} className="rounded-2xl border border-slate-200 p-4" aria-label={`${applicant.fullName} documents`}>
        <h3 className="font-semibold text-slate-950">{applicant.fullName}</h3><div className="mt-3 grid gap-3">{own.map((requirement) => {
          const key = `${requirement.applicantId}:${requirement.requirementCode}`; const complete = ["UPLOADED", "VALIDATED", "WAIVED"].includes(requirement.state);
          const definition = OWNER_DOCUMENTS.find(document => document.code === requirement.requirementCode);
          const label = definition ? (ar ? definition.ar : definition.en) : requirement.requirementCode === "PASSPORT"
            ? (ar ? "جواز السفر — صفحة البيانات كاملة وواضحة" : "Passport — complete, clear personal data page") : requirement.requirementCode === "PERSONAL_PHOTO" ? (ar ? "الصورة الشخصية" : "Personal photo") : requirement.requirementCode.replaceAll("_", " ");
          return <div key={key} className="rounded-xl bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{label}</strong>
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${complete ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{complete ? (ar ? "تم الاستلام" : "Received") : (ar ? "مطلوب" : "Needed")}</span></div>
            {!complete && <div className="mt-3 flex flex-wrap items-center gap-2"><input type="file" aria-label={label} accept="application/pdf,image/jpeg,image/png" disabled={busy || uploading}
              onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(requirement, file); }} className="max-w-full text-sm" />
              {selected[key] && <button type="button" disabled={busy || uploading} className="rounded-lg bg-[#cda64f] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                onClick={() => { const file = selected[key]; if (file) void upload(requirement, file); }}>{ar ? "إعادة محاولة الرفع" : "Retry upload"}</button>}</div>}</div>; })}</div>
      </article>; })}</div>
  </section>;
}
