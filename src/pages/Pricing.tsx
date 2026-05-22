import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Check, Clock, Calendar } from 'lucide-react';
import { visaTypes } from '@/data/visaData';

export default function Pricing() {
  const { t, i18n } = useTranslation('pricing');
  const isAr = i18n.language === 'ar';
  const [processing, setProcessing] = useState<'regular' | 'express'>('regular');
  const navigate = useNavigate();

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

      {/* Pricing Grid - All Cards Visible */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {visaTypes.map((visa) => {
            const price = processing === 'regular' ? visa.regularPrice : visa.expressPrice;
            const time = processing === 'regular' ? visa.processingTimeRegular : visa.processingTimeExpress;
            return (
              <div
                key={visa.id}
                className="bg-white rounded-xl overflow-hidden border-t-[4px] border-[#C9A04C] shadow-md hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col"
              >
                {/* Card Header */}
                <div className="p-5 flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full ${processing === 'express' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {processing === 'regular' ? 'REGULAR' : 'EXPRESS'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#1A2332] leading-snug">
                    {isAr ? visa.nameAr : visa.nameEn}
                  </h3>
                  <div className="flex items-baseline gap-1 mt-3">
                    <span className="text-3xl font-extrabold text-[#C9A04C]">${price}</span>
                    <span className="text-sm text-gray-400">/ {isAr ? 'شخص' : 'person'}</span>
                  </div>
                </div>

                {/* Features */}
                <div className="px-5 pb-4 space-y-3">
                  <div className="flex items-center gap-2.5 text-sm text-gray-600">
                    <Clock size={15} className="text-[#C9A04C] shrink-0" />
                    <span>{time}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-gray-600">
                    <Calendar size={15} className="text-[#C9A04C] shrink-0" />
                    <span>{isAr ? 'الصلاحية:' : 'Validity:'} {visa.validity}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm text-gray-600">
                    <Check size={15} className="text-[#C9A04C] shrink-0" />
                    <span>{isAr ? 'دخول' : 'Entry:'} {visa.id.includes('multiple') ? (isAr ? 'متعدد' : 'Multiple') : (isAr ? 'مفرد' : 'Single')}</span>
                  </div>
                  {processing === 'express' && (
                    <div className="flex items-center gap-2.5 text-sm text-gray-600">
                      <Check size={15} className="text-red-500 shrink-0" />
                      <span className="text-red-500 font-medium">{isAr ? 'أولوية المعالجة' : 'Priority Processing'}</span>
                    </div>
                  )}
                </div>

                {/* CTA Button */}
                <div className="px-5 pb-5 mt-auto">
                  <button
                    onClick={() => navigate(`/?visa=${visa.id}&processing=${processing}`)}
                    className="w-full py-3 rounded-lg font-bold text-sm text-white transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95"
                    style={{
                      background: processing === 'express'
                        ? 'linear-gradient(135deg, #ef4444, #f87171)'
                        : 'linear-gradient(135deg, #C9A04C, #DDBB7A)',
                      boxShadow: processing === 'express'
                        ? '0 2px 8px rgba(239,68,68,0.25)'
                        : '0 2px 8px rgba(201,160,76,0.25)',
                    }}
                  >
                    {processing === 'regular'
                      ? (isAr ? 'قدم الآن' : 'Apply Now')
                      : (isAr ? 'تقديم سريع' : 'Apply Express')}
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
