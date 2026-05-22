import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Calendar, Star, ArrowRight, Plane, Hotel, Utensils, Camera } from 'lucide-react';

interface Destination {
  id: string;
  countryEn: string;
  countryAr: string;
  cityEn: string;
  cityAr: string;
  image: string;
  duration: string;
  durationAr: string;
  price: number;
  originalPrice: number;
  rating: number;
  highlights: string[];
  highlightsAr: string[];
  tag?: string;
  tagAr?: string;
}

const destinations: Destination[] = [
  {
    id: 'thailand',
    countryEn: 'Thailand',
    countryAr: 'تايلاند',
    cityEn: 'Bangkok & Phuket',
    cityAr: 'بانكوك وبوكيت',
    image: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=600&h=400&fit=crop',
    duration: '7 Days / 6 Nights',
    durationAr: '7 أيام / 6 ليالٍ',
    price: 899,
    originalPrice: 1199,
    rating: 4.8,
    highlights: ['Temples Tour', 'Island Hopping', 'Thai Massage', 'Floating Market'],
    highlightsAr: ['جولة المعابد', 'جزر بوكيت', 'مساج تايلاندي', 'السوق العائم'],
    tag: 'Best Seller',
    tagAr: 'الأكثر مبيعاً',
  },
  {
    id: 'malaysia',
    countryEn: 'Malaysia',
    countryAr: 'ماليزيا',
    cityEn: 'Kuala Lumpur & Langkawi',
    cityAr: 'كوالالمبور ولنكاوي',
    image: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=600&h=400&fit=crop',
    duration: '6 Days / 5 Nights',
    durationAr: '6 أيام / 5 ليالٍ',
    price: 749,
    originalPrice: 999,
    rating: 4.7,
    highlights: ['Petronas Towers', 'Langkawi Beach', 'Street Food Tour', 'Batu Caves'],
    highlightsAr: ['أبراج بتروناس', 'شاطئ لنكاوي', 'جولة الطعام', 'كهوف باتو'],
    tag: 'Summer Deal',
    tagAr: 'عرض الصيف',
  },
  {
    id: 'japan',
    countryEn: 'Japan',
    countryAr: 'اليابان',
    cityEn: 'Tokyo & Kyoto & Osaka',
    cityAr: 'طوكيو وكيوتو وأوساكا',
    image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&h=400&fit=crop',
    duration: '10 Days / 9 Nights',
    durationAr: '10 أيام / 9 ليالٍ',
    price: 1899,
    originalPrice: 2399,
    rating: 4.9,
    highlights: ['Mount Fuji', 'Shibuya Crossing', 'Fushimi Inari', 'Bullet Train'],
    highlightsAr: ['جبل فوجي', 'شيبويا', 'معبد فوشيمي', 'القطار السريع'],
    tag: 'Premium',
    tagAr: 'متميز',
  },
  {
    id: 'italy',
    countryEn: 'Italy',
    countryAr: 'إيطاليا',
    cityEn: 'Rome & Venice & Milan',
    cityAr: 'روما والبندقية وميلانو',
    image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600&h=400&fit=crop',
    duration: '8 Days / 7 Nights',
    durationAr: '8 أيام / 7 ليالٍ',
    price: 1299,
    originalPrice: 1699,
    rating: 4.8,
    highlights: ['Colosseum', 'Venice Canals', 'Vatican City', 'Gondola Ride'],
    highlightsAr: ['الكولوسيوم', 'قنوات البندقية', 'الفاتيكان', 'ركوب الجندولة'],
    tag: 'Popular',
    tagAr: 'شائع',
  },
  {
    id: 'france',
    countryEn: 'France',
    countryAr: 'فرنسا',
    cityEn: 'Paris & Nice',
    cityAr: 'باريس ونيس',
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&h=400&fit=crop',
    duration: '7 Days / 6 Nights',
    durationAr: '7 أيام / 6 ليالٍ',
    price: 1199,
    originalPrice: 1549,
    rating: 4.9,
    highlights: ['Eiffel Tower', 'Louvre Museum', 'French Riviera', 'Champs-Élysées'],
    highlightsAr: ['برج إيفل', 'متحف اللوفر', 'الريفييرا', 'الشانزليزيه'],
    tag: 'Romantic',
    tagAr: 'رومانسي',
  },
  {
    id: 'spain',
    countryEn: 'Spain',
    countryAr: 'إسبانيا',
    cityEn: 'Barcelona & Madrid',
    cityAr: 'برشلونة ومدريد',
    image: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=600&h=400&fit=crop',
    duration: '7 Days / 6 Nights',
    durationAr: '7 أيام / 6 ليالٍ',
    price: 999,
    originalPrice: 1349,
    rating: 4.7,
    highlights: ['Sagrada Familia', 'Flamenco Show', 'Park Güell', 'La Rambla'],
    highlightsAr: ['ساجرادا فاميليا', 'رقص الفلامنكو', 'حديقة غويل', 'لارامبلا'],
    tag: 'Summer Deal',
    tagAr: 'عرض الصيف',
  },
  {
    id: 'turkey',
    countryEn: 'Turkey',
    countryAr: 'تركيا',
    cityEn: 'Istanbul & Cappadocia',
    cityAr: 'اسطنبول وكابادوكيا',
    image: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=600&h=400&fit=crop',
    duration: '6 Days / 5 Nights',
    durationAr: '6 أيام / 5 ليالٍ',
    price: 649,
    originalPrice: 899,
    rating: 4.6,
    highlights: ['Hagia Sophia', 'Hot Air Balloon', 'Grand Bazaar', 'Bosphorus Cruise'],
    highlightsAr: ['آيا صوفيا', 'منطاد كابادوكيا', 'السوق الكبير', 'جولة البوسفور'],
    tag: 'Best Value',
    tagAr: 'أفضل قيمة',
  },
];

