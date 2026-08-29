import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Shield, CheckCircle, Star, Headphones, ChevronDown, Rocket, Tag } from 'lucide-react';

const TRUST_ITEMS = [
  { icon: Shield, en: 'Licensed by Meydan FZ', ar: 'مرخصة من ميدان فري زون' },
  { icon: CheckCircle, en: '10,000+ Visas Issued', ar: '+10,000 تأشيرة صادرة' },
  { icon: Star, en: '98% Satisfaction', ar: '٩٨٪ رضا العملاء' },
  { icon: Headphones, en: '24/7 Support', ar: 'دعم ٢٤/٧' },
];

export default function RHero() {
  const { t, i18n } = useTranslation('home');
  const navigate = useNavigate();
  const isAr = i18n.language === 'ar';

  return (
    <section className="relative min-h-[92vh] flex flex-col justify-center overflow-hidden">
      {/* Background */}
      <img
        src="/images/dubai-skyline.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A1628]/85 via-[#0A1628]/70 to-[#0A1628]/90" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 text-center pt-28 pb-16">
        <p className="inline-flex items-center gap-2 text-[#DDBB7A] tracking-[0.25em] text-sm font-semibold mb-6">
          <img src="https://flagcdn.com/w40/ae.png" alt="UAE" className="w-5 h-auto rounded-sm" />
          {isAr ? 'بوابة التأشيرة الإلكترونية الإماراتية' : 'UAE E-VISA PORTAL'}
        </p>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight">
          {isAr ? 'احصل على تأشيرة الإمارات' : 'Get Your UAE Visa in'}
          <span className="block mt-2 bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] bg-clip-text text-transparent">
            {isAr ? 'بسرعة وسهولة وأمان' : '24–48 Hours'}
          </span>
        </h1>

        <p className="mt-6 text-lg text-gray-300 max-w-2xl mx-auto">
          {t('hero.subtitle')}
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => navigate('/apply')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 rounded-xl text-lg font-bold text-white bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] shadow-lg shadow-[#C9A04C]/30 hover:shadow-xl hover:shadow-[#C9A04C]/40 hover:-translate-y-0.5 transition-all"
          >
            <Rocket size={20} />
            {isAr ? 'ابدأ التقديم' : 'Start Application'}
          </button>
          <button
            onClick={() => navigate('/track')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 rounded-xl text-lg font-bold text-[#DDBB7A] border-2 border-[#C9A04C]/60 bg-white/5 backdrop-blur hover:bg-white/10 transition-all"
          >
            <Tag size={20} />
            {t('hero.ctaTrack')}
          </button>
        </div>

        {/* Trust bar */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {TRUST_ITEMS.map(({ icon: Icon, en, ar }) => (
            <span key={en} className="inline-flex items-center gap-2 text-sm text-gray-300">
              <Icon size={18} className="text-[#C9A04C]" />
              {isAr ? ar : en}
            </span>
          ))}
        </div>
      </div>

      <div className="relative z-10 pb-8 flex justify-center">
        <span className="text-gray-400 text-xs flex flex-col items-center gap-1 animate-bounce">
          <ChevronDown size={18} />
          {isAr ? 'مرر لاستكشاف خيارات التأشيرة' : 'Scroll to explore visa options'}
        </span>
      </div>
    </section>
  );
}
