import { DocumentChoiceUpload } from "./DocumentChoiceUpload";
import { Check, Upload } from "lucide-react";
import { documentCardGroups, documentComplete } from "./document-card-groups";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OWNER_DOCUMENTS } from "@contracts/owner-document-requirements";
import { DOCUMENT_INPUT_ACCEPT, DOCUMENT_MIME_TYPES, DOCUMENT_SIZE_GUIDANCE, MAX_DOCUMENT_FILE_SIZE, UNSUPPORTED_DOCUMENT_GUIDANCE, documentMimeType, documentUploadError, type DocumentUploadProgress } from "@contracts/document-upload-policy";
import type { PartyApplicant, PartyRequirementReadiness } from "./InterviewPartySetup";

type Props = { applicants: readonly PartyApplicant[]; requirements: readonly PartyRequirementReadiness[]; busy: boolean;
  error: boolean; newlyRequiredCodes?: readonly string[]; onUpload: (requirement: PartyRequirementReadiness, file: File, onProgress: (progress: DocumentUploadProgress) => void) => Promise<void> };

const cardCopy: Record<string, { en: string; ar: string; hintEn: string; hintAr: string }> = {
  PERSONAL_PHOTO: { en: "Recent personal photo", ar: "صورة شخصية حديثة", hintEn: "White background", hintAr: "خلفية بيضاء" },
  HOME_NATIONAL_ID: { en: "National ID card", ar: "بطاقة الهوية الوطنية", hintEn: "Issued by your home country", hintAr: "الصادرة من بلدك" },
  KSA_RESIDENCE_PROOF: { en: "Proof of residence", ar: "إثبات الإقامة", hintEn: "From Muqeem OR Absher — either one", hintAr: "من مقيم أو أبشر — أي واحد منهما" },
  SA_ABSHER_REPORT: { en: "Absher residence report", ar: "تقرير الإقامة من أبشر", hintEn: "A separate file from the proof above", hintAr: "ملف منفصل غير الإثبات السابق" },
};