const features = [
  { icon: Plane, labelEn: 'Flight Tickets', labelAr: 'تذاكر الطيران' },
  { icon: Hotel, labelEn: '5-Star Hotels', labelAr: 'فنادق 5 نجوم' },
  { icon: Utensils, labelEn: 'Daily Breakfast', labelAr: 'إفطار يومي' },
  { icon: Camera, labelEn: 'Guided Tours', labelAr: 'جولات مرشدة' },
];

export default function TravelDeals() {
  const { i18n } = useTranslation('home');
  const isAr = i18n.language === 'ar';
  const [selectedDest, setSelectedDest] = useState<string | null>(null);
  const dest = destinations.find((d) => d.id === selectedDest);

  const handleBooking = (destination: Destination) => {
    const message = isAr
      ? `مرحباً، أود الاستفسار عن باقة ${destination.countryAr} - ${destination.cityAr} لمدة ${destination.durationAr} بسعر $${destination.price}`
      : `Hello, I would like to inquire about the ${destination.countryEn} package - ${destination.cityEn} for ${destination.duration} at $${destination.price}`;
    const whatsappUrl = `https://wa.me/971508107710?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (selectedDest && dest) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        {/* Destination Detail Hero */}
        <div className="relative h-[50vh] min-h-[400px]">
          <img src={dest.image} alt={isAr ? dest.countryAr : dest.countryEn} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
            <div className="max-w-6xl mx-auto">
              <button
                onClick={() => setSelectedDest(null)}
                className="mb-4 text-white/80 hover:text-white text-sm font-medium flex items-center gap-1 transition-colors"
              >
                <ArrowRight size={16} className={`${isAr ? '' : 'rotate-180'}`} />
                {isAr ? '← العودة للعروض' : '← Back to Deals'}
              </button>
              {dest.tag && (
                <span className="inline-block px-3 py-1 bg-[#C9A04C] text-white text-xs font-bold rounded-full mb-3">
                  {isAr ? dest.tagAr : dest.tag}
                </span>
              )}
              <h1 className="text-4xl sm:text-5xl font-bold text-white">
                {isAr ? dest.countryAr : dest.countryEn}
              </h1>
              <p className="text-white/80 text-lg mt-2">{isAr ? dest.cityAr : dest.cityEn}</p>
              <div className="flex items-center gap-4 mt-4 text-white/80 text-sm">
                <span className="flex items-center gap-1"><Calendar size={14} /> {isAr ? dest.durationAr : dest.duration}</span>
                <span className="flex items-center gap-1"><Star size={14} className="text-yellow-400 fill-yellow-400" /> {dest.rating}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detail Content */}
        <div className="max-w-4xl mx-auto px-4 py-10">
          {/* Price */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6 text-center">
            <p className="text-sm text-gray-500 mb-1">{isAr ? 'السعر للشخص الواحد' : 'Price per person'}</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl text-gray-400 line-through">${dest.originalPrice}</span>
              <span className="text-4xl font-extrabold text-[#C9A04C]">${dest.price}</span>
            </div>
            <p className="text-sm text-emerald-600 font-medium mt-1">
              {isAr ? `توفير $${dest.originalPrice - dest.price}` : `Save $${dest.originalPrice - dest.price}`}
            </p>
          </div>

          {/* What's Included */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{isAr ? 'الباقة تشمل:' : 'Package Includes:'}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {features.map((f) => (
                <div key={f.labelEn} className="text-center p-3 rounded-xl bg-gray-50">
                  <f.icon size={24} className="mx-auto text-[#C9A04C] mb-2" />
                  <p className="text-xs font-medium text-gray-700">{isAr ? f.labelAr : f.labelEn}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Highlights */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{isAr ? 'أبرز المعالم:' : 'Highlights:'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(isAr ? dest.highlightsAr : dest.highlights).map((h, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  <Camera size={16} className="text-[#C9A04C] shrink-0" />
                  <span className="text-sm text-gray-700">{h}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <button
              onClick={() => handleBooking(dest)}
              className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-bold text-white text-lg bg-gradient-to-br from-[#C9A04C] to-[#DDBB7A] shadow-[0_4px_16px_rgba(201,160,76,0.3)] hover:-translate-y-1 hover:shadow-xl transition-all"
            >
              <Plane size={20} />
              {isAr ? 'احجز الآن عبر واتساب' : 'Book Now via WhatsApp'}
            </button>
            <p className="text-sm text-gray-500 mt-3">{isAr ? 'سيتم توجيهك لواتساب للحجز والاستفسار' : 'You will be redirected to WhatsApp for booking'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      {/* Hero */}
      <div className="pt-16 pb-12 px-4 text-center" style={{ background: 'linear-gradient(180deg, #FAFAF7, #F0EDE8)' }}>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#C9A04C]/10 text-[#C9A04C] rounded-full text-sm font-medium mb-4">
          <Plane size={16} />
          {isAr ? 'رحلات سياحية مميزة' : 'Exclusive Travel Packages'}
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-[#1A2332]">
          {isAr ? 'عروض السفر الصيفية' : 'Summer Travel Deals'}
        </h1>
        <p className="text-gray-500 mt-4 max-w-2xl mx-auto text-lg">
          {isAr
            ? 'اكتشف أجمل الوجهات السياحية بأسعار حصرية. الباقات تشمل تذاكر الطيران، الفنادق، والجولات السياحية.'
            : 'Discover the most beautiful destinations at exclusive prices. Packages include flights, hotels, and guided tours.'}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-gray-500">
          {features.map((f) => (
            <span key={f.labelEn} className="flex items-center gap-1.5">
              <f.icon size={16} className="text-[#C9A04C]" />
              {isAr ? f.labelAr : f.labelEn}
            </span>
          ))}
        </div>
      </div>

      {/* Destinations Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {destinations.map((d) => (
            <div
              key={d.id}
              onClick={() => setSelectedDest(d.id)}
              className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300 cursor-pointer border border-gray-100"
            >
              {/* Image */}
              <div className="relative h-48 overflow-hidden">
                <img
                  src={d.image}
                  alt={isAr ? d.countryAr : d.countryEn}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                {d.tag && (
                  <span className="absolute top-3 left-3 px-2.5 py-1 bg-[#C9A04C] text-white text-[10px] font-bold rounded-full uppercase tracking-wide">
                    {isAr ? d.tagAr : d.tag}
                  </span>
                )}
                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="text-xl font-bold text-white">{isAr ? d.countryAr : d.countryEn}</h3>
                  <p className="text-white/80 text-xs">{isAr ? d.cityAr : d.cityEn}</p>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Calendar size={12} />
                    {isAr ? d.durationAr : d.duration}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-yellow-500">
                    <Star size={12} className="fill-yellow-500" />
                    {d.rating}
                  </span>
                </div>

                {/* Highlights */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {(isAr ? d.highlightsAr : d.highlights).slice(0, 3).map((h, i) => (
                    <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-md">{h}</span>
                  ))}
                </div>

                {/* Price */}
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-sm text-gray-400 line-through">${d.originalPrice}</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-extrabold text-[#C9A04C]">${d.price}</span>
                      <span className="text-xs text-gray-400">/{isAr ? 'شخص' : 'person'}</span>
                    </div>
                  </div>
                  <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-full">
                    -{Math.round((1 - d.price / d.originalPrice) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="text-center py-12 bg-white border-t border-gray-100">
        <p className="text-gray-500 mb-4">
          {isAr ? 'عايز عرض مخصص لدولة معينة؟ تواصل معنا!' : 'Want a custom package for a specific destination? Contact us!'}
        </p>
        <a
          href="https://wa.me/971508107710"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/25"
        >
          {isAr ? 'تواصل عبر واتساب' : 'Contact via WhatsApp'}
        </a>
      </div>
    </div>
  );
}
