import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { countriesRequiringVisa } from '@/data/countries';

const regions = [
  { key: 'africa' as const, label: 'Africa', labelAr: 'أفريقيا' },
  { key: 'asia' as const, label: 'Asia', labelAr: 'آسيا' },
  { key: 'europeAmericas' as const, label: 'Europe & Americas', labelAr: 'أوروبا والأمريكتين' },
];

export default function CountriesSection() {
  const { i18n } = useTranslation('home');
  const isAr = i18n.language === 'ar';
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);

  const toggleRegion = (key: string) => {
    setExpandedRegion(expandedRegion === key ? null : key);
  };

  return (
    <section className="py-16 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 text-center mb-2">
          {isAr
            ? 'هل أحتاج إلى تأشيرة لزيارة الإمارات؟'
            : 'Do I need a visa to visit the UAE?'}
        </h2>
        <p className="text-sm text-gray-500 text-center mb-2">
          {isAr
            ? 'مواطنو الدول التالية يجب عليهم التقدم بطلب تأشيرة دبي مسبقاً.'
            : 'Citizens of the following countries must apply for a Dubai visa in advance.'}
        </p>
        <p className="text-xs text-gray-400 text-center mb-8">
          {isAr
            ? 'إذا كنت لا تتأهل لتأشيرة عند الوصول، فيجب عليك التقدم بطلب للحصول على تأشيرة قبل السفر.'
            : 'If you do not qualify for a visa on arrival, you must apply for a visa before traveling.'}
        </p>

        <div className="space-y-2">
          {regions.map((region) => {
            const countries = countriesRequiringVisa[region.key];
            const isExpanded = expandedRegion === region.key;

            return (
              <div key={region.key} className="bg-gray-50 rounded-lg border border-gray-100 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleRegion(region.key)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-100 transition-colors"
                >
                  <span className="text-sm font-semibold text-gray-800">
                    {isAr ? region.labelAr : region.label}
                  </span>
                  <ChevronDown
                    size={18}
                    className={`text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {isExpanded && (
                  <div className="px-5 pb-4">
                    <div className="border-t border-gray-100 pt-4 flex flex-wrap gap-2">
                      {countries.map((country) => (
                        <span
                          key={country.code}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-full text-sm text-gray-600 hover:border-[#C9A04C] hover:text-[#C9A04C] transition-colors"
                        >
                          <img
                            src={`https://flagcdn.com/24x18/${country.code.toLowerCase()}.png`}
                            alt={country.name}
                            className="w-4 h-3 rounded-sm"
                            loading="lazy"
                          />
                          {isAr ? country.nameAr : country.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
