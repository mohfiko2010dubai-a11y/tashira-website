import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Calendar, FileText, Plane, Hotel, Star, ChevronDown, ChevronUp, Phone } from 'lucide-react';

interface SaudiVisaType {
  id: string;
  key: string;
  price: number;
  originalPrice: number;
  processingDays: string;
  validity: string;
  stayDuration: string;
  entries: string;
  entriesAr: string;
  color: string;
  popular?: boolean;
}

const saudiVisas: SaudiVisaType[] = [
  {
    id: 'tourist-30',
    key: 'tourist30',
    price: 185,
    originalPrice: 250,
    processingDays: '3 - 5 days',
    validity: '1 Year',
    stayDuration: '30 Days',
    entries: 'Single / Multiple',
    entriesAr: 'مفرد / متعدد',
    color: '#C9A04C',
    popular: true,
  },
  {
    id: 'umrah',
    key: 'umrah',
    price: 165,
    originalPrice: 220,
    processingDays: '3 - 7 days',
    validity: '30 Days',
    stayDuration: 'Up to 30 Days',
    entries: 'Single',
    entriesAr: 'دخول مفرد',
    color: '#16a34a',
  },
  {
    id: 'visit-90',
    key: 'visit90',
    price: 295,
    originalPrice: 380,
    processingDays: '5 - 7 days',
    validity: '90 Days',
    stayDuration: '90 Days',
    entries: 'Single / Multiple',
    entriesAr: 'مفرد / متعدد',
    color: '#2563eb',
  },
  {
    id: 'transit-96',
    key: 'transit96',
    price: 85,
    originalPrice: 120,
    processingDays: '1 - 3 days',
    validity: '72 Hours transit',
    stayDuration: '96 Hours',
    entries: 'Single',
    entriesAr: 'دخول مفرد',
    color: '#7c3aed',
  },
  {
    id: 'business-30',
    key: 'business30',
    price: 350,
    originalPrice: 450,
    processingDays: '5 - 10 days',
    validity: '90 Days',
    stayDuration: '30 Days',
    entries: 'Single / Multiple',
    entriesAr: 'مفرد / متعدد',
    color: '#dc2626',
  },
  {
    id: 'premium-365',
    key: 'premium365',
    price: 550,
    originalPrice: 750,
    processingDays: '5 - 7 days',
    validity: '1 Year',
    stayDuration: '90 Days per visit',
    entries: 'Multiple',
    entriesAr: 'دخول متعدد',
    color: '#C9A04C',
    popular: true,
  },
];

const requirements = [
  { key: 'reqPassport', icon: FileText },
  { key: 'reqPhoto', icon: FileText },
  { key: 'reqFlight', icon: Plane },
  { key: 'reqHotel', icon: Hotel },
  { key: 'reqVaccine', icon: FileText },
];

const docKeys = ['passport', 'photo', 'flight', 'hotel', 'vaccine', 'id', 'bank', 'sponsor'];

