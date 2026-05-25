import { useRef, useEffect } from 'react';
import { Shield, Clock, FileCheck, Headphones, Globe, Award, ChevronRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const features = [
  { icon: Shield, title: 'Licensed by Meydan FZ', titleAr: 'مرخصة من ميدان', stat: 'Gov' },
  { icon: Clock, title: '3-4 Days Processing', titleAr: 'معالجة 3-4 أيام', stat: 'Fast' },
  { icon: FileCheck, title: '99% Approval Rate', titleAr: '99% نسبة موافقة', stat: 'High' },
  { icon: Headphones, title: '24/7 Live Support', titleAr: 'دعم 24/7', stat: 'Now' },
  { icon: Globe, title: 'All Nationalities', titleAr: 'جميع الجنسيات', stat: 'All' },
  { icon: Award, title: 'Best Price Guarantee', titleAr: 'ضمان أفضل سعر', stat: '$' },
];

export default function WhyChooseTashira() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (leftRef.current) {
        gsap.from(leftRef.current, {
          opacity: 0,
          x: -60,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
        });
      }
      if (cardsRef.current) {
        const cards = cardsRef.current.querySelectorAll('.feature-item');
        gsap.from(cards, {
          opacity: 0,
          y: 30,
          stagger: 0.12,
          duration: 0.5,
          ease: 'power3.out',
          scrollTrigger: { trigger: cardsRef.current, start: 'top 80%' },
        });
      }
    });
    return () => ctx.revert();
  }, []);

  const isAr = document.documentElement.lang === 'ar';

  return (
    <section ref={sectionRef} className="relative overflow-hidden">
      {/* Dark background with image */}
      <div className="relative bg-[#1A2332]">
        {/* Background image overlay */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'url(/images/dubai-skyline.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1A2332] via-[#1A2332]/95 to-[#1A2332]/80" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">

            {/* LEFT: Title + CTA */}
            <div ref={leftRef} className="lg:col-span-5">
              {/* Small label */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-px bg-[#C9A04C]" />
                <span className="text-[10px] text-[#C9A04C] tracking-[0.25em] uppercase font-semibold">
                  {isAr ? 'لماذا نحن' : 'Why TASHIRA'}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight mb-4">
                {isAr
                  ? 'نحن شريكك الموثوق لتأشيرة الإمارات'
                  : 'Your Trusted Partner for UAE Visa'}
              </h2>

              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                {isAr
                  ? 'شركة مرخصة من حكومة دبي، نقدم خدمات تأشيرة إلكترونية سريعة وآمنة لجميع الجنسيات.'
                  : 'A Dubai Government licensed company providing fast, secure electronic visa services for all nationalities. Apply with confidence.'}
              </p>

              {/* Stats row */}
              <div className="flex gap-6 mb-6">
                <div>
                  <p className="text-3xl font-bold text-[#C9A04C]">50K+</p>
                  <p className="text-xs text-gray-500">{isAr ? 'طلب منجز' : 'Visas Processed'}</p>
                </div>
                <div className="w-px bg-white/10" />
                <div>
                  <p className="text-3xl font-bold text-[#C9A04C]">99%</p>
                  <p className="text-xs text-gray-500">{isAr ? 'نسبة موافقة' : 'Approval Rate'}</p>
                </div>
                <div className="w-px bg-white/10" />
                <div>
                  <p className="text-3xl font-bold text-[#C9A04C]">4.9</p>
                  <p className="text-xs text-gray-500">{isAr ? 'تقييم العملاء' : 'Customer Rating'}</p>
                </div>
              </div>

              {/* CTA */}
              <a
                href="https://wa.me/971589896644"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] text-white text-sm font-semibold rounded-lg hover:shadow-lg hover:shadow-[#C9A04C]/20 transition-all"
              >
                {isAr ? 'تحدث معنا على واتساب' : 'Chat on WhatsApp'}
                <ChevronRight size={14} />
              </a>
            </div>

            {/* RIGHT: Feature list */}
            <div ref={cardsRef} className="lg:col-span-7">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {features.map((feature, idx) => (
                  <div
                    key={idx}
                    className="feature-item group flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-[#C9A04C]/30 hover:bg-white/[0.06] transition-all duration-300"
                  >
                    {/* Icon circle */}
                    <div className="relative flex-shrink-0 w-11 h-11 rounded-lg bg-[#C9A04C]/10 border border-[#C9A04C]/20 flex items-center justify-center group-hover:bg-[#C9A04C]/20 transition-colors">
                      <feature.icon size={18} className="text-[#C9A04C]" />
                      {/* Small stat badge */}
                      <span className="absolute -top-1.5 -right-1.5 bg-[#C9A04C] text-white text-[8px] font-bold px-1 py-0.5 rounded">
                        {feature.stat}
                      </span>
                    </div>

                    {/* Text */}
                    <div>
                      <p className="text-sm font-semibold text-white group-hover:text-[#C9A04C] transition-colors">
                        {isAr ? feature.titleAr : feature.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Trust badges row */}
              <div className="mt-6 flex items-center gap-4 px-4">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-full border-2 border-[#1A2332] bg-gradient-to-br from-[#C9A04C]/30 to-[#C9A04C]/10 flex items-center justify-center"
                    >
                      <span className="text-[8px] text-white font-bold">{String.fromCharCode(64 + i)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  <span className="text-[#C9A04C] font-semibold">2,400+</span> {isAr ? 'عميل سعيد هذا الشهر' : 'happy customers this month'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
