import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Clock, Calendar, FileText, Plane, Hotel, Star, ChevronDown, ChevronUp, Phone } from 'lucide-react';

interface SaudiVisaType {
  id: string;
  nameEn: string;
  nameAr: string;
  price: number;
  originalPrice: number;
  processingDays: string;
  validity: string;
  stayDuration: string;
  entries: string;
  entriesAr: string;
  features: string[];
  featuresAr: string[];
  color: string;
  popular?: boolean;
}

const saudiVisas: SaudiVisaType[] = [
  {
    id: 'tourist-30',
    nameEn: '30 Days Tourist Visa',
    nameAr: 'تأشيرة سياحية 30 يوم',
    price: 185,
    originalPrice: 250,
    processingDays: '3 - 5 days',
    validity: '1 Year',
    stayDuration: '30 Days',
    entries: 'Single / Multiple',
    entriesAr: 'مفرد / متعدد',
    features: ['E-visa delivery', 'Tourism activities allowed', 'Hotel bookings included', '90 days validity from issue'],
    featuresAr: ['تأشيرة إلكترونية', 'السياحة مسموح', 'حجوزات فنادق', 'صالحة 90 يوم من الإصدار'],
    color: '#C9A04C',
    popular: true,
  },
  {
    id: 'umrah',
    nameEn: 'Umrah Visa',
    nameAr: 'تأشيرة عمرة',
    price: 165,
    originalPrice: 220,
    processingDays: '3 - 7 days',
    validity: '30 Days',
    stayDuration: 'Up to 30 Days',
    entries: 'Single',
    entriesAr: 'دخول مفرد',
    features: ['Umrah permit included', 'Mecca & Medina access', 'Hotel packages available', 'Ground transport optional'],
    featuresAr: ['تصريح عمرة', 'مكة والمدينة', 'باقات فنادق', 'مواصلات اختيارية'],
    color: '#16a34a',
  },
  {
    id: 'visit-90',
    nameEn: '90 Days Family Visit',
    nameAr: 'زيارة عائلية 90 يوم',
    price: 295,
    originalPrice: 380,
    processingDays: '5 - 7 days',
    validity: '90 Days',
    stayDuration: '90 Days',
    entries: 'Single / Multiple',
    entriesAr: 'مفرد / متعدد',
    features: ['Family visit purpose', 'Extendable in KSA', 'Sponsor letter processing', 'Medical insurance included'],
    featuresAr: ['غرض زيارة عائلية', 'قابلة للتمديد', 'خطاب كفالة', 'تأمين طبي'],
    color: '#2563eb',
  },
  {
    id: 'transit-96',
    nameEn: '96 Hours Transit',
    nameAr: 'عبور 96 ساعة',
    price: 85,
    originalPrice: 120,
    processingDays: '1 - 3 days',
    validity: '72 Hours transit',
    stayDuration: '96 Hours',
    entries: 'Single',
    entriesAr: 'دخول مفرد',
    features: ['Short layover visa', 'Airport to hotel transfer', 'Quick processing', 'Multi-entry option available'],
    featuresAr: ['تأشيرة ترانزيت', 'مواصلات المطار', 'معالجة سريعة', 'متعدد اختياري'],
    color: '#7c3aed',
  },
  {
    id: 'business-30',
    nameEn: '30 Days Business Visa',
    nameAr: 'تأشيرة عمل 30 يوم',
    price: 350,
    originalPrice: 450,
    processingDays: '5 - 10 days',
    validity: '90 Days',
    stayDuration: '30 Days',
    entries: 'Single / Multiple',
    entriesAr: 'مفرد / متعدد',
    features: ['Business meetings allowed', 'Conference attendance', 'Invitation letter processing', 'VIP fast-track option'],
    featuresAr: ['اجتماعات أعمال', 'مؤتمرات', 'خطاب دعوة', 'خدمة VIP سريعة'],
    color: '#dc2626',
  },
  {
    id: 'premium-365',
    nameEn: '1 Year Multiple Entry',
    nameAr: 'متعدد سنة كاملة',
    price: 550,
    originalPrice: 750,
    processingDays: '5 - 7 days',
    validity: '1 Year',
    stayDuration: '90 Days per visit',
    entries: 'Multiple',
    entriesAr: 'دخول متعدد',
    features: ['Unlimited entries', '90 days per stay', 'Tourism & business', 'Priority processing'],
    featuresAr: ['دخول غير محدود', '90 يوم كل زيارة', 'سياحة وأعمال', 'معالجة أولوية'],
    color: '#C9A04C',
    popular: true,
  },
];

const requirements = [
  { en: 'Valid passport (6+ months)', ar: 'جواز سفر ساري (6+ شهور)', icon: FileText },
  { en: 'Face photo (white background)', ar: 'صورة شخصية (خلفية بيضاء)', icon: FileText },
  { en: 'Flight booking', ar: 'حجز طيران', icon: Plane },
  { en: 'Hotel reservation', ar: 'حجز فندق', icon: Hotel },
  { en: 'Vaccination certificate', ar: 'شهادة تطعيم', icon: FileText },
];

