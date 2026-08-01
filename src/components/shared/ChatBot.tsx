import React, { useState, useRef, useEffect } from 'react';
import { trpc } from '@/providers/trpc';
import { MessageCircle, X, Send, Bot, User, Paperclip, Lock, ArrowRight } from 'lucide-react';

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

// ─── Component ───────────────────────────────────────────────────────────────

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => 'chat_' + Math.random().toString(36).slice(2));
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
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendMessage = trpc.chat.sendMessage.useMutation();

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

  useEffect(() => {
    if (open && messages.length === 0) {
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
  }, [open]);

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
          advance({ whoTraveling: 'Single', applicantCount: 1, step: 'residence_status' },
            '**What is your residence status?**');
        } else if (choice.includes('family') || choice.includes('multiple') || choice === 'f') {
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
            `✅ Visa: **${match.emoji} ${match.label}** ($${match.price})\n\n**Choose processing type:**`);
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
          const total = (VISA_OPTIONS.find(v => v.label === w.visaType)?.price || 170) + match.price;
          advance({ processingType: match.label, totalAmount: total * w.applicantCount, step: 'full_name' },
            `✅ Processing: **${match.emoji} ${match.label}** ${match.price > 0 ? '(+$' + match.price + ')' : ''}\n\n` +
            `📋 **Step 4: Applicant ${w.currentApplicant} of ${w.applicantCount}**\n\n` +
            `**Full Name** (as on passport):`);
        } else {
          addBotMessage('❌ Please choose:\n• **Regular** (3-4 days)\n• **Express** (24-36 hours, +$40)');
          setLoading(false);
        }
        break;
      }

      // ─── Full Name ────────────────────────────────────────────────────────
      case 'full_name': {
        if (validateName(msg)) {
          advance({ fullName: msg, step: 'nationality' },
            `✅ Hello, **${msg}**!\n\n**Nationality:**`);
        } else {
          addBotMessage('❌ Please enter your real full name (letters only, at least 2 characters).');
          setLoading(false);
        }
        break;
      }

      // ─── Nationality ──────────────────────────────────────────────────────
      case 'nationality': {
        if (validateRequired(msg)) {
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
          advance({ countryFrom: msg, step: 'arrival_date' },
            `✅ From: **${msg}**\n\n**Expected Arrival Date** (YYYY-MM-DD):`);
        } else {
          addBotMessage('❌ Please enter the country you are traveling from.');
          setLoading(false);
        }
        break;
      }

      // ─── Arrival Date ─────────────────────────────────────────────────────
      case 'arrival_date': {
        if (validateDate(msg)) {
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
        const total = w.totalAmount;
        addBotMessage(
          `📋 **Application Summary**\n\n` +
          `**Travelers:** ${w.whoTraveling} (${w.applicantCount})\n` +
          `**Residence:** ${w.residenceStatus}\n` +
          `**Visa:** ${w.visaType}\n` +
          `**Processing:** ${w.processingType}\n\n` +
          `**Applicant ${w.currentApplicant}:**\n` +
          `• Name: ${w.fullName}\n` +
          `• Nationality: ${w.nationality}\n` +
          `• Passport: ${w.passportNumber}\n` +
          `• Email: ${w.email}\n` +
          `• Phone: ${w.phone}\n\n` +
          `**Total Amount: $${total}**\n\n` +
          `Type **CONFIRM** to proceed to payment.`
        );
        setWizard(w => ({ ...w, step: 'terms' }));
        setLoading(false);
        break;
      }

      // ─── Terms ────────────────────────────────────────────────────────────
      case 'terms': {
        if (msg.toLowerCase() === 'confirm') {
          const refNum = `TSH-${Math.floor(100000 + Math.random() * 900000)}`;
          const payLink = 'https://tashiraev.com/pay/' + refNum;
          advance({
            step: 'payment',
            referenceNumber: refNum,
            paymentLink: payLink,
          },
            `✅ Application confirmed!\n\n` +
            `📋 Reference: **${refNum}**\n` +
            `💰 Total: **$${w.totalAmount}**\n\n` +
            `**Pay Now:**\n${payLink}`);
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
    const w = wizard;

    if (w.step === 'upload_passport_copy') {
      addBotMessage('✅ **Passport Copy** received!');
      setTimeout(() => {
        addBotMessage('📎 Now upload **Passport Cover** (front cover of your passport).\n\nClick the 📎 button below.');
        setWizard(w => ({ ...w, step: 'upload_passport_cover' }));
        setDocStep(1);
      }, 600);
    } else if (w.step === 'upload_passport_cover') {
      addBotMessage('✅ **Passport Cover** received!');
      setTimeout(() => {
        addBotMessage('📎 Now upload **Passport Photo** (white background, face clearly visible).\n\nClick the 📎 button below.');
        setWizard(w => ({ ...w, step: 'upload_passport_photo' }));
        setDocStep(2);
      }, 600);
    } else if (w.step === 'upload_passport_photo') {
      addBotMessage('✅ **Passport Photo** received!\n\nAll documents uploaded successfully.');
      setTimeout(() => {
        setWizard(w => ({ ...w, step: 'review' }));
        // Trigger review
        addBotMessage('Reviewing your application...');
        setTimeout(() => {
          const total = w.totalAmount;
          addBotMessage(
            `📋 **Application Summary**\n\n` +
            `**Travelers:** ${w.whoTraveling} (${w.applicantCount})\n` +
            `**Residence:** ${w.residenceStatus}\n` +
            `**Visa:** ${w.visaType}\n` +
            `**Processing:** ${w.processingType}\n\n` +
            `**Applicant ${w.currentApplicant}:**\n` +
            `• Name: ${w.fullName}\n` +
            `• Nationality: ${w.nationality}\n` +
            `• Passport: ${w.passportNumber}\n` +
            `• Email: ${w.email}\n` +
            `• Phone: ${w.phone}\n\n` +
            `**Total Amount: $${total}**\n\n` +
            `Type **CONFIRM** to proceed to payment.`
          );
          setWizard(w => ({ ...w, step: 'terms' }));
          setLoading(false);
        }, 800);
      }, 600);
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
                  <span className="text-[13px] font-bold text-[#C9A04C]">${v.price}</span>
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
                  <div className="text-[11px] text-gray-500">{p.price > 0 ? `+$${p.price}` : 'Standard'}</div>
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
            <button onClick={() => { addUserMessage('CONFIRM'); setLoading(true); processInput('CONFIRM'); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all font-bold">
              <Lock size={18} />
              CONFIRM & PAY
            </button>
          </div>
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
      <button onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-[#C9A04C] to-[#DDBB7A] text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center">
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Chat Window */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] px-4 py-3 flex items-center gap-3">
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
