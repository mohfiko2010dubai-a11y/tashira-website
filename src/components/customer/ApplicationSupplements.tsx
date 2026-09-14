import { UploadProgress } from "./UploadProgress";
import { useState } from "react";
import { trpc } from "@/providers/trpc-client";
import { documentUploadClient } from "@/lib/document-upload-client";
import { DOCUMENT_INPUT_ACCEPT, documentMimeType, documentUploadError, type DocumentUploadProgress } from "@contracts/document-upload-policy";
import { MAX_ADDITIONAL_NOTES_LENGTH, MAX_SUPPORTING_DOCUMENTS } from "@contracts/application-supplements";

const readFile = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("Cannot read file"));
  reader.onload = () => typeof reader.result === "string" ? resolve(reader.result.slice(reader.result.indexOf(",") + 1)) : reject(new Error("Cannot read file"));
  reader.readAsDataURL(file);
});

export function ApplicationSupplements({ applicationId, ar, companion, onSaved }: { applicationId: number; ar: boolean; companion: boolean; onSaved: () => Promise<unknown> }) {
  const query = trpc.applicationSupplements.get.useQuery({ applicationId });
  const saveNotes = trpc.applicationSupplements.saveNotes.useMutation();
  const saveSponsor = trpc.applicationSupplements.saveSponsor.useMutation();
  const createDocument = trpc.document.create.useMutation();
  const link = trpc.applicationSupplements.linkDocument.useMutation();
  const [notes, setNotes] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [relation, setRelation] = useState<string | null>(null);
  const [editingSponsor, setEditingSponsor] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [progress, setProgress] = useState<DocumentUploadProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sponsor = query.data?.sponsors[0];
  const upload = async () => {
    if (!file || busy) return;
    setBusy(true); setError(""); setFileName(file.name);
    try {
      let id = documentId;
      if (!id) {
        setProgress({ phase: "preparing" });
        const uploaded = await documentUploadClient(setProgress).storage.upload.mutate({ applicationId, documentType: "supporting", fileName: file.name,
          mimeType: documentMimeType(file.type, file.name), fileSize: file.size, base64Data: await readFile(file) });
        setProgress({ phase: "saving" });
        const saved = await createDocument.mutateAsync({ applicationId, documentType: "supporting", originalFileName: file.name,
          storedFileName: uploaded.storedFileName, mimeType: uploaded.mimeType, fileSize: uploaded.fileSize, storagePath: uploaded.storagePath, uploadStatus: "uploaded" });
        id = saved.id; setDocumentId(id);
      }
      await link.mutateAsync({ applicationId, documentId: id });
      await query.refetch(); setFile(null); setDocumentId(null); setProgress({ phase: "accepted" });
    } catch (cause) { setProgress({ phase: "failed" }); setError(documentUploadError(cause instanceof Error ? cause.message : "", ar)); }
    finally { setBusy(false); }
  };
  return <section className="mt-5 space-y-5 rounded-2xl border bg-white p-5">
    {query.error && <p role="alert">{ar ? "تعذر تحميل الإضافات. أعد المحاولة؛ الإضافات الاختيارية لا تمنع المتابعة." : "Could not load additions. Retry; optional additions do not block continuation."}<button type="button" onClick={() => void query.refetch()}>{ar ? "إعادة المحاولة" : "Retry"}</button></p>}
    {companion && query.data && sponsor?.name && sponsor.relation && !editingSponsor && <p>{ar ? "الكفيل" : "Sponsor"}: {sponsor.name} · {sponsor.relation} <button type="button" className="underline" onClick={() => setEditingSponsor(true)}>{ar ? "تعديل" : "Edit"}</button></p>}
    {companion && query.data && (editingSponsor || !sponsor?.name || !sponsor.relation) && <form className="grid gap-3" onSubmit={event => { event.preventDefault(); void saveSponsor.mutateAsync({ applicationId, name: name ?? sponsor?.name ?? "", relation: relation ?? sponsor?.relation ?? "" }).then(async () => { await query.refetch(); await onSaved(); setEditingSponsor(false); }).catch(() => undefined); }}>
      <h2 className="font-bold">{ar ? "بيانات الكفيل" : "Sponsor details"}</h2>
      <label>{ar ? "اسم الكفيل كما في الهوية أو الجواز" : "Sponsor's full name (as in their ID or passport)"}<input required maxLength={255} value={name ?? sponsor?.name ?? ""} onChange={event => setName(event.target.value)} className="mt-2 block w-full rounded-xl border p-3" /></label>
      <label>{ar ? "صلة القرابة بالمسافر" : "Relationship to the applicant"}<input required maxLength={50} value={relation ?? sponsor?.relation ?? ""} onChange={event => setRelation(event.target.value)} className="mt-2 block w-full rounded-xl border p-3" /></label>
      <button type="submit" disabled={saveSponsor.isPending} className="rounded-xl border p-3">{ar ? "حفظ بيانات الكفيل" : "Save sponsor details"}</button>
      <p role="status">{saveSponsor.isError ? (ar ? "تعذر الحفظ. راجع البيانات وأعد المحاولة." : "Could not save. Check the details and retry.") : saveSponsor.isSuccess ? (ar ? "تم الحفظ" : "Saved") : ""}</p>
    </form>}
    <div>
      <h2 className="font-bold">{ar ? "مستندات داعمة إضافية (اختياري)" : "Additional supporting documents (optional)"}</h2>
      <p className="mt-2 text-sm">{ar ? "حتى 6 ملفات. PDF، JPG، PNG، HEIC أو HEIF؛ حتى 20 ميجابايت للملف. لا تمنع المتابعة." : "Up to 6 files. PDF, JPG, PNG, HEIC or HEIF; up to 20 MB each. These never block continuation."}</p>
      <ul className="my-3 space-y-1">{query.data?.files.map(item => <li key={item.id}>✓ {item.name}</li>)}</ul>
      {(query.data?.files.length ?? 0) < MAX_SUPPORTING_DOCUMENTS && <>
        <input type="file" className="max-w-full" aria-label={ar ? "مستند إضافي اختياري" : "Optional supporting file"} accept={DOCUMENT_INPUT_ACCEPT} disabled={busy || !query.data} onChange={event => { setFile(event.target.files?.[0] ?? null); setDocumentId(null); setError(""); setProgress(null); }} />
        {file && progress?.phase !== "accepted" && !error && <button type="button" disabled={busy} onClick={() => void upload()} className="mt-3 rounded-xl border p-3">{error ? (ar ? "إعادة المحاولة" : "Retry") : (ar ? "رفع" : "Upload")}</button>}
      </>}
      {progress && <UploadProgress progress={progress} name={fileName} ar={ar} error={error} disabled={busy} retry={() => void upload()} />}
    </div>
    <form className="grid gap-3" onSubmit={event => { event.preventDefault(); void saveNotes.mutateAsync({ applicationId, notes: notes ?? query.data?.notes ?? "" }).then(() => query.refetch()).catch(() => undefined); }}>
      <label className="font-bold">{ar ? "ملاحظات إضافية (اختياري)" : "Additional notes (optional)"}
        <textarea rows={4} maxLength={MAX_ADDITIONAL_NOTES_LENGTH} value={notes ?? query.data?.notes ?? ""} onChange={event => setNotes(event.target.value)} aria-describedby="additional-notes-help" className="mt-2 block w-full rounded-xl border p-3 font-normal" /></label>
      <p id="additional-notes-help" className="text-sm">{ar ? "أي معلومات أخرى قد تساعدنا في مراجعة طلبك" : "Anything else that may help us review your application"}</p>
      <button type="submit" disabled={saveNotes.isPending || !query.data} className="rounded-xl border p-3">{ar ? "حفظ الملاحظات" : "Save notes"}</button>
      <p role="status">{saveNotes.isError ? (ar ? "تعذر حفظ الملاحظات. أعد المحاولة." : "Could not save notes. Retry.") : saveNotes.isSuccess ? (ar ? "تم حفظ الملاحظات" : "Notes saved") : ""}</p>
    </form>
  </section>;
}
