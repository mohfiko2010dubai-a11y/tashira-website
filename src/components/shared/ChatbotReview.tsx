import { useState } from 'react';
import { CheckCircle, FileCheck, Loader2, Pencil, ShieldCheck } from 'lucide-react';
import type { ChatbotApplicant } from '@/lib/chatbot-application';

type ApplicantChanges = Pick<ChatbotApplicant, 'fullName' | 'nationality' | 'passportNumber' | 'passportExpiry' | 'profession' | 'countryFrom'>;
type ReviewDocumentType = 'passport' | 'photo' | 'national_id' | 'supporting' | 'visa' | 'invoice' | 'gcc_residence' | 'sponsor_id';

export function ChatbotReview({
  applicants,
  email,
  phone,
  visaType,
  processingType,
  applicantCount,
  totalAmount,
  documents,
  onSaveApplicant,
  onSaveContact,
  onSaveService,
  onReplaceDocument,
  onContinue,
}: {
  applicants: ChatbotApplicant[];
  email: string;
  phone: string;
  visaType: string;
  processingType: string;
  applicantCount: number;
  totalAmount: number;
  documents: Array<{ id: number; applicantId: number | null; documentType: ReviewDocumentType; uploadStatus: string }>;
  onSaveApplicant: (index: number, changes: ApplicantChanges) => Promise<void>;
  onSaveContact: (email: string, phone: string) => Promise<void>;
  onSaveService: (visaType: string, processingType: string) => Promise<void>;
  onReplaceDocument: (document: { id: number; applicantId: number | null; documentType: ReviewDocumentType }, file: File) => Promise<void>;
  onContinue: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [applicantDraft, setApplicantDraft] = useState<ApplicantChanges | null>(null);
  const [contactDraft, setContactDraft] = useState({ email, phone });
  const [serviceDraft, setServiceDraft] = useState({ visaType, processingType });

  const save = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
      setEditing(null);
    } catch {
      setError("We couldn't save that change. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const maskPassport = (value: string) => value.length <= 4 ? value : `${'•'.repeat(Math.min(value.length - 4, 8))}${value.slice(-4)}`;
  const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 outline-none focus:border-[#C9A04C]';

  return (
    <div className="border-t border-gray-100 bg-[#FAFAF7] p-3">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#C9A04C]">Final review</p>
          <h3 className="mt-1 text-base font-bold text-[#172235]">Review Your Application</h3>
          <p className="mt-1 text-xs text-gray-500">Please review your information carefully before proceeding to payment.</p>
        </div>

        <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
          {applicants.map((applicant) => {
            const key = `applicant-${applicant.applicantIndex}`;
            const isEditing = editing === key;
            return (
              <section key={applicant.applicantId} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <div><p className="text-xs font-bold text-[#172235]">Applicant {applicant.applicantIndex + 1}</p><p className="text-[11px] text-gray-500">Applicant & passport details</p></div>
                  <button type="button" disabled={busy} onClick={() => { setApplicantDraft(applicant); setEditing(key); }} className="flex items-center gap-1 text-xs font-semibold text-[#C9A04C]"><Pencil size={12} /> Edit</button>
                </div>
                {isEditing && applicantDraft ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(['fullName', 'nationality', 'passportNumber', 'passportExpiry', 'profession', 'countryFrom'] as const).map((field) => (
                      <input key={field} aria-label={field} value={applicantDraft[field]} onChange={(event) => setApplicantDraft({ ...applicantDraft, [field]: event.target.value })} className={inputClass} />
                    ))}
                    <div className="col-span-2 flex gap-2">
                      <button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-lg border px-3 py-2 text-xs">Cancel</button>
                      <button type="button" disabled={busy} onClick={() => save(() => onSaveApplicant(applicant.applicantIndex, applicantDraft))} className="flex-1 rounded-lg bg-[#172235] px-3 py-2 text-xs font-semibold text-white">{busy ? 'Saving…' : 'Save changes'}</button>
                    </div>
                  </div>
                ) : (
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]"><div><dt className="text-gray-400">Name</dt><dd className="font-medium text-gray-700">{applicant.fullName}</dd></div><div><dt className="text-gray-400">Nationality</dt><dd className="font-medium text-gray-700">{applicant.nationality}</dd></div><div><dt className="text-gray-400">Passport</dt><dd className="font-mono font-medium text-gray-700">{maskPassport(applicant.passportNumber)}</dd></div><div><dt className="text-gray-400">Expiry</dt><dd className="font-medium text-gray-700">{applicant.passportExpiry}</dd></div></dl>
                )}
                <div className="mt-3 space-y-1">
                  {documents.filter((document) => document.applicantId === applicant.applicantId && document.uploadStatus === 'uploaded').map((document, documentIndex) => (
                    <label key={document.id} className="flex cursor-pointer items-center justify-between rounded-md bg-emerald-50 px-2 py-1.5 text-[10px] text-emerald-800">
                      <span className="flex items-center gap-1"><CheckCircle size={10}/>{document.documentType === 'photo' ? 'Personal photo' : document.documentType === 'passport' ? `Passport document ${documentIndex + 1}` : document.documentType} · Uploaded</span>
                      <span className="font-semibold text-[#9C792D]">Replace<input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void save(() => onReplaceDocument(document, file)); event.target.value = ''; }}/></span>
                    </label>
                  ))}
                </div>
              </section>
            );
          })}

          <section className="rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between"><div><p className="text-xs font-bold text-[#172235]">Contact Details</p><p className="text-[11px] text-gray-500">Email and WhatsApp</p></div><button type="button" onClick={() => { setContactDraft({ email, phone }); setEditing('contact'); }} className="flex items-center gap-1 text-xs font-semibold text-[#C9A04C]"><Pencil size={12} /> Edit</button></div>
            {editing === 'contact' ? <div className="mt-3 space-y-2"><input aria-label="Email" value={contactDraft.email} onChange={(e) => setContactDraft({ ...contactDraft, email: e.target.value })} className={inputClass}/><input aria-label="Phone" value={contactDraft.phone} onChange={(e) => setContactDraft({ ...contactDraft, phone: e.target.value })} className={inputClass}/><button type="button" disabled={busy} onClick={() => save(() => onSaveContact(contactDraft.email, contactDraft.phone))} className="w-full rounded-lg bg-[#172235] py-2 text-xs font-semibold text-white">Save contact</button></div> : <p className="mt-2 text-[11px] text-gray-600">{email}<br/>{phone}</p>}
          </section>

          <section className="rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between"><div><p className="text-xs font-bold text-[#172235]">Visa / Processing</p><p className="text-[11px] text-gray-500">Server-authoritative price</p></div><button type="button" onClick={() => { setServiceDraft({ visaType, processingType }); setEditing('service'); }} className="flex items-center gap-1 text-xs font-semibold text-[#C9A04C]"><Pencil size={12} /> Edit</button></div>
            {editing === 'service' ? <div className="mt-3 space-y-2"><select value={serviceDraft.visaType} onChange={(e) => setServiceDraft({ ...serviceDraft, visaType: e.target.value })} className={inputClass}>{['14 Days','30 Days','30 Days Multiple','60 Days','60 Days Multiple','90 Days','96 Hours Transit'].map((value) => <option key={value}>{value}</option>)}</select><select value={serviceDraft.processingType} onChange={(e) => setServiceDraft({ ...serviceDraft, processingType: e.target.value })} className={inputClass}><option>Regular</option><option>Express</option></select><button type="button" disabled={busy} onClick={() => save(() => onSaveService(serviceDraft.visaType, serviceDraft.processingType))} className="w-full rounded-lg bg-[#172235] py-2 text-xs font-semibold text-white">Recalculate & save</button></div> : <p className="mt-2 text-[11px] text-gray-600">{visaType} · {processingType}</p>}
          </section>

          <section className="rounded-lg border border-[#C9A04C]/30 bg-[#C9A04C]/5 p-3"><div className="flex items-center gap-2"><FileCheck size={15} className="text-[#C9A04C]"/><p className="text-xs font-bold text-[#172235]">Order Summary</p></div><div className="mt-2 flex items-end justify-between"><p className="text-[11px] text-gray-500">{applicantCount} applicant{applicantCount > 1 ? 's' : ''}<br/>{visaType} · {processingType}</p><p className="text-lg font-bold text-[#C9A04C]">USD {totalAmount.toFixed(2)}</p></div></section>
        </div>

        {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}
        <button type="button" disabled={busy || editing !== null} onClick={onContinue} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin"/> : <ShieldCheck size={16}/>} Continue to policies</button>
      </div>
    </div>
  );
}
