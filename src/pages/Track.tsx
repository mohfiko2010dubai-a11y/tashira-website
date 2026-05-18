import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Search, CheckCircle, ArrowRight } from 'lucide-react';
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
    visaType: '30 Days Single Entry',
    submittedDate: '2025-05-10',
    expectedDelivery: '2025-05-14',
  },
  'TSH-789012': {
    reference: 'TSH-789012',
    status: 'under-review',
    applicantName: 'Sarah Johnson',
    visaType: '60 Days Single Entry',
    submittedDate: '2025-05-15',
    expectedDelivery: '2025-05-19',
  },
};

const statusSteps = ['submitted', 'under-review', 'approved', 'issued'] as const;

export default function Track() {
  const { t, i18n } = useTranslation('track');
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

  const getStatusIndex = (status: string) => statusSteps.indexOf(status as any);

  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <div
        className="pt-32 pb-16 px-4 text-center"
        style={{ background: 'linear-gradient(180deg, #FAFAF7, #F0EDE8)' }}
      >
        <h1 className="text-3xl sm:text-4xl font-bold text-[#1A2332]">{t('title')}</h1>
        <p className="text-gray-500 mt-3 max-w-md mx-auto">{t('subtitle')}</p>
      </div>

      {/* Track Form */}
      <div className="max-w-lg mx-auto px-4 -mt-8">
        <div className="bg-white rounded-xl p-6 shadow-lg">
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
            placeholder={t('placeholder')}
            className="w-full px-5 py-4 border border-gray-200 rounded-lg focus:border-[#C9A04C] focus:ring-1 focus:ring-[#C9A04C] outline-none transition-colors text-center text-lg"
          />
          <button
            onClick={handleTrack}
            className="w-full mt-4 py-4 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #C9A04C, #DDBB7A)',
              boxShadow: '0 2px 8px rgba(201,160,76,0.25)',
            }}
          >
            <Search size={18} />
            {t('button')}
          </button>
        </div>
      </div>

      {/* Result */}
      {searched && (
        <div className="max-w-lg mx-auto px-4 mt-10 pb-20">
          {result ? (
            <div ref={resultRef} className="bg-white rounded-xl p-6 sm:p-8 shadow-lg border border-gray-100">
              {/* Progress Steps */}
              <div className="flex items-center justify-between mb-10">
                {statusSteps.map((step, idx) => {
                  const currentIdx = getStatusIndex(result.status);
                  const isCompleted = idx <= currentIdx;
                  const isCurrent = idx === currentIdx;

                  return (
                    <div key={step} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            isCompleted
                              ? 'bg-[#C9A04C] text-white'
                              : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
                          } ${isCurrent ? 'ring-4 ring-[#C9A04C]/20' : ''}`}
                        >
                          {isCompleted ? <CheckCircle size={18} /> : <span className="text-xs font-bold">{idx + 1}</span>}
                        </div>
                        <span className={`text-[10px] mt-1.5 font-medium text-center leading-tight ${isCurrent ? 'text-[#C9A04C]' : 'text-gray-400'}`}>
                          {t(`result.${step}`)}
                        </span>
                      </div>
                      {idx < statusSteps.length - 1 && (
                        <div className={`flex-1 h-[2px] mx-1 sm:mx-2 ${isCompleted && idx < currentIdx ? 'bg-[#C9A04C]' : 'bg-gray-200'}`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {[
                  { label: t('result.reference'), value: result.reference },
                  { label: t('result.applicant'), value: result.applicantName },
                  { label: t('result.visaType'), value: result.visaType },
                  { label: t('result.submittedDate'), value: result.submittedDate },
                  { label: t('result.expectedDelivery'), value: result.expectedDelivery },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm font-medium text-gray-800 mt-1">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-10">
              <p className="text-gray-500 text-lg mb-4">
                {isAr ? 'لم يتم العثور على طلب' : 'No application found'}
              </p>
              <p className="text-gray-400 text-sm mb-6">
                {isAr ? 'حاول تطبيق نموذجي: TSH-123456' : 'Try a demo reference: TSH-123456'}
              </p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-[#C9A04C] hover:underline font-medium"
              >
                {isAr ? 'قدم طلباً جديداً' : 'Apply for a new visa'}
                <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
