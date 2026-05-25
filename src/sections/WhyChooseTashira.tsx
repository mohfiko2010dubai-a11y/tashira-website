import { useRef, useEffect } from 'react';
import { Shield, Clock, FileCheck, Headphones, Globe, Award } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    icon: Shield,
    title: 'Licensed & Regulated',
    titleAr: 'مرخصة ومنظمة',
    desc: 'Fully licensed by Meydan Free Zone, Dubai Government. Your data is protected with bank-level encryption.',
    descAr: 'مرخصة بالكامل من منطقة ميدان الحرة، حكومة دبي. بياناتك محمية بتشفير بنكي.',
  },
  {
    icon: Clock,
    title: 'Fast Processing',
    titleAr: 'معالجة سريعة',
    desc: 'Get your UAE visa in 3-4 days with regular processing, or 24-36 hours with express service.',
    descAr: 'احصل على تأشيرة الإمارات في 3-4 أيام بالمعالجة العادية، أو 24-36 ساعة بالسريع.',
  },
  {
    icon: FileCheck,
    title: '99% Approval Rate',
    titleAr: 'نسبة موافقة 99%',
    desc: 'Our expert team reviews every application thoroughly to ensure the highest approval rate possible.',
    descAr: 'فريق الخبراء لدينا يراجع كل طلب بدقة لضمان أعلى نسبة موافقة ممكنة.',
  },
  {
    icon: Headphones,
    title: '24/7 Live Support',
    titleAr: 'دعم مباشر 24/7',
    desc: 'Reach us anytime via phone, WhatsApp, or email. Our multilingual team is always ready to help.',
    descAr: 'تواصل معنا في أي وقت عبر الهاتف أو واتساب أو البريد. فريقنا متعدد اللغات جاهز دائماً.',
  },
  {
    icon: Globe,
    title: 'All Nationalities',
    titleAr: 'جميع الجنسيات',
    desc: 'We process visa applications for citizens of all countries worldwide, including GCC residents.',
    descAr: 'نعالج طلبات التأشيرة لمواطني جميع دول العالم، بما في ذلك مقيمي دول الخليج.',
  },
  {
    icon: Award,
    title: 'Best Price Guarantee',
    titleAr: 'ضمان أفضل سعر',
    desc: 'Competitive pricing with no hidden fees. Transparent costs from the start.',
    descAr: 'أسعار تنافسية بدون رسوم خفية. تكاليف شفافة من البداية.',
  },
];

export default function WhyChooseTashira() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (cardsRef.current) {
        const cards = cardsRef.current.querySelectorAll('.feature-card');
        gsap.from(cards, {
          opacity: 0,
          y: 40,
          stagger: 0.1,
          duration: 0.6,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: cardsRef.current,
            start: 'top 80%',
          },
        });
      }
    });
    return () => ctx.revert();
  }, []);

  const isAr = document.documentElement.lang === 'ar';

  return (
    <section ref={sectionRef} className="py-16 sm:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <p className="text-[10px] text-[#C9A04C] tracking-[0.25em] uppercase font-semibold mb-3">
            {isAr ? 'لماذا تاشيرا' : 'Why TASHIRA'}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
            {isAr ? 'لماذا تختار تاشيرا لتأشيرة الإمارات؟' : 'Why Choose TASHIRA for Your UAE Visa?'}
          </h2>
          <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-[#C9A04C] to-transparent mx-auto" />
        </div>

        {/* Feature Cards Grid */}
        <div ref={cardsRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="feature-card group relative bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100 p-6 hover:border-[#C9A04C]/30 hover:shadow-lg hover:shadow-[#C9A04C]/5 transition-all duration-300"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#C9A04C]/10 to-[#C9A04C]/5 border border-[#C9A04C]/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <feature.icon size={22} className="text-[#C9A04C]" />
              </div>

              {/* Title */}
              <h3 className="text-base font-semibold text-gray-900 mb-2">
                {isAr ? feature.titleAr : feature.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-gray-500 leading-relaxed">
                {isAr ? feature.descAr : feature.desc}
              </p>

              {/* Hover accent line */}
              <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-[#C9A04C] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