export default function SaudiVisa() {
  const { t, i18n } = useTranslation('saudiVisa');
  const isAr = i18n.language === 'ar';
  const [expandedVisa, setExpandedVisa] = useState<string | null>(null);

  const handleWhatsApp = (visaKey: string) => {
    const visaName = t(`visas.${visaKey}.name`);
    const message = t('inquiryMessage', { visaName });
    window.open(`https://wa.me/971508107710?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="relative pt-32 pb-16 px-4 text-center overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a472a 0%, #166534 40%, #14532d 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-white rounded-full text-sm font-medium mb-4 backdrop-blur-sm">
            <Star size={16} className="text-yellow-400 fill-yellow-400" />
            {t('hero.badge')}
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            {t('hero.title')}
          </h1>
          <p className="text-white/80 max-w-2xl mx-auto text-lg">
            {t('hero.subtitle')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-8 text-white/70 text-sm">
            {requirements.map((r) => (
              <span key={r.key} className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm">
                <r.icon size={14} />
                {t(`hero.${r.key}`)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Visa Types Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {t('chooseTitle')}
          </h2>
          <p className="text-gray-500 mt-2">
            {t('chooseSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {saudiVisas.map((visa) => {
            const visaFeatures = t(`visas.${visa.key}.features`, { returnObjects: true }) as string[];
            return (
              <div
                key={visa.id}
                className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col border border-gray-100"
              >
                {/* Card Header */}
                <div className="p-5 flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className="inline-block px-3 py-1 text-[10px] font-bold rounded-full text-white uppercase tracking-wide"
                      style={{ backgroundColor: visa.color }}
                    >
                      {visa.processingDays}
                    </span>
                    {visa.popular && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold rounded-full">
                        <Star size={10} className="fill-red-500" />
                        {t('popular')}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 leading-snug">
                    {t(`visas.${visa.key}.name`)}
                  </h3>

                  <div className="flex items-baseline gap-2 mt-3">
                    <span className="text-3xl font-extrabold" style={{ color: visa.color }}>${visa.price}</span>
                    <span className="text-lg text-gray-400 line-through">${visa.originalPrice}</span>
                  </div>

                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                      {t('save')} ${visa.originalPrice - visa.price}
                    </span>
                  </div>
                </div>

                {/* Features */}
                <div className="px-5 pb-3 space-y-2">
                  {visaFeatures.slice(0, 3).map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <Check size={14} style={{ color: visa.color }} className="shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}

                  {/* Expandable section */}
                  {expandedVisa === visa.id && (
                    <div className="pt-2 space-y-2 border-t border-gray-100 mt-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar size={14} className="text-gray-400 shrink-0" />
                        <span>{t('validityLabel')}: {visa.validity}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar size={14} className="text-gray-400 shrink-0" />
                        <span>{t('stayLabel')}: {visa.stayDuration}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Plane size={14} className="text-gray-400 shrink-0" />
                        <span>{t('entryLabel')}: {isAr ? visa.entriesAr : visa.entries}</span>
                      </div>
                      {visaFeatures.slice(3).map((f, i) => (
                        <div key={i + 3} className="flex items-center gap-2 text-sm text-gray-600">
                          <Check size={14} style={{ color: visa.color }} className="shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setExpandedVisa(expandedVisa === visa.id ? null : visa.id)}
                    className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors pt-1"
                  >
                    {expandedVisa === visa.id ? (
                      <>{t('less')} <ChevronUp size={14} /></>
                    ) : (
                      <>{t('moreDetails')} <ChevronDown size={14} /></>
                    )}
                  </button>
                </div>

                {/* CTA */}
                <div className="px-5 pb-5 mt-auto">
                  <button
                    onClick={() => handleWhatsApp(visa.key)}
                    className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95 flex items-center justify-center gap-2"
                    style={{
                      background: `linear-gradient(135deg, ${visa.color}, ${visa.color}dd)`,
                      boxShadow: `0 4px 16px ${visa.color}40`,
                    }}
                  >
                    <Phone size={16} />
                    {t('bookWhatsApp')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Requirements Section */}
      <div className="bg-white border-t border-gray-100 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            {t('documents.title')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {docKeys.map((key) => (
              <div key={key} className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div className="w-10 h-10 rounded-lg bg-[#166534]/10 flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-[#166534]" />
                </div>
                <span className="text-sm font-medium text-gray-700">{t(`documents.${key}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Banner */}
      <div className="py-16 px-4 text-center" style={{ background: 'linear-gradient(135deg, #1a472a 0%, #166534 50%, #14532d 100%)' }}>
        <h2 className="text-3xl font-bold text-white mb-4">
          {t('ctaBanner.title')}
        </h2>
        <p className="text-white/80 max-w-lg mx-auto mb-8">
          {t('ctaBanner.subtitle')}
        </p>
        <a
          href="https://wa.me/971508107710"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-bold text-lg bg-white text-[#166534] hover:bg-gray-100 transition-all hover:-translate-y-1 hover:shadow-xl"
        >
          <Phone size={20} />
          {t('ctaBanner.button')}
        </a>
      </div>
    </div>
  );
}
