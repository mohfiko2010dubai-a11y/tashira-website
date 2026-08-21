import React, { useState, useRef, useEffect } from 'react';
import { trpc } from '@/providers/trpc-client';
import { MessageCircle, X, Send, Bot, User, Paperclip, Lock, ChevronLeft } from 'lucide-react';
import { TERMS_POLICY_VERSION } from '@contracts/constants';
import {
  buildChatbotPaymentPath,
  getChatbotApplicantResumeStep,
  getChatbotVisaLabel,
  getChatbotVisaServiceCode,
  parseChatbotResumeMetadata,
  upsertChatbotApplicant,
  type ChatbotApplicant,
} from '@/lib/chatbot-application';
import { ChatbotReview } from './ChatbotReview';
import { trackFunnelEventOnce } from '@/lib/google-conversion';

// ─── Constants ───────────────────────────────────────────────────────────────

const VISA_OPTIONS = [
  { label: '14 Days', price: 145, emoji: '📅' },
  { label: '30 Days', price: 170, emoji: '📆' },
  { label: '30 Days Multiple', price: 250, emoji: '🔄' },
  { label: '60 Days', price: 250, emoji: '📆' },
  { label: '60 Days Multiple', price: 330, emoji: '🔄' },
  { label: '90 Days', price: 330, emoji: '📆' },
  { label: '96 Hours Transit', price: 99, emoji: '✈️' },
];

const PROCESSING_OPTIONS = [
  { label: 'Regular', price: 0, emoji: '🐢' },
  { label: 'Express', price: 40, emoji: '⚡' },
];

const RESIDENCE_OPTIONS = [
  'Non-GCC Resident',
  'GCC Resident',
  'Accompanying GCC Citizen',
  'GCC Citizen with Companion',
];

const WHO_TRAVELING = ['Single Applicant', 'Family Application'];
const CHATBOT_RESUME_KEY = 'tashira_chatbot_resume';

// ─── Types ───────────────────────────────────────────────────────────────────

type Step =
  | 'welcome'
  | 'who_traveling'
  | 'applicant_count'
  | 'residence_status'
  | 'visa_type'
  | 'processing_type'
  | 'full_name'
  | 'nationality'
  | 'passport_number'
  | 'passport_expiry'
  | 'profession'
  | 'country_from'
  | 'arrival_date'
  | 'email'
  | 'phone'
  | 'upload_passport_copy'
  | 'upload_passport_cover'
  | 'upload_passport_photo'
  | 'review'
  | 'terms'
  | 'payment'
  | 'done';

interface Msg { role: 'user' | 'assistant'; content: string; }