export function InterviewRequirementDocuments({ applicants, requirements, busy, error, newlyRequiredCodes = [], onUpload }: Props) {
  const { i18n } = useTranslation();
  const ar = (i18n.language ?? "en").startsWith("ar");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [replacing, setReplacing] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, File | undefined>>({});
  const [selectedRequirements, setSelectedRequirements] = useState<Record<string, PartyRequirementReadiness>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<Record<string, DocumentUploadProgress | undefined>>({});
  const upload = async (requirement: PartyRequirementReadiness, file: File) => {
    const key = `${requirement.applicantId}:${requirement.requirementCode}`;
    setSelected(current => ({ ...current, [key]: file }));
    setSelectedRequirements(current => ({ ...current, [key]: requirement }));
    setUploadErrors(current => ({ ...current, [key]: "" }));
    const fail = (message: string) => setUploadErrors(current => ({ ...current, [key]: documentUploadError(message, ar) }));
    if (file.size === 0 || file.size > MAX_DOCUMENT_FILE_SIZE) { fail(DOCUMENT_SIZE_GUIDANCE); return; }
    if (!DOCUMENT_MIME_TYPES.has(documentMimeType(file.type, file.name))) { fail(UNSUPPORTED_DOCUMENT_GUIDANCE); return; }
    setUploading(true);
    try {
      await onUpload(requirement, file, update => setProgress(current => ({ ...current, [key]: update })));
      setSelected(current => ({ ...current, [key]: undefined }));
      setReplacing(current => ({ ...current, [key]: false }));
    } catch (cause) { fail(cause instanceof Error ? cause.message : ""); }
    finally { setUploading(false); setProgress(current => ({ ...current, [key]: undefined })); }
  };
  if (!requirements.length) return null;
  const total = requirements.length;
  const done = requirements.filter(documentComplete).length;
  const number = (value: number) => value.toLocaleString(ar ? "ar" : "en");
  const slot = (requirement: PartyRequirementReadiness, shortLabel?: string) => {
    const key = `${requirement.applicantId}:${requirement.requirementCode}`;
    const definition = OWNER_DOCUMENTS.find(item => item.code === requirement.requirementCode);
    const label = definition ? ar ? definition.ar : definition.en : requirement.requirementCode;
    const complete = documentComplete(requirement);
    const choosing = !complete || replacing[key];
    return <div key={key} data-document-code={requirement.requirementCode} className="min-w-0">
      {shortLabel && complete && <p className="mb-1 text-xs font-medium">{shortLabel}</p>}
      {complete && <div className="flex flex-wrap items-center gap-2 text-sm text-emerald-800"><Check size={16} aria-hidden="true" /><span>{ar ? "تم الرفع" : "Uploaded"}</span>
        <button type="button" className="min-h-11 px-2 text-xs underline" disabled={busy || uploading} onClick={() => setReplacing(current => ({ ...current, [key]: !current[key] }))}>{ar ? "استبدال" : "Replace"}</button></div>}
      {choosing && (definition?.rule.any_of || definition?.rule.all_of ? <DocumentChoiceUpload rule={definition.rule} ar={ar} disabled={busy || uploading} uploadedCodes={complete ? [] : requirement.uploadedCodes ?? []}
        onUpload={(leaf, file) => { void upload({ ...requirement, documentKey: leaf.key, documentType: leaf.document_type }, file); }} />
        : <label className={`relative flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${shortLabel ? "border-dashed" : "border-slate-600"} ${busy || uploading ? "opacity-50" : "hover:bg-slate-100"}`}>
          <Upload size={16} aria-hidden="true" />{shortLabel ?? (ar ? "رفع" : "Upload")}
          <input type="file" aria-label={label} accept={DOCUMENT_INPUT_ACCEPT} disabled={busy || uploading} className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={event => { const file = event.target.files?.[0]; if (file) void upload(requirement, file); event.target.value = ""; }} />
        </label>)}
      {selected[key] && uploadErrors[key] && <button type="button" disabled={busy || uploading} className="mt-2 min-h-11 rounded-lg border px-3 text-sm font-semibold"
        onClick={() => { const file = selected[key]; if (file) void upload(selectedRequirements[key] ?? requirement, file); }}>{ar ? "إعادة محاولة الرفع" : "Retry upload"}</button>}
      {progress[key] && <div className="mt-2" role="status" aria-live="polite"><p className="text-xs">{progress[key]?.phase === "uploading" ? (ar ? `جارٍ الرفع ${progress[key]?.percent ?? ""}%` : `Uploading ${progress[key]?.percent ?? ""}%`)
        : progress[key]?.phase === "processing" ? (ar ? "جارٍ معالجة الصورة…" : "Processing photo…") : (ar ? "جارٍ حفظ المستند…" : "Saving document…")}</p>
        <progress className="w-full" aria-label={ar ? "تقدم رفع الملف" : "File upload progress"} max={100} value={progress[key]?.phase === "uploading" ? progress[key]?.percent : undefined} /></div>}
      {uploadErrors[key] && <p role="alert" className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">{ar ? "فشل الرفع: " : "Upload failed: "}{uploadErrors[key]}</p>}
    </div>;
  };
  return <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7" aria-labelledby="requirement-documents-heading">
    <h2 id="requirement-documents-heading" className="text-xl font-bold text-slate-950">{ar ? "المستندات" : "Documents"}</h2>
    <div className="mt-4 flex items-center gap-3" role="status" aria-live="polite" aria-atomic="true">
      <div role="progressbar" aria-label={ar ? "المستندات المرفوعة" : "Documents uploaded"} aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} className="h-2 flex-1 overflow-hidden rounded-full bg-[#ede9df]">
        <div className="h-full rounded-full bg-[#c9a04c] transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${done / total * 100}%` }} /></div>
      <span className="shrink-0 text-sm text-slate-600">{ar ? `${number(done)} من ${number(total)} مرفوعة` : `${done} of ${total} uploaded`}</span>
    </div>
    {done === 0 && <p className="mt-3 text-sm text-slate-500">{ar ? `${number(total)} ملفات، نحو خمس دقائق. تقدر توقف وتكمل في أي وقت.` : `${total === 8 ? "Eight" : total} files, about five minutes. You can stop and come back any time.`}</p>}
    <p className="mt-2 text-xs text-slate-500">{ar ? "PDF، JPG، PNG، HEIC أو HEIF — حتى 20 ميجابايت للملف." : "PDF, JPG, PNG, HEIC or HEIF — up to 20 MB per file."}</p>
    {error && !Object.values(uploadErrors).some(Boolean) && <p role="alert" className="mt-4 text-red-700">{documentUploadError("", ar)}</p>}
    {applicants.map(applicant => {
      const own = requirements.filter(item => item.applicantId === applicant.applicantId);
      const countryName = applicant.residenceCountry ? new Intl.DisplayNames([ar ? "ar" : "en"], { type: "region" }).of(applicant.residenceCountry) : "";
      return documentCardGroups(own).map(group => {
        const files = group.cards.flatMap(card => card.files); const complete = files.every(documentComplete);
        const key = `${applicant.applicantId}:${group.key}`; const open = !complete || expanded[key];
        const heading = group.key === "identity" ? ar ? "الهوية" : "Identity" : group.key === "residence" ? ar ? `الإقامة في ${countryName}` : `Residence in ${countryName}` : ar ? "مستندات إضافية" : "Supporting documents";
        return <section key={key} data-applicant-id={applicant.applicantId} className="mt-7" aria-label={heading}>
          <div className="mb-3 flex items-center gap-3"><h3 className="text-sm font-bold text-[#9b7425]">{heading}</h3><div className="h-px flex-1 bg-[#e8e0d2]" />
            {complete && <button type="button" aria-expanded={Boolean(open)} className="flex min-h-11 items-center gap-2 text-xs text-emerald-800" onClick={() => setExpanded(current => ({ ...current, [key]: !current[key] }))}><Check size={16} />{ar ? `${number(files.length)} ملفات · ${open ? "إخفاء" : "عرض"}` : `${files.length} files · ${open ? "Hide" : "Show"}`}</button>}</div>
          {open && <div className="grid gap-3">{group.cards.map(card => {
            const definition = OWNER_DOCUMENTS.find(item => item.code === card.key); const complete = card.files.every(documentComplete);
            const copy = cardCopy[card.key];
            const label = card.pair === "passport" ? ar ? "جواز السفر" : "Passport" : card.pair === "residence" ? ar ? "بطاقة الإقامة" : "Residence permit" : copy ? ar ? copy.ar : copy.en : definition ? ar ? definition.ar : definition.en : card.key;
            const hint = card.pair === "passport" ? applicant.nationality === "PK" ? ar ? "الصفحة الثانية مطلوبة للجنسية الباكستانية" : "Second page required for Pakistani nationals" : ar ? "الصفحة الأولى والأخيرة" : "First and last passport pages" : card.pair === "residence" ? ar ? "صورتان — الوجه والظهر" : "Two images — front and back" : copy ? ar ? copy.hintAr : copy.hintEn : definition ? ar ? definition.hintAr : definition.hintEn : "";
            return <article key={card.key} data-document-card={card.key} className={`rounded-xl border p-3 transition-colors duration-200 motion-reduce:transition-none ${complete ? "border-emerald-200 bg-emerald-50" : "border-[#e8e0d2] bg-[#fcfbf8]"}`}>
              <div className={card.pair ? "mb-3 flex items-start gap-3" : "flex flex-wrap items-center gap-3"}>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${complete ? "bg-emerald-600 text-white" : "bg-[#f4ecd8] text-[#9b7425]"}`}>{complete ? <Check size={17} /> : <Upload size={17} />}</span>
                <div className="min-w-0 flex-1"><h4 className="text-sm font-bold">{label}</h4><p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p>
                  {card.files.some(file => newlyRequiredCodes.includes(file.requirementCode)) && <p className="mt-1 text-xs text-[#9b7425]">{ar ? "مطلوب بعد تحديث البيانات" : "Newly required after your changes"}</p>}</div>
                {!card.pair && <div className={definition?.rule.any_of || definition?.rule.all_of ? "w-full" : "shrink-0"}>{slot(card.files[0])}</div>}
              </div>
              {card.pair && <div className="grid grid-cols-2 gap-2">{card.files.map((file, index) => slot(file, card.pair === "passport"
                ? index === 0 ? ar ? "الصفحة الأولى" : "First page" : file.requirementCode.endsWith("LAST") ? ar ? "الصفحة الأخيرة" : "Last page" : ar ? "الصفحة الثانية" : "Second page"
                : index === 0 ? ar ? "الوجه الأمامي" : "Front" : ar ? "الوجه الخلفي" : "Back"))}</div>}
            </article>;
          })}</div>}
        </section>;
      });
    })}
    {done === total && <p role="status" className="mt-6 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 motion-safe:animate-in motion-safe:fade-in">{ar ? "اكتملت مستنداتك." : "All set — your documents are complete."}</p>}
  </section>;
}
