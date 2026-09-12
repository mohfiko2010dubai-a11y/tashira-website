import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OWNER_DOCUMENTS } from "@contracts/owner-document-requirements";
import { DOCUMENT_INPUT_ACCEPT, DOCUMENT_MIME_TYPES, DOCUMENT_SIZE_GUIDANCE, MAX_DOCUMENT_FILE_SIZE, UNSUPPORTED_DOCUMENT_GUIDANCE, documentMimeType, documentUploadError, type DocumentUploadProgress } from "@contracts/document-upload-policy";
import type { PartyApplicant, PartyRequirementReadiness } from "./InterviewPartySetup";

type Props = { applicants: readonly PartyApplicant[]; requirements: readonly PartyRequirementReadiness[]; busy: boolean;
  error: boolean; onUpload: (requirement: PartyRequirementReadiness, file: File, onProgress: (progress: DocumentUploadProgress) => void) => Promise<void> };

export function InterviewRequirementDocuments({ applicants, requirements, busy, error, onUpload }: Props) {
  const { i18n } = useTranslation();
  const ar = (i18n.language ?? "en").startsWith("ar");
  const [selected, setSelected] = useState<Record<string, File | undefined>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<Record<string, DocumentUploadProgress | undefined>>({});
  const upload = async (requirement: PartyRequirementReadiness, file: File) => {
    const key = `${requirement.applicantId}:${requirement.requirementCode}`;
    setSelected(current => ({ ...current, [key]: file }));
    setUploadErrors(current => ({ ...current, [key]: "" }));
    const fail = (message: string) => setUploadErrors(current => ({ ...current, [key]: documentUploadError(message, ar) }));
    if (file.size === 0 || file.size > MAX_DOCUMENT_FILE_SIZE) { fail(DOCUMENT_SIZE_GUIDANCE); return; }
    if (!DOCUMENT_MIME_TYPES.has(documentMimeType(file.type, file.name))) { fail(UNSUPPORTED_DOCUMENT_GUIDANCE); return; }
    setUploading(true);
    try {
      await onUpload(requirement, file, update => setProgress(current => ({ ...current, [key]: update })));
      setSelected(current => ({ ...current, [key]: undefined }));
    } catch (cause) { fail(cause instanceof Error ? cause.message : ""); }
    finally { setUploading(false); setProgress(current => ({ ...current, [key]: undefined })); }
  };
  if (!requirements.length) return null;
  return <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="requirement-documents-heading">
    <p className="text-sm font-semibold uppercase tracking-wide text-[#9b7425]">{ar ? "المستندات" : "Documents"}</p>
    <h2 id="requirement-documents-heading" className="mt-1 text-2xl font-bold text-slate-950">{ar ? "مستندات المسافر المطلوبة" : "Applicant document requirements"}</h2>
    <p className="mt-2 text-sm text-slate-600">{ar ? "كل ملف يُحفظ ويرتبط بالمسافر الموضح أدناه فقط." : "Each upload is stored and linked only to the applicant shown below."}</p>
    <p className="mt-2 text-sm text-slate-600">{ar ? "يبدأ الرفع تلقائيًا بعد اختيار الملف. PDF أو JPG أو PNG أو HEIC أو HEIF، بحد أقصى 20 ميجابايت لكل ملف." : "Uploading starts when you choose a file. PDF, JPG, PNG, HEIC or HEIF, up to 20 MB each."}</p>
    {error && !Object.values(uploadErrors).some(Boolean) && <p role="alert" className="mt-4 text-red-700">{documentUploadError("", ar)}</p>}
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
            {!complete && <div className="mt-3 flex flex-wrap items-center gap-2"><input type="file" aria-label={label} accept={DOCUMENT_INPUT_ACCEPT} disabled={busy || uploading}
              onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(requirement, file); }} className="max-w-full text-sm" />
              {selected[key] && uploadErrors[key] && <button type="button" disabled={busy || uploading} className="rounded-lg bg-[#cda64f] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                onClick={() => { const file = selected[key]; if (file) void upload(requirement, file); }}>{ar ? "إعادة محاولة الرفع" : "Retry upload"}</button>}</div>}
            {progress[key] && <div className="mt-3" role="status" aria-live="polite">
              <p className="text-sm">{progress[key]?.phase === "uploading"
                ? (ar ? `جارٍ الرفع ${progress[key]?.percent ?? ""}%` : `Uploading ${progress[key]?.percent ?? ""}%`)
                : progress[key]?.phase === "processing" ? (ar ? "جارٍ معالجة الصورة…" : "Processing photo…")
                : progress[key]?.phase === "saving" ? (ar ? "جارٍ حفظ المستند…" : "Saving document…") : (ar ? "جارٍ قراءة الملف…" : "Reading file…")}</p>
              <progress className="mt-1 w-full" aria-label={ar ? "تقدم رفع الملف" : "File upload progress"} max={100} value={progress[key]?.phase === "uploading" ? progress[key]?.percent : undefined} />
            </div>}
            {uploadErrors[key] && <p role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{ar ? "فشل الرفع: " : "Upload failed: "}{uploadErrors[key]}</p>}
          </div>; })}</div>
      </article>; })}</div>
  </section>;
}