interface Wizard {
  step: Step;
  whoTraveling: string;
  applicantCount: number;
  currentApplicant: number;
  residenceStatus: string;
  visaType: string;
  processingType: string;
  fullName: string;
  nationality: string;
  passportNumber: string;
  passportExpiry: string;
  profession: string;
  countryFrom: string;
  arrivalDate: string;
  email: string;
  phone: string;
  uploads: string[];
  referenceNumber: string;
  paymentLink: string;
  totalAmount: number;
  acceptedTerms: boolean;
  applicationId?: number;
  applicantId?: number;
  applicants: ChatbotApplicant[];
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateName(name: string): boolean {
  return /^[\p{L}\s]{2,}$/u.test(name.trim());
}
function validateEmail(email: string): boolean {
  return /^[\w.-]+@[\w.-]+\.\w{2,}$/.test(email.trim());
}
function validatePhone(phone: string): boolean {
  return /^\+?\d{7,15}$/.test(phone.replace(/\s/g, ''));
}
function validatePassportNumber(pp: string): boolean {
  return /^[A-Z0-9]{6,20}$/i.test(pp.trim());
}
function validateDate(date: string): boolean {
  return /^(\d{4})-(\d{2})-(\d{2})$/.test(date) && !isNaN(Date.parse(date));
}
function validateRequired(val: string): boolean {
  return val.trim().length >= 2;
}

function generateReferenceNumber(): string {
  return `TSH-${Math.floor(100000 + Math.random() * 900000)}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ChatBot() {
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).get('resume') === '1');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [docStep, setDocStep] = useState(0); // 0=passport_copy, 1=passport_cover, 2=passport_photo

  const [wizard, setWizard] = useState<Wizard>({
    step: 'welcome',
    whoTraveling: '',
    applicantCount: 1,
    currentApplicant: 1,
    residenceStatus: '',
    visaType: '',
    processingType: '',
    fullName: '',
    nationality: '',
    passportNumber: '',
    passportExpiry: '',
    profession: '',
    countryFrom: '',
    arrivalDate: '',
    email: '',
    phone: '',
    uploads: [],
    referenceNumber: '',
    paymentLink: '',
    totalAmount: 0,
    acceptedTerms: false,
    applicants: [],
  });

  const wizardRef = useRef(wizard);
  const resumeAppliedRef = useRef(false);
  const [resumeMetadata] = useState(() => parseChatbotResumeMetadata(localStorage.getItem(CHATBOT_RESUME_KEY)));

  // Keep wizardRef in sync with wizard state
  useEffect(() => {
    wizardRef.current = wizard;
  }, [wizard]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startMutation = trpc.wizard.startApplication.useMutation();
  const quoteMutation = trpc.wizard.quoteApplication.useMutation();
  const updateMutation = trpc.wizard.updateApplication.useMutation();
  const submitMutation = trpc.wizard.submitApplication.useMutation();
  const uploadDocMutation = trpc.wizard.uploadDocuments.useMutation();
  const replaceDocMutation = trpc.wizard.replaceDocument.useMutation();
  const resumeQuery = trpc.wizard.getProgress.useQuery(
    { referenceNumber: resumeMetadata?.referenceNumber ?? '' },
    { enabled: Boolean(resumeMetadata), retry: false },
  );
  const reviewProgress = trpc.wizard.getProgress.useQuery(
    { referenceNumber: wizard.referenceNumber },
    { enabled: wizard.step === 'review' && Boolean(wizard.referenceNumber), retry: false },
  );

  useEffect(() => {
    const progress = resumeQuery.data;
    if (!progress || !resumeMetadata || resumeAppliedRef.current) return;

    const completedApplicants: ChatbotApplicant[] = [];
    let resumeIndex = 0;
    let resumeStep: Step = 'full_name';
    for (let index = 0; index < resumeMetadata.applicantCount; index += 1) {
      const applicant = progress.applicants.find((item) => item.applicantIndex === index);
      const applicantDocuments = applicant
        ? progress.documents.filter((document) => document.applicantId === applicant.id && document.uploadStatus === 'uploaded')
        : [];
      const step = getChatbotApplicantResumeStep({
        applicant,
        isPrimary: index === 0,
        arrivalDate: progress.application.arrivalDate,
        contactEmail: progress.application.contactEmail,
        contactPhone: progress.application.contactPhone,
        passportUploads: applicantDocuments.filter((document) => document.documentType === 'passport').length,
        photoUploads: applicantDocuments.filter((document) => document.documentType === 'photo').length,
      });
      if (
        applicant
        && applicant.nationality
        && applicant.passportNumber
        && applicant.passportExpiry
        && applicant.profession
        && applicant.travelingFrom
      ) {
        completedApplicants.push({
          applicantId: applicant.id,
          applicantIndex: index,
          fullName: applicant.fullName,
          nationality: applicant.nationality,
          passportNumber: applicant.passportNumber,
          passportExpiry: applicant.passportExpiry,
          profession: applicant.profession,
          countryFrom: applicant.travelingFrom,
        });
      }
      if (step !== 'complete') {
        resumeIndex = index;
        resumeStep = step;
        break;
      }
      resumeIndex = index;
      resumeStep = index === resumeMetadata.applicantCount - 1 ? 'terms' : 'full_name';
    }

    const currentApplicant = progress.applicants.find((item) => item.applicantIndex === resumeIndex);
    const visaLabel = getChatbotVisaLabel(progress.application.visaType) ?? progress.application.visaType;
    const residenceStatus = {
      'non-gcc': 'Non-GCC Resident',
      'gcc-resident': 'GCC Resident',
      'non-gcc-accompany': 'Accompanying GCC Citizen',
      'gcc-accompany': 'GCC Citizen with Companion',
    }[progress.application.residenceType];
    const nextWizard: Partial<Wizard> = {
      step: resumeStep,
      whoTraveling: resumeMetadata.applicantCount > 1 ? 'Family' : 'Single',
      applicantCount: resumeMetadata.applicantCount,
      currentApplicant: resumeIndex + 1,
      residenceStatus,
      visaType: visaLabel,
      processingType: progress.application.processingType === 'express' ? 'Express' : 'Regular',
      fullName: currentApplicant?.fullName ?? '',
      nationality: currentApplicant?.nationality ?? '',
      passportNumber: currentApplicant?.passportNumber ?? '',
      passportExpiry: currentApplicant?.passportExpiry ?? '',
      profession: currentApplicant?.profession ?? '',
      countryFrom: currentApplicant?.travelingFrom ?? '',
      arrivalDate: progress.application.arrivalDate ?? '',
      email: progress.application.contactEmail,
      phone: progress.application.contactPhone,
      referenceNumber: progress.application.referenceNumber,
      applicationId: progress.application.id,
      applicantId: currentApplicant?.id,
      applicants: completedApplicants,
    };
    const resumeTimer = window.setTimeout(() => {
      if (resumeAppliedRef.current) return;
      resumeAppliedRef.current = true;
      setWizard((current) => ({ ...current, ...nextWizard }));
      if (resumeStep === 'upload_passport_cover') setDocStep(1);
      else if (resumeStep === 'upload_passport_photo') setDocStep(2);
      else setDocStep(0);
      setMessages([{
        role: 'assistant',
        content: resumeStep === 'terms'
          ? `Welcome back. All ${resumeMetadata.applicantCount} applicants are complete. Review and type **CONFIRM** to continue.`
          : `Welcome back. Resuming **Applicant ${resumeIndex + 1} of ${resumeMetadata.applicantCount}** at the next incomplete step.`,
      }]);
      quoteMutation.mutate(
        {
          visaType: progress.application.visaType,
          processingType: progress.application.processingType,
          applicantCount: resumeMetadata.applicantCount,
        },
        { onSuccess: (quote) => setWizard((current) => ({ ...current, totalAmount: quote.totalPrice })) },
      );
    }, 0);
    return () => window.clearTimeout(resumeTimer);
  }, [quoteMutation, resumeMetadata, resumeQuery.data]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const addBotMessage = (content: string) =>
    setMessages(prev => [...prev, { role: 'assistant', content }]);

  const addUserMessage = (content: string) =>
    setMessages(prev => [...prev, { role: 'user', content }]);

  const advance = (updates: Partial<Wizard>, nextMessage?: string) => {
    setWizard(w => ({ ...w, ...updates }));
    if (nextMessage) {
      setLoading(true);
      setTimeout(() => {
        addBotMessage(nextMessage);
        setLoading(false);
      }, 600);
    }
  };

  // ─── Welcome ──────────────────────────────────────────────────────────────

  const handleToggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && messages.length === 0) {
      addBotMessage(
        '👋 Welcome to **TASHIRA Visa Portal**!\n\n' +
        'I am your professional visa assistant. I will guide you through your UAE visa application step by step.\n\n' +
        'Let\'s get started!'
      );
      setTimeout(() => {
        addBotMessage('**Who is traveling?**');
        setWizard(w => ({ ...w, step: 'who_traveling' }));
      }, 800);
    }
  };

  const previousStep: Partial<Record<Step, Step>> = {
    applicant_count: 'who_traveling', residence_status: 'who_traveling', visa_type: 'residence_status',
    processing_type: 'visa_type', full_name: 'processing_type', nationality: 'full_name',
    passport_number: 'nationality', passport_expiry: 'passport_number', profession: 'passport_expiry',
    country_from: 'profession', arrival_date: 'country_from', email: 'arrival_date', phone: 'email',
    upload_passport_copy: 'phone', upload_passport_cover: 'upload_passport_copy', upload_passport_photo: 'upload_passport_cover',
    terms: 'review',
  };

  const goBack = () => {
    const target = previousStep[wizard.step];
    if (!target || loading) return;
    setWizard((current) => ({ ...current, step: target }));
    addBotMessage('You can update the previous answer. Your saved information has been preserved.');
  };

  const saveReviewedApplicant = async (index: number, changes: Pick<ChatbotApplicant, 'fullName' | 'nationality' | 'passportNumber' | 'passportExpiry' | 'profession' | 'countryFrom'>) => {
    if (!wizard.referenceNumber || !validateName(changes.fullName) || !validatePassportNumber(changes.passportNumber)) throw new Error('Invalid applicant details');
    await updateMutation.mutateAsync({ referenceNumber: wizard.referenceNumber, applicantIndex: index, ...changes });
    setWizard((current) => ({
      ...current,
      applicants: current.applicants.map((applicant) => applicant.applicantIndex === index ? { ...applicant, ...changes } : applicant),
      ...(current.currentApplicant - 1 === index ? changes : {}),
    }));
  };

  const saveReviewedContact = async (email: string, phone: string) => {
    if (!wizard.referenceNumber || !validateEmail(email) || !validatePhone(phone)) throw new Error('Invalid contact details');
    await updateMutation.mutateAsync({ referenceNumber: wizard.referenceNumber, applicantIndex: 0, email, phone });
    setWizard((current) => ({ ...current, email, phone }));
  };

  const saveReviewedService = async (visaType: string, processingType: string) => {
    const serviceCode = getChatbotVisaServiceCode(visaType);
    if (!wizard.referenceNumber || !serviceCode) throw new Error('Invalid service');
    const quote = await quoteMutation.mutateAsync({ visaType: serviceCode, processingType, applicantCount: wizard.applicantCount });
    await updateMutation.mutateAsync({ referenceNumber: wizard.referenceNumber, applicantIndex: 0, visaType: serviceCode, processingType, totalAmount: quote.totalPrice });
    setWizard((current) => ({ ...current, visaType, processingType, totalAmount: quote.totalPrice, acceptedTerms: false }));
  };

  const replaceReviewedDocument = async (document: { id: number; applicantId: number | null; documentType: 'passport' | 'photo' | 'national_id' | 'supporting' | 'visa' | 'invoice' | 'gcc_residence' | 'sponsor_id' }, file: File) => {
    const applicant = wizard.applicants.find((item) => item.applicantId === document.applicantId);
    if (!wizard.applicationId || !document.applicantId || !applicant) throw new Error('Invalid document ownership');
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    await replaceDocMutation.mutateAsync({
      applicationId: wizard.applicationId,
      applicantId: document.applicantId,
      applicantIndex: applicant.applicantIndex,
      documentId: document.id,
      documentType: document.documentType,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      base64Data,
    });
    await reviewProgress.refetch();
  };

  // ─── Handle User Input ────────────────────────────────────────────────────

  const handleSend = () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    addUserMessage(msg);
    setLoading(true);
    processInput(msg);
  };

  const processInput = (msg: string) => {
    const w = wizard;

    switch (w.step) {

      // ─── Who Traveling ────────────────────────────────────────────────────
      case 'who_traveling': {
        const choice = msg.toLowerCase();
        if (choice.includes('single') || choice.includes('1') || choice === 's') {
          trackFunnelEventOnce('begin_application', 'chatbot');
          advance({ whoTraveling: 'Single', applicantCount: 1, step: 'residence_status' },
            '**What is your residence status?**');
        } else if (choice.includes('family') || choice.includes('multiple') || choice === 'f') {
          trackFunnelEventOnce('begin_application', 'chatbot');
          advance({ whoTraveling: 'Family', step: 'applicant_count' },
            '**How many applicants?** (2-20)');
        } else {
          addBotMessage('❌ Please choose:\n• **Single Applicant**\n• **Family Application**');
          setLoading(false);
        }
        break;
      }

      // ─── Applicant Count ──────────────────────────────────────────────────
      case 'applicant_count': {
        const count = parseInt(msg);
        if (count >= 2 && count <= 20) {
          advance({ applicantCount: count, step: 'residence_status' },
            `✅ **${count} applicants** registered.\n\n**What is your residence status?**`);
        } else {
          addBotMessage('❌ Please enter a number between **2 and 20**.');
          setLoading(false);
        }
        break;
      }

      // ─── Residence Status ─────────────────────────────────────────────────
      case 'residence_status': {
        const match = RESIDENCE_OPTIONS.find(r => r.toLowerCase().includes(msg.toLowerCase()));
        if (match) {
          advance({ residenceStatus: match, step: 'visa_type' },
            `✅ Residence: **${match}**\n\n**Please select your visa type:**`);
        } else {
          addBotMessage('❌ Please choose:\n' + RESIDENCE_OPTIONS.map(r => '• ' + r).join('\n'));
          setLoading(false);
        }
        break;
      }

      // ─── Visa Type ────────────────────────────────────────────────────────
      case 'visa_type': {
        const match = VISA_OPTIONS.find(v =>
          msg.toLowerCase().includes(v.label.toLowerCase()) ||
          msg === v.price.toString()
        );
        if (match) {
          advance({ visaType: match.label, step: 'processing_type' },
            `✅ Visa: **${match.emoji} ${match.label}**\n\n**Choose processing type:**`);
        } else {
          addBotMessage('❌ Please choose a valid visa type.');
          setLoading(false);
        }
        break;
      }

      // ─── Processing Type ──────────────────────────────────────────────────
      case 'processing_type': {
        const match = PROCESSING_OPTIONS.find(p => p.label.toLowerCase().includes(msg.toLowerCase()));
        if (match) {
          const serviceCode = getChatbotVisaServiceCode(w.visaType);
          if (!serviceCode) {
            addBotMessage('Unable to identify the selected visa product. Please restart the application.');
            setLoading(false);
            break;
          }
          quoteMutation.mutate(
            { visaType: serviceCode, processingType: match.label, applicantCount: w.applicantCount },
            {
              onSuccess: (quote) => advance(
                { processingType: match.label, totalAmount: quote.totalPrice, step: 'full_name' },
                `✅ Processing: **${match.emoji} ${match.label}**\n` +
                `💰 Server quote for ${quote.applicantCount} applicant${quote.applicantCount > 1 ? 's' : ''}: **${quote.currency} ${quote.totalPrice}**\n\n` +
                `📋 **Applicant ${w.currentApplicant} of ${w.applicantCount}**\n\n` +
                '**Full Name** (as on passport):',
              ),
              onError: (error) => {
                addBotMessage(`Unable to quote this application: ${error.message}`);
                setLoading(false);
              },
            },
          );
        } else {
          addBotMessage('❌ Please choose:\n• **Regular** (estimated 3–4 days)\n• **Express** (estimated 24–36 hours, +$40)\n\nTimes depend on complete documents, eligibility, authority review and system availability. Approval and exact timing are not guaranteed.');
          setLoading(false);
        }
        break;
      }

      // ─── Full Name ────────────────────────────────────────────────────────
      case 'full_name': {
        if (validateName(msg)) {
          if (w.applicationId && w.referenceNumber) {
            updateMutation.mutate(
              {
                referenceNumber: w.referenceNumber,
                applicantIndex: w.currentApplicant - 1,
                fullName: msg,
              },
              {
                onSuccess: (result) => advance(
                  { fullName: msg, applicantId: result.applicantId, step: 'nationality' },
                  `✅ **Applicant ${w.currentApplicant} of ${w.applicantCount}: ${msg}**\n\n**Nationality:**`,
                ),
                onError: (error) => {
                  addBotMessage(`Unable to save applicant ${w.currentApplicant}: ${error.message}`);
                  setLoading(false);
                },
              },
            );
            break;
          }
          const refNum = generateReferenceNumber();
          const serviceCode = getChatbotVisaServiceCode(w.visaType);
          if (!serviceCode) {
            addBotMessage('Unable to identify the selected visa product. Please restart the application.');
            setLoading(false);
            break;
          }
          // Start application in DB
          startMutation.mutate(
            {
              referenceNumber: refNum,
              whoTraveling: w.whoTraveling,
              applicantCount: w.applicantCount,
              residenceStatus: w.residenceStatus,
              visaType: serviceCode,
              processingType: w.processingType,
              fullName: msg,
              totalAmount: w.totalAmount,
            },
            {
              onSuccess: (result) => {
                const appId = result.applicationId;
                localStorage.setItem(CHATBOT_RESUME_KEY, JSON.stringify({
                  referenceNumber: refNum,
                  applicantCount: w.applicantCount,
                }));
                advance({
                  fullName: msg,
                  referenceNumber: refNum,
                  applicationId: appId,
                  applicantId: result.applicantId,
                  step: 'nationality',
                },
                  `✅ Hello, **${msg}**!\n\n**Nationality:**`);
              },
              onError: (error) => {
                addBotMessage(`Unable to create your application: ${error.message}. Please try again before continuing.`);
                setLoading(false);
              },
            },
          );
        } else {
          addBotMessage('❌ Please enter your real full name (letters only, at least 2 characters).');
          setLoading(false);
        }
        break;
      }

      // ─── Nationality ──────────────────────────────────────────────────────
      case 'nationality': {
        if (validateRequired(msg)) {
          // Update in DB if we have applicationId
          if (w.applicationId) {
            updateMutation.mutate({ referenceNumber: w.referenceNumber, applicantIndex: w.currentApplicant - 1, nationality: msg });
          }
          advance({ nationality: msg, step: 'passport_number' },
            `✅ Nationality: **${msg}**\n\n**Passport Number:**`);
        } else {
          addBotMessage('❌ Please enter your nationality.');
          setLoading(false);
        }
        break;
      }

      // ─── Passport Number ──────────────────────────────────────────────────
      case 'passport_number': {
        if (validatePassportNumber(msg)) {
          if (w.applicationId) updateMutation.mutate({ referenceNumber: w.referenceNumber, applicantIndex: w.currentApplicant - 1, passportNumber: msg.toUpperCase() });
          advance({ passportNumber: msg.toUpperCase(), step: 'passport_expiry' },
            `✅ Passport: **${msg.toUpperCase()}**\n\n**Passport Expiry Date** (YYYY-MM-DD):`);
        } else {
          addBotMessage('❌ Invalid passport number. Please enter 6-20 alphanumeric characters.');
          setLoading(false);
        }
        break;
      }

      // ─── Passport Expiry ──────────────────────────────────────────────────
      case 'passport_expiry': {
        if (validateDate(msg)) {
          if (w.applicationId) updateMutation.mutate({ referenceNumber: w.referenceNumber, applicantIndex: w.currentApplicant - 1, passportExpiry: msg });
          advance({ passportExpiry: msg, step: 'profession' },
            `✅ Expiry: **${msg}**\n\n**Profession/Occupation:**`);
        } else {
          addBotMessage('❌ Invalid date. Please use format **YYYY-MM-DD** (e.g., 2028-06-15).');
          setLoading(false);
        }
        break;
      }

      // ─── Profession ───────────────────────────────────────────────────────
      case 'profession': {
        if (validateRequired(msg)) {
          if (w.applicationId) updateMutation.mutate({ referenceNumber: w.referenceNumber, applicantIndex: w.currentApplicant - 1, profession: msg });
          advance({ profession: msg, step: 'country_from' },
            `✅ Profession: **${msg}**\n\n**Country Traveling From:**`);
        } else {
          addBotMessage('❌ Please enter your profession.');
          setLoading(false);
        }
        break;
      }

      // ─── Country From ─────────────────────────────────────────────────────
      case 'country_from': {
        if (validateRequired(msg)) {
          if (w.applicationId) updateMutation.mutate({ referenceNumber: w.referenceNumber, applicantIndex: w.currentApplicant - 1, countryFrom: msg });
          if (w.currentApplicant > 1) {
            advance({ countryFrom: msg, step: 'upload_passport_copy' },
              `✅ From: **${msg}**\n\n📎 **Applicant ${w.currentApplicant} of ${w.applicantCount}: Documents**\n\nPlease upload **Passport Copy**.`);
            setDocStep(0);
          } else {
            advance({ countryFrom: msg, step: 'arrival_date' },
              `✅ From: **${msg}**\n\n**Expected Arrival Date** (YYYY-MM-DD):`);
          }
        } else {
          addBotMessage('❌ Please enter the country you are traveling from.');
          setLoading(false);
        }
        break;
      }

      // ─── Arrival Date ─────────────────────────────────────────────────────
      case 'arrival_date': {
        if (validateDate(msg)) {
          if (w.applicationId) updateMutation.mutate({ referenceNumber: w.referenceNumber, applicantIndex: 0, arrivalDate: msg });
          advance({ arrivalDate: msg, step: 'email' },
            `✅ Arrival: **${msg}**\n\n**Email Address:**`);
        } else {
          addBotMessage('❌ Invalid date. Please use format **YYYY-MM-DD** (e.g., 2026-08-15).');
          setLoading(false);
        }
        break;
      }

      // ─── Email ────────────────────────────────────────────────────────────
      case 'email': {
        if (validateEmail(msg)) {
          if (w.applicationId) updateMutation.mutate({ referenceNumber: w.referenceNumber, applicantIndex: 0, email: msg });
          advance({ email: msg, step: 'phone' },
            `✅ Email: **${msg}**\n\n**Phone Number** (with country code, e.g. +971501234567):`);
        } else {
          addBotMessage('❌ Invalid email. Please enter a valid email address (e.g., name@example.com).');
          setLoading(false);
        }
        break;
      }

      // ─── Phone ────────────────────────────────────────────────────────────
      case 'phone': {
        if (validatePhone(msg)) {
          if (w.applicationId) updateMutation.mutate({ referenceNumber: w.referenceNumber, applicantIndex: 0, phone: msg });
          advance({ phone: msg, step: 'upload_passport_copy' },
            `✅ Phone: **${msg}**\n\n` +
            `📎 **Step 6: Document Uploads**\n\n` +
            `Please upload **Passport Copy** (photo page of your passport).\n\n` +
            `Click the 📎 button below to upload.`);
          setDocStep(0);
        } else {
          addBotMessage('❌ Invalid phone. Please enter with country code (e.g., +971501234567).');
          setLoading(false);
        }
        break;
      }

      // ─── Uploads (handled separately) ─────────────────────────────────────
      case 'upload_passport_copy':
      case 'upload_passport_cover':
      case 'upload_passport_photo':
        addBotMessage('📎 Please click the 📎 button below to upload your document.');
        setLoading(false);
        break;

      // ─── Review ───────────────────────────────────────────────────────────
      case 'review': {
        addBotMessage('Use the Review Your Application panel below to verify or edit your information.');
        setLoading(false);
        break;
      }

      // ─── Terms ────────────────────────────────────────────────────────────
      case 'terms': {
        if (msg.toLowerCase() === 'confirm') {
          if (!w.acceptedTerms) {
            addBotMessage('Please explicitly accept the Terms & Conditions, Privacy Policy, and Refund/Cancellation Policy before continuing.');
            setLoading(false);
            break;
          }
          const refNum = w.referenceNumber || generateReferenceNumber();
          const payLink = `${window.location.origin}${buildChatbotPaymentPath(refNum)}`;
          const serviceCode = getChatbotVisaServiceCode(w.visaType);
          if (!serviceCode) {
            addBotMessage('Unable to identify the selected visa product. Please restart the application.');
            setLoading(false);
            break;
          }

          // Final submit to backend
          const primaryApplicant = w.applicants[0];
          if (!primaryApplicant || w.applicants.length !== w.applicantCount) {
            addBotMessage('Applicant information is incomplete. Please resume the application before payment.');
            setLoading(false);
            break;
          }
          submitMutation.mutate(
            {
              referenceNumber: refNum,
              fullName: primaryApplicant.fullName,
              nationality: primaryApplicant.nationality,
              passportNumber: primaryApplicant.passportNumber,
              passportExpiry: primaryApplicant.passportExpiry,
              profession: primaryApplicant.profession,
              countryFrom: primaryApplicant.countryFrom,
              arrivalDate: w.arrivalDate,
              email: w.email,
              phone: w.phone,
              visaType: serviceCode,
              processingType: w.processingType,
              residenceStatus: w.residenceStatus,
              whoTraveling: w.whoTraveling,
              applicantCount: w.applicantCount,
              totalAmount: w.totalAmount,
              policyVersion: TERMS_POLICY_VERSION,
              applicants: w.applicants.map((applicant) => ({
                applicantIndex: applicant.applicantIndex,
                fullName: applicant.fullName,
                nationality: applicant.nationality,
                passportNumber: applicant.passportNumber,
                passportExpiry: applicant.passportExpiry,
                profession: applicant.profession,
                countryFrom: applicant.countryFrom,
              })),
            },
            {
              onSuccess: (result) => {
                const authoritativeTotal = result.quote.totalPrice;
                trackFunnelEventOnce('application_submitted', refNum, {
                  applicant_count: w.applicantCount,
                  application_type: w.whoTraveling.toLowerCase(),
                });
                localStorage.removeItem(CHATBOT_RESUME_KEY);
                advance(
                  {
                    step: 'payment',
                    referenceNumber: refNum,
                    paymentLink: payLink,
                    totalAmount: authoritativeTotal,
                  },
                  `✅ Application confirmed and saved!\n\n` +
                    `📋 Reference: **${refNum}**\n` +
                    `💰 Total: **$${authoritativeTotal}**\n\n` +
                    `**Pay Now:**\n${payLink}`,
                );
              },
              onError: () => {
                addBotMessage(
                  `❌ We couldn't save your application. Please try again. If the problem continues, contact TASHIRA support.\n\n` +
                    `WhatsApp: +971 58 989 6644`,
                );
                setLoading(false);
              },
            },
          );
        } else {
          addBotMessage('❌ Please type **CONFIRM** to proceed, or let me know if you need to change anything.');
          setLoading(false);
        }
        break;
      }

      default:
        setLoading(false);
    }
  };

  // ─── Handle Document Upload ───────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    addUserMessage(`📎 Uploaded: ${file.name}`);

    // Upload to backend immediately
    const doUpload = (docType: "passport" | "photo", afterUpload: () => void) => {
      const currentWizard = wizardRef.current;
      const appId = currentWizard.applicationId;
      const applicantId = currentWizard.applicantId;
      if (!appId || !applicantId) {
        addBotMessage('⚠️ The application was not confirmed, so this document was not uploaded. Please restart the application and try again.');
        return;
      }

      setLoading(true);
      addBotMessage('⏳ Uploading document to server...');

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string)?.split(',')[1];
        if (base64) {
          uploadDocMutation.mutate(
            {
              applicationId: appId,
              applicantId,
              applicantIndex: currentWizard.currentApplicant - 1,
              documentType: docType,
              fileName: file.name,
              mimeType: file.type,
              fileSize: file.size,
              base64Data: base64,
            },
            {
              onSuccess: () => {
                afterUpload();
                addBotMessage(`✅ **${file.name}** uploaded to server successfully!`);
                setLoading(false);
              },
              onError: (err) => {
                addBotMessage(`⚠️ Upload failed: ${err.message}. Please select the file and try again.`);
                setLoading(false);
              },
            }
          );
        } else {
          addBotMessage('⚠️ Could not process file. Please try again.');
          setLoading(false);
        }
      };
      reader.onerror = () => {
        addBotMessage('⚠️ Could not read file. Please try again.');
        setLoading(false);
      };
      reader.readAsDataURL(file);
    };

    const currentStep = wizardRef.current.step;

    if (currentStep === 'upload_passport_copy') {
      doUpload('passport', () => {
        addBotMessage('📎 Now upload **Passport Cover** (front cover of your passport).\n\nClick the 📎 button below.');
        setWizard(prev => ({ ...prev, step: 'upload_passport_cover' }));
        setDocStep(1);
      });
    } else if (currentStep === 'upload_passport_cover') {
      doUpload('passport', () => {
        addBotMessage('📎 Now upload **Passport Photo** (white background, face clearly visible).\n\nClick the 📎 button below.');
        setWizard(prev => ({ ...prev, step: 'upload_passport_photo' }));
        setDocStep(2);
      });
    } else if (currentStep === 'upload_passport_photo') {
      doUpload('photo', () => {
        const cur = wizardRef.current;
        if (!cur.applicantId) {
          addBotMessage('Unable to bind this document set to an applicant. Please retry.');
          setLoading(false);
          return;
        }
        const completedApplicant: ChatbotApplicant = {
          applicantId: cur.applicantId,
          applicantIndex: cur.currentApplicant - 1,
          fullName: cur.fullName,
          nationality: cur.nationality,
          passportNumber: cur.passportNumber,
          passportExpiry: cur.passportExpiry,
          profession: cur.profession,
          countryFrom: cur.countryFrom,
        };
        const completedApplicants = upsertChatbotApplicant(cur.applicants, completedApplicant);
        if (cur.currentApplicant < cur.applicantCount) {
          const nextApplicant = cur.currentApplicant + 1;
          setWizard((prev) => ({
            ...prev,
            applicants: completedApplicants,
            currentApplicant: nextApplicant,
            applicantId: undefined,
            fullName: '',
            nationality: '',
            passportNumber: '',
            passportExpiry: '',
            profession: '',
            countryFrom: '',
            uploads: [],
            step: 'full_name',
          }));
          setDocStep(0);
          addBotMessage(
            `✅ Applicant ${cur.currentApplicant} documents received.\n\n` +
            `📋 **Applicant ${nextApplicant} of ${cur.applicantCount}**\n\n` +
            '**Full Name** (as on passport):',
          );
          setLoading(false);
          return;
        }

        addBotMessage('✅ All applicant documents received!\n\nReviewing your application...');
        setWizard((prev) => ({ ...prev, applicants: completedApplicants }));
        setTimeout(() => {
          const latest = { ...wizardRef.current, applicants: completedApplicants };
          const applicantSummary = completedApplicants.map((applicant) =>
            `**Applicant ${applicant.applicantIndex + 1}:**\n` +
            `• Name: ${applicant.fullName}\n` +
            `• Nationality: ${applicant.nationality}\n` +
            `• Passport: ${applicant.passportNumber}`,
          ).join('\n\n');
          void applicantSummary;
          void latest;
          addBotMessage('✅ All information and documents are ready. Please review every section before continuing.');
          setWizard(prev => ({ ...prev, applicants: completedApplicants, step: 'review' }));
          setLoading(false);
        }, 800);
      });
    }

    e.target.value = '';
  };

  // ─── Render Quick Actions ─────────────────────────────────────────────────

  const renderQuickActions = () => {
    const w = wizard;

    switch (w.step) {
      case 'who_traveling':
        return (
          <div className="p-3 bg-gray-50 border-t border-gray-100 space-y-2">
            <p className="text-xs font-semibold text-gray-500 mb-1">Select:</p>
            <div className="grid grid-cols-2 gap-2">
              {WHO_TRAVELING.map(opt => (
                <button key={opt} onClick={() => { addUserMessage(opt); setLoading(true); processInput(opt); }}
                  className="px-3 py-2 bg-white border border-[#C9A04C] rounded-lg text-[13px] font-semibold text-[#C9A04C] hover:bg-[#FFF8E7] transition-all">
                  {opt}
                </button>
              ))}
            </div>
          </div>
        );

      case 'residence_status':
        return (
          <div className="p-3 bg-gray-50 border-t border-gray-100 space-y-1">
            <p className="text-xs font-semibold text-gray-500 mb-1">Residence Status:</p>
            {RESIDENCE_OPTIONS.map(r => (
              <button key={r} onClick={() => { addUserMessage(r); setLoading(true); processInput(r); }}
                className="w-full text-left px-3 py-2 bg-white border border-gray-200 rounded-lg text-[12px] hover:bg-[#FFF8E7] hover:border-[#C9A04C] transition-all mb-1">
                {r}
              </button>
            ))}
          </div>
        );

      case 'visa_type':
        return (
          <div className="p-3 bg-gray-50 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-2">Select Visa Type:</p>
            <div className="grid grid-cols-1 gap-2">
              {VISA_OPTIONS.map(v => (
                <button key={v.label} onClick={() => { addUserMessage(`${v.emoji} ${v.label}`); setLoading(true); processInput(v.label); }}
                  className="flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-[#FFF8E7] hover:border-[#C9A04C] transition-all">
                  <span className="text-[13px]">{v.emoji} {v.label}</span>
                  <span className="text-[11px] font-semibold text-[#C9A04C]">Server quote</span>
                </button>
              ))}
            </div>
          </div>
        );

      case 'processing_type':
        return (
          <div className="p-3 bg-gray-50 border-t border-gray-100 space-y-2">
            <p className="text-xs font-semibold text-gray-500 mb-1">Processing:</p>
            <div className="grid grid-cols-2 gap-2">
              {PROCESSING_OPTIONS.map(p => (
                <button key={p.label} onClick={() => { addUserMessage(p.label); setLoading(true); processInput(p.label); }}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-[13px] hover:bg-[#FFF8E7] hover:border-[#C9A04C] transition-all">
                  <div>{p.emoji} {p.label}</div>
                  <div className="text-[11px] text-gray-500">Price verified by server</div>
                </button>
              ))}
            </div>
          </div>
        );

      case 'upload_passport_copy':
      case 'upload_passport_cover':
      case 'upload_passport_photo':
        return (
          <div className="p-3 bg-gray-50 border-t border-gray-100">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-[#C9A04C] border-dashed rounded-lg hover:bg-[#FFF8E7] transition-all text-[#C9A04C] font-medium">
              <Paperclip size={18} />
              {docStep === 0 && 'Upload Passport Copy'}
              {docStep === 1 && 'Upload Passport Cover'}
              {docStep === 2 && 'Upload Passport Photo'}
            </button>
          </div>
        );

      case 'terms':
        return (
          <div className="p-3 bg-gray-50 border-t border-gray-100 space-y-2">
            <label className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={wizard.acceptedTerms}
                onChange={(event) => setWizard((current) => ({ ...current, acceptedTerms: event.target.checked }))}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <span>
                I have read and agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#C9A04C] underline">Terms & Conditions</a>,{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#C9A04C] underline">Privacy Policy</a>, and{' '}
                <a href="/refund" target="_blank" rel="noopener noreferrer" className="text-[#C9A04C] underline">Refund/Cancellation Policy</a>.
              </span>
            </label>
            <button onClick={() => { addUserMessage('CONFIRM'); setLoading(true); processInput('CONFIRM'); }}
              disabled={!wizard.acceptedTerms}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all font-bold disabled:cursor-not-allowed disabled:opacity-50">
              <Lock size={18} />
              CONFIRM & PAY
            </button>
          </div>
        );

      case 'review':
        return (
          <ChatbotReview
            applicants={wizard.applicants}
            email={wizard.email}
            phone={wizard.phone}
            visaType={wizard.visaType}
            processingType={wizard.processingType}
            applicantCount={wizard.applicantCount}
            totalAmount={wizard.totalAmount}
            documents={reviewProgress.data?.documents ?? []}
            onSaveApplicant={saveReviewedApplicant}
            onSaveContact={saveReviewedContact}
            onSaveService={saveReviewedService}
            onReplaceDocument={replaceReviewedDocument}
            onContinue={() => setWizard((current) => ({ ...current, step: 'terms', acceptedTerms: false }))}
          />
        );

      case 'payment':
        return (
          <div className="p-3 bg-gray-50 border-t border-gray-100 space-y-2">
            <p className="text-xs font-semibold text-gray-500 mb-1">Complete your payment:</p>
            <a href={wizard.paymentLink} target="_blank" rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all font-bold shadow-lg">
              <Lock size={18} />
              Pay ${wizard.totalAmount} Now
            </a>
            <a href="https://wa.me/971589896644" target="_blank" rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-green-500 text-green-600 rounded-lg hover:bg-green-50 transition-all text-sm font-medium">
              💬 Ask on WhatsApp
            </a>
          </div>
        );

      default:
        return null;
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Chat Toggle */}
      <button onClick={handleToggle}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-[#C9A04C] to-[#DDBB7A] text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center">
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat Window */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] px-4 py-3 flex items-center gap-3">
            {previousStep[wizard.step] && (
              <button type="button" onClick={goBack} disabled={loading} aria-label="Back to previous step" className="rounded-full p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white disabled:opacity-40">
                <ChevronLeft size={18} />
              </button>
            )}
            <div className="w-9 h-9 rounded-full bg-[#C9A04C]/20 flex items-center justify-center">
              <Bot size={20} className="text-[#C9A04C]" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">Tashira Assistant</h3>
              <p className="text-gray-400 text-[11px]">AI Visa Support • Online</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[300px] max-h-[400px]">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-[#C9A04C]/10 flex items-center justify-center shrink-0 mt-1">
                    <Bot size={14} className="text-[#C9A04C]" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#C9A04C] text-white rounded-tr-sm'
                    : 'bg-gray-50 text-gray-700 border border-gray-100 rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-1">
                    <User size={14} className="text-gray-500" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-[#C9A04C]/10 flex items-center justify-center shrink-0">
                  <Bot size={14} className="text-[#C9A04C] animate-pulse" />
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-xl rounded-tl-sm px-3 py-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick Actions */}
          {renderQuickActions()}

          {/* Input */}
          <div className="p-3 border-t border-gray-100 bg-white">
            <div className="flex gap-2">
              <input type="text" value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Type your answer..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:border-[#C9A04C] focus:ring-1 focus:ring-[#C9A04C]/20"
              />
              <button onClick={handleSend} disabled={loading || !input.trim()}
                className="p-2 bg-gradient-to-br from-[#C9A04C] to-[#DDBB7A] text-white rounded-lg disabled:opacity-40 hover:shadow-md transition-all">
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
