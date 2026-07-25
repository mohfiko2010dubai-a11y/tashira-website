import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User, Paperclip, ArrowRight, Lock } from 'lucide-react';
import { trpc } from '@/providers/trpc';

// Wizard steps
type WizardStep = 
  | 'welcome' 
  | 'collect_name' 
  | 'collect_email' 
  | 'collect_phone'
  | 'show_visa_menu' 
  | 'show_processing_menu'
  | 'show_applicant_count'
  | 'upload_docs'
  | 'confirm';

interface WizardState {
  step: WizardStep;
  name: string;
  email: string;
  phone: string;
  visaType: string;
  processingType: string;
  applicantCount: number;
  referenceNumber: string;
  paymentLink: string;
  totalAmount: number;
}

const VISA_OPTIONS = [
  { label: '14 Days Tourist', labelAr: '١٤ يوم سياحة', price: 145, emoji: '✈️' },
  { label: '30 Days Tourist', labelAr: '٣٠ يوم سياحة', price: 170, emoji: '🏖️' },
  { label: '60 Days Tourist', labelAr: '٦٠ يوم سياحة', price: 250, emoji: '🌴' },
  { label: '90 Days Tourist', labelAr: '٩٠ يوم سياحة', price: 330, emoji: '🕌' },
  { label: '96 Hours Transit', labelAr: '٩٦ ساعة ترانزيت', price: 99, emoji: '🛫' },
];

const PROCESSING_OPTIONS = [
  { label: 'Regular (3-4 days)', labelAr: 'عادي (٣-٤ أيام)', price: 0, emoji: '🐢' },
  { label: 'Express (24-36h)', labelAr: 'سريع (٢٤-٣٦ ساعة)', price: 40, emoji: '⚡' },
];

const APPLICANT_COUNTS = [1, 2, 3, 4, 5];

