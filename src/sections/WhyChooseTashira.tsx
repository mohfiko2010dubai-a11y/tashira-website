import { useRef, useEffect } from 'react';
import { Shield, Clock, FileCheck, Headphones, Globe, Award, ChevronRight } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const features = [
  { icon: Shield, title: 'Licensed by Meydan FZ', titleAr: 'مرخصة من ميدان' },
  { icon: Clock, title: 'Fast Processing', titleAr: 'معالجة سريعة' },
  { icon: FileCheck, title: 'Expert Review', titleAr: 'مراجعة خبيرة' },
  { icon: Headphones, title: '24/7 Support', titleAr: 'دعم 24/7' },
  { icon: Globe, title: 'All Nationalities', titleAr: 'جميع الجنسيات' },
  { icon: Award, title: 'Best Price Guarantee', titleAr: 'ضمان أفضل سعر' },
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
          x: -40,
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
          stagger: 0.1,
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
      <div className="relative bg-[#1A2332]">
        {/* Background image overlay */}
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: 'url(/images/dubai-skyline.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1A2332] via-[#1A2332]/95 to-[#1A2332]/85" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">

            {/* LEFT: Title + Description + CTA */}
            <div ref={leftRef} className="lg:col-span-5">
              {/* Label */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-px bg-[#C9A04C]" />
                <span className="text-[10px] text-[#C9A04C] tracking-[0.25em] uppercase font-semibold">
                  {isAr ? 'لماذا نحن' : 'Why TASHIRA'}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-4">
                {isAr
                  ? 'شريكك الموثوق لتأشيرة الإمارات'
                  : 'Your Trusted Partner for UAE Visa'}
              </h2>

              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                {isAr
                  ? 'نحن شركة مرخصة من حكومة دبي نقدم خدمات تأشيرة إلكترونية سريعة وآمنة. فريقنا متخصص في مراجعة كل طلب بدقة لضمان أفضل نتيجة ممكنة.'
                  : 'A Dubai Government licensed company providing fast, secure electronic visa services. Our team specializes in reviewing every application with care to ensure the best possible outcome.'}
              </p>

              {/* CTA */}
              <a
                href="https://wa.me/971589896644"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#C9A04C] to-[#DDBB7A] text-white text-sm font-semibold rounded-lg hover:shadow-lg hover:shadow-[#C9A04C]/20 transition-all"
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
                    className="feature-item group flex items-center gap-4 p-4 rounded-xl bg-white/[0.04] border border-white/10 hover:border-[#C9A04C]/30 hover:bg-white/[0.06] transition-all duration-300"
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#C9A04C]/10 border border-[#C9A04C]/20 flex items-center justify-center group-hover:bg-[#C9A04C]/20 transition-colors">
                      <feature.icon size={18} className="text-[#C9A04C]" />
                    </div>

                    {/* Title */}
                    <p className="text-sm font-semibold text-white group-hover:text-[#C9A04C] transition-colors">
                      {isAr ? feature.titleAr : feature.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
