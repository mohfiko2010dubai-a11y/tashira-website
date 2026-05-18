import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { visaTypes } from '@/data/visaData';

gsap.registerPlugin(ScrollTrigger);

export default function Pricing() {
  const { t, i18n } = useTranslation('pricing');
  const isAr = i18n.language === 'ar';
  const [processing, setProcessing] = useState<'regular' | 'express'>('regular');
  const navigate = useNavigate();
  const gridRef = useRef<HTMLDivElement>(null);



  useEffect(() => {
    const ctx = gsap.context(() => {
      if (gridRef.current) {
        const cards = gridRef.current.querySelectorAll('.pricing-card');
        gsap.from(cards, {
          opacity: 0,
          scale: 0.95,
          y: 30,
          stagger: 0.08,
          duration: 0.6,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: gridRef.current,
            start: 'top 80%',
          },
        });
      }
    });
    return () => ctx.revert();
  }, []);

  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <div
        className="pt-32 pb-12 px-4 text-center"
        style={{ background: 'linear-gradient(180deg, #FAFAF7, #F0EDE8)' }}
      >
        <h1 className="text-3xl sm:text-4xl font-bold text-[#1A2332]">{t('title')}</h1>
        <p className="text-gray-500 mt-3">{t('subtitle')}</p>

        {/* Toggle */}
        <div className="flex justify-center mt-8">
          <div className="flex bg-gray-100 rounded-full p-1">
            {(['regular', 'express'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setProcessing(type)}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                  processing === type
                    ? 'bg-white text-[#1A2332] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t(`processing.${type}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {visaTypes.map((visa) => {
            const price = processing === 'regular' ? visa.regularPrice : visa.expressPrice;
            return (
              <div
                key={visa.id}
                className="pricing-card bg-white rounded-xl overflow-hidden border-t-[3px] border-[#C9A04C] shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
              >
                <div className="p-5">
                  <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                    {processing === 'regular' ? 'Regular' : 'Express'}
                  </span>
                  <h3 className="text-lg font-semibold text-[#1A2332] mt-3">
                    {isAr ? visa.nameAr : visa.nameEn}
                  </h3>
                  <p className="text-3xl font-bold text-[#C9A04C] mt-3">
                    ${price}
                  </p>
                </div>

                <div className="px-5 pb-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Check size={14} className="text-[#C9A04C] shrink-0" />
                    <span>{t('features.processingTime', { time: processing === 'regular' ? visa.processingTimeRegular : visa.processingTimeExpress })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Check size={14} className="text-[#C9A04C] shrink-0" />
                    <span>{t('features.validity', { days: visa.validity })}</span>
                  </div>
                  {processing === 'express' && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Check size={14} className="text-[#C9A04C] shrink-0" />
                      <span>{t('features.prioritySupport')}</span>
                    </div>
                  )}
                </div>

                <div className="px-5 pb-5">
                  <button
                    onClick={() => navigate(`/?visa=${visa.id}&processing=${processing}`)}
                    className="w-full py-3 rounded-lg font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg"
                    style={{
                      background: 'linear-gradient(135deg, #C9A04C, #DDBB7A)',
                      boxShadow: '0 2px 8px rgba(201,160,76,0.25)',
                    }}
                  >
                    {processing === 'regular' ? t('applyNow') : t('applyExpress')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