// Linkify text - convert URLs to clickable links
function LinkifyText({ text, isUser }: { text: string; isUser: boolean }) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  const matches = text.match(urlRegex) || [];

  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {matches[i] && (
            <a
              href={matches[i]}
              target="_blank"
              rel="noopener noreferrer"
              className={`underline font-semibold hover:opacity-80 ${
                isUser ? 'text-white' : 'text-[#C9A04C]'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {matches[i]}
            </a>
          )}
        </span>
      ))}
    </>
  );
}

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [wizard, setWizard] = useState<WizardState>({
    step: 'welcome',
    name: '',
    email: '',
    phone: '',
    visaType: '',
    processingType: '',
    applicantCount: 1,
    referenceNumber: '',
    paymentLink: '',
    totalAmount: 0,
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: () => setLoading(false),
    onError: () => setLoading(false),
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Show welcome message when chat opens
  useEffect(() => {
    if (open && messages.length === 0) {
      addBotMessage(
        '👋 Hi! Welcome to Tashira Visa Portal!\n\n' +
        'I\'m your visa assistant. Let me help you apply for a UAE visa.\n\n' +
        'First, what\'s your name?'
      );
      setWizard(w => ({ ...w, step: 'collect_name' }));
    }
  }, [open]);

  const addBotMessage = (content: string) => {
    setMessages(prev => [...prev, { role: 'assistant', content }]);
  };

  const addUserMessage = (content: string) => {
    setMessages(prev => [...prev, { role: 'user', content }]);
  };

  const handleSend = () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    addUserMessage(msg);
    setInput('');
    handleWizardStep(msg);
  };

  const handleWizardStep = (msg: string) => {
    setLoading(true);

    switch (wizard.step) {
      case 'collect_name':
        setWizard(w => ({ ...w, name: msg, step: 'collect_email' }));
        setTimeout(() => {
          addBotMessage(`Nice to meet you, ${msg}! ✨\n\nWhat's your email address?`);
          setLoading(false);
        }, 500);
        break;

      case 'collect_email':
        setWizard(w => ({ ...w, email: msg, step: 'collect_phone' }));
        setTimeout(() => {
          addBotMessage('Great! 📧\n\nAnd your phone number? (with country code, e.g. +971...)');
          setLoading(false);
        }, 500);
        break;

      case 'collect_phone':
        setWizard(w => ({ ...w, phone: msg, step: 'show_visa_menu' }));
        setTimeout(() => {
          addBotMessage(
            'Perfect! 📱 Now let\'s choose your visa type:\n\n' +
            VISA_OPTIONS.map(v => `${v.emoji} ${v.label} - $${v.price}`).join('\n')
          );
          setLoading(false);
        }, 500);
        break;

      default:
        setLoading(false);
    }
  };

  const handleVisaSelect = (visa: typeof VISA_OPTIONS[0]) => {
    addUserMessage(`${visa.emoji} ${visa.label}`);
    setWizard(w => ({ ...w, visaType: visa.label, step: 'show_processing_menu' }));
    setLoading(true);

    setTimeout(() => {
      addBotMessage(
        `✅ ${visa.label} selected!\n\n` +
        `Choose processing speed:\n\n` +
        PROCESSING_OPTIONS.map(p => `${p.emoji} ${p.label} ${p.price > 0 ? `(+$${p.price})` : '(Free)'}`).join('\n')
      );
      setLoading(false);
    }, 500);
  };

  const handleProcessingSelect = (proc: typeof PROCESSING_OPTIONS[0]) => {
    addUserMessage(`${proc.emoji} ${proc.label}`);
    setWizard(w => ({ ...w, processingType: proc.label, step: 'show_applicant_count' }));
    setLoading(true);

    setTimeout(() => {
      addBotMessage(
        `⚡ ${proc.label}!\n\n` +
        `How many applicants?\n\n` +
        APPLICANT_COUNTS.map(n => `${n} ${n === 1 ? 'person' : 'people'} ${n === 1 ? '👤' : '👥'}`).join('\n')
      );
      setLoading(false);
    }, 500);
  };

  const handleApplicantSelect = (count: number) => {
    addUserMessage(`${count} ${count === 1 ? 'person' : 'people'}`);
    setWizard(w => ({ ...w, applicantCount: count, step: 'upload_docs' }));
    setLoading(true);

    setTimeout(() => {
      addBotMessage(
        `📎 Please upload the required documents:\n\n` +
        `1. Passport copy (photo page)\n` +
        `2. Passport photo (white background)\n\n` +
        `Click the 📎 button below to upload.`
      );
      setLoading(false);
    }, 500);
  };

  const handleDocUpload = () => {
    addBotMessage('✅ Documents received!');

    // Calculate total
    const visa = VISA_OPTIONS.find(v => v.label === wizard.visaType);
    const proc = PROCESSING_OPTIONS.find(p => p.label === wizard.processingType);
    const basePrice = visa?.price || 170;
    const procFee = proc?.price || 0;
    const total = (basePrice + procFee) * wizard.applicantCount;
    const refNum = `TSH-${Math.floor(100000 + Math.random() * 900000)}`;
    const payLink = `https://tashiraev.com/pay/${refNum}`;

    setWizard(w => ({ ...w, step: 'confirm', referenceNumber: refNum, paymentLink: payLink, totalAmount: total }));
    setLoading(true);

    setTimeout(() => {
      addBotMessage(
        `🎉 Almost done, ${wizard.name}!\n\n` +
        `📋 Summary:\n` +
        `• Visa: ${wizard.visaType}\n` +
        `• Processing: ${wizard.processingType}\n` +
        `• Applicants: ${wizard.applicantCount}\n` +
        `• Total: $${total}\n\n` +
        `Your reference: ${refNum}\n\n` +
        `Pay securely here:\n` +
        `${payLink}\n\n` +
        `💬 Questions? WhatsApp us: +971 58 989 6644`
      );

      // Send notification to admin
      sendMessage.mutate({
        sessionId,
        message: `NEW APPLICATION via Chatbot!\nRef: ${refNum}\nName: ${wizard.name}\nEmail: ${wizard.email}\nPhone: ${wizard.phone}\nVisa: ${wizard.visaType}\nProcessing: ${wizard.processingType}\nApplicants: ${wizard.applicantCount}\nTotal: $${total}`,
        visitorName: wizard.name,
        visitorEmail: wizard.email,
        visitorPhone: wizard.phone,
      });

      setLoading(false);
    }, 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    addUserMessage(`📎 Uploaded: ${file.name}`);
    handleDocUpload();
    e.target.value = '';
  };

  // Quick action buttons
  const renderQuickActions = () => {
    if (loading) return null;

    switch (wizard.step) {
      case 'show_visa_menu':
        return (
          <div className="grid grid-cols-1 gap-2 p-3 bg-gray-50 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-1">Select visa type:</p>
            {VISA_OPTIONS.map(visa => (
              <button
                key={visa.label}
                onClick={() => handleVisaSelect(visa)}
                className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-[#C9A04C] hover:bg-[#FFF8E7] transition-all text-left"
              >
                <span className="text-sm">{visa.emoji} {visa.label}</span>
                <span className="text-sm font-bold text-[#C9A04C]">${visa.price}</span>
              </button>
            ))}
          </div>
        );

      case 'show_processing_menu':
        return (
          <div className="grid grid-cols-1 gap-2 p-3 bg-gray-50 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-1">Processing speed:</p>
            {PROCESSING_OPTIONS.map(proc => (
              <button
                key={proc.label}
                onClick={() => handleProcessingSelect(proc)}
                className="flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-[#C9A04C] hover:bg-[#FFF8E7] transition-all text-left"
              >
                <span className="text-sm">{proc.emoji} {proc.label}</span>
                <span className="text-sm font-bold text-[#C9A04C]">{proc.price > 0 ? `+$${proc.price}` : 'Free'}</span>
              </button>
            ))}
          </div>
        );

      case 'show_applicant_count':
        return (
          <div className="grid grid-cols-5 gap-2 p-3 bg-gray-50 border-t border-gray-100">
            <p className="col-span-5 text-xs font-semibold text-gray-500 mb-1">Number of applicants:</p>
            {APPLICANT_COUNTS.map(n => (
              <button
                key={n}
                onClick={() => handleApplicantSelect(n)}
                className="px-3 py-3 bg-white border border-gray-200 rounded-lg hover:border-[#C9A04C] hover:bg-[#FFF8E7] transition-all text-center font-semibold"
              >
                {n}
              </button>
            ))}
          </div>
        );

      case 'upload_docs':
        return (
          <div className="p-3 bg-gray-50 border-t border-gray-100">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-[#C9A04C] border-dashed rounded-lg hover:bg-[#FFF8E7] transition-all text-[#C9A04C] font-medium"
            >
              <Paperclip size={18} />
              Upload Documents
            </button>
          </div>
        );

      case 'confirm':
        return (
          <div className="p-3 bg-gray-50 border-t border-gray-100 space-y-2">
            <p className="text-xs font-semibold text-gray-500 mb-1">Complete your payment:</p>
            <a
              href={wizard.paymentLink || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all font-semibold shadow-sm"
            >
              <Lock size={18} />
              Pay ${wizard.totalAmount || 0} Now
            </a>
            <a
              href={`https://wa.me/971589896644?text=Hi, I have a question about my application ${wizard.referenceNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-green-500 text-green-600 rounded-lg hover:bg-green-50 transition-all text-sm font-medium"
            >
              💬 Ask on WhatsApp
            </a>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 ${
          open ? 'bg-gray-700' : 'bg-gradient-to-br from-[#C9A04C] to-[#DDBB7A]'
        }`}
      >
        {open ? <X size={22} className="text-white" /> : <MessageCircle size={22} className="text-white" />}
      </button>

      {/* Chat Window */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">Tashira Assistant</p>
              <p className="text-white/80 text-[11px]">AI Visa Support</p>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[400px]">
            {messages.length === 0 && !loading && (
              <div className="text-center text-gray-400 text-sm py-8">
                <Bot size={32} className="mx-auto mb-3 text-gray-300" />
                <p>Hello! I'm your Tashira visa assistant.</p>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user' ? 'bg-gray-100' : 'bg-[#C9A04C]/10'
                }`}>
                  {msg.role === 'user' ? <User size={14} className="text-gray-500" /> : <Bot size={14} className="text-[#C9A04C]" />}
                </div>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user' 
                    ? 'bg-[#C9A04C] text-white rounded-tr-sm' 
                    : 'bg-gray-100 text-gray-700 rounded-tl-sm'
                }`}>
                  <LinkifyText text={msg.content} isUser={msg.role === 'user'} />
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-[#C9A04C]/10 flex items-center justify-center">
                  <Bot size={14} className="text-[#C9A04C]" />
                </div>
                <div className="bg-gray-100 rounded-xl px-3 py-2 rounded-tl-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Action Buttons */}
          {renderQuickActions()}

          {/* Input */}
          <div className="border-t border-gray-100 p-3 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                wizard.step === 'collect_name' ? 'Your full name...' :
                wizard.step === 'collect_email' ? 'Your email...' :
                wizard.step === 'collect_phone' ? '+971...' :
                'Type your question...'
              }
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-[#C9A04C] focus:ring-1 focus:ring-[#C9A04C] outline-none"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="p-2 bg-gradient-to-br from-[#C9A04C] to-[#DDBB7A] text-white rounded-lg disabled:opacity-40 hover:shadow-md transition-all"
            >
              <Send size={16} />
            </button>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-3 py-2 text-center border-t border-gray-100">
            <p className="text-[10px] text-gray-400">
              WhatsApp: <a href="https://wa.me/971589896644" target="_blank" rel="noopener noreferrer" className="text-[#C9A04C] hover:underline">+971 58 989 6644</a> | 
              Phone: <a href="tel:+971502101784" className="text-[#C9A04C] hover:underline">+971 50 210 1784</a>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
