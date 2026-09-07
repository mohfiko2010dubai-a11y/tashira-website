import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import VisaProductCards from '@/components/customer/VisaProductCards';

export default function Pricing() {
  const { t } = useTranslation('pricing');

  return (
    <>
      <Helmet>
        <title>UAE Visa Prices 2026 | Dubai Visa Cost | Tashira</title>
        <meta name="description" content="Check UAE visa prices 2026. Tourist visa, transit visa, GCC resident visa pricing. Regular & express processing. Transparent pricing, no hidden fees." />
        <link rel="canonical" href="https://tashiraev.com/visa-prices" />
        <meta property="og:title" content="UAE Visa Prices 2026 | Dubai Visa Cost | Tashira" />
        <meta property="og:description" content="Check UAE visa prices. Tourist, transit, GCC resident visas. Transparent pricing." />
        <meta property="og:url" content="https://tashiraev.com/visa-prices" />
      </Helmet>
      <div className="min-h-screen">
        <div
          className="pt-32 pb-12 px-4 text-center"
          style={{ background: 'linear-gradient(180deg, #FAFAF7, #F0EDE8)' }}
        >
          <h1 className="text-3xl sm:text-4xl font-bold text-[#1A2332]">{t('title')}</h1>
          <p className="text-gray-500 mt-3">{t('subtitle')}</p>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <VisaProductCards />
        </div>
      </div>
    </>
  );
}
