import { useTranslation } from 'react-i18next';
import { ArrowDown } from 'lucide-react';


export default function HowToApply() {
  const { t } = useTranslation('howToApply');

  const _steps = t('steps', { returnObjects: true });
  const steps = Array.isArray(_steps) ? _steps : [];



  return (
    <>
    <div className="min-h-screen">
      {/* Page Header */}
      <div
        className="pt-32 pb-12 px-4 text-center"
        style={{ background: 'linear-gradient(180deg, #FAFAF7, #F0EDE8)' }}
      >
        <h1 className="text-3xl sm:text-4xl font-bold text-[#1A2332]">{t('title')}</h1>
        <p className="text-gray-500 mt-3">{t('subtitle')}</p>
      </div>

      {/* Steps */}
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="space-y-0">
          {steps.map((step, idx) => (
            <div key={idx}>
              <div className="step-card relative bg-white rounded-xl p-8 shadow-sm border-s-4 border-[#C9A04C]">
                <div className="absolute -top-4 start-6 w-8 h-8 rounded-full bg-[#C9A04C] text-white flex items-center justify-center text-sm font-bold shadow-md">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold text-[#1A2332] mt-3">{step.title}</h3>
                <p className="text-gray-500 mt-2 leading-relaxed">{step.description}</p>
              </div>
              {idx < steps.length - 1 && (
                <div className="flex justify-center py-4">
                  <ArrowDown size={20} className="text-[#C9A04C] animate-bounce" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
    </>
  );
}
