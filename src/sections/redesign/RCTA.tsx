import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Rocket } from 'lucide-react';

export default function RCTA() {
  const { t, i18n } = useTranslation('home');
  const navigate = useNavigate();
  const isAr = i18n.language === 'ar';

  return (
    <section className="relative py-20 overflow-hidden">
      <img src="/images/dubai-fountain.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0A1628]/95 to-[#0A1628]/80" />
      <div className="relative max-w-4xl mx-auto px-4 text-center">
        <h2 className="text-3xl lg:text-5xl font-extrabold text-white">{t('ctaSection.title')}</h2>
        <p className="mt-4 text-lg text-gray-300">{t('ctaSection.subtitle')}</p>
        <button
          onClick={() => navigate('/apply')}
          className="mt-10 inline-flex items-center gap-2 px-12 py-4 rounded-xl text-lg font-bold text-white bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] shadow-lg shadow-[#C9A04C]/30 hover:-translate-y-0.5 hover:shadow-xl transition-all"
        >
          <Rocket size={20} />
          {isAr ? 'ابدأ التقديم الآن' : 'Start Your Application'}
        </button>
      </div>
    </section>
  );
}
