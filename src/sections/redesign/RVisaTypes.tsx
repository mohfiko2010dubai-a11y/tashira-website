import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Clock, Calendar, Repeat, Check } from 'lucide-react';

interface VisaCard {
  nameKey: string;
  price: string;
  validityEn: string;
  validityAr: string;
  entryEn: string;
  entryAr: string;
  popular?: boolean;
}

const CARDS: VisaCard[] = [
  { nameKey: 'visaTypes.tourist14', price: '$165', validityEn: 'Valid 60 days', validityAr: 'صالحة ٦٠ يومًا', entryEn: 'Single entry', entryAr: 'دخول واحد' },
  { nameKey: 'visaTypes.tourist30', price: '$185', validityEn: 'Valid 60 days', validityAr: 'صالحة ٦٠ يومًا', entryEn: 'Single entry', entryAr: 'دخول واحد', popular: true },
  { nameKey: 'visaTypes.tourist60', price: '$295', validityEn: 'Valid 60 days', validityAr: 'صالحة ٦٠ يومًا', entryEn: 'Single entry', entryAr: 'دخول واحد' },
  { nameKey: 'visaTypes.transit96', price: '$145', validityEn: 'Valid 30 days', validityAr: 'صالحة ٣٠ يومًا', entryEn: 'Single entry', entryAr: 'دخول واحد' },
];

export default function RVisaTypes() {
  const { t, i18n } = useTranslation('home');
  const navigate = useNavigate();
  const isAr = i18n.language === 'ar';

  return (
    <section className="py-20 lg:py-28 bg-[#FAFAF7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-sm font-bold tracking-[0.25em] text-[#C9A04C] mb-3">TASHIRA</p>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-[#0A1628]">{t('visaTypes.title')}</h2>
          <p className="mt-3 text-gray-500 max-w-xl mx-auto">{t('visaTypes.subtitle')}</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {CARDS.map((card) => (
            <div
              key={card.nameKey}
              className={`relative rounded-2xl bg-white p-6 lg:p-8 border-2 transition-all hover:-translate-y-1 hover:shadow-xl ${
                card.popular ? 'border-[#C9A04C] shadow-lg shadow-[#C9A04C]/10' : 'border-gray-100'
              }`}
            >
              {card.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A]">
                  {isAr ? 'الأكثر طلبًا' : 'MOST POPULAR'}
                </span>
              )}
              <h3 className="text-lg font-bold text-[#0A1628]">{t(card.nameKey)}</h3>
              <p className="mt-4">
                <span className="text-4xl font-extrabold text-[#C9A04C]">{card.price}</span>
                <span className="text-sm text-gray-400"> / {isAr ? 'للشخص' : 'person'}</span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-gray-600">
                <li className="flex items-center gap-2"><Clock size={15} className="text-[#C9A04C]" /> 3–4 {isAr ? 'أيام عمل' : 'working days'}</li>
                <li className="flex items-center gap-2"><Calendar size={15} className="text-[#C9A04C]" /> {isAr ? card.validityAr : card.validityEn}</li>
                <li className="flex items-center gap-2"><Repeat size={15} className="text-[#C9A04C]" /> {isAr ? card.entryAr : card.entryEn}</li>
                <li className="flex items-center gap-2"><Check size={15} className="text-emerald-500" /> {isAr ? 'شامل الرسوم الحكومية' : 'Government fees included'}</li>
              </ul>
              <button
                onClick={() => navigate('/apply')}
                className={`mt-8 w-full py-3 rounded-xl font-bold transition-all ${
                  card.popular
                    ? 'text-white bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] hover:shadow-lg hover:shadow-[#C9A04C]/30'
                    : 'text-[#C9A04C] border-2 border-[#C9A04C]/40 hover:bg-[#C9A04C]/5'
                }`}
              >
                {isAr ? 'قدّم الآن' : 'Apply Now'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
