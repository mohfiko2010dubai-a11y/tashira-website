import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { UploadCloud, X, CheckCircle, User, Users, Globe, Building2, Crown, UsersRound, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { allCountries, allCountriesAr } from '@/data/countries';
import { trpc } from '@/providers/trpc-client';
import TrackApplication from './TrackApplication';
import { TERMS_POLICY_VERSION } from '@contracts/constants';
import FormDecorations from '@/components/shared/FormDecorations';
import StripePaymentForm, { PaymentSuccessModal } from '@/components/shared/StripePaymentForm';
import { useDocumentUpload, type PendingFile } from '@/hooks/useDocumentUpload';
import type { ApplicationReadiness } from '../../api/lib/application-readiness';
import { checkoutPreflightDecision, completionPanelGroups } from '@/lib/checkout-preflight';
import { trackFunnelEventOnce } from '@/lib/google-conversion';

type BaseType = 'single' | 'family';
type ResidenceType = 'non-gcc' | 'gcc-resident' | 'gcc-accompany' | 'non-gcc-accompany';

interface ApplicantData {
  id: number;
  fullName: string;
  nationality: string;
  passportNumber: string;
  passportType: string;
  travelingFrom: string;
  facePhoto: UploadedFile | null;
  passportCopy: UploadedFile | null;
  passportCover: UploadedFile | null;
  passportExpiry: string;
  profession: string;
  gccResidenceNumber: string;
  gccResidenceCountry: string;
  // GCC Resident files
  gccResidenceIdFront: UploadedFile | null;
  gccResidenceIdBack: UploadedFile | null;
  gccResidencyPermit: UploadedFile | null;
  // GCC Accompany / Non-GCC Accompany files
  sponsorIdOrPassport: UploadedFile | null;
  sponsorName: string;
  sponsorRelation: string;
}

interface UploadedFile {
  file: File;
  preview: string;
}

const visaOptions = [
  { value: '14days-single', label: '14 Days Visa', labelAr: 'تأشيرة 14 يوم', price: 165 },
  { value: '14days-multiple', label: '14 Days Multiple', labelAr: 'تأشيرة 14 يوم متعدد', price: 265 },
  { value: '30days-single', label: '30 Days Visa', labelAr: 'تأشيرة 30 يوم', price: 185 },
  { value: '60days-single', label: '60 Days Visa', labelAr: 'تأشيرة 60 يوم', price: 295 },
  { value: '96hours-transit', label: '96 Hours Transit', labelAr: 'تأشيرة عبور 96 ساعة', price: 145 },
  { value: '30days-gcc', label: '30 Days For GCC', labelAr: '30 يوم للخليجيين', price: 185 },
  { value: '30days-multiple', label: '30 Days Multiple', labelAr: 'تأشيرة 30 يوم متعدد', price: 285 },
  { value: '60days-multiple', label: '60 Days Multiple', labelAr: 'تأشيرة 60 يوم متعدد', price: 385 },
  { value: '90days-single', label: '90 Days Visa', labelAr: 'تأشيرة 90 يوم', price: 550 },
];

const passportTypes = [
  { value: 'ordinary', label: 'Ordinary Passport', labelAr: 'جواز سفر عادي' },
  { value: 'diplomatic', label: 'Diplomatic Passport', labelAr: 'جواز سفر دبلوماسي' },
];

const gccCountries = ['Saudi Arabia', 'Kuwait', 'Qatar', 'Bahrain', 'Oman', 'United Arab Emirates'];

const emptyApplicant = (id: number): ApplicantData => ({
  id,
  fullName: '',
  nationality: '',
  passportNumber: '',
  passportType: 'ordinary',
  travelingFrom: '',
  facePhoto: null,
  passportCopy: null,
  passportCover: null,
  passportExpiry: '',
  profession: '',
  gccResidenceNumber: '',
  gccResidenceCountry: '',
  gccResidenceIdFront: null,
  gccResidenceIdBack: null,
  gccResidencyPermit: null,
  sponsorIdOrPassport: null,
  sponsorName: '',
  sponsorRelation: '',
});

export default function VisaApplicationForm() {
  const { i18n } = useTranslation('home');
  const isAr = i18n.language === 'ar';
  const [dragOver, setDragOver] = useState<string | null>(null);

  const [baseType, setBaseType] = useState<BaseType | null>('family');
  const [residenceType, setResidenceType] = useState<ResidenceType | null>('gcc-resident');
  const [numApplicants, setNumApplicants] = useState(2);
  const [currentApplicantIdx, setCurrentApplicantIdx] = useState(0);

  const [visaType, setVisaType] = useState('14days-single');
  const [processingType, setProcessingType] = useState<'regular' | 'express'>('regular');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [applicants, setApplicants] = useState<ApplicantData[]>([emptyApplicant(0), emptyApplicant(1)]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [completionError, setCompletionError] = useState('');
  const { uploadFiles, uploadProgress, isUploading } = useDocumentUpload();
  const utils = trpc.useUtils();
  const [readinessIssues, setReadinessIssues] = useState<ApplicationReadiness | null>(null);
  const priceQuote = trpc.business.quote.useQuery({
    serviceCode: visaType,
    processingType,
    applicantCount: applicants.length,
  });

  const isGCC = residenceType === 'gcc-resident' || residenceType === 'gcc-accompany';
  const isFamily = baseType === 'family';
  const isAccompany = residenceType === 'gcc-accompany' || residenceType === 'non-gcc-accompany';

  const updateApplicant = <K extends keyof ApplicantData>(idx: number, field: K, value: ApplicantData[K]) => {
    setApplicants((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const handleFileDrop = (e: React.DragEvent, idx: number, type: 'face' | 'passport' | 'cover' | 'gcc-front' | 'gcc-back' | 'gcc-permit' | 'sponsor-id') => {
    e.preventDefault();
    setDragOver(null);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file, idx, type);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, idx: number, type: 'face' | 'passport' | 'cover' | 'gcc-front' | 'gcc-back' | 'gcc-permit' | 'sponsor-id') => {
    const file = e.target.files?.[0];
    if (file) processFile(file, idx, type);
  };

  const getFileField = (type: 'face' | 'passport' | 'cover' | 'gcc-front' | 'gcc-back' | 'gcc-permit' | 'sponsor-id'): keyof ApplicantData => {
    switch (type) {
      case 'face': return 'facePhoto';
      case 'passport': return 'passportCopy';
      case 'cover': return 'passportCover';
      case 'gcc-front': return 'gccResidenceIdFront';
      case 'gcc-back': return 'gccResidenceIdBack';
      case 'gcc-permit': return 'gccResidencyPermit';
      case 'sponsor-id': return 'sponsorIdOrPassport';
    }
  };

  // Map file type to document_type enum
  const getDocumentType = (type: string): PendingFile['documentType'] => {
    switch (type) {
      case 'face': return 'photo';
      case 'passport': return 'passport';
      case 'cover': return 'passport';
      case 'gcc-front': return 'gcc_residence';
      case 'gcc-back': return 'gcc_residence';
      case 'gcc-permit': return 'gcc_residence';
      case 'sponsor-id': return 'sponsor_id';
      default: return 'supporting';
    }
  };

  // Collect all pending files from all applicants
  const collectPendingFiles = (): PendingFile[] => {
    const files: PendingFile[] = [];
    const fileTypes: Array<{ key: keyof ApplicantData; type: string }> = [
      { key: 'facePhoto', type: 'face' },
      { key: 'passportCopy', type: 'passport' },
      { key: 'passportCover', type: 'cover' },
      { key: 'gccResidenceIdFront', type: 'gcc-front' },
      { key: 'gccResidenceIdBack', type: 'gcc-back' },
      { key: 'gccResidencyPermit', type: 'gcc-permit' },
      { key: 'sponsorIdOrPassport', type: 'sponsor-id' },
    ];
    applicants.forEach((applicant, idx) => {
      fileTypes.forEach(({ key, type }) => {
        const uploadedFile = applicant[key] as UploadedFile | null;
        if (uploadedFile?.file) {
          files.push({
            file: uploadedFile.file,
            documentType: getDocumentType(type),
            applicantIndex: idx,
          });
        }
      });
    });
    return files;
  };

  const processFile = (file: File, idx: number, type: 'face' | 'passport' | 'cover' | 'gcc-front' | 'gcc-back' | 'gcc-permit' | 'sponsor-id') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      updateApplicant(idx, getFileField(type), { file, preview: result });
    };
    reader.onerror = (e) => {
      console.error(`[processFile] File read error:`, e);
    };
    reader.readAsDataURL(file);
  };

  const removeFile = (idx: number, type: 'face' | 'passport' | 'cover' | 'gcc-front' | 'gcc-back' | 'gcc-permit' | 'sponsor-id') => {
    updateApplicant(idx, getFileField(type), null);
  };

  const handleBaseTypeChange = (type: BaseType) => {
    trackFunnelEventOnce('begin_application', 'primary-form');
    setBaseType(type);
    if (type === 'family') {
      setNumApplicants(2);
      setApplicants([emptyApplicant(0), emptyApplicant(1)]);
    } else {
      setNumApplicants(1);
      setApplicants([emptyApplicant(0)]);
    }
    setCurrentApplicantIdx(0);
  };

  const addApplicant = () => {
    if (applicants.length < 10) {
      setApplicants((p) => [...p, emptyApplicant(p.length)]);
      setNumApplicants((n) => n + 1);
      setCurrentApplicantIdx(applicants.length);
    }
  };

  const removeApplicant = (idx: number) => {
    if (applicants.length > 2) {
      const updated = applicants.filter((_, i) => i !== idx).map((a, i) => ({ ...a, id: i }));
      setApplicants(updated);
      setNumApplicants(updated.length);
      if (currentApplicantIdx >= updated.length) setCurrentApplicantIdx(updated.length - 1);
    }
  };

  const submitApplication = trpc.application.create.useMutation({
    onSuccess: async (data) => {
      trackFunnelEventOnce('application_submitted', data.referenceNumber, {
        applicant_count: applicants.length,
        application_type: baseType || 'single',
      });
      setReferenceNumber(data.referenceNumber);
      setApplicationId(data.id);
      const uploadResult = await uploadFiles(collectPendingFiles(), data.id, data.applicantIds, email);
      setLoading(false);
      if (!uploadResult.success) {
        setCompletionError('Some required documents could not be uploaded. Please retry the application before proceeding to payment.');
        return;
      }
      try {
        const readiness = await utils.payment.readiness.fetch({ referenceNumber: data.referenceNumber });
        const decision = checkoutPreflightDecision(readiness.status);
        setReadinessIssues(decision.showCompletionPanel ? readiness : null);
        setShowPaymentModal(decision.openPaymentUi);
      } catch (error: unknown) {
        setShowPaymentModal(false);
        setCompletionError(error instanceof Error ? error.message : 'Unable to verify application readiness. Please try again.');
      }
    },
    onError: (err) => {
      setLoading(false);
      console.error('Submission error:', err);
      const msg = err.message || 'Unknown error';
      alert(isAr ? `حدث خطأ: ${msg}` : `Error: ${msg}\n\nPlease check console for details.`);
    },
  });

  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentInvoiceNumber, setPaymentInvoiceNumber] = useState('');
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const allScreeningYes = true; // screening questions removed, form always visible
  const calculateTotal = () => priceQuote.data?.totalPrice ?? 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted || !allScreeningYes || !priceQuote.data) return;
    setLoading(true);
    setCompletionError('');
    setReadinessIssues(null);
    setShowPaymentModal(false);
    const ref = `TSH-${Math.floor(100000 + Math.random() * 900000)}`;
    
    submitApplication.mutate({
      referenceNumber: ref,
      baseType: baseType!,
      residenceType: residenceType!,
      visaType,
      processingType,
      contactEmail: email,
      contactPhone: phone,
      arrivalDate,
      policyVersion: TERMS_POLICY_VERSION,
      applicants: applicants.map((a) => ({
        fullName: a.fullName,
        nationality: a.nationality,
        passportNumber: a.passportNumber,
        passportType: a.passportType,
        travelingFrom: a.travelingFrom,
        passportExpiry: a.passportExpiry,
        profession: a.profession,
        gccResidenceNumber: a.gccResidenceNumber,
        gccResidenceCountry: a.gccResidenceCountry,
        sponsorName: a.sponsorName,
        sponsorRelation: a.sponsorRelation,
      })),
    });
  };

  const app = applicants[currentApplicantIdx];
  const completionGroups = readinessIssues ? completionPanelGroups(readinessIssues) : [];

  const renderDropZone = (idx: number, type: 'face' | 'passport' | 'cover' | 'gcc-front' | 'gcc-back' | 'gcc-permit' | 'sponsor-id', file: UploadedFile | null, label: string) => (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-800">{label} <span className="text-red-500">*</span></label>
      {!file ? (
        <div onDragOver={(e) => { e.preventDefault(); setDragOver(`${type}-${idx}`); }} onDragLeave={() => setDragOver(null)} onDrop={(e) => handleFileDrop(e, idx, type)} onClick={() => document.getElementById(`${type}-${idx}`)?.click()} className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${dragOver === `${type}-${idx}` ? 'border-[#C9A04C] bg-[#C9A04C]/[0.03]' : 'border-gray-300 hover:border-[#DDBB7A] bg-gray-50/50'}`}>
          <input id={`${type}-${idx}`} type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => handleFileSelect(e, idx, type)} className="hidden" />
          <div className="flex flex-col items-center gap-1.5">
            <UploadCloud size={22} className="text-gray-400" />
            <p className="text-[10px] text-gray-500">{isAr ? 'اسحب الملف وأفلته هنا' : 'Drag & Drop Files'}<br /><span className="text-[#C9A04C]">{isAr ? 'اختر ملف للرفع' : 'Choose Files to Upload'}</span></p>
          </div>
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-gray-200">
          <img src={file.preview} alt="" className="w-full h-20 object-cover" />
          <button onClick={() => removeFile(idx, type)} className="absolute top-1.5 right-1.5 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"><X size={10} /></button>
          <p className="text-[10px] text-gray-500 px-2 py-1 truncate">{file.file.name}</p>
        </div>
      )}
    </div>
  );

  if (submitted && paymentInvoiceNumber) {
    return (
      <PaymentSuccessModal
        invoiceNumber={paymentInvoiceNumber}
        referenceNumber={referenceNumber}
        totalAmountUsd={calculateTotal()}
        exchangeRate={priceQuote.data?.exchangeRateToBase ?? 0}
        applicationId={applicationId || 0}
        pendingFiles={[]}
        applicantData={{ customerName: applicants[0]?.fullName || '', customerEmail: email, customerPhone: phone, visaType, processingType, arrivalDate }}
        onClose={() => { setSubmitted(false); setPaymentInvoiceNumber(''); setBaseType(null); setResidenceType(null); setApplicants([emptyApplicant(0)]); setTermsAccepted(false); }}
      />
    );
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 pb-20">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4"><CheckCircle size={40} className="text-emerald-500" /></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{isAr ? 'تم الإرسال بنجاح!' : 'Application Submitted!'}</h2>
          <p className="text-gray-500 mb-6">{isAr ? 'تم تقديم طلبك بنجاح.' : 'Your application has been submitted successfully.'}</p>
          <div className="bg-gray-50 rounded-xl p-6 max-w-sm mx-auto mb-6">
            <p className="text-sm text-gray-500 mb-2">{isAr ? 'رقم المرجع الخاص بك' : 'Your Reference Number'}</p>
            <p className="text-3xl font-mono font-bold text-[#C9A04C]">{referenceNumber}</p>
          </div>
          <button onClick={() => { setSubmitted(false); setBaseType(null); setResidenceType(null); setApplicants([emptyApplicant(0)]); setTermsAccepted(false); }} className="px-8 py-3 rounded-lg font-semibold text-white bg-gradient-to-br from-[#C9A04C] to-[#DDBB7A] shadow-[0_2px_8px_rgba(201,160,76,0.25)] hover:-translate-y-0.5 transition-all">{isAr ? 'تقديم طلب جديد' : 'Submit Another Application'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 pb-20 relative">
      {/* Floating side decorations */}
      <FormDecorations />

      <form onSubmit={handleSubmit} className="relative z-10 max-w-5xl mx-auto bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 sm:p-8 lg:p-10">

          {/* ===== STEP 1: SINGLE OR FAMILY ===== */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-full bg-[#C9A04C] text-white flex items-center justify-center text-xs font-bold">1</span>
              <h3 className="text-base font-semibold text-gray-900">{isAr ? 'مين بيسافر؟' : 'Who is traveling?'}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'single', icon: User, title: isAr ? 'متقدم واحد' : 'Single Applicant', desc: isAr ? 'أتقدم لنفسي' : 'I am applying for myself' },
                { key: 'family', icon: Users, title: isAr ? 'طلب عائلي' : 'Family Application', desc: isAr ? 'أتقدم لعائلتي' : 'I am applying for my family' },
              ].map((opt) => (
                <button key={opt.key} type="button" onClick={() => handleBaseTypeChange(opt.key as BaseType)} className={`flex items-center gap-4 p-5 rounded-xl border-2 transition-all text-left ${baseType === opt.key ? 'border-[#C9A04C] bg-gradient-to-br from-[#C9A04C]/10 to-[#C9A04C]/5 shadow-sm' : 'border-gray-200 hover:border-[#DDBB7A]'}`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${baseType === opt.key ? 'bg-[#C9A04C] text-white' : 'bg-gray-100 text-gray-400'}`}><opt.icon size={24} /></div>
                  <div><p className="font-semibold text-gray-900">{opt.title}</p><p className="text-xs text-gray-500">{opt.desc}</p></div>
                </button>
              ))}
            </div>
          </div>

          {/* ===== STEP 2: RESIDENCE TYPE ===== */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-full bg-[#C9A04C] text-white flex items-center justify-center text-xs font-bold">2</span>
              <h3 className="text-base font-semibold text-gray-900">{isAr ? 'نوع الإقامة / الحالة' : 'Residence Status'}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { key: 'non-gcc', icon: Globe, title: isAr ? 'غير مقيم خليجي' : 'Non-GCC Resident', desc: isAr ? 'لا أملك إقامة خليجية' : 'I do not hold GCC residency' },
                  { key: 'gcc-resident', icon: Building2, title: isAr ? 'مقيم خليجي' : 'GCC Resident', desc: isAr ? 'أملك إقامة خليجية' : 'I hold a valid GCC residency' },
                  { key: 'non-gcc-accompany', icon: UsersRound, title: isAr ? 'مصاحب مواطن خليجي' : 'Accompanying GCC Citizen', desc: isAr ? 'غير خليجي + مسافر مع خليجي' : 'Non-GCC citizen accompanying a GCC citizen' },
                  { key: 'gcc-accompany', icon: Crown, title: isAr ? 'مواطن خليجي بمرافق' : 'GCC Citizen with Companion', desc: isAr ? 'خليجي + مسافر مع مرافق' : 'GCC citizen traveling with a companion' },
                ].map((opt) => (
                  <button key={opt.key} type="button" onClick={() => setResidenceType(opt.key as ResidenceType)} className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center ${residenceType === opt.key ? 'border-[#C9A04C] bg-gradient-to-br from-[#C9A04C]/10 to-[#C9A04C]/5 shadow-sm' : 'border-gray-200 hover:border-[#DDBB7A]'}`}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${residenceType === opt.key ? 'bg-[#C9A04C] text-white' : 'bg-gray-100 text-gray-400'}`}><opt.icon size={20} /></div>
                    <p className="text-sm font-semibold text-gray-900">{opt.title}</p>
                    <p className="text-[10px] text-gray-500 leading-tight">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

          {/* ===== STEP 3: FAMILY SIZE + PRICE ===== */}
          {isFamily && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-7 h-7 rounded-full bg-[#C9A04C] text-white flex items-center justify-center text-xs font-bold">3</span>
                <h3 className="text-base font-semibold text-gray-900">{isAr ? 'عدد أفراد العائلة' : 'How many family members?'}</h3>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="text-sm text-gray-600">{isAr ? 'عدد المتقدمين:' : 'Applicants:'}</label>
                <input type="number" min={2} max={10} value={numApplicants} onChange={(e) => { const n = Math.max(2, Math.min(10, parseInt(e.target.value) || 2)); setNumApplicants(n); while (applicants.length < n) setApplicants((p) => [...p, emptyApplicant(p.length)]); while (applicants.length > n) setApplicants((p) => p.slice(0, -1)); }} className="w-20 px-3 py-2 border border-gray-200 rounded-lg focus:border-[#C9A04C] outline-none text-center" />
                <button type="button" onClick={addApplicant} disabled={applicants.length >= 10} className="flex items-center gap-1 px-3 py-2 text-sm text-[#C9A04C] border border-[#C9A04C] rounded-lg hover:bg-[#C9A04C]/5 disabled:opacity-40"><Plus size={14} /> {isAr ? 'إضافة' : 'Add'}</button>
                <div className="ml-auto flex items-center gap-2 bg-gradient-to-r from-[#C9A04C]/10 to-[#C9A04C]/5 border border-[#C9A04C]/30 rounded-xl px-4 py-2">
                  <span className="text-xs text-gray-500">{isAr ? 'الإجمالي:' : 'Total:'}</span>
                  <span className="text-lg font-bold text-[#C9A04C]">${calculateTotal()}</span>
                  <span className="text-[10px] text-gray-400">({applicants.length} {isAr ? 'شخص' : 'person'}{applicants.length > 1 ? 's' : ''})</span>
                </div>
              </div>
            </div>
          )}

          {/* ===== APPLICANT TABS (Family) ===== */}
          {isFamily && applicants.length > 1 && (
            <div className="mb-6 flex items-center gap-2 flex-wrap">
              {applicants.map((_, idx) => (
                <button key={idx} type="button" onClick={() => setCurrentApplicantIdx(idx)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${currentApplicantIdx === idx ? 'bg-[#C9A04C] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  <User size={14} /> {isAr ? `متقدم ${idx + 1}` : `Applicant ${idx + 1}`}
                  {applicants.length > 2 && <span onClick={(e) => { e.stopPropagation(); removeApplicant(idx); }} className="ml-1 p-0.5 rounded-full hover:bg-white/20 cursor-pointer"><X size={10} /></span>}
                </button>
              ))}
            </div>
          )}

          {/* ===== GCC/ACCOMPANY INFO BANNER ===== */}
          {isGCC && (
            <div className="mb-6 bg-gradient-to-r from-[#C9A04C]/10 to-[#C9A04C]/5 border border-[#C9A04C]/30 rounded-xl p-4">
              <p className="text-sm text-[#C9A04C] font-medium">
                {residenceType === 'gcc-resident'
                  ? (isAr ? 'أنت تقدم كـ مقيم خليجي. يرجى رفع صورة البطاقة الخليجية والتصريح أدناه.' : 'You are a GCC Resident. Please upload your GCC Residence ID and permit below.')
                  : (isAr ? 'أنت تقدم كـ مواطن خليجي بمرافق. يرجى رفع البطاقة الخليجية والتصريح ونسخة المرافق أدناه.' : 'You are a GCC citizen traveling with a companion. Please upload GCC Residence ID, permit, and companion documents below.')
                }
              </p>
            </div>
          )}
          {residenceType === 'non-gcc-accompany' && (
            <div className="mb-6 bg-gradient-to-r from-blue-500/10 to-blue-500/5 border border-blue-500/30 rounded-xl p-4">
              <p className="text-sm text-blue-600 font-medium">
                {isAr ? 'أنت مسافر كمصاحب لمواطن خليجي. يرجى رفع نسخة جواز/هوية الكفيل أدناه.' : 'You are accompanying a GCC citizen. Please upload a copy of the sponsor\'s passport or GCC ID below.'}
              </p>
            </div>
          )}

          {/* ===== 2-COLUMN FORM ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-5">
              {/* LEFT COLUMN */}
              <div id="documents-section" tabIndex={-1} className="space-y-5">
                <div id="visa-type-field">
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">{isAr ? 'نوع التأشيرة' : 'Visa Type'} <span className="text-red-500">*</span></label>
                  <select value={visaType} onChange={(e) => setVisaType(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-[#C9A04C] focus:ring-1 focus:ring-[#C9A04C] outline-none bg-white text-gray-800">
                    {visaOptions.map((v) => <option key={v.value} value={v.value}>{isAr ? v.labelAr : v.label}</option>)}
                  </select>
                  {priceQuote.data && <p className="text-xs text-gray-400 mt-1">{isAr ? 'السعر من الخادم:' : 'Server price:'} <span className="font-semibold text-[#C9A04C]">{priceQuote.data.currency} {priceQuote.data.unitPrice.toFixed(2)}</span></p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">{isAr ? 'الجنسية' : 'Nationality'} <span className="text-red-500">*</span></label>
                  <select value={app.nationality} onChange={(e) => updateApplicant(currentApplicantIdx, 'nationality', e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-[#C9A04C] outline-none bg-white text-gray-800" required>
                    <option value="">{isAr ? 'اختر الجنسية' : 'Select Nationality'}</option>
                    {allCountries.map((c) => <option key={c} value={c}>{isAr ? allCountriesAr[c] || c : c}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">{isAr ? 'رقم الجواز' : 'Passport Number'} <span className="text-red-500">*</span></label>
                    <input type="text" value={app.passportNumber} onChange={(e) => updateApplicant(currentApplicantIdx, 'passportNumber', e.target.value)} placeholder={isAr ? 'أدخل الرقم' : 'Type number'} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-[#C9A04C] outline-none placeholder:text-gray-300" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">{isAr ? 'نوع الجواز' : 'Passport Type'}</label>
                    <select value={app.passportType} onChange={(e) => updateApplicant(currentApplicantIdx, 'passportType', e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-[#C9A04C] outline-none bg-white text-gray-800">{passportTypes.map((p) => <option key={p.value} value={p.value}>{isAr ? p.labelAr : p.label}</option>)}</select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">{isAr ? 'أسافر من' : "I'm Traveling from"} <span className="text-red-500">*</span></label>
                  <select value={app.travelingFrom} onChange={(e) => updateApplicant(currentApplicantIdx, 'travelingFrom', e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-[#C9A04C] outline-none bg-white text-gray-800" required>
                    <option value="">{isAr ? 'اختر البلد' : 'Select Country'}</option>
                    {allCountries.map((c) => <option key={c} value={c}>{isAr ? allCountriesAr[c] || c : c}</option>)}
                  </select>
                </div>

                {/* GCC RESIDENT FIELDS */}
                {isGCC && (
                  <div className="bg-gradient-to-r from-[#C9A04C]/5 to-[#C9A04C]/[0.02] border border-[#C9A04C]/20 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-semibold text-[#C9A04C] flex items-center gap-2"><Building2 size={14} /> {residenceType === 'gcc-resident' ? (isAr ? 'بيانات الإقامة الخليجية' : 'GCC Residence Details') : (isAr ? 'بيانات الكفيل / المرافق' : 'Sponsor / Accompany Details')}</p>
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-1">{residenceType === 'gcc-resident' ? (isAr ? 'رقم الإقامة' : 'Residence Number') : (isAr ? 'رقم إقامة الكفيل' : 'Sponsor Residence Number')} <span className="text-red-500">*</span></label>
                      <input type="text" value={app.gccResidenceNumber} onChange={(e) => updateApplicant(currentApplicantIdx, 'gccResidenceNumber', e.target.value)} placeholder={isAr ? 'أدخل الرقم' : 'Enter number'} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-[#C9A04C] outline-none placeholder:text-gray-300" required={isGCC} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-1">{isAr ? 'بلد الإقامة' : 'Residence Country'} <span className="text-red-500">*</span></label>
                      <select value={app.gccResidenceCountry} onChange={(e) => updateApplicant(currentApplicantIdx, 'gccResidenceCountry', e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-[#C9A04C] outline-none bg-white text-gray-800" required={isGCC}>
                        <option value="">{isAr ? 'اختر البلد' : 'Select Country'}</option>
                        {gccCountries.map((c) => <option key={c} value={c}>{isAr ? allCountriesAr[c] || c : c}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* ACCOMPANY FIELDS (Non-GCC or GCC) */}
                {isAccompany && (
                  <div className="bg-gradient-to-r from-blue-500/5 to-blue-500/[0.02] border border-blue-500/20 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-semibold text-blue-600 flex items-center gap-2"><UsersRound size={14} /> {isAr ? 'بيانات الكفيل (المواطن الخليجي)' : 'Sponsor Information (GCC Citizen)'}</p>
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-1">{isAr ? 'اسم الكفيل' : 'Sponsor Name'} <span className="text-red-500">*</span></label>
                      <input type="text" value={app.sponsorName} onChange={(e) => updateApplicant(currentApplicantIdx, 'sponsorName', e.target.value)} placeholder={isAr ? 'الاسم الكامل للكفيل' : 'Full name of sponsor'} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-blue-500 outline-none placeholder:text-gray-300" required={isAccompany} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-1">{isAr ? 'صلة القرابة' : 'Relationship'} <span className="text-red-500">*</span></label>
                      <select value={app.sponsorRelation} onChange={(e) => updateApplicant(currentApplicantIdx, 'sponsorRelation', e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-blue-500 outline-none bg-white text-gray-800" required={isAccompany}>
                        <option value="">{isAr ? 'اختر' : 'Select'}</option>
                        <option value="spouse">{isAr ? 'زوج/زوجة' : 'Spouse'}</option>
                        <option value="parent">{isAr ? 'والد/والدة' : 'Parent'}</option>
                        <option value="child">{isAr ? 'ابن/ابنة' : 'Child'}</option>
                        <option value="sibling">{isAr ? 'أخ/أخت' : 'Sibling'}</option>
                        <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">{isAr ? 'الاسم الكامل' : 'Full Name'} <span className="text-red-500">*</span></label>
                  <input type="text" value={app.fullName} onChange={(e) => updateApplicant(currentApplicantIdx, 'fullName', e.target.value)} placeholder={isAr ? 'كما في الجواز' : 'As in passport'} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-[#C9A04C] outline-none placeholder:text-gray-300" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">{isAr ? 'البريد الإلكتروني' : 'Email Address'} {isFamily && <span className="text-xs text-gray-400 font-normal">({isAr ? 'مشترك' : 'shared'})</span>} <span className="text-red-500">*</span></label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@domain.com" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-[#C9A04C] outline-none placeholder:text-gray-300" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">{isAr ? 'رقم الهاتف / واتساب' : 'Phone / WhatsApp'} {isFamily && <span className="text-xs text-gray-400 font-normal">({isAr ? 'مشترك' : 'shared'})</span>} <span className="text-red-500">*</span></label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 50 123 4567" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-[#C9A04C] outline-none placeholder:text-gray-300" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">{isAr ? 'تاريخ الوصول' : 'Arrival Date'} {isFamily && <span className="text-xs text-gray-400 font-normal">({isAr ? 'مشترك' : 'shared'})</span>} <span className="text-red-500">*</span></label>
                  <input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-[#C9A04C] outline-none text-gray-800" required />
                </div>
              </div>

              {/* RIGHT COLUMN - FILES */}
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900">{isAr ? 'المرفقات' : 'Attach Files'}</h3>
                  {isFamily && <span className="text-xs text-[#C9A04C] font-medium bg-[#C9A04C]/10 px-2.5 py-1 rounded-full">{isAr ? `متقدم ${currentApplicantIdx + 1} من ${applicants.length}` : `Applicant ${currentApplicantIdx + 1} of ${applicants.length}`}</span>}
                </div>

                {/* Standard Files */}
                <div className="grid grid-cols-3 gap-3">
                  {renderDropZone(currentApplicantIdx, 'face', app.facePhoto, isAr ? 'صورة شخصية' : 'Face Photo')}
                  {renderDropZone(currentApplicantIdx, 'passport', app.passportCopy, isAr ? 'نسخة الجواز' : 'Passport Copy')}
                  {renderDropZone(currentApplicantIdx, 'cover', app.passportCover, isAr ? 'غلاف الجواز' : 'Passport Cover')}
                </div>

                {/* GCC RESIDENT: Residence ID Front + Back + Residency Permit */}
                {isGCC && (
                  <div className="bg-[#C9A04C]/[0.03] border border-[#C9A04C]/15 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-semibold text-[#C9A04C]">{isAr ? 'ملفات الإقامة الخليجية' : 'GCC Residence ID & Permit'}</p>
                    <div className="grid grid-cols-2 gap-3">
                      {renderDropZone(currentApplicantIdx, 'gcc-front', app.gccResidenceIdFront, isAr ? 'بطاقة الإقامة (أمام)' : 'Residence ID Front')}
                      {renderDropZone(currentApplicantIdx, 'gcc-back', app.gccResidenceIdBack, isAr ? 'بطاقة الإقامة (خلف)' : 'Residence ID Back')}
                    </div>
                    {renderDropZone(currentApplicantIdx, 'gcc-permit', app.gccResidencyPermit, isAr ? 'تصريح الإقامة' : 'Copy of Residency Permit')}
                  </div>
                )}

                {/* GCC ACCOMPANY: Same GCC files + Sponsor's ID */}
                {residenceType === 'gcc-accompany' && (
                  <div className="bg-blue-500/[0.03] border border-blue-500/15 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-semibold text-blue-600">{isAr ? 'ملفات الكفيل' : "Sponsor's ID or Passport"}</p>
                    {renderDropZone(currentApplicantIdx, 'sponsor-id', app.sponsorIdOrPassport, isAr ? 'نسخة جواز/هوية الكفيل' : "A copy of the sponsor's ID or passport")}
                  </div>
                )}

                {/* NON-GCC ACCOMPANY: Sponsor's ID only */}
                {residenceType === 'non-gcc-accompany' && (
                  <div className="bg-blue-500/[0.03] border border-blue-500/15 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-semibold text-blue-600">{isAr ? 'ملفات الكفيل (المواطن الخليجي)' : "Sponsor's Passport or GCC ID"}</p>
                    {renderDropZone(currentApplicantIdx, 'sponsor-id', app.sponsorIdOrPassport, isAr ? 'نسخة جواز/هوية الكفيل' : "A copy of the sponsor's ID or passport")}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">{isAr ? 'تاريخ انتهاء الجواز' : 'Passport Expiry'} <span className="text-red-500">*</span></label>
                  <input type="date" value={app.passportExpiry} onChange={(e) => updateApplicant(currentApplicantIdx, 'passportExpiry', e.target.value)} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-[#C9A04C] outline-none text-gray-800" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">{isAr ? 'المهنة' : 'Profession'} <span className="text-red-500">*</span></label>
                  <input type="text" value={app.profession} onChange={(e) => updateApplicant(currentApplicantIdx, 'profession', e.target.value)} placeholder={isAr ? 'مثال: مهندس' : 'e.g. Engineer'} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:border-[#C9A04C] outline-none placeholder:text-gray-300" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-800 mb-1.5">{isAr ? 'نوع المعالجة' : 'Processing Type'} <span className="text-red-500">*</span></label>
                  <div className="flex gap-6 py-2">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="processing" value="regular" checked={processingType === 'regular'} onChange={() => setProcessingType('regular')} className="w-4 h-4 text-[#C9A04C]" /><span className="text-sm text-gray-700">{isAr ? 'عادي (تقديرياً 3-4 أيام)' : 'Regular (estimated 3–4 days)'}</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="processing" value="express" checked={processingType === 'express'} onChange={() => setProcessingType('express')} className="w-4 h-4 text-[#C9A04C]" /><span className="text-sm text-gray-700">{isAr ? 'سريع (مدة تقديرية، +$40)' : 'Express (estimated timing, +$40)'}</span></label>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">{isAr ? 'المدد تقديرية وتعتمد على اكتمال المستندات والأهلية ومراجعة الجهة وتوفر الأنظمة، ولا نضمن الموافقة أو توقيتاً دقيقاً.' : 'Times are estimates subject to complete documents, eligibility, authority review and system availability. Approval and exact timing are not guaranteed.'}</p>

                {isFamily && applicants.length > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <button type="button" onClick={() => setCurrentApplicantIdx(Math.max(0, currentApplicantIdx - 1))} disabled={currentApplicantIdx === 0} className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:border-[#C9A04C] hover:text-[#C9A04C] disabled:opacity-30"><ChevronLeft size={14} /> {isAr ? 'السابق' : 'Prev'}</button>
                    <span className="text-sm text-gray-500">{currentApplicantIdx + 1} / {applicants.length}</span>
                    <button type="button" onClick={() => setCurrentApplicantIdx(Math.min(applicants.length - 1, currentApplicantIdx + 1))} disabled={currentApplicantIdx === applicants.length - 1} className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:border-[#C9A04C] hover:text-[#C9A04C] disabled:opacity-30">{isAr ? 'التالي' : 'Next'} <ChevronRight size={14} /></button>
                  </div>
                )}
              </div>
            </div>

          {/* Terms */}
          <div className="mt-6 pt-4 border-t border-gray-100">
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-0.5 w-4 h-4 text-[#C9A04C] border-gray-300 rounded" required />
                <span className="text-sm text-gray-600">
                  {isAr ? 'أقرأ وأوافق على ' : 'I have read and agree to the '}
                  <Link to="/terms" target="_blank" className="text-[#C9A04C] hover:underline">{isAr ? 'الشروط والأحكام' : 'Terms & Conditions'}</Link>
                  {isAr ? '، و' : ', '}
                  <Link to="/privacy" target="_blank" className="text-[#C9A04C] hover:underline">{isAr ? 'سياسة الخصوصية' : 'Privacy Policy'}</Link>
                  {isAr ? '، و' : ', and '}
                  <Link to="/refund" target="_blank" className="text-[#C9A04C] hover:underline">{isAr ? 'سياسة الاسترداد والإلغاء' : 'Refund/Cancellation Policy'}</Link>. <span className="text-red-500">*</span>
                </span>
              </label>
            </div>

          {/* Submit */}
          <div className="mt-6 flex flex-col items-center gap-3">
            {readinessIssues?.status === 'INCOMPLETE' && (
              <div role="alert" className="w-full max-w-2xl rounded-xl border border-amber-300 bg-amber-50 p-5 text-left text-amber-950">
                <h3 className="font-semibold text-lg">Please complete the following before payment.</h3>
                {completionGroups.map((group) => (
                  <div key={group.heading} className="mt-3">
                    <p className="font-medium">{group.heading}</p>
                    {group.items.map((item) => <p key={item}>• {item}</p>)}
                  </div>
                ))}
                <button type="button" onClick={() => {
                  const first = readinessIssues.applicants.find((item) => item.missing.length > 0);
                  if (first) setCurrentApplicantIdx(first.applicantIndex);
                  document.getElementById('documents-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  document.getElementById('documents-section')?.focus({ preventScroll: true });
                }} className="mt-4 rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900">Complete Documents</button>
              </div>
            )}
            {completionError && <p role="alert" className="text-sm text-red-600">{completionError}</p>}
            {isUploading && uploadProgress.length > 0 && <p className="text-sm text-gray-600">Uploading required documents…</p>}
            <button type="submit" disabled={loading || isUploading} className="px-16 py-3.5 rounded-lg font-semibold text-white text-lg bg-gradient-to-br from-[#C9A04C] to-[#DDBB7A] shadow-[0_2px_8px_rgba(201,160,76,0.25)] hover:-translate-y-0.5 hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? (isAr ? 'جاري الإرسال...' : 'Submitting...') : (isAr ? 'إرسال الطلب' : 'Submit Application')}
            </button>
          </div>
        </div>
      </form>

      {/* Track - directly under form */}
      <div className="max-w-5xl mx-auto mt-6">
        <TrackApplication />
      </div>

      {/* ===== PAYMENT MODAL ===== */}
      {showPaymentModal && referenceNumber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
            {paymentInvoiceNumber ? (
              <PaymentSuccessModal
                invoiceNumber={paymentInvoiceNumber}
                referenceNumber={referenceNumber}
                totalAmountUsd={calculateTotal()}
                exchangeRate={priceQuote.data?.exchangeRateToBase ?? 0}
                applicationId={applicationId || 0}
                pendingFiles={[]}
                applicantData={{
                  customerName: applicants[0]?.fullName || '',
                  customerEmail: email,
                  customerPhone: phone,
                  visaType: visaType || '',
                  processingType: processingType,
                  arrivalDate: arrivalDate,
                }}
                onClose={() => { setShowPaymentModal(false); setPaymentInvoiceNumber(''); setSubmitted(false); }}
              />
            ) : (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  {isAr ? 'الدفع الآمن' : 'Secure Payment'}
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  {isAr ? 'أكمل الدفع لتأكيد طلبك' : 'Complete payment to confirm your application'}
                </p>
                <StripePaymentForm
                  amount={calculateTotal()}
                  referenceNumber={referenceNumber}
                  applicantData={{
                    customerName: applicants[0]?.fullName || '',
                    customerEmail: email,
                    customerPhone: phone,
                    passportNumber: applicants[0]?.passportNumber,
                    nationality: applicants[0]?.nationality,
                    visaType: visaType || '',
                    processingType: processingType,
                    arrivalDate: arrivalDate,
                  }}
                  onSuccess={(invoiceNumber) => { setPaymentInvoiceNumber(invoiceNumber); setShowPaymentModal(false); setSubmitted(true); }}
                  onClose={() => setShowPaymentModal(false)}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
