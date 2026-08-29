import { useTranslation } from 'react-i18next';

const STATS = [
  { value: '10,000+', key: 'hero.stats.applications', ar: 'طلب تمت معالجته' },
  { value: '24–48h', key: 'hero.stats.hours', ar: 'متوسط زمن المعالجة' },
  { value: '150+', key: 'hero.stats.countries', ar: 'جنسية نخدمها' },
  { value: '4.9★', key: 'hero.stats.rating', ar: 'تقييم العملاء' },
];

export default function RStats() {
  const { t, i18n } = useTranslation('home');
  const isAr = i18n.language === 'ar';
  return (
    <section className="bg-[#0A1628] border-y border-[#C9A04C]/20">
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-2 lg:grid-cols-4 gap-8">
        {STATS.map((s) => (
          <div key={s.key} className="text-center">
            <p className="text-3xl lg:text-4xl font-extrabold bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] bg-clip-text text-transparent">
              {s.value}
            </p>
            <p className="mt-2 text-sm text-gray-400">{isAr ? s.ar : t(s.key)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
