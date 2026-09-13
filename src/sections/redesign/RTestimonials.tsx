import { publishedTestimonials, type Testimonial } from "@/data/testimonials";
import { useTranslation } from 'react-i18next';
import { Star, Quote } from 'lucide-react';

export default function RTestimonials({ records }: { records?: readonly Testimonial[] }) {
  const { t, i18n } = useTranslation('home');
  const reviews = publishedTestimonials(records);
  if (reviews.length === 0) return null;
  return (
    <section className="py-20 lg:py-28 bg-[#FAFAF7]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-sm font-bold tracking-[0.25em] text-[#C9A04C] mb-3">TASHIRA</p>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-[#0A1628]">{t('testimonials.title')}</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {reviews.map((r) => (
            <figure key={r.id} className="rounded-2xl bg-white p-8 border border-gray-100 shadow-sm hover:shadow-lg transition-shadow">
              <Quote size={28} className="text-[#C9A04C]/40 mb-4" />
              {r.rating !== undefined && <div className="flex gap-1 mb-4" aria-label={t("testimonials.rating", { rating: r.rating })}>
                {Array.from({ length: r.rating }).map((_, i) => (
                  <Star key={i} size={16} aria-hidden="true" className="fill-[#C9A04C] text-[#C9A04C]" />
                ))}
              </div>}
              <blockquote className="text-gray-600 leading-relaxed text-sm">“{i18n.language.startsWith('ar') && r.textAr ? r.textAr : r.textEn}”</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <span className="w-11 h-11 rounded-full bg-gradient-to-br from-[#0A1628] to-[#16213E] text-[#DDBB7A] font-bold flex items-center justify-center text-sm">
                  {r.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('')}
                </span>
                <span>
                  <span className="block font-bold text-[#0A1628] text-sm">{r.name}</span>
                  <span className="block text-xs text-gray-400">{r.country}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