export default function SaudiVisa() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [expandedVisa, setExpandedVisa] = useState<string | null>(null);

  const handleWhatsApp = (visaName: string) => {
    const message = isAr
      ? `مرحباً، أود الاستفسار عن تأشيرة ${visaName} للسعودية`
      : `Hello, I would like to inquire about ${visaName} for Saudi Arabia`;
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
            {isAr ? 'خدمات التأشيرات السعودية' : 'Saudi Arabia Visa Services'}
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            {isAr ? 'تأشيرات المملكة العربية السعودية' : 'Saudi Arabia Visas'}
          </h1>
          <p className="text-white/80 max-w-2xl mx-auto text-lg">
            {isAr
              ? 'سياحة، عمرة، زيارة عائلية، عمل — أحصل على تأشيرتك السعودية بسرعة وسهولة'
              : 'Tourism, Umrah, Family Visit, Business — Get your Saudi visa fast and easy'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 mt-8 text-white/70 text-sm">
            {requirements.map((r) => (
              <span key={r.en} className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm">
                <r.icon size={14} />
                {isAr ? r.ar : r.en}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Visa Types Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {isAr ? 'اختر نوع التأشيرة' : 'Choose Your Visa Type'}
          </h2>
          <p className="text-gray-500 mt-2">
            {isAr ? 'جميع الأسعار تشمل رسوم التأشيرة والخدمة' : 'All prices include visa fees and service charges'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {saudiVisas.map((visa) => (
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
                      {isAr ? 'الأكثر طلباً' : 'POPULAR'}
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-gray-900 leading-snug">
                  {isAr ? visa.nameAr : visa.nameEn}
                </h3>

                <div className="flex items-baseline gap-2 mt-3">
                  <span className="text-3xl font-extrabold" style={{ color: visa.color }}>${visa.price}</span>
                  <span className="text-lg text-gray-400 line-through">${visa.originalPrice}</span>
                </div>

                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                    {isAr ? 'توفير' : 'Save'} ${visa.originalPrice - visa.price}
                  </span>
                </div>
              </div>

              {/* Features */}
              <div className="px-5 pb-3 space-y-2">
                {(isAr ? visa.featuresAr : visa.features).slice(0, 3).map((f, i) => (
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
                      <span>{isAr ? 'الصلاحية:' : 'Validity:'} {visa.validity}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock size={14} className="text-gray-400 shrink-0" />
                      <span>{isAr ? 'مدة البقاء:' : 'Stay:'} {visa.stayDuration}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Plane size={14} className="text-gray-400 shrink-0" />
                      <span>{isAr ? 'نوع الدخول:' : 'Entry:'} {isAr ? visa.entriesAr : visa.entries}</span>
                    </div>
                    {(isAr ? visa.featuresAr : visa.features).slice(3).map((f, i) => (
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
                    <>{isAr ? 'أقل' : 'Less'} <ChevronUp size={14} /></>
                  ) : (
                    <>{isAr ? 'المزيد من التفاصيل' : 'More details'} <ChevronDown size={14} /></>
                  )}
                </button>
              </div>

              {/* CTA */}
              <div className="px-5 pb-5 mt-auto">
                <button
                  onClick={() => handleWhatsApp(isAr ? visa.nameAr : visa.nameEn)}
                  className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-95 flex items-center justify-center gap-2"
                  style={{
                    background: `linear-gradient(135deg, ${visa.color}, ${visa.color}dd)`,
                    boxShadow: `0 4px 16px ${visa.color}40`,
                  }}
                >
                  <Phone size={16} />
                  {isAr ? 'احجز عبر واتساب' : 'Book via WhatsApp'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Requirements Section */}
      <div className="bg-white border-t border-gray-100 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            {isAr ? 'المستندات المطلوبة' : 'Required Documents'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { en: 'Passport copy (valid 6+ months)', ar: 'صورة جواز السفر (ساري 6+ شهور)', icon: FileText },
              { en: 'Personal photo (white background)', ar: 'صورة شخصية (خلفية بيضاء)', icon: FileText },
              { en: 'Flight reservation', ar: 'حجز طيران', icon: Plane },
              { en: 'Hotel booking', ar: 'حجز فندق', icon: Hotel },
              { en: 'Vaccination certificate (if required)', ar: 'شهادة تطعيم (إذا لزم)', icon: FileText },
              { en: 'National ID copy', ar: 'صورة البطاقة الشخصية', icon: FileText },
              { en: 'Bank statement (last 3 months)', ar: 'كشف حساب (آخر 3 شهور)', icon: FileText },
              { en: 'Sponsor letter (for visit visa)', ar: 'خطاب كفالة (تأشيرة زيارة)', icon: FileText },
            ].map((doc, i) => (
              <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div className="w-10 h-10 rounded-lg bg-[#166534]/10 flex items-center justify-center shrink-0">
                  <doc.icon size={18} className="text-[#166534]" />
                </div>
                <span className="text-sm font-medium text-gray-700">{isAr ? doc.ar : doc.en}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Banner */}
      <div className="py-16 px-4 text-center" style={{ background: 'linear-gradient(135deg, #1a472a 0%, #166534 50%, #14532d 100%)' }}>
        <h2 className="text-3xl font-bold text-white mb-4">
          {isAr ? 'جاهز لزيارة السعودية؟' : 'Ready to visit Saudi Arabia?'}
        </h2>
        <p className="text-white/80 max-w-lg mx-auto mb-8">
          {isAr
            ? 'تواصل معنا الآن عبر واتساب وسنبدأ في إجراءات تأشيرتك فوراً'
            : 'Contact us now via WhatsApp and we will start your visa process immediately'}
        </p>
        <a
          href="https://wa.me/971508107710"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-bold text-lg bg-white text-[#166534] hover:bg-gray-100 transition-all hover:-translate-y-1 hover:shadow-xl"
        >
          <Phone size={20} />
          {isAr ? 'تواصل عبر واتساب' : 'Contact via WhatsApp'}
        </a>
      </div>
    </div>
  );
}
