import { useTranslation } from 'react-i18next';
import VisaProductCards from '@/components/customer/VisaProductCards';

export default function RVisaTypes() {
  const { t } = useTranslation('home');

  return (
    <section className="py-20 lg:py-28 bg-[#FAFAF7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-sm font-bold tracking-[0.25em] text-[#C9A04C] mb-3">TASHIRA</p>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-[#0A1628]">{t('visaTypes.title')}</h2>
          <p className="mt-3 text-gray-500 max-w-xl mx-auto">{t('visaTypes.subtitle')}</p>
        </div>
        <VisaProductCards compact />
      </div>
    </section>
  );
}
