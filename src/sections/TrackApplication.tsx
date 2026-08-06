import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, CheckCircle } from 'lucide-react';
import gsap from 'gsap';

interface TrackingResult {
  reference: string;
  status: 'submitted' | 'under-review' | 'approved' | 'issued';
  applicantName: string;
  visaType: string;
  submittedDate: string;
  expectedDelivery: string;
}

const mockResults: Record<string, TrackingResult> = {
  'TSH-123456': {
    reference: 'TSH-123456',
    status: 'approved',
    applicantName: 'Ahmed Mohamed',
    visaType: '30 Days Visa',
    submittedDate: '2026-05-10',
    expectedDelivery: '2026-05-14',
  },
  'TSH-789012': {
    reference: 'TSH-789012',
    status: 'under-review',
    applicantName: 'Sarah Johnson',
    visaType: '60 Days Visa',
    submittedDate: '2026-05-15',
    expectedDelivery: '2026-05-19',
  },
};

const statusSteps = ['submitted', 'under-review', 'approved', 'issued'] as const;

export default function TrackApplication() {
  const { t, i18n } = useTranslation('home');
  const isAr = i18n.language === 'ar';
  const [reference, setReference] = useState('');
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [searched, setSearched] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleTrack = () => {
    const trimmed = reference.trim().toUpperCase();
    if (!trimmed) return;
    setSearched(true);
    const found = mockResults[trimmed];
    setResult(found || null);
    if (found && resultRef.current) {
      gsap.from(resultRef.current, { opacity: 0, scale: 0.97, duration: 0.4, ease: 'power3.out' });
    }
  };

  const getStatusIndex = (status: string) => statusSteps.findIndex((step) => step === status);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-1">
        {isAr ? 'تتبع طلبك' : 'Track your application'}
      </h3>
      <p className="text-xs text-gray-400 mb-4">
        {isAr
          ? '*هذه الميزة متاحة فقط للطلبات المقدمة عبر تأشيرة.'
          : '*This feature is only available for applications submitted through Tashira.'}
      </p>

      <div className="flex flex-col sm:flex-row gap-0 max-w-md">
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
          placeholder="TSH-XXXXXX"
          className="flex-1 px-4 py-3 border border-gray-200 rounded-t-lg sm:rounded-tr-none sm:rounded-l-lg focus:border-[#C9A04C] focus:ring-1 focus:ring-[#C9A04C] outline-none transition-colors text-sm"
        />
        <button
          onClick={handleTrack}
          className="px-6 py-3 rounded-b-lg sm:rounded-bl-none sm:rounded-r-lg font-medium text-white text-sm flex items-center justify-center gap-2 transition-all hover:shadow-lg bg-gradient-to-br from-[#C9A04C] to-[#DDBB7A]"
        >
          <Search size={16} />
          {isAr ? 'تتبع' : 'Track'}
        </button>
      </div>

      {/* Result */}
      {searched && (
        <div ref={resultRef} className="mt-6">
          {result ? (
            <div className="bg-gray-50 rounded-xl p-5">
              {/* Progress Steps */}
              <div className="flex items-center justify-between mb-6">
                {statusSteps.map((step, idx) => {
                  const currentIdx = getStatusIndex(result.status);
                  const isCompleted = idx <= currentIdx;
                  const isCurrent = idx === currentIdx;

                  return (
                    <div key={step} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                            isCompleted
                              ? 'bg-[#C9A04C] text-white'
                              : 'bg-gray-200 text-gray-400'
                          } ${isCurrent ? 'ring-3 ring-[#C9A04C]/20' : ''}`}
                        >
                          {isCompleted ? <CheckCircle size={14} /> : <span className="text-xs">{idx + 1}</span>}
                        </div>
                        <span className={`text-[9px] mt-1 ${isCurrent ? 'text-[#C9A04C]' : 'text-gray-400'}`}>
                          {t(`common:status.${step}`)}
                        </span>
                      </div>
                      {idx < statusSteps.length - 1 && (
                        <div className={`flex-1 h-[2px] mx-2 ${isCompleted && idx < currentIdx ? 'bg-[#C9A04C]' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400 text-xs">{t('track.result.reference')}:</span> <span className="font-medium">{result.reference}</span></div>
                <div><span className="text-gray-400 text-xs">{t('track.result.applicant')}:</span> <span className="font-medium">{result.applicantName}</span></div>
                <div><span className="text-gray-400 text-xs">{t('track.result.visaType')}:</span> <span className="font-medium">{result.visaType}</span></div>
                <div><span className="text-gray-400 text-xs">{t('track.result.expectedDelivery')}:</span> <span className="font-medium">{result.expectedDelivery}</span></div>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <p className="text-red-600 text-sm font-medium">
                {isAr ? 'لم يتم العثور على طلب' : 'No application found with this reference.'}
              </p>
              <p className="text-red-400 text-xs mt-1">
                {isAr ? 'جرب: TSH-123456' : 'Try: TSH-123456'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
